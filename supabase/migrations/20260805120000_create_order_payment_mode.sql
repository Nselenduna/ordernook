-- Phase 2B-2A: create_order gains p_payment_mode. Online orders are created
-- pending_payment (unpaid) instead of new, so they never surface on the
-- kitchen dashboard until payment is confirmed (see checkout-order route /
-- webhook reconcile in later tasks, which flip status -> new on success).
--
-- Signature changes from (text, text, text, jsonb) to
-- (text, text, text, jsonb, text default 'in_store'). Postgres treats this as
-- a distinct overload (new arity), so we explicitly drop the old 4-arg form
-- first to avoid two create_order signatures lingering side by side.
drop function if exists public.create_order(text, text, text, jsonb);

create or replace function public.create_order(
  p_shop_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_payment_mode text default 'in_store'
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

  -- Payment-mode guards (new in 2B-2A). p_payment_mode is validated against a
  -- fixed text set first, then cast to the payment_mode enum to compare
  -- against the shop's enabled modes (text = payment_mode has no implicit
  -- cast in Postgres, so the explicit ::payment_mode cast below is required
  -- for the "any(v_shop.payment_modes)" check to compile/run).
  if p_payment_mode not in ('in_store','online') then raise exception 'invalid_payment_mode'; end if;
  if not (p_payment_mode::payment_mode = any(v_shop.payment_modes)) then raise exception 'payment_mode_unavailable'; end if;
  if p_payment_mode = 'online' and v_shop.stripe_account_id is null then raise exception 'online_not_configured'; end if;

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
          case when p_payment_mode = 'online' then 'pending_payment'::order_status else 'new'::order_status end,
          p_payment_mode::payment_mode, v_total, v_currency, v_number)
  returning * into v_order;

  for line in select * from jsonb_array_elements(v_lines) loop
    insert into order_items (order_id, item_snapshot, qty)
    values (v_order.id, line->'snapshot', (line->>'qty')::int);
  end loop;

  return jsonb_build_object(
    'order_id', v_order.id,
    'access_token', v_order.access_token,
    'token', v_order.access_token,
    'order_number', v_order.order_number,
    'total_minor', v_order.total_minor,
    'currency', v_order.currency,
    'prep_minutes', v_shop.prep_minutes
  );
end;
$$;

-- create_order stays anon-callable by design (guest checkout). No explicit
-- grant existed on the old 4-arg form (default PUBLIC execute grant from
-- CREATE FUNCTION), but we grant explicitly here to be unambiguous and
-- consistent with the rest of this migration set.
grant execute on function public.create_order(text, text, text, jsonb, text) to anon, authenticated;
