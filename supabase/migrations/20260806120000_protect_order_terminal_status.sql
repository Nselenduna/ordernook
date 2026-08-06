-- Terminal order statuses (refunded, rejected) must be set ONLY by trusted
-- server-side flows (the refund-order route, which uses the service-role
-- admin client) — never directly by shop staff via authenticated/anon
-- clients. The dashboard's "advance" update only ever writes
-- accepted/preparing/ready/collected, so this does not affect normal use.
-- service_role, postgres, and migrations (no JWT) pass through.

create or replace function public.protect_order_terminal_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.role() in ('authenticated', 'anon')
     and new.status in ('refunded', 'rejected')
     and new.status is distinct from old.status then
    raise exception 'terminal_status_forbidden' using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

drop trigger if exists protect_order_terminal_status on public.orders;
create trigger protect_order_terminal_status
  before update on public.orders
  for each row execute function public.protect_order_terminal_status();
