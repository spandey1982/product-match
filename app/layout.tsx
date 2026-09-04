import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Poppins } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// viewport-fit=cover lets iOS populate env(safe-area-inset-*), so the
// floating Trial Room FAB on /catalog can clear the home indicator and the
// mobile browser's auto-hiding bottom chrome instead of sitting behind them.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mentishq.com";
const SITE_NAME = "Mentis";
const SITE_DESCRIPTION =
  "Turn any fashion catalog into an AI-powered shopping experience. AI Cataloging, Fashion Studio, Virtual Try-On, Smart Matching, and In-Store Kiosk — one platform for fashion retailers.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  // No title.template: every page in this codebase already sets its own
  // full "X — Mentis" title, so a template would double the suffix.
  title: "Mentis — AI Commerce Infrastructure for Fashion Retail",
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    url: "/",
    title: "Mentis — AI Commerce Infrastructure for Fashion Retail",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Mentis — AI Commerce Infrastructure for Fashion Retail",
    description: SITE_DESCRIPTION,
  },
};

// Sitewide entity data — helps generative engines resolve "Mentis" as an
// organization/product before they ever read a specific page's content.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: APP_URL,
  logo: `${APP_URL}/icon.svg`,
  description: SITE_DESCRIPTION,
};

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: SITE_DESCRIPTION,
  url: APP_URL,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#fafafa]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
