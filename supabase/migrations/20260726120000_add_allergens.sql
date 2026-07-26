-- Phase 1 Slice 1: allergen info per menu item (UK food law — shown at point of order).
alter table public.menu_items
  add column allergens text[] not null default '{}';

comment on column public.menu_items.allergens is
  'Free-form allergen tags shown to customers before ordering (e.g. milk, gluten, nuts). Empty = no data captured, UI shows "ask staff".';
