import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

