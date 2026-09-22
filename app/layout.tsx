import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";
import { PUBLIC_SITE_URL } from "@/lib/site";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const title = "Drop Me A Question — Get a real answer from a real expert";
const description =
  "Ask one question. Get a personal, accountable answer from someone who actually knows.";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title,
  description,
  openGraph: {
    title,
    description,
    url: PUBLIC_SITE_URL,
    siteName: "Drop Me A Question",
    images: ["/brand/logo-lockup.png"],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/brand/logo-lockup.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${publicSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}