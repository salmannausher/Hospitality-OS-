import { Cormorant_Garamond, Work_Sans } from "next/font/google";
import "@hospitality/ui/tokens.css";

// Scoped to /widget only — deliberately not the root layout, so this never
// touches the landing page's own Fraunces/Instrument Sans tokens
// (apps/web/src/app/globals.css). Loads Bellevue's real fonts
// (findings-log.md #25/#26) so this harness previews the actual per-hotel
// typography, not a generic placeholder.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cormorant.variable} ${workSans.variable}`} style={{ minHeight: "100%" }}>
      {children}
    </div>
  );
}
