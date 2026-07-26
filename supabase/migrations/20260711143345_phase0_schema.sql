-- Order-Ahead Phase 0 schema (HANDOFF.md §8)
create extension if not exists pgcrypto;

create type public.plan_tier as enum ('basic','pro');
create type public.staff_role as enum ('owner','staff');
create type public.option_group_type as enum ('single','multi');
create type public.order_status as enum ('pending_payment','new','accepted','preparing','ready','collected','rejected','refunded');
create type public.payment_mode as enum ('in_store','online');

create table public.countries (
  code text primary key,
  currency text not null,
  locale text not null,
  timezone text not null,
  tax_display text not null default 'inclusive',
  features jsonb not null default '{}'::jsonb
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  country_code text not null references public.countries(code),
  branding jsonb not null default '{}'::jsonb,
  stripe_account_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'trialing',
  plan_tier public.plan_tier not null default 'basic',
  payment_modes public.payment_mode[] not null default '{in_store}',
  prep_minutes int not null default 10,
  is_paused boolean not null default false,
  hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  address text not null
);

create table public.staff_users (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role public.staff_role not null default 'staff',
  unique (shop_id, auth_user_id)
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name text not null,
  description text,
  photo_url text,
  price_minor int not null check (price_minor >= 0),
  currency text not null,
  is_available boolean not null default true,
  sort_order int not null default 0
);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  type public.option_group_type not null default 'single',
  required boolean not null default false,
  sort_order int not null default 0
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups(id) on delete cascade,
  name text not null,
  price_delta_minor int not null default 0,
  sort_order int not null default 0
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  display_name text,
  phone text,
  push_subscription jsonb,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  status public.order_status not null default 'new',
  payment_mode public.payment_mode not null default 'in_store',
  total_minor int not null check (total_minor >= 0),
  currency text not null,
  stripe_payment_intent_id text,
  order_number int not null,
  access_token uuid not null unique default gen_random_uuid(),
  reject_reason text,
  push_subscription jsonb,
  placed_at timestamptz not null default now(),
  ready_at timestamptz,
  collected_at timestamptz
);
create index orders_shop_placed_idx on public.orders (shop_id, placed_at desc);
create index orders_shop_status_idx on public.orders (shop_id, status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_snapshot jsonb not null,
  qty int not null check (qty > 0)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  actor text not null,
  action text not null,
  at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id);

-- ===== RLS helper: is the current auth user staff of this shop? =====
-- SECURITY DEFINER so it can read staff_users regardless of RLS.
create or replace function public.is_staff_of(target_shop uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from staff_users
    where shop_id = target_shop and auth_user_id = auth.uid()
  );
$$;
revoke execute on function public.is_staff_of(uuid) from anon;

-- ===== Enable RLS everywhere (never leave a table open) =====
alter table public.countries enable row level security;
alter table public.shops enable row level security;
alter table public.locations enable row level security;
alter table public.staff_users enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;

-- Public (anon + authed) read: config + menu browsing
create policy countries_public_read on public.countries for select using (true);
create policy shops_public_read on public.shops for select using (true);
create policy locations_public_read on public.locations for select using (true);
create policy categories_public_read on public.menu_categories for select using (true);
create policy items_public_read on public.menu_items for select using (true);
create policy option_groups_public_read on public.option_groups for select
  using (exists (select 1 from public.menu_items mi where mi.id = item_id));
create policy options_public_read on public.options for select
  using (exists (select 1 from public.option_groups g where g.id = group_id));

-- Staff manage their own shop's data
create policy shops_staff_update on public.shops for update
  using (public.is_staff_of(id)) with check (public.is_staff_of(id));
create policy staff_users_self_read on public.staff_users for select
  using (auth_user_id = auth.uid());
create policy categories_staff_write on public.menu_categories for all
  using (public.is_staff_of(shop_id)) with check (public.is_staff_of(shop_id));
create policy items_staff_write on public.menu_items for all
  using (public.is_staff_of(shop_id)) with check (public.is_staff_of(shop_id));
create policy option_groups_staff_write on public.option_groups for all
  using (exists (select 1 from public.menu_items mi where mi.id = item_id and public.is_staff_of(mi.shop_id)))
  with check (exists (select 1 from public.menu_items mi where mi.id = item_id and public.is_staff_of(mi.shop_id)));
create policy options_staff_write on public.options for all
  using (exists (select 1 from public.option_groups g join public.menu_items mi on mi.id = g.item_id where g.id = group_id and public.is_staff_of(mi.shop_id)))
  with check (exists (select 1 from public.option_groups g join public.menu_items mi on mi.id = g.item_id where g.id = group_id and public.is_staff_of(mi.shop_id)));

-- Customers: only their own row (guest flows never touch this table directly)
create policy customers_self on public.customers for all
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Orders: staff see/manage their shop's orders. Anonymous customers go via
-- SECURITY DEFINER token functions only — no direct anon access.
create policy orders_staff_read on public.orders for select using (public.is_staff_of(shop_id));
create policy orders_staff_update on public.orders for update
  using (public.is_staff_of(shop_id)) with check (public.is_staff_of(shop_id));
create policy order_items_staff_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and public.is_staff_of(o.shop_id)));
create policy order_events_staff_read on public.order_events for select using (public.is_staff_of(shop_id));

-- ===== Order lifecycle trigger: timestamps + audit log =====
create or replace function public.on_order_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into order_events (shop_id, order_id, actor, action)
    values (new.shop_id, new.id, coalesce(auth.uid()::text, 'system'), 'created:' || new.status);
  elsif new.status is distinct from old.status then
    if new.status = 'ready' and new.ready_at is null then new.ready_at := now(); end if;
    if new.status = 'collected' and new.collected_at is null then new.collected_at := now(); end if;
    insert into order_events (shop_id, order_id, actor, action)
    values (new.shop_id, new.id, coalesce(auth.uid()::text, 'system'), old.status || '->' || new.status);
  end if;
  return new;
end;
$$;
create trigger order_change before insert or update on public.orders
  for each row execute function public.on_order_change();

-- ===== create_order: server-side price validation (never trust client totals) =====
create or replace function public.create_order(
  p_shop_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb -- [{"item_id": uuid, "qty": int, "option_ids": [uuid,...]}]
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_shop shops%rowtype;
  v_tz text;
  v_number int;
  v_total int := 0;
  v_order orders%rowtype;
  li jsonb;
  v_qty int;
  v_item menu_items%rowtype;
  v_sel uuid[];
  v_valid_count int;
  v_line_total int;
  v_opts jsonb;
  v_lines jsonb := '[]'::jsonb;
  line jsonb;
begin
  select * into v_shop from shops where slug = p_shop_slug;
  if not found then raise exception 'shop_not_found'; end if;
  if v_shop.is_paused then raise exception 'shop_paused'; end if;
  if p_customer_name is null or length(trim(p_customer_name)) < 1 or length(p_customer_name) > 80 then
    raise exception 'invalid_name';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_cart';
  end if;

  for li in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((li->>'qty')::int, 1);
    if v_qty < 1 or v_qty > 20 then raise exception 'invalid_qty'; end if;

    select * into v_item from menu_items
      where id = (li->>'item_id')::uuid and shop_id = v_shop.id;
    if not found then raise exception 'item_not_found'; end if;
    if not v_item.is_available then raise exception 'item_unavailable'; end if;

    v_sel := coalesce(
      (select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(li->'option_ids', '[]'::jsonb))),
      '{}'::uuid[]
    );

    -- every supplied option must belong to this item
    select count(*) into v_valid_count
      from options o join option_groups g on g.id = o.group_id
      where g.item_id = v_item.id and o.id = any(v_sel);
    if v_valid_count <> coalesce(array_length(v_sel, 1), 0) then
      raise exception 'invalid_options';
    end if;

    -- required groups must have a selection
    if exists (
      select 1 from option_groups g
      where g.item_id = v_item.id and g.required
        and not exists (select 1 from options o where o.group_id = g.id and o.id = any(v_sel))
    ) then raise exception 'missing_required_option'; end if;

    -- single-choice groups: at most one selection
    if exists (
      select 1 from options o join option_groups g on g.id = o.group_id
      where g.item_id = v_item.id and g.type = 'single' and o.id = any(v_sel)
      group by g.id having count(*) > 1
    ) then raise exception 'multiple_selections_in_single_group'; end if;

    select coalesce(v_item.price_minor + sum(o.price_delta_minor), v_item.price_minor)
      into v_line_total
      from options o where o.id = any(v_sel);

    select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'group', g.name, 'name', o.name, 'price_delta_minor', o.price_delta_minor
      ) order by g.sort_order, o.sort_order), '[]'::jsonb)
      into v_opts
      from options o join option_groups g on g.id = o.group_id
      where o.id = any(v_sel);

    v_total := v_total + (v_line_total * v_qty);
    v_lines := v_lines || jsonb_build_object(
      'qty', v_qty,
      'snapshot', jsonb_build_object(
        'item_id', v_item.id, 'name', v_item.name,
        'unit_price_minor', v_line_total, 'base_price_minor', v_item.price_minor,
        'currency', v_item.currency, 'options', v_opts
      )
    );
  end loop;

  -- per-shop daily order number (shop row locked to serialise)
  perform 1 from shops where id = v_shop.id for update;
  select c.timezone into v_tz from countries c where c.code = v_shop.country_code;
  select coalesce(max(o.order_number), 0) + 1 into v_number
    from orders o
    where o.shop_id = v_shop.id
      and (o.placed_at at time zone v_tz)::date = (now() at time zone v_tz)::date;

  insert into orders (shop_id, customer_name, customer_phone, status, payment_mode, total_minor, currency, order_number)
  values (v_shop.id, trim(p_customer_name), nullif(trim(coalesce(p_customer_phone, '')), ''), 'new', 'in_store', v_total, v_shop.payment_modes[1] is not null and true and (select currency from countries where code = v_shop.country_code), v_number)
  returning * into v_order;

  for line in select * from jsonb_array_elements(v_lines) loop
    insert into order_items (order_id, item_snapshot, qty)
    values (v_order.id, line->'snapshot', (line->>'qty')::int);
  end loop;

  return jsonb_build_object(
    'order_id', v_order.id,
    'access_token', v_order.access_token,
    'order_number', v_order.order_number,
    'total_minor', v_order.total_minor,
    'currency', v_order.currency,
    'prep_minutes', v_shop.prep_minutes
  );
end;
$$;

-- ===== token-scoped customer access (guests never query orders directly) =====
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id, 'status', o.status, 'order_number', o.order_number,
    'customer_name', o.customer_name, 'total_minor', o.total_minor, 'currency', o.currency,
    'payment_mode', o.payment_mode, 'placed_at', o.placed_at, 'ready_at', o.ready_at,
    'reject_reason', o.reject_reason,
    'shop', jsonb_build_object('name', s.name, 'slug', s.slug, 'prep_minutes', s.prep_minutes, 'branding', s.branding),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object('qty', oi.qty, 'snapshot', oi.item_snapshot)), '[]'::jsonb)
      from order_items oi where oi.order_id = o.id
    )
  )
  from orders o join shops s on s.id = o.shop_id
  where o.access_token = p_token;
$$;

create or replace function public.attach_push_subscription(p_token uuid, p_subscription jsonb)
returns void
language sql security definer
set search_path = public
as $$
  update orders set push_subscription = p_subscription where access_token = p_token;
$$;

-- Realtime: dashboard subscribes to order changes (RLS enforced for subscribers)
alter publication supabase_realtime add table public.orders;