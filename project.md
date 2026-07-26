# project.md — OrderNook (North Star)

**What:** White-label order-ahead PWA for small neighbourhood food & drink shops (coffee, sandwiches, bakeries). Shop registers → builds menu → gets a QR code → customers scan once, install the shop's branded PWA, order ahead, skip the queue.

**Why:** Small shops can only take an order when the customer is at the counter → queues, walk-aways, no menu visibility. Marketplaces (Deleveroo/Uber Eats) take commission; we don't.

**Business model:** Flat subscription via Stripe Billing. Basic £12/mo (pay-in-store only) · Pro £25/mo (+ Stripe Checkout online payments, wallet later). Zero per-order commission. Customer money goes directly to shops via Stripe Connect (Standard, direct charges) — platform never touches order money.

**Source of truth:** `../HANDOFF.md` (locked spec v0.1, 11 Jul 2026). Read it before changing anything structural.

**Owner:** Lloyd Mgutshini, Zizwe IT Limited. UK launch first, country-config from day 1.
