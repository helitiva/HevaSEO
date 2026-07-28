// FEATURE: admin provisioning (staff/manager/affiliate shadows) + the privileged-invite claim flow +
// the escalation guard (privileged shadows are NOT claimable by open self-signup).
import { group, check, eq, assert, denied, allowed, rows, svc, anonClient, uniqEmail } from '../lib.mjs';

export async function run(ctx) {
  group('Provisioning — admin creates role shadows; non-admins cannot');
  const staffEmail = uniqEmail('staff');
  await check('admin create_staff_member → invited shadow (role staff, unclaimed)', async () => {
    await allowed(ctx.admin.rpc('create_staff_member', { p_name: 'E2E Staff', p_email: staffEmail, p_role_label: 'SEO', p_capacity: 5, p_skills: ['keyword'] }), 'create_staff_member');
    const p = (await rows(svc.from('profiles').select('role,status,user_id').eq('email', staffEmail), 'shadow')).at(0);
    assert(p && p.role === 'staff' && p.status === 'invited' && p.user_id === null, 'shadow must be staff/invited/unclaimed');
  });
  await check('a staff user cannot provision staff (admin only)', async () => denied(ctx.staff.rpc('create_staff_member', { p_name: 'X', p_email: uniqEmail('x'), p_role_label: 'r', p_capacity: 1, p_skills: [] }), 'staff provision'));
  await check('admin create_manager → manager shadow', async () => {
    const e = uniqEmail('mgr');
    await allowed(ctx.admin.rpc('create_manager', { p_name: 'E2E Mgr', p_email: e, p_role: 'manager' }), 'create_manager');
    eq((await rows(svc.from('profiles').select('role').eq('email', e), 'mgr shadow')).at(0).role, 'manager');
  });
  await check('admin create_affiliate_partner → affiliate shadow + row', async () => {
    const e = uniqEmail('aff');
    await allowed(ctx.admin.rpc('create_affiliate_partner', { p_name: 'E2E Aff', p_email: e, p_code: `E2E${Math.floor(Math.random() * 1e5)}`, p_tier: 'bronze' }), 'create_affiliate_partner');
    eq((await rows(svc.from('profiles').select('role').eq('email', e), 'aff shadow')).at(0).role, 'affiliate');
  });

  group('Escalation guard — open self-signup cannot claim a privileged shadow');
  await check('signing up with a pending STAFF invite email does NOT claim it', async () => {
    const anon = anonClient();
    await anon.auth.signUp({ email: staffEmail, password: 'Attacker-123456' }).catch(() => {});
    const p = (await rows(svc.from('profiles').select('role,user_id').eq('email', staffEmail), 'post-signup')).at(0);
    assert(p.role === 'staff', 'role must stay staff (never overwritten to customer)');
    assert(p.user_id === null, 'CRITICAL: the staff shadow must remain unclaimed by open self-signup');
    eq((await rows(svc.from('profiles').select('id').eq('email', staffEmail), 'dupes')).length, 1, 'no duplicate profile created over the privileged email');
  });

  group('Invite claim — the sanctioned privileged onboarding path (service-role)');
  await check('a customer/anon cannot call claim_invite', async () => denied(ctx.customer.rpc('claim_invite', { p_email: 'x@y.z', p_user_id: '00000000-0000-4000-8000-000000000000' }), 'customer claim_invite'));
  await check('service-role createUser + claim_invite links a fresh privileged invite', async () => {
    const e = uniqEmail('invite');
    await allowed(ctx.admin.rpc('create_staff_member', { p_name: 'Invitee', p_email: e, p_role_label: 'SEO', p_capacity: 3, p_skills: ['content'] }), 'shadow');
    const { data: created, error } = await svc.auth.admin.createUser({ email: e, password: 'Temp-abc123XY', email_confirm: true });
    assert(!error && created?.user, `createUser: ${error?.message}`);
    await allowed(svc.rpc('claim_invite', { p_email: e, p_user_id: created.user.id }), 'claim_invite');
    const p = (await rows(svc.from('profiles').select('role,status,user_id').eq('email', e), 'linked')).at(0);
    assert(p.role === 'staff' && p.status === 'active' && p.user_id === created.user.id, 'invite linked as active staff');
  });
}
