"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import "./login.css";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Jika sudah login, langsung diarahkan ke dashboard
  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setErrorMessage(res.error || "Email atau kata sandi tidak valid.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setErrorMessage("Terjadi kesalahan pada sistem. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="login-screen">
      <div className="login-card-container">
        {/* Kolom Kiri: Panel Branding & Ilustrasi Profesional HRIS */}
        <div className="login-brand-panel">
          <div className="brand-panel-content">
            {/* Kategori Sistem Enterprise */}
            <div className="brand-eyebrow">
              <Building2 className="w-4 h-4 text-blue-200" />
              <span>HRIS Enterprise Platform</span>
            </div>

            {/* Headline & Deskripsi */}
            <h2 className="brand-headline">
              Kelola Tim & Administrasi SDM Lebih Efisien
            </h2>
            <p className="brand-subheadline">
              Sistem informasi sumber daya manusia terpadu PT Karsa Lintas Nusantara untuk pencatatan presensi, kuota cuti, dan operasional karyawan.
            </p>

            {/* Area Gambar Hero */}
            <div className="hero-illustration-wrapper">
              <div className="hero-image-container">
                <img
                  src="/images/login-hero.jpg"
                  alt="Ilustrasi Profesional HRIS KarsaHR"
                  className="hero-image"
                />
              </div>
            </div>

            {/* Footer Keamanan di Panel Samping */}
            <div className="brand-panel-footer">
              <ShieldCheck className="w-4 h-4 text-blue-200" />
              <span>Enterprise Grade Security · 256-bit SSL Protected</span>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Form Login */}
        <div className="login-form-panel">
          <div className="login-header">
            <div className="welcome-section">
              <h2 className="portal-title">Selamat Datang Kembali</h2>
              <p className="portal-subtitle">Silakan masukkan email dan kata sandi akun Anda</p>
            </div>
          </div>

          {/* Pesan Kesalahan / Akun Nonaktif (Sesuai PRD BR-01) */}
          {errorMessage && (
            <div className="alert-box">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Masuk */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Perusahaan
              </label>
              <div className="input-wrapper">
                <Mail className="input-icon" />
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="nama@karsalintas.test"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="password">
                  Kata Sandi
                </label>
                <span className="help-text">Minimal 6 karakter</span>
              </div>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-input form-input-password"
                  placeholder="Masukkan kata sandi akun"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPassword ? (
                    <Eye size={16} />
                  ) : (
                    <EyeOff size={16} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <span>Masuk ke Portal</span>
              )}
            </button>
          </form>


          <div className="login-footer">
            <p>Aplikasi HRIS Internal PT Karsa Lintas Nusantara</p>
            <p className="sub-footer">Hanya diperuntukkan bagi personel dengan otorisasi resmi.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
