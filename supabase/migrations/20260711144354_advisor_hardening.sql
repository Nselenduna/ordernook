-- Lock down functions that should not be API-callable.
-- (create_order / get_order_by_token / attach_push_subscription stay anon-callable
--  by design: guest checkout + unguessable-token order access.)
revoke execute on function public.is_staff_of(uuid) from public, anon;
grant execute on function public.is_staff_of(uuid) to authenticated;
revoke execute on function public.on_order_before() from public, anon, authenticated;
revoke execute on function public.on_order_after() from public, anon, authenticated;

-- auth_rls_initplan: evaluate auth.uid() once per query, not per row
drop policy staff_users_self_read on public.staff_users;
create policy staff_users_self_read on public.staff_users for select
  using (auth_user_id = (select auth.uid()));
drop policy customers_self on public.customers;
create policy customers_self on public.customers for all
  using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));

-- multiple_permissive_policies: split staff FOR ALL into write-only policies
-- (public_read policies already cover SELECT for everyone)
drop policy categories_staff_write on public.menu_categories;
create policy categories_staff_insert on public.menu_categories for insert to authenticated
  with check (public.is_staff_of(shop_id));
create policy categories_staff_update on public.menu_categories for update to authenticated
  using (public.is_staff_of(shop_id)) with check (public.is_staff_of(shop_id));
create policy categories_staff_delete on public.menu_categories for delete to authenticated
  using (public.is_staff_of(shop_id));

drop policy items_staff_write on public.menu_items;
create policy items_staff_insert on public.menu_items for insert to authenticated
  with check (public.is_staff_of(shop_id));
create policy items_staff_update on public.menu_items for update to authenticated
  using (public.is_staff_of(shop_id)) with check (public.is_staff_of(shop_id));
create policy items_staff_delete on public.menu_items for delete to authenticated
  using (public.is_staff_of(shop_id));

drop policy option_groups_staff_write on public.option_groups;
create policy option_groups_staff_insert on public.option_groups for insert to authenticated
  with check (exists (select 1 from public.menu_items mi where mi.id = item_id and public.is_staff_of(mi.shop_id)));
create policy option_groups_staff_update on public.option_groups for update to authenticated
  using (exists (select 1 from public.menu_items mi where mi.id = item_id and public.is_staff_of(mi.shop_id)))
  with check (exists (select 1 from public.menu_items mi where mi.id = item_id and public.is_staff_of(mi.shop_id)));
create policy option_groups_staff_delete on public.option_groups for delete to authenticated
  using (exists (select 1 from public.menu_items mi where mi.id = item_id and public.is_staff_of(mi.shop_id)));

drop policy options_staff_write on public.options;
create policy options_staff_insert on public.options for insert to authenticated
  with check (exists (select 1 from public.option_groups g join public.menu_items mi on mi.id = g.item_id where g.id = group_id and public.is_staff_of(mi.shop_id)));
create policy options_staff_update on public.options for update to authenticated
  using (exists (select 1 from public.option_groups g join public.menu_items mi on mi.id = g.item_id where g.id = group_id and public.is_staff_of(mi.shop_id)))
  with check (exists (select 1 from public.option_groups g join public.menu_items mi on mi.id = g.item_id where g.id = group_id and public.is_staff_of(mi.shop_id)));
create policy options_staff_delete on public.options for delete to authenticated
  using (exists (select 1 from public.option_groups g join public.menu_items mi on mi.id = g.item_id where g.id = group_id and public.is_staff_of(mi.shop_id)));

-- customers_self was FOR ALL too but has no public overlap; leave it.

-- FK covering indexes
create index if not exists customers_auth_user_idx on public.customers (auth_user_id);
create index if not exists locations_shop_idx on public.locations (shop_id);
create index if not exists menu_categories_shop_idx on public.menu_categories (shop_id);
create index if not exists menu_items_shop_idx on public.menu_items (shop_id);
create index if not exists menu_items_category_idx on public.menu_items (category_id);
create index if not exists option_groups_item_idx on public.option_groups (item_id);
create index if not exists options_group_idx on public.options (group_id);
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists shops_country_idx on public.shops (country_code);
create index if not exists staff_users_auth_user_idx on public.staff_users (auth_user_id);