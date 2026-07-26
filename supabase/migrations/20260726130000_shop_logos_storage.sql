-- Phase 1 Slice 3: public bucket for shop logos/PWA icons, staff-write-scoped.
insert into storage.buckets (id, name, public)
values ('shop-logos', 'shop-logos', true)
on conflict (id) do nothing;

-- Public read (logos are shown to anonymous customers + used as PWA icons).
create policy "shop_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'shop-logos');

-- Staff may write ONLY under their own shop's folder: path = "{shop_id}/...".
-- storage.foldername(name)[1] is the first path segment (the shop_id).
create policy "shop_logos_staff_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-logos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "shop_logos_staff_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-logos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'shop-logos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "shop_logos_staff_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-logos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );
