import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";

import { AdminUsers } from "@/components/AdminUsers";
import { AppShell } from "@/components/AppShell";
import { BarList, DailyColumns } from "@/components/charts";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/client";
import { intOr, numOr, pctOr } from "@/lib/format";
import { useTitle } from "@/lib/useTitle";

const REASON = {
  invalid_image: "Unreadable or non-image file",
  model_unavailable: "Model not loaded",
  inference_error: "Error while analysing",
};

export function AdminPage() {
  useTitle("Admin");
  const { user } = useAuth();
  const asked = Number(new URLSearchParams(useSearch()).get("days"));
  const days = [7, 30, 90].includes(asked) ? asked : 30;
  const [loaded, setLoaded] = useState({ days: null, s: null, error: null });
  useEffect(() => {
    let live = true;
    api(`/statistics?days=${days}`)
      .then((s) => live && setLoaded({ days, s, error: null }))
      .catch((e) =>
        live && setLoaded({ days, s: null, error: e.status ? ` (error ${e.status})` : " — the API is not reachable" }),
      );
    return () => {
      live = false;
    };
  }, [days]);
  const state = loaded.days === days ? loaded : { s: null, error: null };
  if (!state.s) {
    return (
      <AppShell user={user} title="Admin">
        {state.error === null ? (
          <p role="status" className="text-[15px] text-muted">
            Loading…
          </p>
        ) : (
          <p role="alert" className="rounded-md bg-[var(--danger-bg)] p-5 text-[var(--danger-ink)]">
            Statistics could not be loaded{state.error}.
          </p>
        )}
      </AppShell>
    );
  }
  const s = state.s;
  const L = s.live;
  const failRate = L.total_requests ? L.failed_requests / L.total_requests : 0;
  const topReason = Object.entries(L.failed_by_reason).sort((a, b) => b[1] - a[1])[0];
  const finding =
    L.total_requests === 0
      ? "No requests yet. Usage will appear here after the first photo is checked."
      : L.failed_requests === 0
        ? `${plural(L.successful_predictions, "successful prediction")} and no failed requests so far.`
        : `${L.failed_requests.toLocaleString("en-GB")} of ${plural(L.total_requests, "request")} failed (${(failRate * 100).toFixed(1)}%)${
            topReason ? `, most often: ${(REASON[topReason[0]] ?? topReason[0]).toLowerCase()}` : ""
          }.`;
  const lowShare = L.successful_predictions ? L.low_confidence_predictions / L.successful_predictions : null;
  const crops = ["cashew", "cassava", "maize", "tomato"]
    .map((c) => ({ label: c[0].toUpperCase() + c.slice(1), value: L.crop_distribution[c] ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const tm = s.model.historical_test_metrics;

  const kpis = [
    { label: "Successful predictions", value: L.successful_predictions.toLocaleString("en-GB") },
    {
      label: "Failed requests",
      value: L.failed_requests.toLocaleString("en-GB"),
      note: L.total_requests ? `${(failRate * 100).toFixed(1)}% of all` : "–",
    },
    {
      label: "Average processing",
      value: L.average_processing_ms != null ? L.average_processing_ms.toFixed(0) : "–",
      unit: L.average_processing_ms != null ? "ms" : undefined,
    },
    {
      label: "Low-confidence results",
      value: L.low_confidence_predictions.toLocaleString("en-GB"),
      note: lowShare != null ? `${(lowShare * 100).toFixed(1)}% below 60% confidence` : "–",
    },
    { label: "Accounts", value: L.users.toLocaleString("en-GB") },
  ];

  return (
    <AppShell
      user={user}
      title="Admin"
      actions={
        <nav aria-label="Period" className="flex gap-1 text-[14px]">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/admin?days=${d}`}
              aria-current={d === days ? "true" : undefined}
              className={`rounded-md px-3 py-1.5 ${d === days ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}
            >
              {d} days
            </Link>
          ))}
        </nav>
      }
    >
      <p className="mb-6 max-w-[80ch] text-[16px] text-ink-2">{finding}</p>

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] bg-rule sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-surface p-4">
            <dt className="text-[14px] text-muted">{k.label}</dt>
            <dd className="tabular mt-1 text-[26px] font-normal leading-tight">
              {k.value}
              {k.unit && <span className="ml-1 text-[14px] text-muted">{k.unit}</span>}
            </dd>
            {k.note && <dd className="mt-0.5 text-[13px] text-muted">{k.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="vol-h" className="rounded-[var(--radius-lg)] bg-surface p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="vol-h" className="text-[14px] font-semibold">
              Requests per day
            </h2>
            <p className="flex gap-4 text-[13px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 bg-accent" />
                Successful
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 bg-negative" />
                Failed
              </span>
              <span>last {days} days</span>
            </p>
          </div>
          {L.volume_by_day.length ? (
            <DailyColumns data={L.volume_by_day} />
          ) : (
            <p className="py-10 text-[15px] text-muted">No requests in this period.</p>
          )}
        </section>

        <section aria-labelledby="crop-h" className="rounded-[var(--radius-lg)] bg-surface p-5">
          <h2 id="crop-h" className="mb-4 text-[14px] font-semibold">
            Crops checked
          </h2>
          <BarList rows={crops} highlightFirst={crops[0]?.value > 0} />
          {Object.keys(L.failed_by_reason).length > 0 && (
            <>
              <h3 className="mb-3 mt-6 text-[14px] font-semibold">Why requests failed</h3>
              <BarList
                rows={Object.entries(L.failed_by_reason).map(([k, v]) => ({ label: REASON[k] ?? k, value: v }))}
                highlightFirst={false}
              />
            </>
          )}
        </section>

        <section aria-labelledby="cls-h" className="rounded-[var(--radius-lg)] bg-surface p-5">
          <h2 id="cls-h" className="mb-4 text-[14px] font-semibold">
            Most frequent predictions <span className="font-normal text-muted">(not verified diagnoses)</span>
          </h2>
          {L.class_distribution.length ? (
            <BarList
              rows={L.class_distribution
                .slice(0, 8)
                .map((c) => ({ label: c.display_name, sub: c.crop, value: c.count }))}
            />
          ) : (
            <p className="text-[15px] text-muted">No predictions yet.</p>
          )}
        </section>

        <section aria-labelledby="model-h" className="rounded-[var(--radius-lg)] bg-surface p-5">
          <h2 id="model-h" className="text-[14px] font-semibold">
            Model in service
          </h2>
          <p className="mt-1 text-[15px]">
            {s.model.current_version ?? <span className="text-negative">Not loaded — {s.model.error}</span>}
          </p>
          {tm ? (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-y-3 text-[14px]">
                <dt className="text-muted">Test accuracy</dt>
                <dd className="tabular text-right">{pctOr(tm.accuracy)}</dd>
                <dt className="text-muted">Top-3 accuracy</dt>
                <dd className="tabular text-right">{pctOr(tm.top3_accuracy)}</dd>
                <dt className="text-muted">Macro F1</dt>
                <dd className="tabular text-right">{numOr(tm.f1_macro)}</dd>
                <dt className="text-muted">Test images</dt>
                <dd className="tabular text-right">{intOr(tm.n_images)}</dd>
                {tm.latency_cpu && (
                  <>
                    <dt className="text-muted">CPU latency p50</dt>
                    <dd className="tabular text-right">{numOr(tm.latency_cpu.p50_ms, 1)} ms</dd>
                  </>
                )}
              </dl>
              <p className="mt-4 text-[13px] text-muted">{s.note}</p>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-muted">No recorded evaluation metrics for this model.</p>
          )}
        </section>
      </div>

      <AdminUsers currentUserId={user.id} />
    </AppShell>
  );
}

function plural(n, noun) {
  return `${n.toLocaleString("en-GB")} ${noun}${n === 1 ? "" : "s"}`;
}
