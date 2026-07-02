import { describe, it, expect } from 'vitest';
import {
  UUID_RE, toAdminOrder, toMgrOrder, toCustomerOrder, CUST_STATUS, SERVICE_KEY,
  type OrderRow, type MyOrderRow,
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
  customers: { name: 'Jane Doe', company: 'Acme Co' },
  assignee: { name: 'Mai T.' },
};

describe('toAdminOrder', () => {
  it('maps a full row to AdminOrder (value→number, dates→YYYY-MM-DD, company preferred)', () => {
    const o = toAdminOrder(baseRow);
    expect(o).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      code: 'AUD-1001',
      customer: 'Acme Co',
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
      customers: { name: 'Solo', company: null }, assignee: null,
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
  it('forces value to 0 (the orders_mgr view omits it)', () => {
    const { value, ...rest } = baseRow; // mgr row has no value
    expect(toMgrOrder(rest).value).toBe(0);
  });
  it('keeps all non-money fields', () => {
    const { value, ...rest } = baseRow;
    const o = toMgrOrder(rest);
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
};

describe('toCustomerOrder (derive)', () => {
  it('derives the customer Order model from a DB row', () => {
    const o = toCustomerOrder(myRow);
    expect(o.id).toBe('KW-1013');
    expect(o.service).toBe('keyword');
    expect(o.status).toBe('completed');
    expect(o.cost).toBe(39);
    expect(o.owner).toBe('Mai T.');
    expect(o.domain).toBe('Acme Co');
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

  it('domain falls back company→name→"My site"', () => {
    expect(toCustomerOrder({ ...myRow, customers: { company: null, name: 'Solo' } }).domain).toBe('Solo');
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
});

describe('UUID_RE', () => {
  it('accepts a real uuid, rejects legacy mock ids', () => {
    expect(UUID_RE.test('11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(UUID_RE.test('o1')).toBe(false);
    expect(UUID_RE.test('AUD-1001')).toBe(false);
  });
});
