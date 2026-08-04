-- Self-serve shop registration. The ONLY writer of shops/staff_users for owners.
-- SECURITY DEFINER so it inserts past the (intentionally absent) INSERT policies on
-- shops/staff_users. Column defaults fill subscription_status='trialing',
-- plan_tier='basic', trial_ends_at=now()+30d. GB is seeded in public.countries.
-- The protect_shop_billing trigger is BEFORE UPDATE only, so INSERT here is fine.

create or replace function public.register_shop(p_name text, p_slug text)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid   := auth.uid();
  v_name text   := btrim(coalesce(p_name, ''));
  v_slug text   := lower(btrim(coalesce(p_slug, '')));
  v_reserved text[] := array[
    'dashboard','order','api','auth','login','register',
    'admin','static','_next','favicon','manifest'
  ];
  v_shop public.shops;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.staff_users where auth_user_id = v_uid) then
    raise exception 'already_registered' using errcode = 'P0001';
  end if;

  if v_name = '' or length(v_name) > 80 then
    raise exception 'name_invalid' using errcode = 'P0001';
  end if;

  if length(v_slug) < 3 or length(v_slug) > 40
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug_invalid' using errcode = 'P0001';
  end if;

  if v_slug = any(v_reserved) then
    raise exception 'slug_reserved' using errcode = 'P0001';
  end if;

  begin
    insert into public.shops (name, slug, country_code)
    values (v_name, v_slug, 'GB')
    returning * into v_shop;
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = 'P0001';
  end;

  insert into public.staff_users (shop_id, auth_user_id, role)
  values (v_shop.id, v_uid, 'owner');

  return v_shop;
end;
$$;

revoke all on function public.register_shop(text, text) from public, anon;
grant execute on function public.register_shop(text, text) to authenticated;
