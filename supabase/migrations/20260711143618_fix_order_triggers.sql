drop trigger if exists order_change on public.orders;
drop function if exists public.on_order_change();

-- BEFORE: stamp lifecycle timestamps on status change
create or replace function public.on_order_before()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'ready' and new.ready_at is null then new.ready_at := now(); end if;
    if new.status = 'collected' and new.collected_at is null then new.collected_at := now(); end if;
  end if;
  return new;
end;
$$;
create trigger order_before before update on public.orders
  for each row execute function public.on_order_before();

-- AFTER: audit log (row exists now, FK is satisfiable)
create or replace function public.on_order_after()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into order_events (shop_id, order_id, actor, action)
    values (new.shop_id, new.id, coalesce(auth.uid()::text, 'system'), 'created:' || new.status);
  elsif new.status is distinct from old.status then
    insert into order_events (shop_id, order_id, actor, action)
    values (new.shop_id, new.id, coalesce(auth.uid()::text, 'system'), old.status || '->' || new.status);
  end if;
  return new;
end;
$$;
create trigger order_after after insert or update on public.orders
  for each row execute function public.on_order_after();