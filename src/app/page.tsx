"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  FileText, 
  LogIn, 
  Sparkles,
  ArrowRight,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

export default function Home() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [serverTime, setServerTime] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Jika user sudah login, redirect ke dashboard
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);


  // Update WIB Server Time Realtime
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // UTC + 7 WIB
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const wib = new Date(utc + 7 * 3600000);
      
      const timeStr = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(wib) + " WIB";
      
      setServerTime(timeStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Quick preset accounts for testing
  const handleSelectPreset = (roleEmail: string, roleName: string) => {
    setEmail(roleEmail);
    setPassword("Latihan#2026");
    setSelectedRole(roleName);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setErrorMessage(res.error || "Gagal masuk. Periksa kembali email dan kata sandi Anda.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setErrorMessage("Terjadi kendala koneksi. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="landing-wrapper">
      {/* Top Banner Navigation */}
      <header className="landing-header">
        <div className="header-container">
          <div className="brand-badge">
            <div className="brand-icon">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="brand-title">KarsaHR</h1>
              <p className="brand-subtitle">PT Karsa Lintas Nusantara</p>
            </div>
          </div>

          <div className="server-time-pill">
            <Clock className="w-4 h-4 text-primary" />
            <span>{serverTime || "Sinkronisasi Server WIB..."}</span>
          </div>
        </div>
      </header>

      {/* Main Hero & Login Section */}
      <main className="landing-main">
        <div className="hero-content">
          <div className="badge-live">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Capstone Project · PT Karsa Lintas Nusantara</span>
          </div>
          
          <h2 className="hero-title">
            Sistem Informasi HR Internal <br />
            <span className="gradient-text">Akurat, Terpadu & Terpercaya</span>
          </h2>
          
          <p className="hero-description">
            Platform mandiri terintegrasi untuk pengelolaan absensi berbasis waktu server WIB, 
            persetujuan cuti berjenjang anti-minus kuota, pengelolaan slip gaji rahasia, serta analitik divisi.
          </p>

          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon bg-blue-subtle">
                <Clock className="w-5 h-5 text-blue" />
              </div>
              <div>
                <h4 className="feature-title">Absensi Server WIB</h4>
                <p className="feature-text">Check-in otomatis, validasi batas 08.15.00 WIB anti-kecurangan perangkat.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon bg-emerald-subtle">
                <Calendar className="w-5 h-5 text-emerald" />
              </div>
              <div>
                <h4 className="feature-title">Cuti Berjenjang & Kuota</h4>
                <p className="feature-text">Validasi kuota real-time, persetujuan 2-tahap (Atasan lalu HRD).</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon bg-purple-subtle">
                <FileText className="w-5 h-5 text-purple" />
              </div>
              <div>
                <h4 className="feature-title">Slip Gaji Rahasia</h4>
                <p className="feature-text">Nomor otomatis SG-TTTTBB-NNN, hanya bisa diakses HRD dan pemilik slip.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="login-card-container">
          <div className="card login-card">
            <div className="login-card-header">
              <div className="login-avatar">
                <LogIn className="w-6 h-6 text-primary" />
              </div>
              <h3 className="login-title">Masuk ke KarsaHR</h3>
              <p className="login-subtitle">Gunakan email perusahaan untuk mengakses akun Anda</p>
            </div>

            {/* Quick Test Account Selector */}
            <div className="preset-container">
              <span className="preset-label">Pilih Akun Uji Coba Cepat:</span>
              <div className="preset-chips">
                <button 
                  type="button" 
                  onClick={() => handleSelectPreset("andi.wijaya@karsalintas.test", "Karyawan (Andi)")}
                  className={`chip ${selectedRole === "Karyawan (Andi)" ? "chip-active" : ""}`}
                >
                  Karyawan (Andi)
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSelectPreset("maya.anggraini@karsalintas.test", "Atasan (Maya)")}
                  className={`chip ${selectedRole === "Atasan (Maya)" ? "chip-active" : ""}`}
                >
                  Atasan (Maya)
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSelectPreset("rina.kusumawardani@karsalintas.test", "HRD (Rina)")}
                  className={`chip ${selectedRole === "HRD (Rina)" ? "chip-active" : ""}`}
                >
                  HRD (Rina)
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSelectPreset("bambang.hartono@karsalintas.test", "Nonaktif (Bambang)")}
                  className={`chip ${selectedRole === "Nonaktif (Bambang)" ? "chip-active chip-danger" : ""}`}
                >
                  Uji Nonaktif (Bambang)
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="error-alert">
                <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Perusahaan</label>
                <input 
                  id="email" 
                  type="email" 
                  className="form-input" 
                  placeholder="nama@karsalintas.test"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Kata Sandi</label>
                <input 
                  id="password" 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" disabled={isSubmitting} className="btn btn-primary login-btn">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk Sekarang</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>


            <div className="security-notice">
              <ShieldCheck className="w-4 h-4 text-emerald" />
              <span>Diautentikasi aman melalui Firebase & audit log aktif.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2026 PT Karsa Lintas Nusantara · Bekasi. Seluruh hak cipta dilindungi.</p>
      </footer>

      <style jsx>{`
        .landing-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at 10% 20%, rgba(37, 99, 235, 0.05) 0%, rgba(248, 250, 252, 1) 90%);
        }

        .landing-header {
          border-bottom: 1px solid var(--border-subtle);
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .brand-badge {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
        }

        .brand-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .brand-subtitle {
          font-size: 0.75rem;
          font-weight: 500;
          color: #64748b;
        }

        .server-time-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 0.375rem 0.875rem;
          border-radius: 9999px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #1e40af;
        }

        .landing-main {
          flex: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 3.5rem 1.5rem;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 4rem;
          align-items: center;
        }

        @media (max-width: 900px) {
          .landing-main {
            grid-template-columns: 1fr;
            padding: 2rem 1rem;
            gap: 2.5rem;
          }
        }

        .badge-live {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
          padding: 0.35rem 0.85rem;
          border-radius: 9999px;
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: 1.25rem;
        }

        .hero-title {
          font-size: 2.5rem;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.03em;
          color: #0f172a;
          margin-bottom: 1.25rem;
        }

        .gradient-text {
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-description {
          font-size: 1.0625rem;
          line-height: 1.6;
          color: #475569;
          margin-bottom: 2rem;
        }

        .features-grid {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
        }

        .feature-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .bg-blue-subtle {
          background-color: #eff6ff;
        }

        .text-blue {
          color: #2563eb;
        }

        .bg-emerald-subtle {
          background-color: #ecfdf5;
        }

        .text-emerald {
          color: #10b981;
        }

        .bg-purple-subtle {
          background-color: #f5f3ff;
        }

        .text-purple {
          color: #8b5cf6;
        }

        .feature-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 0.2rem;
        }

        .feature-text {
          font-size: 0.8125rem;
          color: #64748b;
          line-height: 1.4;
        }

        .login-card {
          padding: 2.25rem;
          border-radius: 18px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(226, 232, 240, 0.8);
          background: #ffffff;
        }

        .login-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .login-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.25rem;
        }

        .login-subtitle {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 1.5rem;
        }

        .preset-container {
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          padding: 0.75rem 1rem;
          margin-bottom: 1.5rem;
        }

        .preset-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          margin-bottom: 0.5rem;
        }

        .preset-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .chip {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .chip:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }

        .chip-active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }

        .chip-danger {
          border-color: #fca5a5;
          color: #b91c1c;
        }

        .chip-danger.chip-active {
          background: #dc2626;
          border-color: #dc2626;
          color: #ffffff;
        }

        .error-alert {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.8125rem;
          font-weight: 500;
          margin-bottom: 1.25rem;
        }

        .login-btn {

          width: 100%;
          padding: 0.75rem;
          font-size: 0.9375rem;
          margin-top: 0.5rem;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        }

        .security-notice {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1.25rem;
          padding-top: 1rem;
          border-top: 1px solid #f1f5f9;
          font-size: 0.75rem;
          color: #64748b;
        }

        .landing-footer {
          border-top: 1px solid var(--border-subtle);
          padding: 1.25rem;
          text-align: center;
          font-size: 0.8125rem;
          color: #94a3b8;
          background: #ffffff;
        }
      `}</style>
    </div>
  );
}
