-- supabase/tests/0000_extensions_test.sql
-- Asserts the extensions every later migration depends on are installed.
begin;
select plan(3);

select has_extension('pgcrypto', 'pgcrypto is installed (gen_random_uuid)');
select has_extension('citext',   'citext is installed (case-insensitive email)');
select has_extension('pgtap',    'pgtap is installed (so these tests can run)');

select * from finish();
rollback;
