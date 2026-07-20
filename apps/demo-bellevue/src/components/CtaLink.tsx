import type { ReactNode } from "react";

const VARIANTS = {
  solid: "bg-ink text-sand hover:bg-brass",
  outline: "border border-ink/25 text-ink hover:border-brass hover:text-brass",
  "solid-dark": "bg-brass-light text-night hover:bg-sand",
  "outline-dark":
    "border border-sand/35 text-sand hover:border-brass-light hover:text-brass-light",
} as const;

export function CtaLink({
  href,
  variant = "solid",
  children,
}: {
  href: string;
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`inline-flex h-12 items-center justify-center px-8 text-[0.75rem] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${VARIANTS[variant]}`}
    >
      {children}
    </a>
  );
}

export function TextLink({
  href,
  children,
  tone = "light",
}: {
  href: string;
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  const color =
    tone === "light"
      ? "text-brass hover:text-ink"
      : "text-brass-light hover:text-sand";
  return (
    <a
      href={href}
      className={`group inline-flex items-baseline gap-2 text-[0.78rem] font-medium uppercase tracking-[0.16em] transition-colors duration-300 ${color}`}
    >
      <span className="border-b border-current pb-1">{children}</span>
      <span
        aria-hidden
        className="transition-transform duration-300 group-hover:translate-x-1"
      >
        →
      </span>
    </a>
  );
}
