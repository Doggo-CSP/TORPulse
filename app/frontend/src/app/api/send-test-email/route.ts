import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      to,
      subject,
      html,
      gmailUser: customGmailUser,
      gmailAppPassword: customGmailAppPassword,
      fromName,
    } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "กรุณาระบุ to, subject และ html ให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // Determine Gmail User & App Password from request or env
    const gmailUser = (
      customGmailUser ||
      process.env.GOOGLE_SMTP_USER ||
      process.env.GMAIL_USER ||
      ""
    ).trim();

    const rawPassword = (
      customGmailAppPassword ||
      process.env.GOOGLE_SMTP_PASS ||
      process.env.GMAIL_APP_PASSWORD ||
      ""
    ).trim();
    // Clean spaces from 16-char app password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
    const gmailAppPassword = rawPassword.replace(/\s+/g, "");

    if (!gmailUser || !gmailAppPassword) {
      return NextResponse.json(
        {
          error: "ยังไม่ได้ระบุอีเมล Gmail หรือ App Password สำหรับ Google SMTP",
          code: "MISSING_GMAIL_AUTH",
          message:
            "กรุณาระบุบัญชี Gmail และรหัสผ่านสำหรับแอป (16 หลัก) ในฟอร์ม หรือกำหนดใน GOOGLE_SMTP_USER และ GOOGLE_SMTP_PASS",
        },
        { status: 400 }
      );
    }

    // Create Nodemailer Transporter for Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    const senderHeader = fromName
      ? `"${fromName}" <${gmailUser}>`
      : `"TORPulse Alerts" <${gmailUser}>`;

    const info = await transporter.sendMail({
      from: senderHeader,
      to: to.trim(),
      subject: subject,
      html: html,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      to: to.trim(),
      from: senderHeader,
      subject,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; responseCode?: number };
    let friendlyMessage = err.message || "ไม่สามารถส่งอีเมลผ่าน Google SMTP ได้";

    if (err.code === "EAUTH" || err.responseCode === 535) {
      friendlyMessage =
        "การยืนยันตัวตน Google SMTP ล้มเหลว (535 Authentication Failed): กรุณาตรวจสอบว่าใช้ 'รหัสผ่านสำหรับแอป (App Password)' 16 หลักจาก Google ไม่ใช่รหัสผ่านล็อกอินปกติของ Gmail";
    }

    return NextResponse.json(
      {
        error: friendlyMessage,
        code: err.code || "SMTP_ERROR",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
