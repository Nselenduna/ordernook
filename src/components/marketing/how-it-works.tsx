import { ClipboardList, QrCode, BellRing } from "lucide-react";

const steps = [
  {
    icon: ClipboardList,
    title: "Register & build your menu",
    body: "Sign up free and add your items, photos and options in a few taps. 30-day trial, no card needed.",
  },
  {
    icon: QrCode,
    title: "Share your QR code",
    body: "Print the poster and pop it on the counter, the table or the van. Customers scan and order in seconds.",
  },
  {
    icon: BellRing,
    title: "Orders land on your dashboard",
    body: "Get a ping for every order. Accept, prepare, mark ready — and never miss a sale to a busy phone line again.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-heading text-3xl font-extrabold tracking-tight text-[color:var(--brand-dark)] sm:text-4xl">
          Live in three steps
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          No developers, no app store, no setup fee. If you can build a menu, you
          can take orders today.
        </p>
      </div>

      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="relative rounded-2xl border border-border bg-card p-7"
          >
            <span className="absolute right-6 top-6 font-heading text-5xl font-extrabold text-[rgba(217,119,6,0.3)]">
              {i + 1}
            </span>
            <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[color:var(--brand-amber-bg)] text-[color:var(--brand-amber-dark)]">
              <step.icon className="size-6" strokeWidth={2} />
            </span>
            <h3 className="mt-5 font-heading text-xl font-bold text-[color:var(--brand-dark)]">
              {step.title}
            </h3>
            <p className="mt-2 text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
