# Pilot onboarding

To add a pilot shop (no self-serve signup yet — Slice 4):

1. Open the Supabase SQL editor for project `iryavyogljedwgllaoit`.
2. Copy `seed-shop.sql` and find-and-replace the four placeholder values: slug (`'joes-cafe'`), name (`'Joe''s Cafe'`), owner email (2 places; `'owner@joescafe.test'`), and owner password (`'ChangeMe-Now1!'`). Set a REAL owner password before running. Edit the menu inserts if needed to match the shop.
3. Paste the edited SQL into the Supabase SQL editor and Run.
4. If it errors "duplicate key value" on slug, this shop was already seeded — check the dashboard.
5. Give the owner: `https://ordernook.uk/<slug>` (their QR is in the dashboard) and their new login credentials.
6. In the dashboard, refine the menu (Slice 2) / settings / print the QR.

The owner login uses a `.test`-style email by design (no email delivery).
