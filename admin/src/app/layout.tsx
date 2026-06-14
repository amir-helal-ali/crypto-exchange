import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EgMoney - Admin Panel",
  description: "ادارة منصة EgMoney",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
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
