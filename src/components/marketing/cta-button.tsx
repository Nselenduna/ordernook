import Link from "next/link";

/**
 * Large pill CTA for the marketing site. The app's shadcn Button is tuned for
 * compact dashboard density (h-8/h-9); the landing page wants generous,
 * thumb-friendly pills, so these are purpose-built.
 */
type CtaButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  /** Renders a plain <a> for off-app links. */
  external?: boolean;
  className?: string;
};

const base =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 active:translate-y-px";

const styles: Record<NonNullable<CtaButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-[color:var(--brand-dark)]",
  outline:
    "border border-primary/30 bg-background text-primary hover:border-primary hover:bg-accent",
};

export function CtaButton({
  href,
  children,
  variant = "primary",
  external,
  className,
}: CtaButtonProps) {
  const cls = `${base} ${styles[variant]} ${className ?? ""}`;
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
