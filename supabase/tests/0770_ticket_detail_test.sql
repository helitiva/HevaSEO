-- Ticket reply attachments (+ media-only replies) and post-resolution CSAT rating. Self-scoped via a
-- captured ticket id (the DB may already hold other tickets).
begin;
select plan(7);

select has_function('rate_ticket', 'rate_ticket() exists');
select ok(not has_function_privilege('anon', 'post_ticket_message(uuid,text,jsonb)', 'execute'), 'anon CANNOT post');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-000000000c11', '11111111-1111-1111-1111-111111111111', 'c1@a', 'C1', 'customer');
insert into customers(id, tenant_id, name, email, status, user_id) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'One', 'c1@a', 'claimed', 'aaaaaaaa-0000-0000-0000-000000000c11');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';

select set_config('test.tk', (select id::text from create_ticket('Need help', 'technical', 'first', 'med')), true);
-- a reply carrying only media (no text) is allowed and stores the attachment
select post_ticket_message(current_setting('test.tk')::uuid, '', '[{"kind":"image","url":"http://x/a.png","name":"a.png"}]'::jsonb);
select throws_ok($$ select post_ticket_message(current_setting('test.tk')::uuid, '   ') $$, 'EMPTY_BODY', 'empty reply w/o media rejected');
select throws_ok($$ select rate_ticket(current_setting('test.tk')::uuid, 5) $$, 'NOT_ALLOWED', 'cannot rate an open ticket');
select throws_ok($$ select rate_ticket(current_setting('test.tk')::uuid, 9) $$, 'BAD_RATING', 'rating must be 1-5');
select set_ticket_status(current_setting('test.tk')::uuid, 'resolved');
select rate_ticket(current_setting('test.tk')::uuid, 4, 'Great help');

reset role;
select is((select jsonb_array_length(attachments) from ticket_messages where ticket_id = current_setting('test.tk')::uuid and body = ''), 1, 'media-only reply stored the attachment');
select is((select csat_rating from tickets where id = current_setting('test.tk')::uuid), 4, 'CSAT rating persisted');

select * from finish();
rollback;
