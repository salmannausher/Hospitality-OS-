import type { ReactNode } from "react";

const VARIANTS = {
  solid: "bg-ink text-ivory hover:bg-brass",
  outline: "border border-ink/25 text-ink hover:border-brass hover:text-brass",
  "solid-dark": "bg-champagne text-night hover:bg-ivory",
  "outline-dark":
    "border border-ivory/30 text-ivory hover:border-champagne hover:text-champagne",
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
      className={`inline-flex h-12 items-center justify-center px-8 text-[0.78rem] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${VARIANTS[variant]}`}
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
      : "text-champagne hover:text-ivory";
  return (
    <a
      href={href}
      className={`group inline-flex items-baseline gap-2 text-[0.8rem] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${color}`}
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
