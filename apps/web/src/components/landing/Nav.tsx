"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#difference", label: "The difference" },
  { href: "#agencies", label: "For agencies" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled
          ? "border-b border-line/70 bg-ivory/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a
          href="#top"
          className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-ink"
        >
          Hospitality AI OS
        </a>
        <div className="flex items-center gap-8">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hidden text-[0.72rem] font-medium uppercase tracking-[0.2em] text-ink-soft transition-colors duration-300 hover:text-brass md:block"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#book"
            className="inline-flex h-9 items-center bg-ink px-5 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-ivory transition-colors duration-300 hover:bg-brass"
          >
            Book a demo
          </a>
        </div>
      </nav>
    </header>
  );
}
