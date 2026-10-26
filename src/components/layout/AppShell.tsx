"use client";

import React from "react";
import { usePathname } from "next/navigation";
import AppLayout from "./AppLayout";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Halaman login (root "/") tidak menggunakan sidebar/app layout
  if (pathname === "/") {
    return <>{children}</>;
  }

  return <AppLayout>{children}</AppLayout>;
}
