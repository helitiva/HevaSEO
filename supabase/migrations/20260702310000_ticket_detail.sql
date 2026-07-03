-- Richer ticket detail: reply attachments (images/video) + a post-resolution CSAT rating.

-- ── attachments on ticket messages ([{ kind:'image'|'video', url, name }]) ────────
alter table ticket_messages add column if not exists attachments jsonb not null default '[]'::jsonb;

-- extend post_ticket_message with attachments (media-only replies are allowed). Replaces the 2-arg version.
drop function if exists post_ticket_message(uuid, text);
create or replace function post_ticket_message(p_ticket uuid, p_body text, p_attachments jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role  text := case when current_app_role() = 'customer' then 'customer' else 'staff' end;
  v_media boolean := jsonb_typeof(coalesce(p_attachments, '[]'::jsonb)) = 'array'
                     and jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) > 0;
begin
  if coalesce(btrim(p_body), '') = '' and not v_media then raise exception 'EMPTY_BODY'; end if;
  if not ticket_participant(p_ticket) then raise exception 'NOT_PARTICIPANT'; end if;
  insert into ticket_messages(tenant_id, ticket_id, author_role, author_id, body, attachments)
       values (current_tenant_id(), p_ticket, v_role, current_profile_id(), btrim(p_body), coalesce(p_attachments, '[]'::jsonb));
  update tickets set last_reply_at = now(),
         status = case when current_app_role() = 'customer' and status = 'resolved' then 'open' else status end
   where id = p_ticket;
end $$;
revoke execute on function post_ticket_message(uuid, text, jsonb) from public, anon;
grant  execute on function post_ticket_message(uuid, text, jsonb) to authenticated;

-- ── CSAT: the owning customer rates support once the ticket is resolved/closed ────
alter table tickets add column if not exists csat_rating int check (csat_rating between 1 and 5);
alter table tickets add column if not exists csat_note   text;
alter table tickets add column if not exists csat_at     timestamptz;

create or replace function rate_ticket(p_ticket uuid, p_rating int, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'BAD_RATING'; end if;
  if not exists (
    select 1 from tickets t join customers c on c.id = t.customer_id
    where t.id = p_ticket and t.tenant_id = current_tenant_id()
      and c.user_id = current_profile_id() and current_app_role() = 'customer'
      and t.status in ('resolved', 'closed')
  ) then raise exception 'NOT_ALLOWED'; end if;
  update tickets set csat_rating = p_rating, csat_note = nullif(btrim(coalesce(p_note, '')), ''), csat_at = now()
   where id = p_ticket;
end $$;
revoke execute on function rate_ticket(uuid, int, text) from public, anon;
grant  execute on function rate_ticket(uuid, int, text) to authenticated;
