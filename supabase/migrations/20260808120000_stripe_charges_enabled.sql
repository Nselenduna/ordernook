-- Phase 2B onboarding rebuild (Account Links): a connected account exists as soon
-- as it's created, but can't take charges until Stripe onboarding completes. Gate
-- the 'online' payment mode on charges being enabled, not merely on an account id.

alter table public.shops
  add column if not exists stripe_charges_enabled boolean not null default false;

-- RPC now requires charges to be enabled, not just an account present.
create or replace function public.set_online_payments(p_enabled boolean)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_shop public.shops;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select s.* into v_shop
  from public.shops s
  join public.staff_users su on su.shop_id = s.id
  where su.auth_user_id = v_uid
  limit 1;

  if v_shop.id is null then
    raise exception 'no_shop' using errcode = 'P0001';
  end if;

  if p_enabled then
    if v_shop.stripe_account_id is null then
      raise exception 'no_stripe_account' using errcode = 'P0001';
    end if;
    if not v_shop.stripe_charges_enabled then
      raise exception 'charges_not_enabled' using errcode = 'P0001';
    end if;
    update public.shops
      set payment_modes = array(
        select distinct unnest(payment_modes || array['online']::payment_mode[])
      )
      where id = v_shop.id
      returning * into v_shop;
  else
    update public.shops
      set payment_modes = array_remove(payment_modes, 'online'::payment_mode)
      where id = v_shop.id
      returning * into v_shop;
  end if;

  return v_shop;
end;
$$;

revoke all on function public.set_online_payments(boolean) from public, anon;
grant execute on function public.set_online_payments(boolean) to authenticated;

-- Trigger backstop for direct writes: 'online' requires a connected account that
-- can actually charge.
create or replace function public.enforce_online_requires_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.role() in ('authenticated', 'anon')
     and 'online' = any(new.payment_modes)
     and (new.stripe_account_id is null or new.stripe_charges_enabled is not true) then
    raise exception 'online_requires_account' using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

drop trigger if exists enforce_online_requires_account on public.shops;
create trigger enforce_online_requires_account
  before insert or update on public.shops
  for each row execute function public.enforce_online_requires_account();
