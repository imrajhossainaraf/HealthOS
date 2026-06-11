"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { normalizeBDPhone } from "@/lib/phone";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16 text-muted">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, register, verifyOtp, resendOtp, loginWithToken, status } = useAuth();

  const [mode, setMode] = useState("login"); // login | register
  const [step, setStep] = useState("form"); // form | otp
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "" });
  const [otp, setOtp] = useState({ email: "", code: "", devCode: null });
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Is Google sign-in configured on the server?
  useEffect(() => {
    authApi.googleStatus().then((r) => setGoogleEnabled(!!r.enabled)).catch(() => {});
  }, []);

  // Handle the OAuth redirect: ?token=… (success) or ?oauth_error=… (failure).
  useEffect(() => {
    const token = params.get("token");
    const oauthError = params.get("oauth_error");
    const handleRedirect = () => {
      if (oauthError) setError(oauthError);
      if (token) {
        setBusy(true);
        loginWithToken(token)
          .then(() => router.replace("/dashboard"))
          .catch(() => setError("Google sign-in failed — please try again"))
          .finally(() => setBusy(false));
      }
    };
    if (token || oauthError) handleRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(form.email.trim(), form.password);
        router.push("/dashboard");
      } else {
        if (form.password.length < 8) throw new Error("Password must be at least 8 characters");
        const res = await register(form.email.trim(), form.password, form.name.trim(), form.phone.trim());
        // Move to the email-verification step.
        setOtp({ email: res.email || form.email.trim().toLowerCase(), code: "", devCode: res.devCode || null });
        setStep("otp");
        setInfo("We sent a 6-digit code to your email.");
      }
    } catch (err) {
      // An unverified login → server sent a fresh code; jump into the OTP step.
      if (err?.data?.needsVerification) {
        setOtp({ email: err.data.email || form.email.trim().toLowerCase(), code: "", devCode: err.data.devCode || null });
        setStep("otp");
        setInfo("Please verify your email. We just sent you a code.");
      } else {
        setError(err?.message || "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(otp.email, otp.code.trim());
      router.push("/dashboard");
    } catch (err) {
      setError(err?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      const r = await resendOtp(otp.email);
      setOtp((o) => ({ ...o, devCode: r.devCode || null }));
      setInfo("A new code is on its way.");
    } catch {
      setInfo("If your email is registered, a new code has been sent.");
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="glass rounded-2xl p-6">
        {step === "otp" ? (
          <>
            <h1 className="font-display text-2xl font-bold">Verify your email</h1>
            <p className="mt-1 text-sm text-muted">
              Enter the 6-digit code we sent to <span className="font-medium text-text">{otp.email}</span>.
            </p>

            {otp.devCode && (
              <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                Dev mode (no email server): your code is <span className="font-bold tracking-widest">{otp.devCode}</span>
              </p>
            )}

            <form onSubmit={submitOtp} className="mt-5 space-y-3">
              <input
                inputMode="numeric"
                maxLength={6}
                required
                className={`${inp} text-center text-2xl font-bold tracking-[0.5em]`}
                value={otp.code}
                onChange={(e) => setOtp((o) => ({ ...o, code: e.target.value.replace(/\D/g, "") }))}
                placeholder="••••••"
                autoFocus
              />
              {error && <Alert tone="emergency">{error}</Alert>}
              {info && <Alert tone="success">{info}</Alert>}
              <button type="submit" disabled={busy || otp.code.length !== 6} className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white disabled:opacity-50">
                {busy ? "Verifying…" : "Verify & continue"}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <button type="button" onClick={resend} className="font-medium text-primary">Resend code</button>
              <button type="button" onClick={() => { setStep("form"); setError(null); setInfo(null); }} className="hover:text-text">← Back</button>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {mode === "login"
                ? "Sign in to sync your health data across devices."
                : "Your profile, family, and emergency data sync securely to your account."}
            </p>

            {status === "authed" && (
              <p className="mt-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
                You’re signed in. <a href="/dashboard" className="underline">Go to dashboard →</a>
              </p>
            )}

            {googleEnabled && (
              <>
                <a
                  href={authApi.googleUrl()}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:border-primary/50"
                >
                  <GoogleIcon /> Continue with Google
                </a>
                <div className="my-4 flex items-center gap-3 text-xs text-muted">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <form onSubmit={submit} className={`${googleEnabled ? "" : "mt-5"} space-y-3`}>
              {mode === "register" && (
                <Field label="Name">
                  <input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" autoComplete="name" />
                </Field>
              )}
              <Field label="Email">
                <input type="email" required className={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" />
              </Field>
              {mode === "register" && (
                <Field label="Phone">
                  <input
                    type="tel"
                    inputMode="tel"
                    className={inp}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    onBlur={() => form.phone && setForm((f) => ({ ...f, phone: normalizeBDPhone(f.phone) }))}
                    placeholder="+880 1XXX-XXXXXX"
                    autoComplete="tel"
                  />
                </Field>
              )}
              <Field label="Password">
                <input type="password" required minLength={mode === "register" ? 8 : undefined} className={inp} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} />
              </Field>

              {error && <Alert tone="emergency">{error}</Alert>}
              {info && <Alert tone="success">{info}</Alert>}

              <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white disabled:opacity-50">
                {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-muted">
              {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setInfo(null); }}
                className="font-medium text-primary"
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Works offline too — without an account your data stays on this device only.
      </p>
    </div>
  );
}

const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function Alert({ tone, children }) {
  const cls = tone === "success"
    ? "border-success/40 bg-success/10 text-success"
    : "border-emergency/40 bg-emergency/10 text-emergency";
  return <p className={`rounded-lg border p-3 text-sm ${cls}`}>{children}</p>;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
