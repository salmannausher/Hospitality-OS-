import type { Metadata } from "next";
import { Cormorant_Garamond, Work_Sans } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ConciergeWidget } from "@/components/ConciergeWidget";
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
        <ConciergeWidget />
      </body>
    </html>
  );
}
