import { describe, it, expect } from 'vitest';
import {
  UUID_RE, toAdminOrder, toMgrOrder, toCustomerOrder, CUST_STATUS, SERVICE_KEY, aggregateProjectTags,
  type OrderRow, type MyOrderRow, type ProjectTagInput,
} from './orderMap';

const baseRow: OrderRow = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'AUD-1001',
  service: 'Audit',
  pkg: 'Standard',
  state: 'in_progress',
  priority: 'high',
  source: 'quick',
  value: '39.00',
  deadline: '2026-06-26T00:00:00+00:00',
  created_at: '2026-06-24T10:00:00+00:00',
  customers: { id: 'c0000000-0000-4000-8000-000000000001', name: 'Jane Doe', company: 'Acme Co' },
  assignee: { name: 'Mai T.' },
};

describe('toAdminOrder', () => {
  it('maps a full row to AdminOrder (value→number, dates→YYYY-MM-DD, company preferred)', () => {
    const o = toAdminOrder(baseRow);
    expect(o).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      code: 'AUD-1001',
      customer: 'Acme Co',
      // carried so callers can join customer facts by id instead of by company NAME — matching on the
      // name silently pulled a mock customer's tier/LTV onto a real order (see 5544d9f).
      customerId: 'c0000000-0000-4000-8000-000000000001',
      service: 'Audit',
      pkg: 'Standard',
      status: 'in_progress',
      priority: 'high',
      source: 'quick',
      value: 39,
      staff: 'Mai T.',
      deadline: '2026-06-26',
      created: '2026-06-24',
    });
  });

  it('falls back: company→name→"—", pkg→"—", staff→null, deadline→null', () => {
    const o = toAdminOrder({
      ...baseRow, pkg: null, deadline: null,
      customers: { id: 'c0000000-0000-4000-8000-000000000009', name: 'Solo', company: null }, assignee: null,
    });
    expect(o.customer).toBe('Solo');
    expect(o.pkg).toBe('—');
    expect(o.staff).toBeNull();
    expect(o.deadline).toBeNull();
  });

  it('customer "—" when no customer row at all', () => {
    expect(toAdminOrder({ ...baseRow, customers: null }).customer).toBe('—');
  });

  it('coerces numeric strings and numbers alike', () => {
    expect(toAdminOrder({ ...baseRow, value: 104 }).value).toBe(104);
    expect(toAdminOrder({ ...baseRow, value: '104.50' }).value).toBe(104.5);
  });
});

describe('toMgrOrder (money-blind)', () => {
  // orders_mgr exposes the customer as flat columns (customer_id/_name/_company), not an embed — the
  // view is the money-blind gate, so it hands back its own shape. Build a row that matches it.
  const mgrRow = (() => {
    const { value, customers, ...rest } = baseRow;
    return {
      ...rest,
      customer_id: customers?.id ?? null,
      customer_name: customers?.name ?? null,
      customer_company: customers?.company ?? null,
    };
  })();

  it('forces value to 0 (the orders_mgr view omits it)', () => {
    expect(toMgrOrder(mgrRow).value).toBe(0);
  });
  it('keeps all non-money fields', () => {
    const o = toMgrOrder(mgrRow);
    expect(o.code).toBe('AUD-1001');
    expect(o.staff).toBe('Mai T.');
    expect(o.status).toBe('in_progress');
  });
});

describe('CUST_STATUS — DB state → customer 4-state', () => {
  it.each([
    ['new', 'planned'], ['confirmed', 'planned'], ['assigned', 'planned'],
    ['in_progress', 'progress'], ['changes_requested', 'progress'],
    ['internal_review', 'review'], ['delivered', 'completed'],
    ['approved', 'completed'], ['completed', 'completed'],
  ])('%s → %s', (state, expected) => {
    expect(CUST_STATUS[state]).toBe(expected);
  });
  it('has no mapping for canceled (excluded from the board)', () => {
    expect(CUST_STATUS['canceled']).toBeUndefined();
  });
});

describe('SERVICE_KEY — DB service label → ServiceKey', () => {
  it('maps every known service', () => {
    expect(SERVICE_KEY).toMatchObject({
      Audit: 'audit', Content: 'content', Keyword: 'keyword', Backlink: 'backlink',
      Optimization: 'optimize', 'Web Design': 'design', Indexer: 'indexer',
    });
  });
});

const myRow: MyOrderRow = {
  code: 'KW-1013', service: 'Keyword', pkg: 'Standard', state: 'completed',
  priority: 'med', value: 39, deadline: '2026-06-19T00:00:00+00:00',
  created_at: '2026-06-13T00:00:00+00:00', delivered_at: null,
  customers: { company: 'Acme Co', name: 'Jane Doe' }, assignee: { name: 'Mai T.' },
  order_details: null,
};

describe('toCustomerOrder (derive)', () => {
  it('derives the customer Order model from a DB row', () => {
    const o = toCustomerOrder(myRow);
    expect(o.id).toBe('KW-1013');
    expect(o.service).toBe('keyword');
    expect(o.status).toBe('completed');
    expect(o.cost).toBe(39);
    expect(o.owner).toBe('Mai T.');
    expect(o.domain).toBe('My site'); // no project domain and no site URL — and NEVER the company name
    expect(o.sub).toBe('Standard');
    expect(o.progress).toBeNull();
    expect(o.invoice).toBeNull();
    expect(o.pay).toBe('paid');        // completed → paid
  });

  it('pay is pending for non-completed states', () => {
    expect(toCustomerOrder({ ...myRow, state: 'in_progress' }).pay).toBe('pending');
  });

  it('unknown service → optimize; unknown state → planned', () => {
    const o = toCustomerOrder({ ...myRow, service: 'Mystery', state: 'weird' });
    expect(o.service).toBe('optimize');
    expect(o.status).toBe('planned');
  });

  it('eta is "—" without a deadline; owner "Unassigned" without assignee', () => {
    const o = toCustomerOrder({ ...myRow, deadline: null, assignee: null });
    expect(o.eta).toBe('—');
    expect(o.owner).toBe('Unassigned');
  });

  it('eta shows the turnaround in days (deadline − created)', () => {
    const o = toCustomerOrder({ ...myRow, created_at: '2026-06-13T00:00:00+00:00', deadline: '2026-06-16T00:00:00+00:00' });
    expect(o.eta).toBe('3 days');
    expect(toCustomerOrder({ ...myRow, created_at: '2026-06-13T00:00:00+00:00', deadline: '2026-06-14T00:00:00+00:00' }).eta).toBe('1 day');
  });

  it('domain is never the company name — project domain → site host → "My site"', () => {
    // This test used to assert the opposite (company→name→"My site"). That fallback was removed on
    // purpose: presenting "Acme Co" as an order's *website* is a fabricated domain, and a customer
    // reading their own order saw a site they never gave us. Only a real project domain or a real URL
    // the customer typed may fill this field.
    const proj = (domain: string) => ({ project: 'p', folder: 'f', title: null, site: null, brief: null, proj: { domain } });
    expect(toCustomerOrder({ ...myRow, order_details: proj('henro.co') }).domain).toBe('henro.co');
    expect(toCustomerOrder({ ...myRow, customers: { company: 'Acme Co', name: 'Jane Doe' } }).domain).toBe('My site');
    expect(toCustomerOrder({ ...myRow, customers: { company: null, name: 'Solo' } }).domain).toBe('My site');
    expect(toCustomerOrder({ ...myRow, customers: null }).domain).toBe('My site');
  });

  it('delivered → awaiting review in the Completed column, carrying delivered_at', () => {
    const o = toCustomerOrder({ ...myRow, state: 'delivered', delivered_at: '2026-07-01T00:00:00+00:00' });
    expect(o.status).toBe('completed');
    expect(o.awaitingReview).toBe(true);
    expect(o.deliveredAt).toBe('2026-07-01T00:00:00+00:00');
  });

  it('non-delivered states are not awaiting review', () => {
    expect(toCustomerOrder({ ...myRow, state: 'completed' }).awaitingReview).toBe(false);
  });

  it('carries the order-time project + folder (object or array embed)', () => {
    const obj = toCustomerOrder({ ...myRow, order_details: { project: 'HevaShop Store', folder: 'E-commerce client', title: null, site: null, brief: null, proj: null } });
    expect(obj.project).toBe('HevaShop Store');
    expect(obj.folder).toBe('E-commerce client');
    const arr = toCustomerOrder({ ...myRow, order_details: [{ project: 'An Phat', folder: 'Retail', title: null, site: null, brief: null, proj: null }] });
    expect(arr.project).toBe('An Phat');
    expect(arr.folder).toBe('Retail');
  });

  it('leaves project/folder undefined when there is no order_details', () => {
    const o = toCustomerOrder(myRow);
    expect(o.project).toBeUndefined();
    expect(o.folder).toBeUndefined();
  });
});

describe('aggregateProjectTags — project card {service → {plan,run,done}} from linked orders', () => {
  const P1 = '11111111-1111-1111-1111-111111111111';
  const P2 = '22222222-2222-2222-2222-222222222222';
  const row = (projectId: string | null, service: string, state: string): ProjectTagInput => ({ projectId, service, state });

  it('buckets each state: planned→plan, in_progress/internal_review→run, delivered/approved/completed→done', () => {
    const tags = aggregateProjectTags([
      row(P1, 'Audit', 'new'),             // plan
      row(P1, 'Audit', 'in_progress'),     // run
      row(P1, 'Audit', 'internal_review'), // run (in review still counts as running work)
      row(P1, 'Audit', 'delivered'),       // done
      row(P1, 'Audit', 'approved'),        // done
    ]).get(P1)!;
    expect(tags.audit).toEqual({ plan: 1, run: 2, done: 2 });
  });

  it('accumulates orders, keeps services separate, scopes per project', () => {
    const m = aggregateProjectTags([
      row(P1, 'Audit', 'new'),
      row(P1, 'Optimization', 'new'),
      row(P2, 'Backlink', 'completed'),
    ]);
    expect(m.get(P1)).toEqual({ audit: { plan: 1, run: 0, done: 0 }, optimize: { plan: 1, run: 0, done: 0 } });
    expect(m.get(P2)).toEqual({ backlink: { plan: 0, run: 0, done: 1 } });
  });

  it('skips rows with no project link', () => {
    expect(aggregateProjectTags([row(null, 'Audit', 'new')]).size).toBe(0);
  });

  it('skips canceled + unknown states — they belong to no column', () => {
    expect(aggregateProjectTags([row(P1, 'Audit', 'canceled'), row(P1, 'Audit', 'weird')]).size).toBe(0);
  });

  it('unknown service falls back to optimize (mirrors toCustomerOrder)', () => {
    expect(aggregateProjectTags([row(P1, 'Mystery', 'new')]).get(P1)).toEqual({ optimize: { plan: 1, run: 0, done: 0 } });
  });
});

describe('UUID_RE', () => {
  it('accepts a real uuid, rejects legacy mock ids', () => {
    expect(UUID_RE.test('11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(UUID_RE.test('o1')).toBe(false);
    expect(UUID_RE.test('AUD-1001')).toBe(false);
  });
});
