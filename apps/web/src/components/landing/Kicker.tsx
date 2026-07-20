import type { ReactNode } from "react";

export function Kicker({
  index,
  children,
  tone = "light",
  centered = false,
}: {
  index?: string;
  children: ReactNode;
  tone?: "light" | "dark";
  centered?: boolean;
}) {
  const color = tone === "light" ? "text-brass" : "text-champagne";
  const rule = tone === "light" ? "bg-brass/40" : "bg-champagne/40";
  return (
    <p
      className={`flex items-center gap-4 text-[0.7rem] font-medium uppercase tracking-[0.24em] ${color} ${
        centered ? "justify-center" : ""
      }`}
    >
      {index ? (
        <>
          <span>{index}</span>
          <span aria-hidden className={`h-px w-10 ${rule}`} />
        </>
      ) : null}
      <span>{children}</span>
    </p>
  );
}
