import 'server-only';
import { randomBytes } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

// Privileged-invite onboarding. handle_new_user no longer auto-claims staff/manager/admin/affiliate
// shadows via open self-signup (that was an escalation path — see 20260701450000). So after an admin
// provisions a shadow (create_staff_member / create_manager / create_affiliate_partner), we create the
// auth login here with a temp password and link it explicitly via claim_invite (service-role only).
// The temp password is returned to the admin to hand to the invitee, who changes it on first login.
export type ProvisionResult = { ok: true; tempPassword: string } | { ok: false; error: string };

export async function provisionInviteLogin(email: string, name: string): Promise<ProvisionResult> {
  const svc = createServiceClient();
  const tempPassword = `Heva-${randomBytes(9).toString('base64url')}`;

  // Pre-confirmed so the invitee can sign in immediately with the temp password. handle_new_user sees
  // an existing privileged shadow → it neither claims nor creates, leaving the link to claim_invite.
  const { data, error } = await svc.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true, user_metadata: { name },
  });
  if (error || !data?.user) return { ok: false, error: error?.message ?? 'Could not create the login.' };

  const { error: linkErr } = await svc.rpc('claim_invite', { p_email: email, p_user_id: data.user.id });
  if (linkErr) return { ok: false, error: linkErr.message };

  return { ok: true, tempPassword };
}
