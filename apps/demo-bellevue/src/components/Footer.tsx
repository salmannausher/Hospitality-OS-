import Link from "next/link";
import { PROPERTY } from "@/lib/content";

const COLUMNS = [
  {
    title: "Stay",
    links: [
      { href: "/rooms", label: "Rooms" },
      { href: "/dining", label: "Dining" },
      { href: "/spa", label: "Spa" },
      { href: "/explore", label: "Explore" },
    ],
  },
  {
    title: "Occasions",
    links: [{ href: "/weddings", label: "Weddings & Events" }],
  },
  {
    title: "The Desk",
    links: [
      { href: "/reserve", label: "Reserve" },
      { href: "/#practical-notes", label: "Policies" },
      { href: "mailto:frontdesk@bellevuehotel.example", label: "Contact" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="bg-night px-6 pb-28 pt-20 text-sand md:px-10">
      {/* pb-28 (not pb-12) — clears the fixed concierge launcher (docs/19 §7:
          "the launcher never overlaps a Reserve action at any breakpoint"),
          which otherwise sits directly over this row's bottom-right text. */}
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 border-b border-sand/10 pb-14 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8">
          <div>
            <p className="font-display text-2xl italic">{PROPERTY.name}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist">
              {PROPERTY.location}
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brass-light">
                {col.title}
              </p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-mist transition-colors duration-300 hover:text-sand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 pt-8 text-[0.7rem] uppercase tracking-[0.18em] text-mist md:flex-row md:items-center md:justify-between">
          <span>Est. 1968 · Five stars · Bellevue Cove</span>
          <span>A Hospitality AI OS demo property — not a real hotel</span>
        </div>
      </div>
    </footer>
  );
}
