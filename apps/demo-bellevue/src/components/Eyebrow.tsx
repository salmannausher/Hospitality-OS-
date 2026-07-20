export function Eyebrow({
  children,
  tone = "light",
}: {
  children: string;
  tone?: "light" | "dark";
}) {
  const color = tone === "light" ? "text-brass" : "text-brass-light";
  return (
    <p className={`text-[0.7rem] font-medium uppercase tracking-[0.28em] ${color}`}>
      {children}
    </p>
  );
}
