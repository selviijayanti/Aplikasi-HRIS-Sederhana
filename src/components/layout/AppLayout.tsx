import React, { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { getLeaveStatusOverrides, getSubmittedLeaves } from "@/lib/utils/leave-store";
import { MoreHorizontal, LogOut } from "lucide-react";

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
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [pendingBadgeCount, setPendingBadgeCount] = useState<number>(0);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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

  // Tutup dropdown menu saat menekan tombol Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

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

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#6b7280" }}>
        Memuat data...
      </div>
    );
  }

  // Tentukan sapaan dan role label
  const roleLabel = user.peran === "hrd" ? "HRD" : user.peran === "atasan" ? "Atasan" : "Karyawan";
  const divisiLabel = user.divisi_nama || user.jabatan;

  const isFullBleed = fullBleed ?? (pathname === "/persetujuan");

  return (
    <div className="app-shell">
      {/* Sidebar Navigasi Sesuai Wireframe */}
      <aside className="app-sidebar">
        <div>
          <div className="sidebar-header">
            <h1 className="brand-title">KarsaHR</h1>
            <p className="brand-company">PT Karsa Lintas Nusantara</p>
          </div>

          <nav className="sidebar-menu">
            <a
              href="/dashboard"
              className={`menu-item ${pathname === "/dashboard" ? "active" : ""}`}
            >
              <span>Dashboard</span>
            </a>

            <a
              href="/absensi"
              className={`menu-item ${pathname === "/absensi" ? "active" : ""}`}
            >
              <span>Absensi</span>
            </a>

            <a
              href="/cuti"
              className={`menu-item ${pathname === "/cuti" ? "active" : ""}`}
            >
              <span>Cuti dan Izin</span>
            </a>

            {/* Menu Khusus Atasan & HRD sesuai PRD */}
            {(user.peran === "atasan" || user.peran === "hrd") && (
              <a
                href="/persetujuan"
                className={`menu-item ${pathname === "/persetujuan" ? "active" : ""}`}
              >
                <span>Persetujuan</span>
                {pendingBadgeCount > 0 && (
                  <span className="menu-badge">
                    {pendingBadgeCount}
                  </span>
                )}
              </a>
            )}

            {(user.peran === "atasan" || user.peran === "hrd") && (
              <a
                href="/karyawan"
                className={`menu-item ${pathname === "/karyawan" ? "active" : ""}`}
              >
                <span>Data Karyawan</span>
              </a>
            )}

            <a
              href="/slip-gaji"
              className={`menu-item ${pathname === "/slip-gaji" ? "active" : ""}`}
            >
              <span>Slip Gaji</span>
            </a>

            {/* Menu Khusus HRD sesuai PRD */}
            {user.peran === "hrd" && (
              <>
                <a
                  href="/laporan"
                  className={`menu-item ${pathname === "/laporan" ? "active" : ""}`}
                >
                  <span>Laporan</span>
                </a>
                <a
                  href="/pengaturan"
                  className={`menu-item ${pathname === "/pengaturan" ? "active" : ""}`}
                >
                  <span>Pengaturan</span>
                </a>
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
                <p className="dropdown-user-name">{user.nama_lengkap}</p>
                <p className="dropdown-user-email">{user.email || user.nik_karyawan}</p>
                <span className="dropdown-user-tag">{roleLabel} · {divisiLabel}</span>
              </div>

              <div className="dropdown-divider" />

              {/* Info NIK Karyawan */}
              <div className="dropdown-info-item">
                <span className="dropdown-item-label">NIK:</span>
                <span className="dropdown-item-val font-mono">{user.nik_karyawan}</span>
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
            title="Klik untuk membuka menu akun"
          >
            <div className="profile-info-left">
              {user.foto_url || (user as any).foto ? (
                <img
                  src={user.foto_url || (user as any).foto}
                  alt={user.nama_lengkap}
                  className="profile-avatar-img"
                />
              ) : (
                <div
                  className="profile-avatar-circle"
                  aria-label={user.nama_lengkap}
                >
                  {getInitials(user.nama_lengkap)}
                </div>
              )}
              <div className="profile-text-wrap">
                <p className="profile-user-name" title={user.nama_lengkap}>
                  {user.nama_lengkap}
                </p>
                <p className="profile-user-role" title={`${roleLabel} · ${divisiLabel}`}>
                  {roleLabel} · {divisiLabel}
                </p>
              </div>
            </div>

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
