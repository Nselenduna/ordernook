import Link from "next/link";
import { OnPill } from "@/components/marketing/on-logo";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="OrderNook home">
          <OnPill height={40} />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Link
            href="/dashboard/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard/register"
            className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[color:var(--brand-dark)]"
          >
            Register free
          </Link>
        </div>
      </nav>
    </header>
  );
}
