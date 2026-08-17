import type { Metadata } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-headline",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FootConnect — Pitch Owner Hub",
  description: "Stadium-at-Night infrastructure and reservation management for amateur football arena owners.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${inter.variable} ${jetbrainsMono.variable} h-full dark antialiased`}
    >
      <body className="min-h-full bg-[#0A0F0A] text-[#e1e3e0] flex flex-col selection:bg-[#c3f400] selection:text-[#161e00]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
