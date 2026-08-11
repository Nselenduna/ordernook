import { CtaButton } from "@/components/marketing/cta-button";
import { OnMark } from "@/components/marketing/on-logo";

const stats = [
  { value: "30-day", label: "free trial, no card" },
  { value: "Minutes", label: "to go live" },
  { value: "0%", label: "commission — ever" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft green wash behind the fold */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-accent/70 via-background to-background"
      />
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3.5 py-1.5 text-sm font-medium text-primary">
          <OnMark size={20} detail="initials" />
          Ordering made easy for everyone
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl font-heading text-4xl font-extrabold tracking-tight text-[color:var(--brand-dark)] sm:text-6xl">
          Your customers want to order from their phone.{" "}
          <span className="text-[color:var(--brand-amber)]">Now they can.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Give your café its own ordering page and live dashboard in minutes. No
          queues, no missed phone calls, and none of the big-platform 30% cut —
          just orders, straight to you.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CtaButton href="/dashboard/register">Start free — no card</CtaButton>
          <CtaButton href="/corner-grind" variant="outline">
            See a live demo
          </CtaButton>
        </div>

        <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card px-5 py-4 text-center shadow-[0_1px_0_rgba(0,0,0,0.02)]"
            >
              <dt className="font-heading text-2xl font-bold text-primary">
                {s.value}
              </dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
