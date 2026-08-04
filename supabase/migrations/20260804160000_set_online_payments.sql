-- Toggle the 'online' payment mode for the caller's shop. Requires a connected
-- Stripe account before online can be enabled. Only touches payment_modes (not a
-- billing-protected column), so it's safe under the protect_shop_billing trigger.
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
