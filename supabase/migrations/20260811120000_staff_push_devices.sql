-- Staff device subscriptions for new-order web push.
-- One row per DEVICE (not per user): an owner with a phone and a counter
-- tablet gets both. Distinct from orders.push_subscription, which is a
-- customer's device attached to a single order and nulled on expiry.
create table public.staff_push_devices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  label text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index staff_push_devices_shop_idx on public.staff_push_devices (shop_id);

alter table public.staff_push_devices enable row level security;

-- Staff touch only their own device rows, and only for a shop they staff.
create policy staff_push_devices_self on public.staff_push_devices for all
  using (auth_user_id = auth.uid() and public.is_staff_of(shop_id))
  with check (auth_user_id = auth.uid() and public.is_staff_of(shop_id));

-- Enrolment. SECURITY DEFINER so the upsert can resolve the unique-endpoint
-- conflict even when the row currently belongs to another user (device handed
-- over to a new staff member), while still proving the caller staffs the shop.
create or replace function public.attach_staff_push_device(
  p_shop_id uuid,
  p_subscription jsonb,
  p_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_endpoint text := p_subscription->>'endpoint';
begin
  if not public.is_staff_of(p_shop_id) then
    raise exception 'not staff of shop %', p_shop_id;
  end if;

  if v_endpoint is null or v_endpoint = '' then
    raise exception 'subscription missing endpoint';
  end if;

  insert into public.staff_push_devices
    (shop_id, auth_user_id, endpoint, subscription, label)
  values
    (p_shop_id, auth.uid(), v_endpoint, p_subscription, p_label)
  on conflict (endpoint) do update
    set shop_id      = excluded.shop_id,
        auth_user_id = excluded.auth_user_id,
        subscription = excluded.subscription,
        label        = coalesce(excluded.label, staff_push_devices.label);
end;
$$;

revoke execute on function public.attach_staff_push_device(uuid, jsonb, text) from anon;
