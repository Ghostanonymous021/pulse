import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: "Pulse",
    template: "%s · Pulse",
  },
  description: "A camada social dos estudantes universitários",
  applicationName: "Pulse",
  authors: [{ name: "Pulse" }],
  generator: "Next.js",
  keywords: ["Pulse", "universidade", "social", "estudantes"],
  referrer: "strict-origin-when-cross-origin",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://pulse.app",
  ),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pulse",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "pt_MZ",
    siteName: "Pulse",
    title: "Pulse",
    description: "A camada social dos estudantes universitários",
  },
  twitter: {
    card: "summary",
    title: "Pulse",
    description: "A camada social dos estudantes universitários",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  // WCAG: allow zoom (do not lock maximumScale / userScalable)
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* iOS splash / home screen — color matches manifest */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-foreground"
        >
          Saltar para o conteudo
        </a>
        <div id="main" className="flex min-h-full flex-1 flex-col">
          {children}
        </div>
        <PwaRegister />
      </body>
    </html>
  );
}
