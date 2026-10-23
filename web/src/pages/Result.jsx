import { useEffect, useState } from "react";
import { Link } from "wouter";

import { AppShell } from "@/components/AppShell";
import { ConfidenceBars } from "@/components/ConfidenceBars";
import { ResultActions } from "@/components/ResultActions";
import { useAuth } from "@/lib/auth";
import { absoluteUrl, api } from "@/lib/client";
import { useTitle } from "@/lib/useTitle";
import { NotFound } from "@/pages/Errors";

const KIND = { disease: "Disease", pest: "Pest damage", healthy: "No problem detected" };

export function ResultPage({ id }) {
  useTitle("Result");
  const { user } = useAuth();
  const [loaded, setLoaded] = useState({ id: null, p: null, status: "loading" });
  useEffect(() => {
    let live = true;
    api(`/predictions/${encodeURIComponent(id)}`)
      .then((p) => live && setLoaded({ id, p, status: "ok" }))
      .catch((e) => live && setLoaded({ id, p: null, status: e.status === 404 ? "missing" : "error" }));
    return () => {
      live = false;
    };
  }, [id]);
  // Until the response for this id arrives, show loading (not the previous result).
  const state = loaded.id === id ? loaded : { p: null, status: "loading" };
  if (state.status === "missing") return <NotFound />;
  if (state.status !== "ok") {
    return (
      <AppShell user={user} title="Result">
        {state.status === "loading" ? (
          <p role="status" className="text-[15px] text-muted">
            Loading…
          </p>
        ) : (
          <p role="alert" className="rounded-md bg-[var(--danger-bg)] p-5 text-[var(--danger-ink)]">
            This result could not be loaded. Check your connection and refresh the page.
          </p>
        )}
      </AppShell>
    );
  }
  const p = state.p;
  const top = p.predicted;
  const lowConf = p.warnings.some((w) => w.code === "low_confidence");
  const shownWarnings = p.warnings.filter((w) => w.code !== "scope");
  const scope = p.warnings.find((w) => w.code === "scope");

  return (
    <AppShell
      user={user}
      title={
        <>
          {top.display_name} <span className="text-muted">· {cap(top.crop)}</span>
        </>
      }
      actions={
        <Link href="/app" className="btn btn-primary btn-sm">
          Check another
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
        <div className="grid content-start gap-4 lg:sticky lg:top-8 lg:self-start">
          {p.image_url ? (
            <img
              src={absoluteUrl(p.image_url)}
              alt={`Your photo, assessed as ${top.display_name} on ${top.crop}`}
              className="w-full rounded-[var(--radius-lg)] bg-surface object-contain"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-[var(--radius-lg)] bg-surface p-6 text-center text-[15px] text-muted">
              The photo was not stored (image storage is switched off or the photo has expired).
            </div>
          )}
          <ResultActions id={p.id} saved={p.saved} note={p.note} />
        </div>

        <div className="grid content-start gap-6">
          <section aria-labelledby="verdict-h" className="grid gap-5 rounded-[var(--radius-lg)] bg-surface p-5 lg:p-6">
            <div>
              <p className="text-[14px] text-muted">
                {KIND[top.kind] ?? top.kind} · model {p.model_version}
              </p>
              <h2
                id="verdict-h"
                className="mt-1 text-[clamp(26px,2.6vw,34px)] font-light leading-[1.1] tracking-[-0.02em]"
              >
                {lowConf ? "Possibly " : "Most likely "}
                {top.display_name.toLowerCase()}
              </h2>
            </div>
            <ConfidenceBars items={p.top_predictions} />
            <p className="text-[14px] text-muted">
              Analysed in <span className="tabular">{p.processing_ms?.toFixed(0)} ms</span> ·{" "}
              {new Date(p.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </section>

          {shownWarnings.length > 0 && (
            <section
              aria-label="Uncertainty"
              className="grid gap-2 rounded-[var(--radius-lg)] bg-[var(--warning-bg)] p-5 text-[15px] text-[var(--warning-ink)]"
            >
              {shownWarnings.map((w) => (
                <p key={w.code}>{w.message}</p>
              ))}
            </section>
          )}

          <section aria-labelledby="about-h" className="grid gap-3">
            <h2 id="about-h" className="text-[18px] font-medium">
              About this condition
            </h2>
            <p className="max-w-[65ch] text-ink-2">{p.explanation}</p>
            {p.signs.length > 0 && (
              <>
                <h3 className="mt-2 text-[15px] font-semibold">What to look for</h3>
                <ul className="grid max-w-[65ch] list-disc gap-1.5 pl-5 text-ink-2">
                  {p.signs.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="steps-h" className="grid gap-3 rounded-[var(--radius-lg)] bg-surface p-5 lg:p-6">
            <h2 id="steps-h" className="text-[18px] font-medium">
              What you can do next
            </h2>
            <ol className="grid max-w-[65ch] list-decimal gap-2 pl-5 text-ink-2">
              {p.next_steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-2 max-w-[65ch] text-[15px] text-ink">{p.escalate}</p>
          </section>

          <section aria-labelledby="src-h" className="grid gap-2 text-[15px]">
            <h2 id="src-h" className="font-semibold">
              Sources
            </h2>
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {p.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="text-ink-2 underline decoration-rule underline-offset-4 hover:text-ink"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-[70ch] text-[14px] text-muted">
              {p.disclaimer} {scope?.message}
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
