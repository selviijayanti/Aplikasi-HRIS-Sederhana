"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Lock, Mail, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
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

  // Jika sudah login, langsung ke dashboard
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
      <div className="login-box">
        {/* Header Perusahaan */}
        <div className="login-header">
          <div className="logo-container">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="app-title">KarsaHR</h1>
          <p className="company-title">PT Karsa Lintas Nusantara</p>
          <div className="divider"></div>
          <h2 className="portal-subtitle">Masuk ke Akun Anda</h2>
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
            <label className="form-label" htmlFor="password">
              Kata Sandi
            </label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input form-input-password"
                placeholder="Masukkan kata sandi"
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
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
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
                <span>Memproses...</span>
              </>
            ) : (
              <span>Masuk</span>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Aplikasi HRIS Internal PT Karsa Lintas Nusantara</p>
          <p className="sub-footer">Hanya untuk pengguna yang memiliki akun resmi.</p>
        </div>
      </div>
    </div>
  );
}
