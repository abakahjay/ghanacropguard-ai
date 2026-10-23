
import { Link } from "wouter";
import { useCallback, useEffect, useState } from "react";

import { absoluteUrl, api } from "@/lib/client";
import { CROPS } from "@/lib/types";

const PAGE_SIZE = 20;

export function HistoryList() {
  const [q, setQ] = useState("");
  const [crop, setCrop] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (q.trim()) sp.set("q", q.trim());
    if (crop) sp.set("crop", crop);
    if (savedOnly) sp.set("saved", "true");
    try {
      setData(await api(`/predictions/history?${sp}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, crop, savedOnly, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function remove(id) {
    try {
      await api(`/predictions/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const from = data && data.total ? (data.page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(data.page * data.page_size, data.total) : 0;
  const filtered = Boolean(q || crop || savedOnly);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1 sm:max-w-[340px]">
          <span className="visually-hidden">Search history</span>
          <input
            type="search"
            className="field h-9 text-[15px]"
            placeholder="Search a condition, crop or note"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div role="group" aria-label="Crop" className="flex flex-wrap gap-1.5">
          {[{ key: "", name: "All crops" }, ...CROPS].map((c) => (
            <button
              key={c.key || "all"}
              type="button"
              aria-pressed={crop === c.key}
              onClick={() => {
                setCrop(c.key);
                setPage(1);
              }}
              className={`h-9 rounded-md px-3 text-[14px] transition-colors ${
                crop === c.key ? "bg-ink text-field-ink" : "bg-surface text-ink-2 hover:text-ink"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="flex h-9 items-center gap-2 text-[14px] text-ink-2">
          <input
            type="checkbox"
            checked={savedOnly}
            onChange={(e) => {
              setSavedOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Saved only
        </label>
      </div>

      <div className="rounded-[var(--radius-lg)] bg-surface">
        <div className="flex items-baseline justify-between px-5 pt-4 text-[14px] text-muted">
          <span className="tabular">{data ? (data.total ? `${from}–${to} of ${data.total}` : "0 results") : " "}</span>
          {loading && <span role="status">Loading…</span>}
        </div>
        {error ? (
          <div role="alert" className="grid gap-3 p-5">
            <p className="text-[var(--danger-ink)]">{error}</p>
            <button type="button" className="btn btn-quiet btn-sm justify-self-start" onClick={load}>
              Try again
            </button>
          </div>
        ) : data && data.items.length === 0 && !loading ? (
          <div className="grid gap-3 p-5 pb-6">
            <p className="text-ink-2">
              {filtered ? "No checks match these filters." : "You have not checked any leaves yet."}
            </p>
            {!filtered && (
              <Link href="/app" className="btn btn-primary btn-sm justify-self-start">
                Check a leaf
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-px px-2 pb-2 pt-2">
            {data?.items.map((p) => (
              <li
                key={p.id}
                className="group relative flex min-h-[72px] items-center gap-3 rounded-lg px-3 py-3 sm:gap-4 transition-colors hover:bg-raised"
              >
                {p.image_url ? (
                  <img src={absoluteUrl(p.image_url)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="h-12 w-12 shrink-0 rounded-lg bg-raised" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/results/${p.id}`}
                    className="block truncate text-[16px] after:absolute after:inset-0"
                  >
                    {p.predicted?.display_name} <span className="text-muted">· {p.crop}</span>
                    {p.saved && (
                      <span className="ml-2 rounded bg-raised px-1.5 py-0.5 text-[12px] text-ink-2">Saved</span>
                    )}
                  </Link>
                  <p className="truncate text-[14px] text-muted">
                    {new Date(p.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                {/* phones: percentage above Delete, so the name and note keep the width */}
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="tabular text-right text-[15px] text-ink-2 sm:w-14">
                    {((p.predicted?.confidence ?? 0) * 100).toFixed(0)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    aria-label={`Delete ${p.predicted?.display_name} result`}
                    className="relative z-10 -mr-2 min-h-[32px] rounded-md px-2 text-[14px] text-muted transition-colors hover:text-negative sm:mr-0 [@media(hover:hover)]:sm:opacity-0 [@media(hover:hover)]:sm:group-hover:opacity-100 [@media(hover:hover)]:sm:focus:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-quiet btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            disabled={to >= data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
