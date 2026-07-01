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

type PerfRow = { profile_id: string; quality: number | null; on_time: number | null; throughput: number | null };

export async function getStaff(): Promise<AdminStaff[]> {
  const supabase = await createClient();
  const [staff, perf] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, staff_details!staff_details_profile_id_fkey(skills, capacity, role_label, timezone, since, active, composite, quality, on_time, throughput, trend)')
      .eq('role', 'staff')
      .returns<StaffRow[]>(),
    supabase.rpc('staff_perf_all').returns<PerfRow[]>(), // inc-E32: computed from real deliverables
  ]);
  if (staff.error) throw new Error(`getStaff: ${staff.error.message}`);
  // computed perf overrides the seeded showcase values ONLY for staff with real reviewed work
  const perfBy = new Map((perf.data ?? []).filter((p) => p.quality != null).map((p) => [p.profile_id, p]));

  return (staff.data ?? []).flatMap((r) => {
    const d = r.staff_details;
    if (!d) return [];
    const cp = perfBy.get(r.id);
    const quality = cp ? cp.quality! : d.quality;
    const onTime = cp ? cp.on_time! : d.on_time;
    const throughput = cp ? (cp.throughput ?? 0) : d.throughput;
    const composite = cp ? Math.round((quality + onTime) / 2) : d.composite;
    return [{
      id: r.id,
      name: r.name ?? '',
      email: r.email ?? '',
      skills: d.skills,
      capacity: d.capacity,
      openLoad: 0,
      composite,
      quality,
      onTime,
      throughput,
      active: d.active,
      role: d.role_label ?? '',
      since: d.since ?? '',
      tz: d.timezone ?? '',
      trend: d.trend,
    } satisfies AdminStaff];
  });
}
