"use client";

// Login page — Sprint 1 admin shell (docs/14-sprint-backlog.md). No custom
// /auth/login endpoint (API §3.1): this form calls Supabase Auth directly via
// the browser client; our API never sees a password.

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
    <main
      style={{
        maxWidth: 360,
        margin: "4rem auto",
        padding: "0 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.1rem" }}>Admin sign in</h1>

      {configError && (
        <p style={{ color: "crimson", fontSize: "0.85rem", marginTop: "1rem" }}>
          {configError}
        </p>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.8rem", color: "#666" }}>Email</span>
          <input
            type="email"
            autoComplete="username"
            {...register("email")}
            style={{ padding: "8px", border: "1px solid #ccc", borderRadius: 6 }}
          />
          {errors.email && (
            <span style={{ color: "crimson", fontSize: "0.75rem" }}>{errors.email.message}</span>
          )}
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.8rem", color: "#666" }}>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            {...register("password")}
            style={{ padding: "8px", border: "1px solid #ccc", borderRadius: 6 }}
          />
          {errors.password && (
            <span style={{ color: "crimson", fontSize: "0.75rem" }}>{errors.password.message}</span>
          )}
        </label>

        {formError && <p style={{ color: "crimson", fontSize: "0.85rem" }}>{formError}</p>}

        <button
          type="submit"
          disabled={submitting || !!configError}
          style={{ padding: "8px 16px", borderRadius: 6, marginTop: "0.5rem" }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
