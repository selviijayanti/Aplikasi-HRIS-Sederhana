"use client";

import React, { useState, useEffect } from "react";
import {
  EmailNotificationRecord,
  getEmailNotifications,
  clearEmailNotifications,
} from "@/lib/email/email-service";
import { Mail, X, Trash2, ExternalLink, CheckCircle, Clock } from "lucide-react";

interface EmailOutboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EmailOutboxModal({ isOpen, onClose }: EmailOutboxModalProps) {
  const [emails, setEmails] = useState<EmailNotificationRecord[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailNotificationRecord | null>(null);

  const loadEmails = () => {
    const list = getEmailNotifications();
    setEmails(list);
    if (list.length > 0 && !selectedEmail) {
      setSelectedEmail(list[0]);
    } else if (list.length === 0) {
      setSelectedEmail(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEmails();
    }
  }, [isOpen]);

  // Dengarkan event email baru yang terkirim saat modal terbuka
  useEffect(() => {
    const handleEmailSent = () => {
      loadEmails();
    };
    window.addEventListener("karsahr_email_sent", handleEmailSent);
    return () => window.removeEventListener("karsahr_email_sent", handleEmailSent);
  }, []);

  if (!isOpen) return null;

  const handleClear = () => {
    if (confirm("Apakah Anda yakin ingin mengosongkan riwayat email outbox?")) {
      clearEmailNotifications();
      setEmails([]);
      setSelectedEmail(null);
    }
  };

  const formatWib = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB";
    } catch {
      return isoStr;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "LEAVE_SUBMITTED_TO_MANAGER":
        return { label: "Pengajuan ke Atasan", color: "#2563eb", bg: "#eff6ff" };
      case "LEAVE_PENDING_HRD":
        return { label: "Menunggu HRD", color: "#d97706", bg: "#fffbeb" };
      case "LEAVE_STATUS_UPDATED":
        return { label: "Keputusan Cuti", color: "#059669", bg: "#ecfdf5" };
      case "PAYROLL_PUBLISHED":
        return { label: "Slip Gaji Terbit (BR-11)", color: "#7c3aed", bg: "#f5f3ff" };
      default:
        return { label: "Notifikasi Sistem", color: "#475569", bg: "#f1f5f9" };
    }
  };

  return (
    <div className="outbox-backdrop" onClick={onClose}>
      <div className="outbox-card" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="outbox-header">
          <div className="outbox-title-box">
            <div className="outbox-icon-wrap">
              <Mail size={18} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="outbox-title">Log Notifikasi Email Transaksional</h3>
                <span className="outbox-badge-count">{emails.length} pesan</span>
              </div>
              <p className="outbox-sub">
                Fitur Nilai Tambah PRD Bab 11 &amp; BR-11 (Atasan, HRD, Pemohon, dan Terbit Slip Gaji).
              </p>
            </div>
          </div>

          <div className="outbox-header-actions">
            {emails.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="btn-clear-outbox"
                title="Kosongkan riwayat email"
              >
                <Trash2 size={13} />
                <span>Kosongkan</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="outbox-close-btn"
              aria-label="Tutup modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Modal (Dual-pane: List & Preview) */}
        <div className="outbox-body">
          {emails.length === 0 ? (
            <div className="outbox-empty">
              <div className="empty-mail-circle">
                <Mail size={32} />
              </div>
              <h4>Belum Ada Riwayat Notifikasi Email</h4>
              <p>
                Notifikasi email otomatis akan dicatat di sini saat ada pengajuan cuti baru, persetujuan atasan/HRD, atau saat slip gaji diterbitkan.
              </p>
            </div>
          ) : (
            <div className="outbox-dual-pane">
              {/* Kolom Kiri: Daftar Email */}
              <div className="outbox-list-pane">
                {emails.map((item) => {
                  const typeBadge = getTypeLabel(item.type);
                  const isSelected = selectedEmail?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedEmail(item)}
                      className={`outbox-item-card ${isSelected ? "selected" : ""}`}
                    >
                      <div className="item-top-row">
                        <span
                          className="item-type-badge"
                          style={{ color: typeBadge.color, backgroundColor: typeBadge.bg }}
                        >
                          {typeBadge.label}
                        </span>
                        <span className="item-time">
                          <Clock size={11} style={{ display: "inline", marginRight: 3 }} />
                          {formatWib(item.sentAt)}
                        </span>
                      </div>

                      <div className="item-recipient">
                        Ke: <strong>{item.toName}</strong> &lt;{item.toEmail}&gt;
                      </div>

                      <div className="item-subject">{item.subject}</div>

                      <div className="item-status-row">
                        <span className="status-indicator">
                          <CheckCircle size={12} className="text-emerald-500" />
                          <span>Terkirim (Simulasi Outbox)</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Kolom Kanan: Pratinjau HTML Email */}
              <div className="outbox-preview-pane">
                {selectedEmail ? (
                  <div className="preview-container">
                    <div className="preview-top-bar">
                      <div>
                        <div className="preview-subject">{selectedEmail.subject}</div>
                        <div className="preview-meta">
                          Kepada: <strong>{selectedEmail.toName}</strong> ({selectedEmail.toEmail}) &bull;{" "}
                          {formatWib(selectedEmail.sentAt)}
                        </div>
                      </div>
                      <a
                        href={selectedEmail.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-open-link"
                        title="Buka tautan aksi tujuan"
                      >
                        <ExternalLink size={13} />
                        <span>Buka Tautan</span>
                      </a>
                    </div>

                    <div className="preview-frame-wrap">
                      <iframe
                        title="Pratinjau Email"
                        srcDoc={selectedEmail.html}
                        className="preview-iframe"
                        sandbox="allow-same-origin allow-popups"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="preview-placeholder">
                    Pilih email dari daftar di sebelah kiri untuk melihat pratinjau.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .outbox-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .outbox-card {
          background-color: #ffffff;
          border-radius: 14px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 1040px;
          height: 86vh;
          max-height: 720px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          animation: outboxPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes outboxPop {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .outbox-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e2e8f0;
          background: #fafafa;
        }

        .outbox-title-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .outbox-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background-color: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          border: 1px solid #dbeafe;
          flex-shrink: 0;
        }

        .outbox-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.25;
        }

        .outbox-badge-count {
          font-size: 0.6875rem;
          font-weight: 700;
          background-color: #dbeafe;
          color: #1d4ed8;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }

        .outbox-sub {
          font-size: 0.71875rem;
          color: #64748b;
          margin: 0.2rem 0 0 0;
        }

        .outbox-header-actions {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .btn-clear-outbox {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          color: #64748b;
          padding: 0.3rem 0.65rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-clear-outbox:hover {
          background-color: #fee2e2;
          color: #dc2626;
          border-color: #fca5a5;
        }

        .outbox-close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 0.35rem;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .outbox-close-btn:hover {
          background-color: #e2e8f0;
          color: #0f172a;
        }

        .outbox-body {
          flex: 1;
          min-height: 0;
          display: flex;
          background-color: #f8fafc;
        }

        .outbox-empty {
          margin: auto;
          text-align: center;
          padding: 3rem 2rem;
          max-width: 420px;
        }

        .empty-mail-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background-color: #eff6ff;
          color: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem auto;
        }

        .outbox-empty h4 {
          font-size: 1rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.5rem 0;
        }

        .outbox-empty p {
          font-size: 0.8125rem;
          color: #64748b;
          line-height: 1.5;
          margin: 0;
        }

        .outbox-dual-pane {
          display: flex;
          width: 100%;
          height: 100%;
        }

        .outbox-list-pane {
          width: 360px;
          border-right: 1px solid #e2e8f0;
          background-color: #ffffff;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .outbox-item-card {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .outbox-item-card:hover {
          background-color: #f8fafc;
        }

        .outbox-item-card.selected {
          background-color: #eff6ff;
          border-left: 3px solid #2563eb;
        }

        .item-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.35rem;
        }

        .item-type-badge {
          font-size: 0.65625rem;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
        }

        .item-time {
          font-size: 0.65625rem;
          color: #94a3b8;
          display: flex;
          align-items: center;
        }

        .item-recipient {
          font-size: 0.75rem;
          color: #334155;
          margin-bottom: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-subject {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.35;
          margin-bottom: 0.35rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .item-status-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.65625rem;
          color: #059669;
          font-weight: 500;
        }

        .outbox-preview-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: #f1f5f9;
          overflow: hidden;
        }

        .preview-container {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .preview-top-bar {
          background-color: #ffffff;
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .preview-subject {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
        }

        .preview-meta {
          font-size: 0.71875rem;
          color: #64748b;
          margin-top: 0.15rem;
        }

        .btn-open-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .btn-open-link:hover {
          background-color: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }

        .preview-frame-wrap {
          flex: 1;
          padding: 1rem;
          overflow: hidden;
          display: flex;
        }

        .preview-iframe {
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 8px;
          background-color: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .preview-placeholder {
          margin: auto;
          color: #94a3b8;
          font-size: 0.8125rem;
        }

        @media (max-width: 768px) {
          .outbox-card {
            max-width: 100%;
            height: 94vh;
          }

          .outbox-dual-pane {
            flex-direction: column;
          }

          .outbox-list-pane {
            width: 100%;
            height: 38%;
            border-right: none;
            border-bottom: 1px solid #e2e8f0;
          }

          .outbox-preview-pane {
            height: 62%;
          }
        }
      `}</style>
    </div>
  );
}
