-- Slice 2a security fix: a menu item's category must belong to the item's own shop.
-- Prevents a staff member from attaching an item (with their own shop_id) to another
-- shop's category (category ids are publicly readable) and having it render on that
-- shop's customer menu.
drop policy items_staff_insert on public.menu_items;
create policy items_staff_insert on public.menu_items for insert to authenticated
  with check (
    public.is_staff_of(menu_items.shop_id)
    and exists (
      select 1 from public.menu_categories c
      where c.id = menu_items.category_id and c.shop_id = menu_items.shop_id
    )
  );

drop policy items_staff_update on public.menu_items;
create policy items_staff_update on public.menu_items for update to authenticated
  using (public.is_staff_of(menu_items.shop_id))
  with check (
    public.is_staff_of(menu_items.shop_id)
    and exists (
      select 1 from public.menu_categories c
      where c.id = menu_items.category_id and c.shop_id = menu_items.shop_id
    )
  );
