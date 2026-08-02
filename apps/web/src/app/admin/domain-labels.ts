// Shared IA §2 domain taxonomy labels — used by Dashboard, Conversations, and
// Analytics so the mapping lives in exactly one place (Engineering Conventions
// "no duplicated business logic").

export const DOMAIN_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  booking: "Booking",
  dining: "Dining",
  spa: "Spa",
  property: "Property",
  local_area: "Local Area",
  policies: "Policies",
  events: "Events",
};

export function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain;
}
