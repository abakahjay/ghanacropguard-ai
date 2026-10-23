
import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/client";

export function AdminUsers({ currentUserId }) {
  const [rows, setRows] = useState(null);
  const [audit, setAudit] = useState(null);
  const [err, setErr] = useState(null);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let alive = true;
    Promise.all([api("/admin/users?page_size=8"), api("/admin/audit?limit=8")])
      .then(([u, a]) => {
        if (alive) {
          setRows(u.items);
          setAudit(a);
        }
      })
      .catch((e) => {
        if (alive) setErr(e.message);
      });
    return () => {
      alive = false;
    };
  }, [version]);

  async function update(id, body) {
    setErr(null);
    try {
      await api(`/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section aria-labelledby="users-h" className="rounded-[var(--radius-lg)] bg-surface p-5">
        <h2 id="users-h" className="mb-3 text-[14px] font-semibold">
          Accounts <span className="font-normal text-muted">newest first</span>
        </h2>
        {err && (
          <p role="alert" className="mb-3 text-[14px] text-negative">
            {err}
          </p>
        )}
        {!rows ? (
          <p className="text-[15px] text-muted">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th className="h-9 font-normal">Account</th>
                  <th className="font-normal">Region</th>
                  <th className="text-right font-normal">Checks</th>
                  <th className="pl-4 font-normal">Role</th>
                  <th className="font-normal" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-rule">
                    <td className="py-2.5 pr-3">
                      <span className="block max-w-[260px] truncate">{r.full_name || r.email}</span>
                      <span className="block max-w-[260px] truncate text-[13px] text-muted">{r.email}</span>
                    </td>
                    <td className="text-ink-2">{r.region ?? <span className="text-muted">–</span>}</td>
                    <td className="tabular text-right">{r.predictions}</td>
                    <td className="pl-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[12px] ${r.is_active ? "bg-raised text-ink-2" : "bg-[var(--danger-bg)] text-[var(--danger-ink)]"}`}
                      >
                        {r.is_active ? r.role : "disabled"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {r.id !== currentUserId && (
                        <>
                          <button
                            type="button"
                            className="px-2 text-ink-2 hover:text-ink"
                            onClick={() => update(r.id, { role: r.role === "admin" ? "user" : "admin" })}
                          >
                            {r.role === "admin" ? "Make user" : "Make admin"}
                          </button>
                          <button
                            type="button"
                            className="px-2 text-ink-2 hover:text-ink"
                            onClick={() => update(r.id, { is_active: !r.is_active })}
                          >
                            {r.is_active ? "Disable" : "Enable"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section aria-labelledby="audit-h" className="rounded-[var(--radius-lg)] bg-surface p-5">
        <h2 id="audit-h" className="mb-3 text-[14px] font-semibold">
          Recent admin and account events
        </h2>
        {!audit ? (
          <p className="text-[15px] text-muted">Loading…</p>
        ) : audit.length === 0 ? (
          <p className="text-[15px] text-muted">No events yet.</p>
        ) : (
          <ul className="grid gap-2.5 text-[14px]">
            {audit.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="truncate">{a.action.replace(".", " · ").replace(/_/g, " ")}</span>
                <span className="tabular shrink-0 text-muted">
                  {new Date(a.created_at).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
