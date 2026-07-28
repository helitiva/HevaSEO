-- inc-E32: computed staff performance from real activity (was seeded-static in staff_details). Derives,
-- per staff (deliverable submitter), from reviewed deliverables + the order deadline:
--   quality    = approved / (approved + changes_requested)          (× 100)
--   on_time    = approved reviewed by the order deadline / approved  (× 100)
--   throughput = count of approved deliverables
-- SQL invoker-rights → RLS applies (admin sees all; a staffer would see only their own). Returns one row
-- per submitter that has deliverables; a staff with no reviewed work is absent → the reader keeps the
-- seeded showcase value (so the mostly-shadow demo roster isn't gutted).
create or replace function staff_perf_all()
returns table (profile_id uuid, quality int, on_time int, throughput int)
language sql stable
as $$
  select
    d.submitter_id,
    case when count(*) filter (where d.status in ('approved', 'changes_requested')) > 0
      then round(100.0 * count(*) filter (where d.status = 'approved')
                 / count(*) filter (where d.status in ('approved', 'changes_requested')))::int end,
    case when count(*) filter (where d.status = 'approved') > 0
      then round(100.0 * count(*) filter (where d.status = 'approved' and o.deadline is not null and d.reviewed_at <= o.deadline)
                 / count(*) filter (where d.status = 'approved'))::int end,
    count(*) filter (where d.status = 'approved')::int
  from deliverables d
  join orders o on o.id = d.order_id
  where d.tenant_id = current_tenant_id()
  group by d.submitter_id;
$$;

revoke execute on function staff_perf_all() from public;
grant  execute on function staff_perf_all() to authenticated;
