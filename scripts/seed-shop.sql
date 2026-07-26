-- OrderNook pilot shop seed. Plain SQL for the Supabase Dashboard SQL editor.
-- Before running, find-and-replace these four placeholder values throughout the script:
--   1. slug: 'joes-cafe'
--   2. name: 'Joe''s Cafe'
--   3. owner email (2 places): 'owner@joescafe.test'
--   4. owner password: 'ChangeMe-Now1!'
-- You can also edit the menu inserts to match the real shop.
-- UK country row is assumed to exist already.

do $$
declare
  v_shop_id uuid;
  v_cat uuid;
  v_user_id uuid := gen_random_uuid();
begin
  insert into public.shops (slug, name, country_code, branding, prep_minutes, hours)
  values ('joes-cafe', 'Joe''s Cafe', 'GB',
          jsonb_build_object('tagline', 'Skip the queue.'),
          10, '{}'::jsonb)
  returning id into v_shop_id;

  insert into public.locations (shop_id, address) values (v_shop_id, 'TBC');

  insert into public.menu_categories (shop_id, name, sort_order)
  values (v_shop_id, 'Drinks', 1) returning id into v_cat;

  insert into public.menu_items
    (shop_id, category_id, name, description, price_minor, currency, sort_order, allergens)
  values
    (v_shop_id, v_cat, 'Latte', 'Smooth and milky', 330, 'GBP', 1, array['milk']),
    (v_shop_id, v_cat, 'Americano', 'Double espresso, hot water', 280, 'GBP', 2, '{}');

  -- Owner login (same pattern as the Corner Grind seed).
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token,
                          email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
          'owner@joescafe.test', crypt('ChangeMe-Now1!', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_user_id, v_user_id::text,
          jsonb_build_object('sub', v_user_id::text, 'email', 'owner@joescafe.test', 'email_verified', true),
          'email', now(), now(), now());

  insert into public.staff_users (shop_id, auth_user_id, role)
  values (v_shop_id, v_user_id, 'owner');
end $$;
