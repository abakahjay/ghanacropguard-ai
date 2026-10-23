import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";

import { useAuth } from "@/lib/auth";
import { googleSignInUrl, rememberNext, safeNext as onSite } from "@/lib/client";
import { GHANA_REGIONS } from "@/lib/types";

export function AuthForm({ mode }) {
  const [, navigate] = useLocation();
  const { signIn } = useAuth();
  const next = new URLSearchParams(useSearch()).get("next");
  const safeNext = onSite(next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [consent, setConsent] = useState({ age_confirmed: false, accept_terms: false });
  const consented = consent.age_confirmed && consent.accept_terms;
  const tick = (name) => (e) => setConsent((c) => ({ ...c, [name]: e.target.checked }));

  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
    };
    if (mode === "register") {
      payload.full_name = String(fd.get("full_name") ?? "").trim() || null;
      payload.region = String(fd.get("region") ?? "") || null;
      payload.age_confirmed = fd.get("age_confirmed") === "on";
      payload.accept_terms = fd.get("accept_terms") === "on";
      if (payload.password !== fd.get("confirm")) {
        setFieldErrors({ confirm: "Passwords do not match." });
        return;
      }
    }
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await signIn(mode, payload);
      navigate(safeNext, { replace: true });
    } catch (err) {
      const e2 = err;
      const fe = {};
      for (const f of e2.fields ?? []) fe[f.field] = f.message.replace(/^Value error, /, "");
      setFieldErrors(fe);
      setError(Object.keys(fe).length ? null : e2.message);
      setBusy(false);
    }
  }

  const isReg = mode === "register";
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {isReg && (
        <Field label="Your name" name="full_name" autoComplete="name" hint="Optional" error={fieldErrors.full_name} />
      )}
      <Field label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        autoComplete={isReg ? "new-password" : "current-password"}
        hint={isReg ? "At least 8 characters, with letters and numbers" : undefined}
        error={fieldErrors.password}
      />
      {!isReg && (
        <Link href="/forgot-password" className="-mt-2 justify-self-start text-[15px] text-ink-2 underline decoration-accent underline-offset-4 hover:text-ink">
          Forgot password?
        </Link>
      )}
      {isReg && (
        <>
          <Field
            label="Confirm password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            error={fieldErrors.confirm}
          />
          <div className="grid gap-2">
            <label htmlFor="f-region" className="text-[15px] font-medium">
              Region <span className="font-normal text-muted">· optional</span>
            </label>
            <select id="f-region" name="region" className="field" defaultValue="" aria-describedby="f-region-hint">
              <option value="">Prefer not to say</option>
              {GHANA_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span id="f-region-hint" className="text-[14px] text-muted">
              Only used for region-level statistics. We never ask for your exact location.
            </span>
          </div>
        </>
      )}
      {isReg && (
        <fieldset className="grid gap-3">
          <legend className="visually-hidden">Confirmations</legend>
          <Check name="age_confirmed" error={fieldErrors.age_confirmed} onChange={tick("age_confirmed")}>
            I am 16 years old or older.
          </Check>
          <Check name="accept_terms" error={fieldErrors.accept_terms} onChange={tick("accept_terms")}>
            I accept the{" "}
            <Link href="/terms" target="_blank" className="text-ink underline decoration-accent underline-offset-4">
              Terms of Use
            </Link>{" "}
            and have read the{" "}
            <Link href="/privacy" target="_blank" className="text-ink underline decoration-accent underline-offset-4">
              privacy notice
            </Link>
            .
          </Check>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-[var(--danger-bg)] px-4 py-3 text-[15px] text-[var(--danger-ink)]">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-accent w-full" disabled={busy}>
        {busy ? (isReg ? "Creating account…" : "Signing in…") : isReg ? "Create account" : "Sign in"}
      </button>
      <div className="flex items-center gap-3 text-[13px] text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-raised" />
        or
        <span className="h-px flex-1 bg-raised" />
      </div>
      {isReg && !consented ? (
        <div className="grid gap-1.5">
          <button type="button" className="btn btn-quiet w-full gap-3" disabled aria-describedby="google-hint">
            <GoogleMark /> Sign up with Google
          </button>
          <span id="google-hint" className="text-[14px] text-muted">
            Tick the two boxes above first.
          </span>
        </div>
      ) : (
        <a
          href={googleSignInUrl({ consent: isReg && consented })}
          onClick={() => rememberNext(safeNext)}
          className="btn btn-quiet w-full gap-3"
        >
          <GoogleMark /> {isReg ? "Sign up with Google" : "Continue with Google"}
        </a>
      )}
      <p className="text-[15px] text-ink-2">
        {isReg ? "Already have an account? " : "New here? "}
        <Link
          href={`${isReg ? "/login" : "/register"}${next ? `?next=${encodeURIComponent(safeNext)}` : ""}`}
          className="text-ink underline decoration-accent underline-offset-4"
        >
          {isReg ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function Field({ label, name, type = "text", hint, error, ...rest }) {
  const id = `f-${name}`;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[15px] font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className="field"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {error ? (
        <span id={`${id}-err`} className="text-[14px] text-negative">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-[14px] text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function Check({ name, error, onChange, children }) {
  return (
    <div className="grid gap-1">
      <label className="flex items-start gap-3 text-[15px] text-ink-2">
        <input
          type="checkbox"
          name={name}
          onChange={onChange}
          required
          aria-invalid={!!error}
          className="mt-1 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]"
        />
        <span>{children}</span>
      </label>
      {error && <span className="pl-[30px] text-[14px] text-negative">{error}</span>}
    </div>
  );
}
