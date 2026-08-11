import type { Metadata, Viewport } from "next";
import { PhoneOff, Percent, Wallet, Clock } from "lucide-react";
import { SiteNav } from "@/components/marketing/site-nav";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Features } from "@/components/marketing/features";
import { Pricing } from "@/components/marketing/pricing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CtaButton } from "@/components/marketing/cta-button";
import { OnLockup } from "@/components/marketing/on-logo";

// Phase 1: the marketing landing page for ordernook.uk. The old Phase 0
// redirect to the demo shop now lives behind the "See a live demo" CTA.
export const metadata: Metadata = {
  title: "OrderNook — order-ahead for independent shops",
  description:
    "Give your café its own branded ordering page and live dashboard in minutes. 30-day free trial, no card, zero commission. £12/month.",
};

export const viewport: Viewport = {
  themeColor: "#1D6F4C",
};

const problems = [
  {
    icon: Percent,
    title: "The big platforms take a cut of every order",
    body: "Up to 30% gone before you've paid for beans or wages.",
  },
  {
    icon: PhoneOff,
    title: "Phone orders get missed at the worst times",
    body: "A ringing phone during the morning rush is a lost sale.",
  },
  {
    icon: Wallet,
    title: "A custom app costs £10k+ and months of work",
    body: "Out of reach for a shop that just wants to take orders.",
  },
  {
    icon: Clock,
    title: "Queues cost you customers who won't wait",
    body: "People walk when the line is long. Let them order ahead.",
  },
];

const audience = [
  "Cafés",
  "Coffee carts",
  "Food trucks",
  "Delis",
  "Bakeries",
  "Sandwich shops",
  "Juice bars",
  "Campus canteens",
];

export default function Home() {
  return (
    <div className="theme-kupa flex min-h-full flex-col bg-background font-sans text-foreground">
      <SiteNav />

      <main className="flex-1">
        <Hero />

        {/* The problem */}
        <section className="bg-secondary py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-extrabold tracking-tight text-[color:var(--brand-dark)] sm:text-4xl">
                Taking orders shouldn&apos;t cost you your margin
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                The tools built for small shops are either too expensive, too
                complicated, or take a bite out of every sale.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {problems.map((p) => (
                <div
                  key={p.title}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-6"
                >
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-amber-bg)] text-[color:var(--brand-amber-dark)]">
                    <p.icon className="size-5" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-[color:var(--brand-dark)]">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-muted-foreground">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />
        <Features />

        {/* Who it's for */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-[color:var(--brand-dark)] sm:text-4xl">
              Made for the shop on your high street
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              If you sell food or drink to order, OrderNook fits.
            </p>
          </div>
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-3">
            {audience.map((a) => (
              <span
                key={a}
                className="pill-glossy rounded-full px-5 py-2.5 text-sm font-bold"
              >
                {a}
              </span>
            ))}
          </div>
        </section>

        <Pricing />

        {/* Final CTA */}
        <section className="bg-secondary">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
            <OnLockup height={72} className="mx-auto" />
            <h2 className="mt-8 font-heading text-3xl font-extrabold tracking-tight text-[color:var(--brand-dark)] sm:text-4xl">
              Ready to take your first order?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Set up your shop in minutes and start your 30-day free trial today.
              No card, no commission, no catch.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <CtaButton href="/dashboard/register">
                Start free — no card
              </CtaButton>
              <CtaButton href="/corner-grind" variant="outline">
                See a live demo
              </CtaButton>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
