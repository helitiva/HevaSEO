-- Revision requests: when a customer sends a delivered order back for changes, they must say WHAT to
-- revise (a note) and may attach pasted images/videos. The note becomes a visible order_message; the
-- media lives in a public 'order-media' bucket. request_order_changes is atomic: no note → no transition.

-- ── media bucket (images + video, ≤30MB), own-uid-folder writes, public read ─────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-media', 'order-media', true, 31457280,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

drop policy if exists "order_media_public_read" on storage.objects;
create policy "order_media_public_read" on storage.objects for select using (bucket_id = 'order-media');
drop policy if exists "order_media_insert_own" on storage.objects;
create policy "order_media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "order_media_delete_own" on storage.objects;
create policy "order_media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'order-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── attachments on an order message ([{ kind:'image'|'video', url, name }]) ───────
alter table order_messages add column if not exists attachments jsonb not null default '[]'::jsonb;

-- ── atomic "request changes" — posts the note (+ media) then advances delivered → changes_requested ─
create or replace function request_order_changes(p_order uuid, p_note text, p_attachments jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if coalesce(btrim(p_note), '') = '' then raise exception 'EMPTY_NOTE'; end if;
  -- authz + state machine (delivered → changes_requested, customer-only): rolls everything back if illegal
  perform advance_order(p_order, 'changes_requested');
  -- ownership is now confirmed by advance_order — attach the revision note as a customer-visible message
  select tenant_id into v_tenant from orders where id = p_order;
  insert into order_messages (tenant_id, order_id, author_id, body, internal, attachments)
       values (v_tenant, p_order, current_profile_id(), btrim(p_note), false, coalesce(p_attachments, '[]'::jsonb));
end $$;
revoke execute on function request_order_changes(uuid, text, jsonb) from public, anon;
grant  execute on function request_order_changes(uuid, text, jsonb) to authenticated;
