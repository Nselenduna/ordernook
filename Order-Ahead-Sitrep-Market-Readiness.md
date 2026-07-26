# Order-Ahead (Coffee Shop 2) — Sitrep & Market-Readiness Report

**Prepared:** 17 July 2026 · Assessed from codebase at `Coffee shop 2/order-ahead` + HANDOFF.md / SPEC.md
**Verdict: ON TRACK, pre-market by design. Phase 0 of 3 is complete and verified. This is the healthiest project of the three assessed — the gap to a sellable Basic tier is Phase 1, roughly 2–4 focused weeks.**

---

## 1. Situation Report

**Product:** White-label order-ahead PWA for small food & drink shops. Shops get a branded installable app via QR scan; customers order ahead and skip the queue; flat subscription (£12 Basic / £25 Pro hypothesis), no per-order commission; customer money flows directly to shops via Stripe Connect (Phase 2).

**Stack:** Next.js 16 (App Router) · Supabase (Postgres/Auth/RLS/Realtime) · Tailwind 4 + shadcn/ui · web-push · Zustand. Live Supabase project (`order-ahead`, eu-west-2).

**Activity:** 6 commits, all 11 Jul 2026 — 6 days old and actively moving. Unlike EduLink and RentLink, **work is committed**, and the repo carries a disciplined doc system (state.md, handoff.md, roadmap.md, decisions/log.md, locked SPEC v0.1).

### Phase 0 — done and *verified*, not just written
- Full loop proven live in browser and **on a real Pixel 6 as an installed PWA**: menu → customise (size/milk/extras, price deltas) → cart → guest checkout → order lands on dashboard **via Realtime with sound** → Accept/Preparing/Ready/Collected → customer status page updates → push send path exercised
- Server-side price validation: `create_order` is a SECURITY DEFINER Postgres function that recomputes all prices from the DB, snapshots order items, and issues per-shop daily order numbers under a row lock — client totals are never trusted
- **No service-role key anywhere** — privileged ops are RPCs gated by RLS; anon spot-check confirmed orders are denied, menus readable
- Money as integers in minor units + currency; i18n strings externalised from day 1; PWA shell (manifest + sw.js) serving; audit triggers; DB advisor hardening applied
- Production build passes clean

### Gaps / risks
| Issue | Severity | Note |
|---|---|---|
| **Migrations not in the repo** | High | Schema was applied to Supabase via MCP; the SQL lives only in the hosted project. If that free-tier project is lost/paused, the schema is unrecoverable from git. Export migrations into `supabase/migrations/` now |
| Not deployed | Med | No Vercel deploy yet → no HTTPS → **iPhone PWA/push untested**, and iOS is where the install-required push constraint bites. Roadmap already lists this first — correctly |
| No automated tests | Med | The spec itself demands cross-tenant RLS leakage tests; nothing automated yet (manual spot-checks only) |
| Sentry unwired | Low | Placeholder DSN |
| Free-plan juggling | Low | `wez_me_van` project paused to free the slot; 2-project limit will pinch again at pilot — budget for Supabase Pro (~$25/mo) |
| Single hard-coded shop | By design | Phase 0 scope; self-serve registration is Phase 1 |

---

## 2. Market-Readiness (PM lens)

Phases 0–1 = the complete sellable **Basic** tier. Phase 0 done → the critical path is:

**Now**
1. Commit migrations to the repo (an hour of work, removes the single biggest asset risk)
2. Deploy to Vercel → real-device iPhone test of install + push (the one thing that can invalidate the product mechanics)
3. Phase 1: registration, menu editor, branding + dynamic per-shop manifest, QR PDF, per-shop routing, settings

**Next**
4. Pilot: 2–3 local shops, free, weekly feedback — before Stripe work. Phase 2 (Connect + Billing) only once a pilot shop actually asks to take money online, which also tests the Basic→Pro upgrade hypothesis
5. Name + domain (blocks QR printing, manifests, marketing — the longest lead-time "open item")
6. RLS leakage test suite + CI before the second real shop exists

**Business-model risks to watch (from the spec's own market scan):** GloriaFood/storekit offer free tiers monetised via payment margins — the £12/mo Basic tier is competing with free. The defensible wedge is the branded installable PWA + live counter queue; the pilot must prove shops perceive that difference. If Basic→Pro upgrades don't happen, pricing is wrong or online payment matters less than assumed — both are cheap to learn in pilot.

---

## 3. User-Research lens

The handoff already schedules the right next step: the AUDIENCE.md interview before any marketing copy. Sharpened:

- **Riskiest assumptions, in order:** (1) shop owners will pay monthly for queue-skipping (vs. free web-form competitors), (2) customers actually install from QR (the whole iOS push mechanic depends on it), (3) no-show rate on pay-in-store is tolerable
- 5–8 owner interviews at neighbourhood shops during the morning rush — observe the queue problem live; capture current workaround (phone calls, WhatsApp orders?)
- Pilot metrics that decide Phase 2: QR-scan→install rate, install→first-order rate, repeat-order rate (the "regulars" thesis), no-show rate, and whether staff keep the dashboard tab open all day
- Measure `?src=qr` attribution from day 1 — it's already in the spec

---

## 4. Compliance lens (UK launch — not legal advice)

| Area | Status | Note |
|---|---|---|
| GDPR | Well-designed | Minimal PII (name + optional phone), guest-first, tokened order access. Still needed at pilot: per-shop privacy policy, platform-as-processor DPA, export/delete flows (spec'd, not built) |
| PCI | Solved by design | Stripe Checkout hosted = SAQ-A; no card data touches the platform |
| **UK food law — allergens** | **Gap in spec** | UK food businesses must provide allergen information (14 regulated allergens) at point of order; Natasha's Law tightened labelling culture. The menu schema has no allergen fields — add `allergens` to `menu_items` in Phase 1 and display before checkout. Cheap now, painful later |
| VAT | Flagged in spec | Platform subscription VAT at threshold; also ensure shop receipts/prices display VAT-inclusive per config |
| Wallet (Phase 3) | Correctly gated | Per-shop closed loop only; legal sign-off before build — keep that gate |
| E-commerce regs | Minor | UK consumer-contract rules: order confirmation with total + shop identity (the tokened status page mostly covers this; add an email/receipt option for Pro) |

---

## 5. Bottom line — and the three-project picture

Order-Ahead is the best-run project of the three: committed code, written decisions, a locked spec, and a Phase 0 that was *verified on a real device* before being called done. Its two real exposures are operational (schema SQL not in git; iOS untested for lack of a deploy) and strategic (competing with free tiers at £12/mo — the pilot answers that).

| | EduLink Africa | RentLink Mzansi | Order-Ahead |
|---|---|---|---|
| Maturity | Frontend prototype, no backend | Near-complete MVP | Phase 0 of 3, verified |
| Git hygiene | 1 commit, 3 months uncommitted | 0 commits | ✅ 6 commits + docs |
| Backend | localStorage only | Full Supabase + RLS | Full Supabase + RLS (SQL not in repo) |
| Payments | Paynow wired, client-trusted | RevenueCat end-to-end | Deliberately deferred (Phase 2) |
| Distance to revenue | Months | 2–4 weeks | 2–4 weeks (Phase 1 → pilot) |
| Next single action | Pick business model | Commit + rotate keys | Export migrations to repo, deploy |

The working pattern that produced Order-Ahead (spec → phased build → verify → handoff docs) is exactly what EduLink and RentLink are missing — worth retrofitting to both.
