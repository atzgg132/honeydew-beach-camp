import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { hotel } from "@/data/hotel";
import { LodgingJsonLd } from "@/components/seo/LodgingJsonLd";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["italic", "normal"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: hotel.name,
    template: `%s | ${hotel.name}`,
  },
  description:
    "Honey Dew Beach Camp on Mousuni Island. Single-Bed and Double-Bed rooms, with or without air-conditioning. Meals included in the stay charges.",
  openGraph: {
    title: hotel.name,
    description: "A stay on Mousuni Island.",
    images: [{ url: "/brand/lockup-bg.png" }],
  },
  icons: {
    icon: "/brand/emblem.png",
    apple: "/brand/apple-touch.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${cormorant.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-cream font-sans text-ink antialiased">
        <LodgingJsonLd />
        {children}
      </body>
    </html>
  );
}
