"use client";

// Login page — Sprint 1 admin shell (docs/14-sprint-backlog.md). No custom
// /auth/login endpoint (API §3.1): this form calls Supabase Auth directly via
// the browser client; our API never sees a password.
//
// Visual design ported from the Stitch "Sign In" mockup (Admin Dashboard
// redesign). Reuses apps/web's existing ivory/ink/brass/night palette and
// Fraunces/Instrument Sans fonts (already loaded globally by the root
// layout for the landing page) rather than introducing a third token set —
// nothing in docs/ has decided a dedicated admin design system yet. There is
// no SSO and no password-reset flow anywhere in the API spec or auth context,
// so — unlike the mockup — this omits both rather than wiring up dead UI.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminAuth } from "@/lib/admin-auth-context";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const { signIn, configError } = useAdminAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginForm) {
    setSubmitting(true);
    setFormError(null);
    const { error } = await signIn(values.email, values.password);
    setSubmitting(false);
    if (error) {
      setFormError(error);
      return;
    }
    router.push("/admin");
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* Left panel — product identity. Hidden below lg to keep the form the
          whole story on small screens. */}
      <div className="grain relative hidden overflow-hidden bg-night lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ivory/10">
            <SparkIcon className="h-5 w-5 text-champagne" />
          </div>
          <span className="font-display text-lg text-ivory">Hospitality AI OS</span>
        </div>

        <div className="flex items-center gap-6">
          <span className="text-xs tracking-[0.3em] text-mist [writing-mode:vertical-rl]">
            HAUTE INTELLIGENCE OS
          </span>
          <p className="max-w-[14rem] font-display text-2xl leading-snug text-ivory/90">
            Guest experience, orchestrated.
          </p>
        </div>

        <p className="text-xs text-mist">© {new Date().getFullYear()} Hospitality AI OS</p>
      </div>

      {/* Right panel — the actual form */}
      <div className="flex items-center justify-center bg-ivory px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-night">
              <SparkIcon className="h-5 w-5 text-champagne" />
            </div>
            <h1 className="font-display text-2xl text-ink">Access Portal</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Secure authentication for concierge and management personnel.
            </p>
          </div>

          {configError && (
            <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {configError}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-widest text-ink-soft uppercase">
                Corporate Identity
              </span>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-mist" />
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="manager@estate.com"
                  {...register("email")}
                  className="w-full rounded-lg border border-line bg-white py-3 pr-4 pl-10 text-sm text-ink placeholder:text-mist focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none"
                />
              </div>
              {errors.email && (
                <span className="text-xs text-red-600">{errors.email.message}</span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-widest text-ink-soft uppercase">
                Security Key
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  {...register("password")}
                  className="w-full rounded-lg border border-line bg-white py-3 pr-10 pl-4 text-sm text-ink placeholder:text-mist focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-mist hover:text-ink-soft"
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs text-red-600">{errors.password.message}</span>
              )}
            </label>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={submitting || !!configError}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-ink py-3 font-medium text-ivory transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Authenticate"}
              {!submitting && <ArrowRightIcon className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-mist">
            <LockIcon className="h-3.5 w-3.5" />
            End-to-end encrypted connection
          </p>
        </div>
      </div>
    </main>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2M6.5 6.7C4.3 8.1 2.7 10 2 12c0 0 3.5 7 10 7 2 0 3.7-.6 5.1-1.4M9.9 5.2A10.6 10.6 0 0112 5c6.5 0 10 7 10 7-.4.8-1.3 2.1-2.6 3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 118 0v3" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
