// FEATURE: Authentication + JWT claims + RLS tenant/role isolation.
import { group, check, eq, assert, denied, rows, roleOf, login, ACCOUNTS, ACME } from '../lib.mjs';

export async function run(ctx) {
  group('Auth — 5 roles resolve the right app_role claim');
  for (const [key, email] of Object.entries(ACCOUNTS)) {
    await check(`${email} → ${key}`, async () => eq(await roleOf(ctx[key]), key === 'admin' ? 'admin' : key, `role for ${email}`));
  }
  await check('wrong password is rejected', async () => {
    let ok = false;
    try { await login(ACCOUNTS.customer, 'wrong-password'); } catch { ok = true; }
    assert(ok, 'login with a wrong password should fail');
  });

  group('RLS — reads are scoped per role (pristine seed)');
  await check('admin sees all 11 orders', async () => eq((await rows(ctx.admin.from('orders').select('id'), 'admin orders')).length, 11));
  await check('admin sees all 6 customers', async () => eq((await rows(ctx.admin.from('customers').select('id'), 'admin customers')).length, 6));
  await check('admin sees all 6 staff profiles', async () => eq((await rows(ctx.admin.from('profiles').select('id').eq('role', 'staff'), 'admin staff')).length, 6));
  await check('customer sees ONLY her own orders', async () => {
    const o = await rows(ctx.customer.from('orders').select('id,customer_id'), 'customer orders');
    assert(o.length > 0 && o.every((x) => x.customer_id === ACME), 'every order must be the customer\'s own');
  });
  await check('customer sees only her own customer row', async () => eq((await rows(ctx.customer.from('customers').select('id'), 'customer self')).length, 1));
  await check('staff sees 0 base orders (money-blind base table)', async () => eq((await rows(ctx.staff.from('orders').select('id'), 'staff base orders')).length, 0));
  await check('manager reads orders_mgr; value column is ABSENT', async () => {
    assert((await rows(ctx.manager.from('orders_mgr').select('code').limit(1), 'mgr view')).length > 0, 'manager should see pod rows');
    const v = await ctx.manager.from('orders_mgr').select('value').limit(1);
    assert(!!v.error, 'orders_mgr must not expose the value column');
  });
  await check('staff cannot read customer_balances', async () => eq((await rows(ctx.staff.from('customer_balances').select('balance'), 'staff balances')).length, 0));
  await check('staff cannot read invoices (money-blind)', async () => eq((await rows(ctx.staff.from('invoices').select('id'), 'staff invoices')).length, 0));

  group('RLS — cross-tenant / cross-user isolation');
  await check('customer cannot read another customer\'s order', async () => {
    const other = (await rows(ctx.admin.from('orders').select('id,customer_id'), 'all orders')).find((o) => o.customer_id !== ACME);
    eq((await rows(ctx.customer.from('orders').select('id').eq('id', other.id), 'cross-read')).length, 0);
  });
  await check('customer cannot read another customer\'s balance', async () => {
    const other = (await rows(ctx.admin.from('customers').select('id'), 'all cust')).find((c) => c.id !== ACME);
    eq((await rows(ctx.customer.from('customer_balances').select('balance').eq('customer_id', other.id), 'cross-balance')).length, 0);
  });
  await check('staff/affiliate wallets invisible to a customer', async () => {
    eq((await rows(ctx.customer.from('staff_wallet').select('balance'), 'cust->staff_wallet')).length, 0);
    eq((await rows(ctx.customer.from('affiliate_commission').select('balance'), 'cust->aff_comm')).length, 0);
  });
}
