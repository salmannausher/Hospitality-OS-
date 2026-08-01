import type { Metadata } from "next";
import { Cormorant_Garamond, Work_Sans } from "next/font/google";
import Script from "next/script";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bellevue Hotel — The Coastline's Quiet Constant",
  description:
    "Since 1968, Bellevue Hotel has stood at the edge of Bellevue Cove — a five-star oceanfront retreat built around unhurried service and a view that hasn't needed to change in fifty years.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Header />
        <main>{children}</main>
        <Footer />
        {/* Sprint 5 ticket 5 (docs/06-system-architecture.md §3): the real
            embeddable widget script, not a React component — the exact
            integration path a genuine hotel client site would use. */}
        {/* The embed is a self-mounting IIFE, so Fast Refresh cannot update an
            instance already running in the page. Bump this version whenever
            public/widget.js changes to prevent a stale cached bundle from
            surviving a rebuild (findings-log.md #35). */}
        <Script
          src="/widget.js?v=20260801-geometry-35"
          data-widget-key="wk_demo_bellevue"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
