"use client";

// Protected admin shell — Sprint 1 scope (docs/14-sprint-backlog.md), visual
// design ported from the Stitch "Dashboard" mockup (Admin Dashboard redesign).
// Reuses apps/web's existing ivory/ink/brass/night palette and Fraunces/
// Instrument Sans fonts (see admin/login/page.tsx for the same reasoning —
// nothing in docs/ has decided a dedicated admin design system yet).
//
// Two deliberate deviations from the mockup:
// - No hotel-switcher dropdown: multi-hotel selection isn't built anywhere in
//   this app (every admin page hard-codes hotelMemberships[0], a known,
//   documented MVP gap) — rendering a chevron would imply working
//   functionality that doesn't exist. The hotel name is plain text.
// - No search icon: no global-search endpoint exists in the API spec.
// The notification bell IS real — it links to /admin/notifications and shows
// an unread-count dot backed by GET /v1/admin/notifications?status=PENDING.

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { listNotifications } from "@hospitality/sdk";
import {
  DashboardIcon,
  BuildingIcon,
  BookIcon,
  HubIcon,
  ChatIcon,
  LeadsIcon,
  ChartIcon,
  BellIcon,
  PaletteIcon,
  SlidersIcon,
  PlugIcon,
  CardIcon,
  UsersIcon,
  LogoutIcon,
  SparkIcon,
} from "../icons";

// UX §8 screen map. Screens land here as they're built (docs/14-sprint-backlog.md).
const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: DashboardIcon },
  { label: "Hotels", href: "/admin/hotels", agencyOnly: true, icon: BuildingIcon },
  { label: "Knowledge Base", href: "/admin/knowledge", icon: BookIcon },
  { label: "Relationships", href: "/admin/relationships", icon: HubIcon },
  { label: "Conversations", href: "/admin/conversations", icon: ChatIcon },
  { label: "Leads", href: "/admin/leads", icon: LeadsIcon },
  { label: "Analytics", href: "/admin/analytics", icon: ChartIcon },
  { label: "Notifications", href: "/admin/notifications", icon: BellIcon },
  { label: "Brand Settings", href: "/admin/brand", icon: PaletteIcon },
  { label: "Prompt Settings", href: null, icon: SlidersIcon },
  { label: "Integrations", href: null, icon: PlugIcon },
  { label: "Billing", href: null, icon: CardIcon },
  { label: "Users & Roles", href: null, icon: UsersIcon },
] as const;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  AGENCY_ADMIN: "Agency Admin",
  HOTEL_ADMIN: "Hotel Admin",
  MARKETING: "Marketing",
  RESERVATIONS: "Reservations",
  VIEWER: "Viewer",
};

export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const { loading, session, sessionData, sessionError, signOut } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = session?.access_token;
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  // `Paginated<T>` has no total count, only `items`/`nextCursor` — this checks
  // for *any* unread notification (a dot), not an exact count.
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listNotifications(accessToken, { status: "PENDING", hotelId, limit: 1 })
      .then((page) => {
        if (!cancelled) setHasUnread(page.items.length > 0);
      })
      .catch(() => {
        /* non-critical — the badge just stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId]);

  useEffect(() => {
    if (!loading && !session) router.replace("/admin/login");
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory font-sans text-sm text-ink-soft">
        Loading…
      </div>
    );
  }

  if (!session) return null; // redirecting

  if (sessionError) {
    return (
      <main className="mx-auto mt-24 max-w-md px-4 font-sans">
        <p className="text-sm text-red-700">{sessionError}</p>
        <button
          onClick={() => void signOut()}
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm text-ivory hover:bg-ink/90"
        >
          Sign out
        </button>
      </main>
    );
  }

  const isAgencyLevel = (sessionData?.organizationMemberships.length ?? 0) > 0;
  const primaryHotel = sessionData?.hotelMemberships[0]?.hotel?.name ?? null;
  const role =
    sessionData?.hotelMemberships[0]?.role ?? sessionData?.organizationMemberships[0]?.role ?? null;
  const visibleNavItems = NAV_ITEMS.filter((item) => !("agencyOnly" in item) || isAgencyLevel);

  return (
    <div className="min-h-screen bg-ivory font-sans text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-line bg-white">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink">
            <SparkIcon className="h-4 w-4 text-champagne" />
          </div>
          <span className="font-display text-base text-ink">Hospitality AI OS</span>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.href !== null && pathname === item.href;
            if (!item.href) {
              return (
                <span
                  key={item.label}
                  title="Coming in a later sprint"
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-mist"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 opacity-60" />
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-ink text-ivory" : "text-ink-soft hover:bg-parchment hover:text-ink"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4">
          <div className="flex items-center gap-2 rounded-lg border border-brass/25 bg-champagne/10 px-3 py-2.5">
            <SparkIcon className="h-4 w-4 shrink-0 text-brass" />
            <span className="text-xs font-semibold text-ink-soft">AI OS Core v2.0</span>
          </div>
        </div>
      </aside>

      <div className="pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-ivory/90 px-8 backdrop-blur-sm">
          <span className="text-sm font-medium text-ink">
            {primaryHotel ?? "Hospitality AI OS Admin"}
          </span>

          <div className="flex items-center gap-5">
            <Link
              href="/admin/notifications"
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-parchment hover:text-ink"
            >
              <BellIcon className="h-[18px] w-[18px]" />
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brass" />
              )}
            </Link>

            <div className="flex items-center gap-3 border-l border-line pl-5">
              <div className="text-right">
                <p className="text-sm leading-none font-semibold text-ink">
                  {sessionData?.user.name ?? sessionData?.user.email}
                </p>
                {role && (
                  <p className="mt-1 text-xs tracking-wide text-mist uppercase">
                    {ROLE_LABELS[role] ?? role}
                  </p>
                )}
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-semibold text-ivory">
                {(sessionData?.user.name ?? sessionData?.user.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <button
                onClick={() => void signOut()}
                aria-label="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-parchment hover:text-ink"
              >
                <LogoutIcon className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </header>

        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
