import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EgMoney - Professional Crypto Exchange",
  description: "Trade cryptocurrencies with advanced tools, real-time market data, and secure wallet management.",
  manifest: "/manifest.json",
  icons: { icon: "/favicon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "EgMoney" },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="application-name" content="EgMoney" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#10b981" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "hsl(240 10% 5.9% / 0.9)",
              color: "hsl(0 0% 98%)",
              border: "1px solid hsl(240 3.7% 15.9%)",
              backdropFilter: "blur(20px)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "hsl(142 76% 36%)", secondary: "white" } },
            error: { iconTheme: { primary: "hsl(0 62.8% 50.6%)", secondary: "white" } },
          }}
        />
      </body>
    </html>
  );
}
