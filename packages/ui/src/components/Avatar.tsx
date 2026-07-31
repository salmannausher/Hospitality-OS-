// docs/08-ui-design-system.md §8: shown once per concierge turn, in the widget
// header and beside the first message of a turn. Brand accent lives only on the
// ring — never a filled background — per §3's "accent, not background" rule.

export interface AvatarProps {
  /** Usually the concierge's first initial (conciergeName[0]). */
  initial: string;
  logoUrl?: string | null;
  size?: "sm" | "md";
}

export function Avatar({ initial, logoUrl, size = "md" }: AvatarProps) {
  const dimension = size === "sm" ? 24 : 32;

  return (
    <span
      style={{
        width: dimension,
        height: dimension,
        borderRadius: "50%",
        border: "1.5px solid var(--brand-primary)",
        background: "var(--neutral-0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
        fontFamily: "var(--font-display)",
        fontStyle: "italic",
        fontSize: size === "sm" ? "0.7rem" : "0.8rem",
        color: "var(--brand-primary)",
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a hotel-supplied
        // external logo URL, not a local asset next/image can optimize.
        <img
          src={logoUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initial.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
