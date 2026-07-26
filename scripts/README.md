# Pilot onboarding

To add a pilot shop (no self-serve signup yet — Slice 4):

1. Open the Supabase SQL editor for project `iryavyogljedwgllaoit`.
2. Paste `seed-shop.sql`, edit the four `\set` values (slug, name, owner email, owner password) and the menu inserts to match the shop.
3. Run it.
4. Give the owner: `https://ordernook.uk/<slug>` (their QR is in the dashboard) and their login.
5. In the dashboard, refine the menu (Slice 2) / settings / print the QR.

The owner login uses a `.test`-style email by design (no email delivery). Change the password before handing it over.
