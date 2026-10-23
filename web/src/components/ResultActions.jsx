
import { useState } from "react";
import { useLocation } from "wouter";

import { api } from "@/lib/client";

export function ResultActions({ id, saved: initialSaved, note: initialNote }) {
  const [, navigate] = useLocation();
  const [saved, setSaved] = useState(initialSaved);
  const [note, setNote] = useState(initialNote ?? "");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(false);

  async function patch(body, kind) {
    setBusy(kind);
    setMsg(null);
    try {
      await api(`/predictions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (kind === "note") setMsg("Note saved.");
      return true;
    } catch (e) {
      setMsg(e.message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 rounded-[var(--radius-lg)] bg-surface p-5">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          disabled={busy !== null}
          aria-pressed={saved}
          onClick={async () => {
            const next = !saved;
            setSaved(next);
            if (!(await patch({ saved: next }, "save"))) setSaved(!next);
          }}
        >
          {saved ? "Saved ✓" : "Save result"}
        </button>
        {!confirming ? (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(true)}>
            Delete
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-[14px] text-ink-2">Delete photo and result?</span>
            <button
              type="button"
              className="btn btn-sm bg-[var(--danger-bg)] text-[var(--danger-ink)]"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("delete");
                try {
                  await api(`/predictions/${id}`, { method: "DELETE" });
                  navigate("/app/history", { replace: true });
                } catch (e) {
                  setMsg(e.message);
                  setBusy(null);
                }
              }}
            >
              {busy === "delete" ? "Deleting…" : "Yes, delete"}
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        )}
      </div>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          patch({ note: note.trim() || null }, "note");
        }}
      >
        <label htmlFor="note" className="text-[14px] font-medium">
          Your note
        </label>
        <textarea
          id="note"
          value={note}
          maxLength={1000}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Plot by the river, planted in May"
          className="field h-auto resize-y py-2.5"
        />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-quiet btn-sm" disabled={busy !== null}>
            {busy === "note" ? "Saving…" : "Save note"}
          </button>
          {msg && (
            <span role="status" className="text-[14px] text-ink-2">
              {msg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
