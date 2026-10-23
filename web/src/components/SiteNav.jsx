import { Link } from "wouter";

import { useAuth } from "@/lib/auth";
import { AUTHOR_NAME, PORTFOLIO_URL } from "@/lib/contact";
import { photos } from "@/lib/photos";

import { Wordmark } from "./Mark";

/** "Built by Abakah Joshua", linking to the portfolio. */
export function BuiltBy({ className = "" }) {
  return (
    <span className={className}>
      Built by{" "}
      <a
        href={PORTFOLIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink underline decoration-accent underline-offset-4 hover:text-accent"
        data-testid="link-footer-portfolio"
      >
        {AUTHOR_NAME}
      </a>
    </span>
  );
}

export function SiteNav({ signedIn }) {
  const { user } = useAuth();
  signedIn = signedIn ?? Boolean(user);
  return (
    <header className="relative z-20">
      <nav aria-label="Main" className="mx-auto flex h-16 items-center justify-between px-[var(--margin)]">
        <Link href="/" aria-label="GhanaCropGuard AI home" className="shrink-0">
          {/* phones: the mark alone, so the links keep room */}
          <Wordmark className="max-[420px]:[&>span:last-child]:hidden" />
        </Link>
        <div className="flex items-center gap-4 whitespace-nowrap text-[15px] sm:gap-7">
          <Link href="/crops" className="text-ink-2 transition-colors hover:text-ink">
            Crops
          </Link>
          <a href="/#how" className="hidden text-ink-2 transition-colors hover:text-ink sm:inline">
            How it works
          </a>
          <Link href="/limitations" className="hidden text-ink-2 transition-colors hover:text-ink sm:inline">
            Limits
          </Link>
          {signedIn ? (
            <Link href="/app" className="btn btn-accent btn-sm">
              Open app
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-ink-2 transition-colors hover:text-ink">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-accent btn-sm">
                Check a leaf
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export function QuietFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-[20svh] px-[var(--margin)] pb-[30px] text-[15px] sm:mt-[30svh]">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-baseline">
        <p className="text-muted">Crop disease screening for Ghana</p>
        <p className="flex flex-wrap gap-x-6 gap-y-1">
          <Link href="/crops" className="text-ink hover:text-accent">
            Crops
          </Link>
          <Link href="/limitations" className="text-ink hover:text-accent">
            Limits &amp; accuracy
          </Link>
          <Link href="/app" className="text-ink hover:text-accent">
            App
          </Link>
          <a href="https://doi.org/10.17632/bwh3zbpkpv.1" className="text-ink hover:text-accent" rel="noopener">
            Dataset
          </a>
          <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-accent">
            Portfolio
          </a>
        </p>
        <p className="text-muted sm:text-right">
          © {year} ·{" "}
          <Link href="/privacy" className="text-ink hover:text-accent">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="text-ink hover:text-accent">
            Terms
          </Link>
        </p>
      </div>
      <p className="mt-6 text-[15px] text-ink-2">
        GhanaCropGuard AI · <BuiltBy />
      </p>
      <p className="mt-3 max-w-[80ch] text-[13px] text-muted">
        Leaf photographs: CCMT dataset, Mensah et al. (2023), Data in Brief 49:109306, Mendeley Data
        doi:10.17632/bwh3zbpkpv.1, licensed CC BY 4.0. Farm photographs from Wikimedia Commons, resized:{" "}
        {Object.values(photos).map((p, i, all) => (
          <span key={p.src}>
            <a href={p.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
              {p.author}
            </a>{" "}
            ({p.license}){i < all.length - 1 ? ", " : "."}
          </span>
        ))}
      </p>
    </footer>
  );
}
