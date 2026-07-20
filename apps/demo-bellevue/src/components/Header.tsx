"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/rooms", label: "Rooms" },
  { href: "/dining", label: "Dining" },
  { href: "/spa", label: "Spa" },
  { href: "/explore", label: "Explore" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Every page opens on a full-bleed photo (Hero / PageHero), each darkened
  // at the top edge specifically so this transparent, light-text header
  // stays legible before the user has scrolled far enough to trigger the
  // solid, dark-text state.
  const solid = scrolled || menuOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        solid
          ? "border-b border-line/70 bg-sand/90 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10">
        <Link
          href="/"
          className={`font-display text-lg italic tracking-wide transition-colors duration-500 ${
            solid ? "text-ink" : "text-sand"
          }`}
        >
          Bellevue Hotel
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[0.72rem] font-medium uppercase tracking-[0.2em] transition-colors duration-500 hover:text-brass ${
                solid ? "text-ink-soft" : "text-sand/90"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/reserve"
            className={`inline-flex h-9 items-center border px-5 text-[0.7rem] font-medium uppercase tracking-[0.18em] transition-colors duration-500 ${
              solid
                ? "border-brass text-brass hover:bg-brass hover:text-sand"
                : "border-sand/60 text-sand hover:bg-sand hover:text-ink"
            }`}
          >
            Reserve
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className={`flex h-9 w-9 items-center justify-center border transition-colors duration-500 ${
            solid ? "border-ink/20 text-ink" : "border-sand/40 text-sand"
          } md:hidden`}
        >
          <span className="text-[0.7rem] uppercase tracking-widest">
            {menuOpen ? "Close" : "Menu"}
          </span>
        </button>
      </nav>

      {menuOpen ? (
        <div
          id="mobile-menu"
          className="flex flex-col gap-1 border-t border-line/70 bg-sand px-6 py-6 md:hidden"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="py-3 text-sm font-medium uppercase tracking-[0.18em] text-ink-soft"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/reserve"
            onClick={() => setMenuOpen(false)}
            className="mt-3 inline-flex h-11 items-center justify-center border border-brass text-[0.72rem] font-medium uppercase tracking-[0.18em] text-brass"
          >
            Reserve
          </Link>
        </div>
      ) : null}
    </header>
  );
}
