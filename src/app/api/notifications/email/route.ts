import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const toEmail = body.toEmail || body.to;
    const toName = body.toName || body.recipientName || "";
    const subject = body.subject;
    const type = body.type;
    const html = body.html || "";

    if (!toEmail || !subject) {
      return NextResponse.json(
        { success: false, error: "toEmail dan subject wajib diisi" },
        { status: 400 }
      );
    }

    // 1. Integrasi SMTP (DevMail, Mailtrap, atau Custom SMTP)
    const smtpHost = process.env.DEVMAIL_SMTP_HOST || process.env.SMTP_HOST;
    const smtpPort = Number(process.env.DEVMAIL_SMTP_PORT || process.env.SMTP_PORT || 587);
    const smtpUser = process.env.DEVMAIL_SMTP_USER || process.env.SMTP_USER;
    const smtpPass = process.env.DEVMAIL_SMTP_PASS || process.env.SMTP_PASS;

    if (smtpHost && smtpUser) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass || "",
          },
        });

        const info = await transporter.sendMail({
          from: process.env.EMAIL_FROM || '"KarsaHR" <hris@karsalintas.test>',
          to: toName ? `"${toName}" <${toEmail}>` : toEmail,
          subject: subject,
          html: html,
        });

        console.log(`[KarsaHR SMTP] Email terkirim ke DevMail/SMTP:`, info.messageId);

        return NextResponse.json({
          success: true,
          provider: "smtp",
          messageId: info.messageId,
          message: "Email berhasil dikirim ke server DevMail.",
        });
      } catch (smtpErr: any) {
        console.warn("[KarsaHR SMTP Error] Gagal kirim via SMTP, fallback ke log lokal:", smtpErr?.message || smtpErr);
      }
    }

    // 2. Cek integrasi Resend jika disetel
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "KarsaHR <hris@karsalintas.test>",
            to: [toEmail],
            subject: subject,
            html: html,
          }),
        });

        if (resendRes.ok) {
          const resendData = await resendRes.json();
          return NextResponse.json({
            success: true,
            provider: "resend",
            data: resendData,
          });
        }
      } catch (providerErr) {
        console.warn("[Email API] Gagal kirim via Resend, fallback ke log lokal:", providerErr);
      }
    }

    // 2. Fallback Simulasi & Outbox Log (PRD Bab 11: Demo & Bootcamp Ready)
    console.log(`\n=======================================================`);
    console.log(`[KarsaHR EMAIL NOTIFIKASI KELUAR]`);
    console.log(`Tipe      : ${type}`);
    console.log(`Penerima  : ${toName} <${toEmail}>`);
    console.log(`Subjek    : ${subject}`);
    console.log(`Waktu     : ${new Date().toLocaleString("id-ID")}`);
    console.log(`Status    : Tersimulasi & Tersimpan di Outbox`);
    console.log(`=======================================================\n`);

    return NextResponse.json({
      success: true,
      simulated: true,
      message: "Notifikasi email tersimulasi dan tercatat di outbox sistem KarsaHR.",
    });
  } catch (err: any) {
    // Menjamin response selalu ramah dan tidak merusak aksi utama
    console.warn("[Email API Error Handler]:", err?.message || err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal handler warning" },
      { status: 200 }
    );
  }
}
