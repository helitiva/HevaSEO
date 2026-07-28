import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AdminRule } from '@/data/adminMock';

// Step 2 inc-5d — real (RLS-scoped) assignment routing rules for the admin Assignment board. Replaces
// the RULES mock. The table stores target_staff_id (→ profile name via join); `priority`/`active`
// aren't modeled yet, so we treat every stored rule as active with a default priority (the board uses
// mode/service/target for routing; priority is display-only). Admin-only RLS (manager has no policy).
type RuleRow = {
  id: string; service: string; pkg: string | null; mode: AdminRule['mode'];
  target: { name: string | null } | null;
};

export async function getRules(): Promise<AdminRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignment_rules')
    .select('id, service, pkg, mode, target:profiles!assignment_rules_target_staff_id_fkey(name)')
    .returns<RuleRow[]>();
  if (error) throw new Error(`getRules: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    service: r.service,
    pkg: r.pkg,
    mode: r.mode,
    target: r.target?.name ?? null,
    priority: 50,   // not modeled in the table yet
    active: true,   // a stored rule is active
  }));
}
