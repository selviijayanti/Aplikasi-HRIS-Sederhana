"use client";

import React, { useEffect, useState, useRef, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { getLeaveStatusOverrides, getSubmittedLeaves } from "@/lib/utils/leave-store";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  Users,
  Receipt,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const LayoutContext = createContext<boolean>(false);

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AppLayoutProps {
  children: React.ReactNode;
  fullBleed?: boolean;
}

export default function AppLayout({ children, fullBleed }: AppLayoutProps) {
  // Jika AppLayout sudah aktif di parent level (AppShell), cukup render children saja
  const isNested = useContext(LayoutContext);
  if (isNested) {
    return <>{children}</>;
  }

  return (
    <LayoutContext.Provider value={true}>
      <AppLayoutContent fullBleed={fullBleed}>{children}</AppLayoutContent>
    </LayoutContext.Provider>
  );
}

function AppLayoutContent({ children, fullBleed }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [pendingBadgeCount, setPendingBadgeCount] = useState<number>(0);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Tutup drawer mobile saat rute halaman berganti
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Ambil state collapse tersimpan di localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("karsahr_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // Abaikan jika localStorage tidak dapat diakses
    }
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("karsahr_sidebar_collapsed", String(next));
      } catch {
        // Abaikan error localStorage
      }
      return next;
    });
  };

  // Tutup dropdown menu saat klik di luar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Tutup dropdown menu dan mobile drawer saat menekan tombol Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileMenuOpen(false);
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // RBAC Access Control (PRD BR-11 & NFR-3: Perlindungan hak akses rute berdasarkan peran)
  const isAuthorized = React.useMemo(() => {
    if (loading) return null; // Sedang memuat auth
    if (!user) return false;
    const role = user.peran?.toLowerCase();
    if (pathname.startsWith("/laporan") || pathname.startsWith("/pengaturan")) {
      return role === "hrd";
    }
    if (pathname.startsWith("/persetujuan") || pathname.startsWith("/karyawan")) {
      return role === "atasan" || role === "hrd";
    }
    return true;
  }, [loading, user, pathname]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/");
      } else if (isAuthorized === false) {
        router.replace("/dashboard");
      }
    }
  }, [user, loading, isAuthorized, router]);

  // Sinkronisasi badge menu Persetujuan secara dinamis & real-time dari Firestore (PRD Bab 7 & US-05/US-06)
  useEffect(() => {
    if (!user || (user.peran !== "atasan" && user.peran !== "hrd")) {
      setPendingBadgeCount(0);
      return;
    }

    const userUid = user.id;
    const userSeedId = (user as any)?.seed_id;
    const userNik = user.nik_karyawan;
    const userDivId = user.divisi_id;
    const userDivName = (user.divisi_nama || (user as any)?.["divisi (bantu)"] || "").toLowerCase();
    const isAtasan = user.peran === "atasan";
    const isHRD = user.peran === "hrd";

    // Pengecualian diri sendiri (BR-09: Atasan/HRD tidak boleh menyetujui pengajuannya sendiri)
    const isSelf = (item: any) => {
      return (
        (userUid && item.karyawan_id === userUid) ||
        (userSeedId && item.karyawan_id === userSeedId) ||
        (userNik && item.nik_karyawan === userNik) ||
        (user.nama_lengkap &&
          (item.nama_karyawan || item["pemohon (bantu)"] || item.nama)?.toLowerCase() ===
            user.nama_lengkap.toLowerCase())
      );
    };

    // Pengecekan divisi untuk Atasan (hanya divisi yang dipimpinnya)
    const isDivisionMatch = (item: any) => {
      if (userDivId && item.divisi_id === userDivId) return true;
      const itemDiv = (item.divisi_nama || item.divisi || item["divisi (bantu)"] || "").toLowerCase();
      if (!itemDiv) return false;
      return itemDiv.includes(userDivName) || userDivName.includes(itemDiv);
    };

    const computeCount = (firestoreItems: any[] = []) => {
      const overrides = getLeaveStatusOverrides();
      const localSubmitted = getSubmittedLeaves();

      const allMap = new Map<string, any>();
      firestoreItems.forEach((d) => allMap.set(d.id, d));
      localSubmitted.forEach((l) => {
        if (!allMap.has(l.id)) allMap.set(l.id, l);
      });

      const items = Array.from(allMap.values());
      let count = 0;

      items.forEach((item) => {
        if (isSelf(item)) return;

        const currentStatus = overrides[item.id]?.status || item.status || "diajukan";

        if (isAtasan) {
          // Atasan: hanya dari divisinya yang berstatus 'diajukan'
          if (isDivisionMatch(item) && currentStatus === "diajukan") {
            count++;
          }
        } else if (isHRD) {
          // HRD: status 'disetujui_atasan' atau 'diajukan' bila tahap atasan dilewati
          const bypassAtasan = item.perlu_atasan === false || item.tahap_persetujuan === "hrd";
          if (currentStatus === "disetujui_atasan" || (currentStatus === "diajukan" && bypassAtasan)) {
            count++;
          }
        }
      });

      setPendingBadgeCount(count);
    };

    let unsubscribe: (() => void) | null = null;
    let latestFsItems: any[] = [];

    try {
      const colRef = collection(db, "pengajuan_cuti");
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          latestFsItems = [];
          snapshot.forEach((doc) => {
            latestFsItems.push({ id: doc.id, ...doc.data() });
          });
          computeCount(latestFsItems);
        },
        (error) => {
          console.warn("Firestore onSnapshot error di AppLayout:", error);
          computeCount([]);
        }
      );
    } catch (err) {
      console.warn("Gagal membuat onSnapshot di AppLayout:", err);
      computeCount([]);
    }

    const handleStorageChange = () => {
      computeCount(latestFsItems);
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user]);

  // Tentukan sapaan dan role label secara aman
  const roleLabel = user ? (user.peran === "hrd" ? "HRD" : user.peran === "atasan" ? "Atasan" : "Karyawan") : "...";
  const divisiLabel = user ? (user.divisi_nama || user.jabatan || "") : "";

  const isFullBleed = fullBleed ?? (pathname === "/persetujuan");

  // NFR-3 / BR-11: Render loading / guard setelah seluruh hooks dipanggil
  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>
          Memverifikasi akses KarsaHR...
        </div>
      </div>
    );
  }

  if (!user || isAuthorized === false) {
    return null;
  }

  return (
    <div className="app-shell">
      {/* Mobile Top Header Bar - Tampilan Mobile Friendly */}
      <header className="mobile-header-bar">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Buka menu navigasi"
        >
          <Menu size={22} />
        </button>

        <div className="mobile-brand-title">
          <span className="mobile-logo-badge">K</span>
          <span className="mobile-app-name">KarsaHR</span>
        </div>

        <button
          type="button"
          className="mobile-profile-btn"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Buka profil dan navigasi"
        >
          {user?.foto_url || (user as any)?.foto ? (
            <img
              src={user?.foto_url || (user as any)?.foto}
              alt={user?.nama_lengkap || "Pengguna"}
              className="mobile-avatar-img"
            />
          ) : (
            <div className="mobile-avatar-circle">
              {getInitials(user?.nama_lengkap)}
            </div>
          )}
        </button>
      </header>

      {/* Backdrop Gelap saat Drawer Mobile Terbuka */}
      {isMobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigasi - Mobile Friendly Off-Canvas Drawer & Desktop Sidebar */}
      <aside className={`app-sidebar ${isCollapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}>
        {/* Tombol Floating Edge Toggle Buka/Tutup Persis Sesuai Gambar Referensi (Desktop) */}
        <button
          type="button"
          className="sidebar-toggle-edge-btn"
          onClick={handleToggleCollapse}
          title={isCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
          aria-label={isCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div>
          {/* Header Sidebar */}
          <div className="sidebar-header">
            {!isCollapsed ? (
              <div className="brand-info">
                <h1 className="brand-title">KarsaHR</h1>
                <p className="brand-company">PT Karsa Lintas Nusantara</p>
              </div>
            ) : (
              <div
                className="brand-mini-badge"
                title="KarsaHR · PT Karsa Lintas Nusantara (Klik untuk membuka sidebar)"
                onClick={handleToggleCollapse}
                role="button"
                tabIndex={0}
              >
                <span>K</span>
              </div>
            )}

            {/* Tombol Tutup Khusus Mobile Drawer */}
            <button
              type="button"
              className="mobile-drawer-close-btn"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Tutup menu navigasi"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="sidebar-menu">
            <Link
              href="/dashboard"
              className={`menu-item ${pathname === "/dashboard" ? "active" : ""}`}
              title={isCollapsed ? "Dashboard" : undefined}
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="menu-item-left">
                <LayoutDashboard className="menu-item-icon" size={18} />
                <span className="menu-item-text">Dashboard</span>
              </div>
            </Link>

            <Link
              href="/absensi"
              className={`menu-item ${pathname === "/absensi" ? "active" : ""}`}
              title={isCollapsed ? "Absensi" : undefined}
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="menu-item-left">
                <CalendarCheck className="menu-item-icon" size={18} />
                <span className="menu-item-text">Absensi</span>
              </div>
            </Link>

            <Link
              href="/cuti"
              className={`menu-item ${pathname === "/cuti" ? "active" : ""}`}
              title={isCollapsed ? "Cuti dan Izin" : undefined}
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="menu-item-left">
                <CalendarDays className="menu-item-icon" size={18} />
                <span className="menu-item-text">Cuti dan Izin</span>
              </div>
            </Link>

            {/* Menu Khusus Atasan & HRD sesuai PRD */}
            {(user?.peran === "atasan" || user?.peran === "hrd") && (
              <Link
                href="/persetujuan"
                className={`menu-item ${pathname === "/persetujuan" ? "active" : ""}`}
                title={isCollapsed ? `Persetujuan${pendingBadgeCount > 0 ? ` (${pendingBadgeCount})` : ""}` : undefined}
                onClick={() => setIsMobileOpen(false)}
              >
                <div className="menu-item-left">
                  <CheckSquare className="menu-item-icon" size={18} />
                  <span className="menu-item-text">Persetujuan</span>
                </div>
                {pendingBadgeCount > 0 && (
                  isCollapsed ? (
                    <span className="menu-badge-dot" title={`${pendingBadgeCount} permohonan menunggu persetujuan`} />
                  ) : (
                    <span className="menu-badge">
                      {pendingBadgeCount}
                    </span>
                  )
                )}
              </Link>
            )}

            {(user?.peran === "atasan" || user?.peran === "hrd") && (
              <Link
                href="/karyawan"
                className={`menu-item ${pathname === "/karyawan" ? "active" : ""}`}
                title={isCollapsed ? "Data Karyawan" : undefined}
                onClick={() => setIsMobileOpen(false)}
              >
                <div className="menu-item-left">
                  <Users className="menu-item-icon" size={18} />
                  <span className="menu-item-text">Data Karyawan</span>
                </div>
              </Link>
            )}

            <Link
              href="/slip-gaji"
              className={`menu-item ${pathname === "/slip-gaji" ? "active" : ""}`}
              title={isCollapsed ? "Slip Gaji" : undefined}
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="menu-item-left">
                <Receipt className="menu-item-icon" size={18} />
                <span className="menu-item-text">Slip Gaji</span>
              </div>
            </Link>

            {/* Menu Khusus HRD sesuai PRD */}
            {user?.peran === "hrd" && (
              <>
                <Link
                  href="/laporan"
                  className={`menu-item ${pathname === "/laporan" ? "active" : ""}`}
                  title={isCollapsed ? "Laporan" : undefined}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <div className="menu-item-left">
                    <BarChart3 className="menu-item-icon" size={18} />
                    <span className="menu-item-text">Laporan</span>
                  </div>
                </Link>
                <Link
                  href="/pengaturan"
                  className={`menu-item ${pathname === "/pengaturan" ? "active" : ""}`}
                  title={isCollapsed ? "Pengaturan" : undefined}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <div className="menu-item-left">
                    <Settings className="menu-item-icon" size={18} />
                    <span className="menu-item-text">Pengaturan</span>
                  </div>
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Profil Bawah Sidebar (User Profile Footer dengan Menu Dropdown) */}
        <div className="sidebar-footer" ref={profileMenuRef}>
          {/* Popover Menu Dropdown ke Atas (Option A) */}
          {isProfileMenuOpen && (
            <div className="profile-dropdown-menu" role="menu" aria-label="Menu Opsi Akun">
              {/* Header Mini Info Akun */}
              <div className="dropdown-user-header">
                <p className="dropdown-user-name">{user?.nama_lengkap || "Pengguna"}</p>
                <p className="dropdown-user-email">{user?.email || user?.nik_karyawan || ""}</p>
                <span className="dropdown-user-tag">{roleLabel} · {divisiLabel}</span>
              </div>

              <div className="dropdown-divider" />

              {/* Info NIK Karyawan */}
              <div className="dropdown-info-item">
                <span className="dropdown-item-label">NIK:</span>
                <span className="dropdown-item-val font-mono">{user?.nik_karyawan || "-"}</span>
              </div>

              <div className="dropdown-divider" />

              {/* Tombol Keluar Akun */}
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  logout();
                }}
                className="dropdown-logout-item"
              >
                <LogOut size={14} />
                <span>Keluar Akun</span>
              </button>
            </div>
          )}

          {/* Baris Utama Profil (Avatar, Nama, Jabatan & Titik Tiga) */}
          <div
            className={`profile-main-row ${isProfileMenuOpen ? "active" : ""}`}
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            title={isCollapsed ? `${user?.nama_lengkap || "Pengguna"} (${roleLabel}) - Klik untuk opsi` : "Klik untuk membuka menu akun"}
          >
            <div className="profile-info-left">
              {user?.foto_url || (user as any)?.foto ? (
                <img
                  src={user?.foto_url || (user as any)?.foto}
                  alt={user?.nama_lengkap || "Pengguna"}
                  className="profile-avatar-img"
                />
              ) : (
                <div
                  className="profile-avatar-circle"
                  aria-label={user?.nama_lengkap || "Pengguna"}
                >
                  {getInitials(user?.nama_lengkap)}
                </div>
              )}
              {!isCollapsed && (
                <div className="profile-text-wrap">
                  <p className="profile-user-name" title={user?.nama_lengkap || ""}>
                    {user?.nama_lengkap || "Memuat..."}
                  </p>
                  <p className="profile-user-role" title={`${roleLabel} · ${divisiLabel}`}>
                    {roleLabel} · {divisiLabel}
                  </p>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                type="button"
                className={`profile-more-btn ${isProfileMenuOpen ? "active" : ""}`}
                title="Menu opsi akun"
                aria-label="Menu opsi akun"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProfileMenuOpen(!isProfileMenuOpen);
                }}
              >
                <MoreHorizontal size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className={isFullBleed ? "app-main-fullbleed" : "app-main"}>
        {children}
      </main>
    </div>
  );
}
