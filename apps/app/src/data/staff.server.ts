import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AdminStaff } from '@/data/adminMock';

// Lane A inc-3g — real (RLS-scoped) staff roster for the admin Staff page. Reads the team from
// profiles(role='staff') + their staff_details (skills/capacity/role/tz/tenure + perf metrics).
// Return shape matches AdminStaff (CONTRACTS §3). `openLoad` is recomputed from real orders in
// buildStaffVMs, so it's left 0 here. Pay/wallet/finance signals stay in the gated Lane D domain.
type StaffRow = {
  id: string;
  name: string | null;
  email: string | null;
  staff_details: {
    skills: string[]; capacity: number; role_label: string | null; timezone: string | null;
    since: string | null; active: boolean;
    composite: number; quality: number; on_time: number; throughput: number; trend: number[];
  } | null;
};

export async function getStaff(): Promise<AdminStaff[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, staff_details!staff_details_profile_id_fkey(skills, capacity, role_label, timezone, since, active, composite, quality, on_time, throughput, trend)')
    .eq('role', 'staff')
    .returns<StaffRow[]>();
  if (error) throw new Error(`getStaff: ${error.message}`);

  return (data ?? []).flatMap((r) => {
    const d = r.staff_details;
    if (!d) return [];
    return [{
      id: r.id,
      name: r.name ?? '',
      email: r.email ?? '',
      skills: d.skills,
      capacity: d.capacity,
      openLoad: 0,
      composite: d.composite,
      quality: d.quality,
      onTime: d.on_time,
      throughput: d.throughput,
      active: d.active,
      role: d.role_label ?? '',
      since: d.since ?? '',
      tz: d.timezone ?? '',
      trend: d.trend,
    } satisfies AdminStaff];
  });
}
