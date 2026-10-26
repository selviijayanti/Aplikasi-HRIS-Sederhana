import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import StyledJsxRegistry from "./registry";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "KarsaHR · PT Karsa Lintas Nusantara",
  description: "Aplikasi HRIS Internal PT Karsa Lintas Nusantara - Modern & Mobile Friendly",
  keywords: ["HRIS", "KarsaHR", "mobile friendly", "responsive", "aplikasi HRIS sederhana", "absensi", "cuti", "payroll"],
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable}>
      <body className={inter.className}>
        <StyledJsxRegistry>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </StyledJsxRegistry>
      </body>
    </html>
  );
}


