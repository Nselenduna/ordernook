-- Fire a shop-facing push whenever an order becomes visible to the shop.
-- pg_net is async and fire-and-forget: a slow or unreachable endpoint can
-- never block or fail an order insert. That property is load-bearing —
-- this function must never raise.
create extension if not exists pg_net;

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'ordernook_notify_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'ordernook_notify_secret';

  -- Missing config must be loud in the logs, because the failure mode
  -- otherwise looks exactly like "no orders yet".
  if v_url is null or v_secret is null then
    raise log 'notify_new_order: vault secrets missing, skipping order %', new.id;
    return null;
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('order_id', new.id),
    headers := jsonb_build_object(
      'Content-Type',       'application/json',
      'x-ordernook-secret', v_secret
    )
  );

  return null;
exception when others then
  raise log 'notify_new_order failed for order %: %', new.id, sqlerrm;
  return null;
end;
$$;

revoke execute on function public.notify_new_order() from anon, authenticated;

-- In-store orders are inserted straight at 'new'.
create trigger orders_notify_new_order_insert
after insert on public.orders
for each row
when (new.status = 'new')
execute function public.notify_new_order();

-- Online orders are inserted at 'pending_payment' and flip to 'new' when
-- payment reconciles. `is distinct from` stops an unrelated re-save from
-- pinging a second time.
create trigger orders_notify_new_order_update
after update on public.orders
for each row
when (new.status = 'new' and old.status is distinct from 'new')
execute function public.notify_new_order();
