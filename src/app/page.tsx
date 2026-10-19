"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Lock, Mail, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Jika sudah login, langsung ke dashboard
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

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
                type="password"
                className="form-input"
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary submit-btn"
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

      <style jsx>{`
        .login-screen {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          padding: 1.5rem;
        }

        .login-box {
          width: 100%;
          max-width: 420px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
          padding: 2.5rem 2rem;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .logo-container {
          width: 44px;
          height: 44px;
          background: #2563eb;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 0.75rem auto;
        }

        .app-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin: 0;
        }

        .company-title {
          font-size: 0.8125rem;
          color: #64748b;
          margin: 0.2rem 0 0 0;
          font-weight: 500;
        }

        .divider {
          width: 40px;
          height: 2px;
          background: #e2e8f0;
          margin: 1.25rem auto 1rem auto;
        }

        .portal-subtitle {
          font-size: 1rem;
          font-weight: 600;
          color: #334155;
          margin: 0;
        }

        .alert-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          font-size: 0.8125rem;
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          margin-bottom: 1.5rem;
          line-height: 1.4;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .form-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #334155;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper :global(.input-icon) {
          position: absolute;
          left: 0.875rem;
          width: 1.125rem;
          height: 1.125rem;
          color: #94a3b8;
          pointer-events: none;
        }

        .form-input {
          width: 100%;
          padding: 0.625rem 0.875rem 0.625rem 2.625rem;
          font-size: 0.875rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }

        .form-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .submit-btn {
          width: 100%;
          padding: 0.75rem;
          font-size: 0.9375rem;
          font-weight: 600;
          margin-top: 0.5rem;
          border-radius: 8px;
        }

        .login-footer {
          margin-top: 2rem;
          padding-top: 1.25rem;
          border-top: 1px solid #f1f5f9;
          text-align: center;
        }

        .login-footer p {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0;
        }

        .login-footer .sub-footer {
          font-size: 0.6875rem;
          color: #94a3b8;
          margin-top: 0.25rem;
        }
      `}</style>
    </div>
  );
}
