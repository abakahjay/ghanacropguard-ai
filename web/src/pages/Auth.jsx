import { useEffect, useState } from "react";
import { Link, Redirect, useLocation, useSearch } from "wouter";

import { AuthForm, Field } from "@/components/AuthForm";
import { Wordmark } from "@/components/Mark";
import { BuiltBy } from "@/components/SiteNav";
import { SitePhoto } from "@/components/SitePhoto";
import { useAuth } from "@/lib/auth";
import { api, safeNext, tokenStore } from "@/lib/client";
import { photos } from "@/lib/photos";
import { useTitle } from "@/lib/useTitle";

function AuthLayout({ children, photo = photos.cassava, allowSignedIn = false }) {
  const { user } = useAuth();
  const next = new URLSearchParams(useSearch()).get("next");
  if (user && !allowSignedIn) return <Redirect to={safeNext(next)} />;
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col px-[var(--margin)] py-6">
        <Link href="/" aria-label="GhanaCropGuard AI home">
          <Wordmark />
        </Link>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">{children}</div>
        <p className="text-[13px] text-muted">
          A preliminary aid, not a diagnosis. Confirm with your extension officer. <BuiltBy />
        </p>
      </div>
      <div className="relative hidden overflow-hidden bg-surface lg:block">
        <SitePhoto photo={photo} sizes="58vw" priority />
      </div>
    </div>
  );
}

const linkCls = "text-ink underline decoration-accent underline-offset-4";

export function LoginPage() {
  useTitle("Sign in");
  return (
    <AuthLayout>
      <h1 className="mb-8 text-[clamp(28px,3vw,40px)] font-light tracking-[-0.03em]">Sign in</h1>
      <AuthForm mode="login" />
    </AuthLayout>
  );
}

export function RegisterPage() {
  useTitle("Create an account");
  return (
    <AuthLayout photo={photos.harvest}>
      <h1 className="mb-3 text-[clamp(28px,3vw,40px)] font-light tracking-[-0.03em]">Create an account</h1>
      <p className="mb-8 text-[16px] text-ink-2">
        Your account keeps your checks private and lets you look back at them. See how we handle your photos in the{" "}
        <Link href="/privacy" className={linkCls}>
          privacy notice
        </Link>
        .
      </p>
      <AuthForm mode="register" />
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  useTitle("Forgot password");
  const [state, setState] = useState({ kind: "idle" });
  async function onSubmit(e) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setState({ kind: "busy" });
    try {
      const r = await api("/auth/forgot-password", {
        method: "POST",
        json: { email, redirect_uri: `${window.location.origin}/reset-password` },
      });
      setState({ kind: "sent", message: r.message });
    } catch (err) {
      setState({ kind: "error", message: err.fields?.[0]?.message || err.message });
    }
  }
  return (
    <AuthLayout photo={photos.maize}>
      <h1 className="mb-3 text-[clamp(28px,3vw,40px)] font-light tracking-[-0.03em]">Forgot your password?</h1>
      {state.kind === "sent" ? (
        <div className="grid gap-5" role="status">
          <p className="text-[17px] text-ink-2">{state.message}</p>
          <p className="text-[15px] text-muted">
            The link works for 30 minutes. Check your spam folder if it hasn&apos;t arrived in a few minutes.
          </p>
          <Link href="/login" className={`${linkCls} text-[15px]`}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <p className="text-[16px] text-ink-2">
            Enter the email you signed up with and we&apos;ll send a link to choose a new password. Accounts made with
            Google can use this to add a password too.
          </p>
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          {state.kind === "error" && <ErrorNote>{state.message}</ErrorNote>}
          <button type="submit" className="btn btn-accent w-full" disabled={state.kind === "busy"}>
            {state.kind === "busy" ? "Sending…" : "Send reset link"}
          </button>
          <Link href="/login" className={`${linkCls} text-[15px]`}>
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  useTitle("Choose a new password");
  // The link carries the secret in the fragment (#token=&email=), which never reaches a server.
  // Read it once, then drop it from the address bar and history.
  const [{ token, email }] = useState(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    return { token: h.get("token") || "", email: h.get("email") || "" };
  });
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const [state, setState] = useState({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState({});

  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("new_password") ?? "");
    if (pw !== fd.get("confirm")) {
      setFieldErrors({ confirm: "Passwords do not match." });
      return;
    }
    setFieldErrors({});
    setState({ kind: "busy" });
    try {
      const r = await api("/auth/reset-password", { method: "POST", json: { email, token, new_password: pw } });
      tokenStore.clear(); // every session was signed out
      setState({ kind: "done", message: r.message });
    } catch (err) {
      const fe = {};
      for (const f of err.fields ?? []) fe[f.field] = f.message;
      setFieldErrors(fe);
      setState({ kind: "error", message: fe.new_password ? null : err.message });
    }
  }

  return (
    <AuthLayout photo={photos.maize} allowSignedIn>
      <h1 className="mb-3 text-[clamp(28px,3vw,40px)] font-light tracking-[-0.03em]">Choose a new password</h1>
      {!token || !email ? (
        <div className="grid gap-5">
          <ErrorNote>This reset link is incomplete. Open the link from the email again, or request a new one.</ErrorNote>
          <Link href="/forgot-password" className={`${linkCls} text-[15px]`}>
            Request a new link
          </Link>
        </div>
      ) : state.kind === "done" ? (
        <div className="grid gap-5" role="status">
          <p className="text-[17px] text-ink-2">{state.message} For your security, every device was signed out.</p>
          <Link href="/login" className="btn btn-accent w-full">
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <p className="text-[16px] text-ink-2">
            For <b className="font-medium text-ink">{email}</b>
          </p>
          <Field
            label="New password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters, with letters and numbers"
            error={fieldErrors.new_password}
          />
          <Field
            label="Confirm new password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            error={fieldErrors.confirm}
          />
          {state.kind === "error" && state.message && (
            <ErrorNote>
              {state.message}{" "}
              <Link href="/forgot-password" className="underline underline-offset-4">
                Request a new link
              </Link>
            </ErrorNote>
          )}
          <button type="submit" className="btn btn-accent w-full" disabled={state.kind === "busy"}>
            {state.kind === "busy" ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

/** Google sign-in lands here with #token= or #error= (from FullBackendd). */
export function GoogleCallbackPage() {
  useTitle("Signing in");
  const { refresh } = useAuth();
  const [, navigate] = useLocation();
  // Read the fragment once (StrictMode runs effects twice; the first run clears the address bar).
  const [landed] = useState(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    return { token: h.get("token"), error: h.get("error") };
  });
  const [error, setError] = useState(
    landed.token ? null : landed.error || "Google sign-in did not finish. Please try again.",
  );
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    const { token } = landed;
    if (!token) return;
    let next = "/app";
    try {
      next = safeNext(sessionStorage.getItem("cg_next"));
    } catch {
      /* ignore */
    }
    tokenStore.set(token);
    refresh().then((me) => (me ? navigate(next, { replace: true }) : setError("Google sign-in did not finish. Please try again.")));
  }, [landed, refresh, navigate]);

  return (
    <AuthLayout allowSignedIn>
      {error ? (
        <div className="grid gap-5">
          <h1 className="text-[clamp(28px,3vw,40px)] font-light tracking-[-0.03em]">Couldn&apos;t sign in</h1>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-accent">
              Back to sign in
            </Link>
            <Link href="/register" className="btn btn-quiet">
              Create an account
            </Link>
          </div>
        </div>
      ) : (
        <p role="status" className="text-[17px] text-ink-2">
          Signing you in with Google…
        </p>
      )}
    </AuthLayout>
  );
}

function ErrorNote({ children }) {
  return (
    <p role="alert" className="rounded-md bg-[var(--danger-bg)] px-4 py-3 text-[15px] text-[var(--danger-ink)]">
      {children}
    </p>
  );
}
