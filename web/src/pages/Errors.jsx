import { Link } from "wouter";

import { SiteNav } from "@/components/SiteNav";
import { useTitle } from "@/lib/useTitle";

export function ErrorPage({ reset }) {
  return (
    <main className="grid min-h-[70svh] content-center gap-6 px-[var(--margin)]">
      <h1 className="text-[length:var(--step-head)] font-light tracking-[-0.035em]">Something went wrong</h1>
      <p className="max-w-[52ch] text-ink-2">
        This page could not be shown. If you are on mobile data, check your signal and try again.
      </p>
      <button type="button" onClick={reset} className="btn btn-accent justify-self-start">
        Try again
      </button>
    </main>
  );
}

export function NotFound() {
  useTitle("Page not found");
  return (
    <>
      <SiteNav />
      <main className="grid min-h-[70svh] content-center gap-6 px-[var(--margin)]">
        <h1 className="text-[length:var(--step-head)] font-light tracking-[-0.035em]">Page not found</h1>
        <p className="max-w-[48ch] text-ink-2">
          The page or result you were looking for does not exist, or it belongs to another account.
        </p>
        <p className="flex gap-3">
          <Link href="/app" className="btn btn-accent">
            Check a leaf
          </Link>
          <Link href="/" className="btn btn-quiet">
            Home
          </Link>
        </p>
      </main>
    </>
  );
}
