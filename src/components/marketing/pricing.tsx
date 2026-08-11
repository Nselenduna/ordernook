import { Check } from "lucide-react";
import { CtaButton } from "@/components/marketing/cta-button";

const included = [
  "Your own branded ordering page",
  "Live orders dashboard",
  "Options, modifiers & item photos",
  "Push notifications & QR poster",
  "Installable app for your customers",
  "Take payment online — card checkout & automatic refunds",
  "Zero commission on every order",
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-heading text-3xl font-extrabold tracking-tight text-[color:var(--brand-dark)] sm:text-4xl">
          One simple price
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          No commission, no setup fee, no lock-in. Cancel any time.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-md">
        <div className="relative rounded-3xl border-2 border-primary bg-card p-8 shadow-sm">
          <span className="absolute -top-3 left-8 rounded-full bg-[color:var(--brand-amber)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Available now
          </span>
          <h3 className="font-heading text-xl font-bold text-[color:var(--brand-dark)]">
            Basic
          </h3>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-heading text-5xl font-extrabold text-primary">
              £12
            </span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <p className="mt-2 text-sm font-medium text-primary">
            30-day free trial — no card required
          </p>

          <ul className="mt-6 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  strokeWidth={2.5}
                />
                <span className="text-sm text-foreground">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <CtaButton href="/dashboard/register" className="w-full">
              Start your free trial
            </CtaButton>
          </div>
        </div>
      </div>
    </section>
  );
}
