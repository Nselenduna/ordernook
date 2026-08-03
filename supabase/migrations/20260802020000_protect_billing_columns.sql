-- Billing columns must be written ONLY by the Stripe webhook (service role) —
-- never by shop staff, who could otherwise self-grant entitlement (bypass
-- billing) via the blanket shops_staff_update RLS policy.
-- A trigger blocks authenticated/anon from changing these; service_role,
-- postgres, and migrations (no JWT) pass through.

create or replace function public.protect_shop_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() in ('authenticated', 'anon') then
    if new.subscription_status is distinct from old.subscription_status
       or new.plan_tier is distinct from old.plan_tier
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_account_id is distinct from old.stripe_account_id then
      raise exception 'billing columns are read-only';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_shop_billing on public.shops;
create trigger protect_shop_billing
  before update on public.shops
  for each row execute function public.protect_shop_billing_columns();
