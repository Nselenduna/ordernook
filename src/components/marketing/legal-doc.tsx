import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";

/**
 * Shared shell for /terms and /privacy so the two documents can't drift apart
 * visually. Wraps the marketing nav and footer around a narrow reading column.
 */
export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="theme-kupa flex min-h-full flex-col bg-background font-sans text-foreground">
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {updated}
        </p>
        <div className="mt-10 space-y-4 leading-relaxed text-foreground/90">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pt-6 text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

export function Fine({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-border pt-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
