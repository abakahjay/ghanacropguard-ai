import { useEffect, useState } from "react";
import { Link } from "wouter";

import { AppShell } from "@/components/AppShell";
import { UploadWorkspace } from "@/components/UploadWorkspace";
import { useAuth } from "@/lib/auth";
import { absoluteUrl, api } from "@/lib/client";
import { useTitle } from "@/lib/useTitle";

export function AppHome() {
  useTitle("Check a leaf");
  const { user } = useAuth();
  const [recent, setRecent] = useState(null);
  const [recentError, setRecentError] = useState(false);
  useEffect(() => {
    let live = true;
    api("/predictions/history?page_size=4")
      .then((r) => live && setRecent(r))
      .catch(() => live && setRecentError(true));
    return () => {
      live = false;
    };
  }, []);
  const first = user.full_name?.split(" ")[0];

  return (
    <AppShell
      user={user}
      title="Check a leaf"
      actions={
        <Link href="/app/history" className="btn btn-quiet btn-sm">
          History
        </Link>
      }
    >
      <p className="mb-6 max-w-[70ch] text-[16px] text-ink-2">
        {first ? `Akwaaba, ${first}. ` : ""}Take or choose a photo of a cashew, cassava, maize or tomato leaf. You get
        the most likely condition, two alternatives and practical next steps.
      </p>
      <UploadWorkspace />

      <section aria-labelledby="recent-h" className="mt-10 rounded-[var(--radius-lg)] bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="recent-h" className="text-[14px] font-semibold">
            Recent checks{" "}
            {recent ? <span className="tabular ml-1.5 font-normal text-muted">{recent.total}</span> : null}
          </h2>
          <Link href="/app/history" className="text-[14px] text-ink-2 hover:text-ink">
            View all
          </Link>
        </div>
        {recentError ? (
          <p className="text-[15px] text-muted">Your history could not be loaded right now.</p>
        ) : !recent ? (
          <p role="status" className="text-[15px] text-muted">
            Loading…
          </p>
        ) : recent.items.length === 0 ? (
          <p className="text-[15px] text-muted">No checks yet. Your results will be listed here.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {recent.items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/app/results/${p.id}`}
                  className="flex h-[63px] items-center gap-3 rounded-lg bg-raised px-3 transition-colors hover:bg-[#243026]"
                >
                  {p.image_url ? (
                    <img src={absoluteUrl(p.image_url)} alt="" className="h-10 w-10 shrink-0 rounded object-cover" loading="lazy" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded bg-surface" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">
                      {p.predicted?.display_name} <span className="text-muted">· {p.crop}</span>
                    </span>
                    <span className="block text-[13px] text-muted">
                      {new Date(p.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[15px] text-ink-2">
                    {((p.predicted?.confidence ?? 0) * 100).toFixed(0)}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
