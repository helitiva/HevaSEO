-- audit_log rows written in the SAME transaction share an identical created_at, because Postgres
-- now() returns the TRANSACTION start time, not the wall clock. advance_order() writes its own row and
-- also triggers auto_review_order(), which writes deliverable.approve + a second order.advanced — all
-- in one transaction, all stamped to the microsecond identically:
--
--   07:51:12.82361  order.advanced       in_progress → internal_review
--   07:51:12.82361  order.advanced       internal_review → delivered
--   07:51:12.82361  deliverable.approve
--
-- So `order by created_at desc` has no tiebreak and the auto-review chain renders in arbitrary order —
-- the activity feed showed the order reaching internal_review *after* it had already been delivered.
-- An audit log that cannot order its own events is a weak audit log.
--
-- seq gives insertion order a total ordering. bigserial backfills existing rows in physical (i.e.
-- insert) order, which is exactly the order we want, and every future insert gets it for free.
alter table audit_log add column seq bigserial;

-- the feed reads newest-first; created_at stays the primary key of the sort so day boundaries are never
-- reordered by a sequence reset, with seq breaking ties inside a transaction.
create index audit_log_feed_idx on audit_log (tenant_id, created_at desc, seq desc);
