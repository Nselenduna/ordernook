-- Phase 1 Slice 2c: public bucket for menu item photos, staff-write-scoped.
insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;

-- Public read (photos are shown to anonymous customers).
create policy "menu_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-photos');

-- Staff may write ONLY under their own shop's folder: path = "{shop_id}/...".
create policy "menu_photos_staff_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-photos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "menu_photos_staff_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-photos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'menu-photos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "menu_photos_staff_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-photos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );
