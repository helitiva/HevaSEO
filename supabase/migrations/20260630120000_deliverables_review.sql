-- Step 2 / inc-5e: the deliverable review surface needs the reviewer's verdict on each submission.
-- Add reviewed_at + review_note to deliverables (NON-money; additive — existing RLS unchanged).
-- kind/fileName/url come from the existing `files` jsonb; the staff name from submitter_id (join).
alter table deliverables
  add column reviewed_at timestamptz,
  add column review_note text;
