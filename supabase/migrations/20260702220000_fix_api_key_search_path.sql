-- create_api_key uses pgcrypto's gen_random_bytes()/digest(), which live in the `extensions` schema on
-- Supabase — unreachable under `search_path = public`. Recreate the fn with extensions on the path.
create or replace function create_api_key(p_label text default 'Default')
returns table (id uuid, token text, label text, last4 text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare v_cust uuid; v_tenant uuid; v_secret text; v_token text; v_id uuid;
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  v_cust := current_customer_id(); v_tenant := current_tenant_id();
  if v_cust is null then raise exception 'NO_CUSTOMER'; end if;
  v_secret := encode(gen_random_bytes(24), 'hex');
  v_token  := 'sk_live_' || v_secret;
  insert into api_keys (tenant_id, customer_id, label, prefix, last4, token_hash)
    values (v_tenant, v_cust, coalesce(nullif(btrim(p_label), ''), 'Default'),
            'sk_live_', right(v_secret, 4), encode(digest(v_token, 'sha256'), 'hex'))
    returning api_keys.id into v_id;
  return query
    select k.id, v_token, k.label, k.last4, k.created_at from api_keys k where k.id = v_id;
end $$;
revoke execute on function create_api_key(text) from public, anon;
grant  execute on function create_api_key(text) to authenticated;
