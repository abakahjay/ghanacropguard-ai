
import { useState } from "react";
import { Link, useLocation } from "wouter";

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/client";
import { GHANA_REGIONS } from "@/lib/types";

function Section({ title, desc, children }) {
  return (
    <section className="grid gap-4 border-b border-rule py-8 first:pt-0 last:border-0 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10">
      <div>
        <h2 className="text-[16px] font-medium">{title}</h2>
        <p className="mt-1 max-w-[42ch] text-[14px] text-muted">{desc}</p>
      </div>
      <div className="rounded-[var(--radius-lg)] bg-surface p-5">{children}</div>
    </section>
  );
}

function Status({ msg }) {
  if (!msg) return null;
  return (
    <p role="status" className={`text-[14px] ${msg.ok ? "text-positive" : "text-negative"}`}>
      {msg.text}
    </p>
  );
}

export function ProfileForms({ user }) {
  const [, navigate] = useLocation();
  const { logout, setUser } = useAuth();
  const [m1, setM1] = useState(null);
  const [m2, setM2] = useState(null);
  const [m3, setM3] = useState(null);
  const [busy, setBusy] = useState(null);
  const passwordless = user.has_password === false; // signed up with Google

  async function run(key, set, fn) {
    setBusy(key);
    set(null);
    try {
      set({ ok: true, text: await fn() });
    } catch (e) {
      const err = e;
      set({ ok: false, text: err.fields?.[0]?.message?.replace(/^Value error, /, "") ?? err.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-[1152px]">
      <Section
        title="Your details"
        desc="Your name is shown only to you. Region is optional and used only for region-level statistics."
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run("details", setM1, async () => {
              setUser(
                await api("/auth/me", {
                  method: "PATCH",
                  json: {
                    full_name: String(fd.get("full_name") || "").trim() || null,
                    region: String(fd.get("region") || "") || null,
                  },
                }),
              );
              return "Saved.";
            });
          }}
        >
          <label className="grid gap-2">
            <span className="text-[14px] font-medium">Name</span>
            <input
              name="full_name"
              className="field"
              defaultValue={user.full_name ?? ""}
              maxLength={120}
              autoComplete="name"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[14px] font-medium">Email</span>
            <input className="field opacity-70" value={user.email} readOnly aria-readonly />
          </label>
          <label className="grid gap-2">
            <span className="text-[14px] font-medium">Region</span>
            <select name="region" className="field" defaultValue={user.region ?? ""}>
              <option value="">Prefer not to say</option>
              {GHANA_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-4">
            <button className="btn btn-primary btn-sm" disabled={busy !== null}>
              {busy === "details" ? "Saving…" : "Save"}
            </button>
            <Status msg={m1} />
          </div>
        </form>
      </Section>

      <Section title="Password" desc="Changing your password signs you out on every other device.">
        {user.has_password === false ? (
          <div className="grid gap-3 text-[15px] text-ink-2">
            <p>You sign in with Google, so this account has no password yet.</p>
            <p>
              To add one, use{" "}
              <Link href="/forgot-password" className="text-ink underline decoration-accent underline-offset-4">
                Forgot password
              </Link>{" "}
              with <b className="font-medium text-ink">{user.email}</b>; we&apos;ll email you a link.
            </p>
          </div>
        ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            if (fd.get("new_password") !== fd.get("confirm")) {
              setM2({ ok: false, text: "New passwords do not match." });
              return;
            }
            run("pw", setM2, async () => {
              await api("/auth/me/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  current_password: fd.get("current_password"),
                  new_password: fd.get("new_password"),
                }),
              });
              logout(); // the change revoked every token, this one included
              navigate("/login?next=/app/profile", { replace: true });
              return "Password changed. Please sign in again.";
            });
          }}
        >
          <label className="grid gap-2">
            <span className="text-[14px] font-medium">Current password</span>
            <input name="current_password" type="password" className="field" autoComplete="current-password" required />
          </label>
          <label className="grid gap-2">
            <span className="text-[14px] font-medium">New password</span>
            <input
              name="new_password"
              type="password"
              className="field"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[14px] font-medium">Confirm new password</span>
            <input name="confirm" type="password" className="field" autoComplete="new-password" required />
          </label>
          <div className="flex items-center gap-4">
            <button className="btn btn-primary btn-sm" disabled={busy !== null}>
              {busy === "pw" ? "Changing…" : "Change password"}
            </button>
            <Status msg={m2} />
          </div>
        </form>
        )}
      </Section>

      <Section
        title="Your data"
        desc="Delete every photo and result in your history, or delete your account entirely. Deletion is permanent."
      >
        <div className="grid gap-6">
          <div className="grid gap-3">
            <p className="text-[15px] text-ink-2">Delete all photos and results, but keep your account.</p>
            <button
              type="button"
              className="btn btn-quiet btn-sm justify-self-start"
              disabled={busy !== null}
              onClick={() => {
                if (!window.confirm("Delete all your photos and results? This cannot be undone.")) return;
                run("history", setM3, async () => {
                  await api("/predictions", { method: "DELETE" });
                  return "Your history has been deleted.";
                });
              }}
            >
              {busy === "history" ? "Deleting…" : "Delete my history"}
            </button>
          </div>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = String(new FormData(e.currentTarget).get("password") ?? "");
              if (!window.confirm("Permanently delete your account, photos and results?")) return;
              run("account", setM3, async () => {
                await api("/auth/me", {
                  method: "DELETE",
                  json: passwordless ? { confirm: value.trim().toUpperCase() } : { password: value },
                });
                logout();
                navigate("/", { replace: true });
                return "Account deleted.";
              });
            }}
          >
            <p className="text-[15px] text-ink-2">
              {passwordless
                ? "Delete my account. Type DELETE to confirm."
                : "Delete my account. Enter your password to confirm."}
            </p>
            <input
              name="password"
              type={passwordless ? "text" : "password"}
              className="field max-w-[360px]"
              autoComplete={passwordless ? "off" : "current-password"}
              required
              aria-label={passwordless ? "Type DELETE" : "Password"}
            />
            <button
              className="btn btn-sm justify-self-start bg-[var(--danger-bg)] text-[var(--danger-ink)]"
              disabled={busy !== null}
            >
              {busy === "account" ? "Deleting…" : "Delete account"}
            </button>
          </form>
          <Status msg={m3} />
        </div>
      </Section>
    </div>
  );
}
