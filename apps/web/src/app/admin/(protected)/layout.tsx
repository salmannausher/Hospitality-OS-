"use client";

// Protected admin shell — Sprint 1 scope (docs/14-sprint-backlog.md): a route
// guard, sidebar nav (labels only, screens land in later sprints), and a
// header. No design system yet (Sprint 5 decision pending) — bare/unstyled,
// matching the same inline-style approach as the guest widget harness.

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";

// UX §8 screen map. Dashboard is the only screen that exists yet.
const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Hotels", href: null, agencyOnly: true },
  { label: "Knowledge Base", href: "/admin/knowledge" },
  { label: "Conversations", href: null },
  { label: "Leads", href: null },
  { label: "Analytics", href: null },
  { label: "Brand Settings", href: null },
  { label: "Prompt Settings", href: null },
  { label: "Integrations", href: null },
  { label: "Billing", href: null },
  { label: "Users & Roles", href: null },
] as const;

export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const { loading, session, sessionData, sessionError, signOut } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/admin/login");
  }, [loading, session, router]);

  if (loading) {
    return <p style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>Loading…</p>;
  }

  if (!session) return null; // redirecting

  if (sessionError) {
    return (
      <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "crimson" }}>{sessionError}</p>
        <button onClick={() => void signOut()} style={{ marginTop: "1rem" }}>
          Sign out
        </button>
      </main>
    );
  }

  const isAgencyLevel = (sessionData?.organizationMemberships.length ?? 0) > 0;
  const primaryHotel = sessionData?.hotelMemberships[0]?.hotel?.name ?? null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <nav
        style={{
          width: 220,
          borderRight: "1px solid #ddd",
          padding: "1.5rem 1rem",
          flexShrink: 0,
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: "1rem" }}>Hospitality AI OS</p>
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {NAV_ITEMS.filter((item) => !("agencyOnly" in item) || isAgencyLevel).map((item) => (
            <li key={item.label}>
              {item.href ? (
                <a href={item.href} style={{ color: "#111", textDecoration: "none" }}>
                  {item.label}
                </a>
              ) : (
                <span style={{ color: "#999" }} title="Coming in a later sprint">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div style={{ flex: 1 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #ddd",
          }}
        >
          <span>{primaryHotel ?? "Hospitality AI OS Admin"}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#666" }}>{sessionData?.user.email}</span>
            <button onClick={() => void signOut()}>Sign out</button>
          </span>
        </header>
        <main style={{ padding: "1.5rem" }}>{children}</main>
      </div>
    </div>
  );
}
