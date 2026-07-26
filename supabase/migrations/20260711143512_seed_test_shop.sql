-- Seed: UK config + test shop "The Corner Grind" + menu + staff owner login
insert into public.countries (code, currency, locale, timezone, tax_display, features)
values ('GB', 'GBP', 'en-GB', 'Europe/London', 'inclusive',
        '{"payment_methods":["card","apple_pay","google_pay"],"wallet_enabled":true}'::jsonb);

do $$
declare
  v_shop_id uuid;
  v_cat_coffee uuid;
  v_cat_notcoffee uuid;
  v_cat_pastries uuid;
  v_item record;
  v_group_id uuid;
  v_user_id uuid := gen_random_uuid();
begin
  insert into public.shops (slug, name, country_code, branding, prep_minutes, hours)
  values ('corner-grind', 'The Corner Grind', 'GB',
          '{"primary":"#6F4E37","accent":"#D89A7E","background":"#F6EBDF","logo_url":null,"tagline":"Skip the queue. Your coffee, ready when you are."}'::jsonb,
          10,
          '{"mon":["07:00","17:00"],"tue":["07:00","17:00"],"wed":["07:00","17:00"],"thu":["07:00","17:00"],"fri":["07:00","17:00"],"sat":["08:00","16:00"],"sun":null}'::jsonb)
  returning id into v_shop_id;

  insert into public.locations (shop_id, address)
  values (v_shop_id, '12 Market Street, Leyland, Lancashire PR25 1AA');

  insert into public.menu_categories (shop_id, name, sort_order) values (v_shop_id, 'Coffee', 1) returning id into v_cat_coffee;
  insert into public.menu_categories (shop_id, name, sort_order) values (v_shop_id, 'Not Coffee', 2) returning id into v_cat_notcoffee;
  insert into public.menu_categories (shop_id, name, sort_order) values (v_shop_id, 'Pastries & Bakes', 3) returning id into v_cat_pastries;

  insert into public.menu_items (shop_id, category_id, name, description, price_minor, currency, sort_order) values
    (v_shop_id, v_cat_coffee, 'Espresso', 'Double shot, rich and short', 250, 'GBP', 1),
    (v_shop_id, v_cat_coffee, 'Americano', 'Double espresso, hot water', 280, 'GBP', 2),
    (v_shop_id, v_cat_coffee, 'Flat White', 'Double shot, velvety microfoam', 320, 'GBP', 3),
    (v_shop_id, v_cat_coffee, 'Latte', 'Smooth and milky', 330, 'GBP', 4),
    (v_shop_id, v_cat_coffee, 'Cappuccino', 'Equal parts espresso, steamed milk, foam', 330, 'GBP', 5),
    (v_shop_id, v_cat_coffee, 'Mocha', 'Espresso meets chocolate', 360, 'GBP', 6),
    (v_shop_id, v_cat_notcoffee, 'Hot Chocolate', 'Proper cocoa, whipped cream optional', 320, 'GBP', 1),
    (v_shop_id, v_cat_notcoffee, 'English Breakfast Tea', 'Yorkshire, obviously', 250, 'GBP', 2),
    (v_shop_id, v_cat_notcoffee, 'Chai Latte', 'Spiced and comforting', 340, 'GBP', 3),
    (v_shop_id, v_cat_pastries, 'Butter Croissant', 'Baked fresh each morning', 280, 'GBP', 1),
    (v_shop_id, v_cat_pastries, 'Pain au Chocolat', NULL, 320, 'GBP', 2),
    (v_shop_id, v_cat_pastries, 'Blueberry Muffin', NULL, 300, 'GBP', 3),
    (v_shop_id, v_cat_pastries, 'Sausage Roll', 'Local butcher''s pork, all-butter pastry', 350, 'GBP', 4);

  -- Size / Milk / Extras on milky drinks (shapes from the old Expo app)
  for v_item in
    select id from public.menu_items
    where shop_id = v_shop_id
      and name in ('Americano','Flat White','Latte','Cappuccino','Mocha','Hot Chocolate','Chai Latte')
  loop
    insert into public.option_groups (item_id, name, type, required, sort_order)
    values (v_item.id, 'Size', 'single', true, 1) returning id into v_group_id;
    insert into public.options (group_id, name, price_delta_minor, sort_order) values
      (v_group_id, 'Small', 0, 1), (v_group_id, 'Medium', 40, 2), (v_group_id, 'Large', 70, 3);

    insert into public.option_groups (item_id, name, type, required, sort_order)
    values (v_item.id, 'Milk', 'single', false, 2) returning id into v_group_id;
    insert into public.options (group_id, name, price_delta_minor, sort_order) values
      (v_group_id, 'Whole', 0, 1), (v_group_id, 'Skimmed', 0, 2),
      (v_group_id, 'Oat', 40, 3), (v_group_id, 'Soya', 40, 4), (v_group_id, 'Coconut', 40, 5);

    insert into public.option_groups (item_id, name, type, required, sort_order)
    values (v_item.id, 'Extras', 'multi', false, 3) returning id into v_group_id;
    insert into public.options (group_id, name, price_delta_minor, sort_order) values
      (v_group_id, 'Extra shot', 50, 1), (v_group_id, 'Vanilla syrup', 40, 2),
      (v_group_id, 'Caramel syrup', 40, 3), (v_group_id, 'Decaf', 0, 4);
  end loop;

  -- Staff owner login (dev seed): owner@cornergrind.test / CornerGrind-Demo1!
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token,
                          email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
          'owner@cornergrind.test', crypt('CornerGrind-Demo1!', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_user_id, v_user_id::text,
          jsonb_build_object('sub', v_user_id::text, 'email', 'owner@cornergrind.test', 'email_verified', true),
          'email', now(), now(), now());

  insert into public.staff_users (shop_id, auth_user_id, role)
  values (v_shop_id, v_user_id, 'owner');
end $$;