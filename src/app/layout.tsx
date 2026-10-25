import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import StyledJsxRegistry from "./registry";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "KarsaHR · PT Karsa Lintas Nusantara",
  description: "Aplikasi HRIS Internal PT Karsa Lintas Nusantara",
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
          <AuthProvider>{children}</AuthProvider>
        </StyledJsxRegistry>
      </body>
    </html>
  );
}


