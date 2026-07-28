-- A self-service signup never got a `customers` row.
--
-- handle_new_user creates (or claims) the PROFILE, and every customer in the database until now came from
-- seed.sql or admin provisioning, which insert the customers row themselves. So nothing ever exercised the
-- genuinely-new path: a person who signs up through /register ends with a profile and no customer entity.
--
-- That row is what the customer-facing product actually points at — orders.customer_id, projects.customer_id,
-- affiliate_referrals.customer_id all reference customers(id). Without it:
--   * placing an order fails outright with "No customer profile found." (order.actions.ts), and
--   * attribute_referral (20260726120000) no-ops, so a referred signup is never credited to its partner.
--
-- Fix at the layer that owns provisioning: after the profile is settled, ensure the customers row exists.
-- The insert is guarded by NOT EXISTS so the LINK branch (an admin-provisioned shadow that already has its
-- customers row) is untouched, and re-running is harmless.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency constant uuid := 'a9e0c0de-0000-4000-8000-000000000001';
  v_name   text := nullif(new.raw_user_meta_data ->> 'name', '');
begin
  -- (1) LINK: claim a CUSTOMER shadow in place. Privileged shadows are intentionally NOT matched here.
  update public.profiles
     set user_id = new.id,
         name    = coalesce(name, v_name),
         status  = 'active'
   where tenant_id = v_agency
     and email     = new.email
     and user_id is null
     and role      = 'customer';

  if not found then
    -- A non-customer shadow (or any existing profile) owns this email → do NOT create a customer row
    -- over it. Leave the auth user without a profile: the access-token hook adds no claims, so RLS
    -- returns 0 rows and the account is inert until claimed through the proper privileged-invite flow.
    if exists (select 1 from public.profiles where tenant_id = v_agency and email = new.email) then
      return new;
    end if;

    -- (2) CREATE: genuinely new email → fresh forced-customer profile (metadata role stays untrusted).
    insert into public.profiles (tenant_id, user_id, email, name, role)
    values (v_agency, new.id, new.email, v_name, 'customer');

    -- (3) PROVISION — CREATE PATH ONLY: a genuinely-new self-signup has no customers row, and the rest of
    -- the product (orders, projects, affiliate_referrals) references one. This must NOT run on the LINK
    -- path above: a claimed shadow always arrives with its customers row from whoever created it
    -- (seed.sql, admin provisioning), and seed in particular inserts auth.users — firing this trigger —
    -- BEFORE it inserts its own customers rows, so provisioning there would race and duplicate the row.
    insert into public.customers (tenant_id, user_id, name, email, status)
    select v_agency, p.id, coalesce(p.name, v_name, split_part(new.email, '@', 1)), new.email, 'claimed'
      from public.profiles p
     where p.tenant_id = v_agency
       and p.user_id   = new.id
       and p.role      = 'customer'
       and not exists (select 1 from public.customers c where c.user_id = p.id);
  end if;

  return new;
end $$;

-- Backfill: any customer profile that already signed up under the broken path is inert today (cannot
-- order, cannot be attributed). Give those accounts the row they should have had.
insert into public.customers (tenant_id, user_id, name, email, status)
select p.tenant_id, p.id, coalesce(p.name, split_part(p.email, '@', 1)), p.email, 'claimed'
  from public.profiles p
 where p.role = 'customer'
   and p.user_id is not null
   and not exists (select 1 from public.customers c where c.user_id = p.id);
