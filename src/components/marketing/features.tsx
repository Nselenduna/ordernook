import {
  Store,
  LayoutDashboard,
  SlidersHorizontal,
  ImageIcon,
  BellRing,
  Smartphone,
  QrCode,
  BadgePercent,
} from "lucide-react";

const features = [
  {
    icon: Store,
    title: "Your own branded page",
    body: "A clean ordering page with your name, colours and logo — not a listing lost on someone else's marketplace.",
  },
  {
    icon: LayoutDashboard,
    title: "Live orders dashboard",
    body: "Every order in one place, updating in real time. Accept, prepare, ready, collected.",
  },
  {
    icon: SlidersHorizontal,
    title: "Options & modifiers",
    body: "Oat milk, extra shot, no sugar. Build option groups so customers order exactly what they want.",
  },
  {
    icon: ImageIcon,
    title: "Item photos",
    body: "Show off your bakes and brews. Photos sell more than words ever will.",
  },
  {
    icon: BellRing,
    title: "Push notifications",
    body: "A ping the moment an order comes in — even when the page is closed.",
  },
  {
    icon: Smartphone,
    title: "Installable app",
    body: "Customers can add your shop to their home screen. No app store, no download friction.",
  },
  {
    icon: QrCode,
    title: "QR poster, ready to print",
    body: "Generate a counter poster in one click. Scan, order, done.",
  },
  {
    icon: BadgePercent,
    title: "Zero commission",
    body: "One flat monthly price. Keep 100% of every order — no per-order cut, ever.",
  },
];

export function Features() {
  return (
    <section id="features" className="bg-secondary py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-[color:var(--brand-dark)] sm:text-4xl">
            Everything you need to take orders
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built for small shops, not enterprises. Powerful where it counts,
            simple everywhere else.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                <f.icon className="size-5" strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-heading text-lg font-bold text-[color:var(--brand-dark)]">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
