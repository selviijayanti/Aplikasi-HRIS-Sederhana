/**
 * Layanan Notifikasi Email Transaksional KarsaHR
 * Sesuai Spesifikasi PRD Bab 11 & Aturan BR-11:
 * - Email ke Atasan saat ada pengajuan baru dari anggota divisinya
 * - Email ke HRD saat pengajuan menunggu keputusan akhir
 * - Email ke pemohon saat pengajuan disetujui, ditolak, atau dibatalkan
 * - Email ke karyawan saat slip gaji terbit (Hanya berisi tautan ke aplikasi tanpa nominal gaji - BR-11)
 * - Kegagalan pengiriman email TIDAK BOLEH membatalkan aksi utama.
 */

export type EmailNotificationType =
  | "LEAVE_SUBMITTED_TO_MANAGER"
  | "LEAVE_PENDING_HRD"
  | "LEAVE_STATUS_UPDATED"
  | "PAYROLL_PUBLISHED";

export interface EmailNotificationRecord {
  id: string;
  type: EmailNotificationType;
  toEmail: string;
  toName: string;
  subject: string;
  title: string;
  message: string;
  actionUrl: string;
  actionText: string;
  meta: Record<string, any>;
  sentAt: string;
  status: "delivered" | "simulated" | "failed";
  html: string;
}

const STORAGE_KEY = "karsahr_email_notifications";

/**
 * Ambil seluruh riwayat notifikasi email tersimpan (Outbox)
 */
export function getEmailNotifications(): EmailNotificationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("Gagal membaca riwayat email:", err);
    return [];
  }
}

/**
 * Simpan notifikasi email ke penyimpanan lokal
 */
export function persistEmailNotification(email: EmailNotificationRecord): void {
  if (typeof window === "undefined") return;
  try {
    const current = getEmailNotifications();
    const updated = [email, ...current].slice(0, 100); // Simpan maksimal 100 email terakhir
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Picu event custom agar komponen UI real-time terbarui
    window.dispatchEvent(new CustomEvent("karsahr_email_sent", { detail: email }));
  } catch (err) {
    console.warn("Gagal menyimpan notifikasi email ke local storage:", err);
  }
}

/**
 * Kosongkan riwayat email
 */
export function clearEmailNotifications(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("karsahr_email_sent", { detail: null }));
  } catch (err) {
    console.warn("Gagal mengosongkan riwayat email:", err);
  }
}

/**
 * Buat template HTML email formal dan profesional berstandar enterprise
 */
export function generateEmailHtml({
  recipientName,
  title,
  badgeText,
  badgeColor = "#2563eb",
  summaryItems,
  note,
  actionUrl,
  actionText,
}: {
  recipientName: string;
  title: string;
  badgeText?: string;
  badgeColor?: string;
  summaryItems: Array<{ label: string; value: string }>;
  note?: string;
  actionUrl: string;
  actionText: string;
}): string {
  const currentYear = new Date().getFullYear();

  const summaryRows = summaryItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 12px; color: #64748b; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f1f5f9; width: 38%;">
          ${item.label}
        </td>
        <td style="padding: 8px 12px; color: #0f172a; font-size: 13px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">
          ${item.value}
        </td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 28px 14px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner Navy -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f224a 0%, #1e3a8a 100%); padding: 24px 28px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 800; font-size: 15px; width: 30px; height: 30px; line-height: 30px; text-align: center; border-radius: 8px; vertical-align: middle; margin-right: 8px;">K</div>
                    <span style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; vertical-align: middle;">KarsaHR</span>
                  </td>
                  <td align="right">
                    <span style="color: #93c5fd; font-size: 11px; font-weight: 500;">PT Karsa Lintas Nusantara</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px;">
              ${
                badgeText
                  ? `<div style="display: inline-block; padding: 4px 10px; background-color: ${badgeColor}15; color: ${badgeColor}; border: 1px solid ${badgeColor}35; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px;">
                      ${badgeText}
                    </div>`
                  : ""
              }

              <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 18px; font-weight: 700; line-height: 1.35;">
                ${title}
              </h2>

              <p style="margin: 0 0 18px 0; color: #475569; font-size: 13.5px; line-height: 1.55;">
                Halo <strong>${recipientName}</strong>,
              </p>

              <!-- Summary Table -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; overflow: hidden;">
                ${summaryRows}
              </table>

              ${
                note
                  ? `<div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 0 6px 6px 0; margin-bottom: 22px;">
                      <p style="margin: 0; color: #92400e; font-size: 12.5px; line-height: 1.45;">
                        <strong>Catatan:</strong> ${note}
                      </p>
                    </div>`
                  : ""
              }

              <!-- Action CTA Button -->
              <div style="text-align: center; margin: 26px 0 10px 0;">
                <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 13.5px; font-weight: 600; padding: 11px 26px; border-radius: 8px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);">
                  ${actionText} &rarr;
                </a>
              </div>

              <p style="margin: 22px 0 0 0; color: #94a3b8; font-size: 11.5px; text-align: center; line-height: 1.45;">
                Atau salin tautan berikut ke peramban Anda:<br>
                <a href="${actionUrl}" style="color: #2563eb; text-decoration: underline; word-break: break-all;">${actionUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 18px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px;">
                Email notifikasi transaksional otomatis dari sistem internal <strong>KarsaHR</strong>.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 10.5px;">
                &copy; ${currentYear} PT Karsa Lintas Nusantara. Seluruh hak cipta dilindungi.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Kirim Notifikasi Email (Non-blocking & Fallback Aman)
 * Aturan PRD: Kegagalan pengiriman email tidak boleh membatalkan aksi utama.
 */
export async function sendEmailNotification({
  type,
  toEmail,
  toName,
  subject,
  title,
  message,
  badgeText,
  badgeColor,
  summaryItems,
  note,
  actionPath,
  actionText,
  meta = {},
}: {
  type: EmailNotificationType;
  toEmail: string;
  toName: string;
  subject: string;
  title: string;
  message: string;
  badgeText?: string;
  badgeColor?: string;
  summaryItems: Array<{ label: string; value: string }>;
  note?: string;
  actionPath: string;
  actionText: string;
  meta?: Record<string, any>;
}): Promise<{ success: boolean; id: string }> {
  const id = `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const actionUrl = `${baseUrl}${actionPath.startsWith("/") ? actionPath : `/${actionPath}`}`;

  const html = generateEmailHtml({
    recipientName: toName,
    title,
    badgeText,
    badgeColor,
    summaryItems,
    note,
    actionUrl,
    actionText,
  });

  const record: EmailNotificationRecord = {
    id,
    type,
    toEmail,
    toName,
    subject,
    title,
    message,
    actionUrl,
    actionText,
    meta,
    sentAt: new Date().toISOString(),
    status: "simulated",
    html,
  };

  try {
    // 1. Simpan ke local outbox store
    persistEmailNotification(record);

    // 2. Kirim secara asynchronous ke API Route backend (Next.js server)
    // Non-blocking: tidak menggunakan await pada aksi utama
    fetch("/api/notifications/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    })
      .then(async (res) => {
        if (!res.ok) {
          console.warn(`[KarsaHR Email] API status ${res.status}: fallback ke outbox simulasi.`);
        }
      })
      .catch((err) => {
        console.warn("[KarsaHR Email] Network fetch error:", err);
      });

    return { success: true, id };
  } catch (err) {
    // Menjamin kegagalan email TIDAK membatalkan aksi utama (PRD Bab 11)
    console.warn("[KarsaHR Email] Warning non-blocking email dispatch error:", err);
    return { success: false, id };
  }
}
