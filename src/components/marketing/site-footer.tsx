import Link from "next/link";
import { OnPill } from "@/components/marketing/on-logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div>
            <OnPill height={40} />
            <p className="mt-3 text-sm text-muted-foreground">
              A{" "}
              <a
                href="https://zizweit.uk"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground hover:text-primary"
              >
                Zizwe IT
              </a>{" "}
              product · Low Cost. High Impact.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link
              href="/dashboard/register"
              className="text-muted-foreground hover:text-foreground"
            >
              Start free
            </Link>
            <Link
              href="/dashboard/login"
              className="text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <a
              href="https://zizweit.uk"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href="https://zizweit.uk"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              Terms
            </a>
            <a
              href="mailto:support@zizweit.uk"
              className="text-muted-foreground hover:text-foreground"
            >
              support@zizweit.uk
            </a>
          </nav>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Zizwe IT Limited
        </p>
      </div>
    </footer>
  );
}
