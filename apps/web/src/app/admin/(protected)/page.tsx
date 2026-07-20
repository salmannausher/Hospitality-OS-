"use client";

import { useAdminAuth } from "@/lib/admin-auth-context";

export default function AdminDashboardPage() {
  const { sessionData } = useAdminAuth();

  return (
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Dashboard</h1>
      <p>
        Signed in as <strong>{sessionData?.user.email}</strong>
        {sessionData?.user.name ? ` (${sessionData.user.name})` : ""}.
      </p>

      {sessionData?.hotelMemberships.map((m) => (
        <p key={m.id}>
          {m.role} at <strong>{m.hotel?.name ?? m.hotelId}</strong>
        </p>
      ))}

      {sessionData?.organizationMemberships.map((m) => (
        <p key={m.id}>
          {m.role} across <strong>{m.organization.name}</strong>
        </p>
      ))}

      <p style={{ color: "#999", marginTop: "1.5rem", fontSize: "0.85rem" }}>
        KPI tiles, the portfolio view, and every other screen in the sidebar land in later sprints
        (docs/14-sprint-backlog.md) — this page exists to prove login → session → shell works end to
        end, not to show real numbers yet.
      </p>
    </div>
  );
}
