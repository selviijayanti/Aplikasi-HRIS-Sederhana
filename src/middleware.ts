import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware (NFR-2 & NFR-3 / PRD BR-11)
 * 
 * Bertanggung jawab atas:
 * 1. Menambahkan header X-Robots-Tag: noindex ke semua halaman (NFR-2)
 * 2. Menolak akses langsung tanpa login (curl / direct URL) ke rute terproteksi (NFR-3)
 * 3. Memeriksa hak akses berbasis peran (RBAC) di sisi server:
 *    - /laporan, /pengaturan: Khusus peran HRD
 *    - /persetujuan, /karyawan: Khusus peran Atasan dan HRD
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // NFR-2: Semua halaman diberi noindex agar tidak muncul di mesin pencari
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

  // Daftar rute terproteksi internal
  const protectedRoutes = [
    "/dashboard",
    "/absensi",
    "/cuti",
    "/persetujuan",
    "/karyawan",
    "/slip-gaji",
    "/laporan",
    "/pengaturan",
  ];

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtected) {
    // Header keamanan tambahan
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // NFR-3: Periksa cookie sesi server-side
    const sessionCookie = request.cookies.get("karsahr_session");

    if (!sessionCookie || !sessionCookie.value) {
      // Akses API tanpa autentikasi -> 401 Unauthorized
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Unauthorized: Otentikasi server-side diperlukan (NFR-3)." },
          { status: 401 }
        );
      }
      // Akses URL halaman tanpa login -> Redirect 307 ke login (mencegah curl membocorkan HTML)
      const loginUrl = new URL("/", request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const session = JSON.parse(decodeURIComponent(sessionCookie.value));
      const role = (session?.peran || "").toLowerCase();

      // BR-11 & NFR-3: Proteksi peran HRD untuk Laporan & Pengaturan
      if (pathname.startsWith("/laporan") || pathname.startsWith("/pengaturan")) {
        if (role !== "hrd") {
          const dashboardUrl = new URL("/dashboard", request.url);
          return NextResponse.redirect(dashboardUrl);
        }
      }

      // Proteksi peran Atasan & HRD untuk Persetujuan & Karyawan
      if (pathname.startsWith("/persetujuan") || pathname.startsWith("/karyawan")) {
        if (role !== "atasan" && role !== "hrd") {
          const dashboardUrl = new URL("/dashboard", request.url);
          return NextResponse.redirect(dashboardUrl);
        }
      }
    } catch {
      // Cookie rusak -> redirect ke halaman utama
      const loginUrl = new URL("/", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  // Terapkan ke semua rute internal aplikasi
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
