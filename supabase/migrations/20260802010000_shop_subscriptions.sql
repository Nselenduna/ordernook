-- Phase 2A: shop subscriptions (Stripe Billing).

alter table public.shops
  add column if not exists stripe_customer_id text,
  add column if not exists trial_ends_at timestamptz;

-- Backfill: 30-day trial from creation for existing shops.
update public.shops set trial_ends_at = created_at + interval '30 days'
  where trial_ends_at is null;

-- Keep the two live pilots unlocked well past ship.
update public.shops set trial_ends_at = timestamptz '2027-01-01 00:00:00+00'
  where slug in ('corner-grind', 'pilot-test');

-- New shops get a 30-day trial by default.
alter table public.shops
  alter column trial_ends_at set default (now() + interval '30 days');

-- Entitlement: subscription active, or still within trial.
create or replace function public.is_entitled(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shops s
    where s.id = p_shop_id
      and (
        s.subscription_status = 'active'
        or (s.subscription_status = 'trialing' and s.trial_ends_at > now())
      )
  );
$$;

-- create_order: identical to 20260711143434, plus an entitlement gate right
-- after the shop is resolved (a locked shop can't be ordered from).
create or replace function public.create_order(
  p_shop_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_shop shops%rowtype;
  v_currency text;
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
  if not public.is_entitled(v_shop.id) then raise exception 'not_entitled'; end if;
  if v_shop.is_paused then raise exception 'shop_paused'; end if;
  if p_customer_name is null or length(trim(p_customer_name)) < 1 or length(p_customer_name) > 80 then
    raise exception 'invalid_name';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_cart';
  end if;

  select c.currency, c.timezone into v_currency, v_tz
    from countries c where c.code = v_shop.country_code;

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

    select count(*) into v_valid_count
      from options o join option_groups g on g.id = o.group_id
      where g.item_id = v_item.id and o.id = any(v_sel);
    if v_valid_count <> coalesce(array_length(v_sel, 1), 0) then
      raise exception 'invalid_options';
    end if;

    if exists (
      select 1 from option_groups g
      where g.item_id = v_item.id and g.required
        and not exists (select 1 from options o where o.group_id = g.id and o.id = any(v_sel))
    ) then raise exception 'missing_required_option'; end if;

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

  perform 1 from shops where id = v_shop.id for update;
  select coalesce(max(o.order_number), 0) + 1 into v_number
    from orders o
    where o.shop_id = v_shop.id
      and (o.placed_at at time zone v_tz)::date = (now() at time zone v_tz)::date;

  insert into orders (shop_id, customer_name, customer_phone, status, payment_mode, total_minor, currency, order_number)
  values (v_shop.id, trim(p_customer_name), nullif(trim(coalesce(p_customer_phone, '')), ''),
          'new', 'in_store', v_total, v_currency, v_number)
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
