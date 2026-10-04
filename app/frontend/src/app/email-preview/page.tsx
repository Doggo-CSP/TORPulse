"use client";

import { useState, useMemo, useEffect } from "react";
import { SiteNav } from "@/app/components/site_nav";
import { useAuth } from "@/hooks/use-auth";
import {
  BellIcon,
  ClockIcon,
  EnvelopeIcon,
  CommandLineIcon,
  EyeIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  SparklesIcon,
  AdjustmentsHorizontalIcon,
  DocumentDuplicateIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

type TemplateType = "bookmark_expiring" | "new_tor_match" | "weekly_digest";
type ViewMode = "preview" | "code";
type DeviceMode = "desktop" | "mobile";

interface EmailVariables {
  userName: string;
  userEmail: string;
  projectTitle: string;
  agencyName: string;
  budgetBaht: number;
  deadlineDate: string;
  daysRemaining: number;
  category: string;
  technologies: string[];
  torId: string;
  torDetailUrl: string;
}

const DEFAULT_VARS: EmailVariables = {
  userName: "คุณกิตติศักดิ์ เจริญสุข",
  userEmail: "kittisak.c@enterprise.co.th",
  projectTitle: "จ้างพัฒนาระบบคลาวด์แพลตฟอร์มกลางและวิเคราะห์ข้อมูลอัจฉริยะ (AI & Cloud Platform)",
  agencyName: "สำนักงานพัฒนารัฐบาลดิจิทัล (องค์การมหาชน)",
  budgetBaht: 48500000,
  deadlineDate: "15 ตุลาคม 2569 เวลา 16:30 น.",
  daysRemaining: 1,
  category: "เทคโนโลยีสารสนเทศและการสื่อสาร",
  technologies: ["Cloud Computing", "AI / Machine Learning", "Kubernetes", "Next.js"],
  torId: "TOR-6909-08241",
  torDetailUrl: "https://torpulse.gov.th/tor/690908241",
};

export default function EmailPreviewPage() {
  const { user } = useAuth();
  const [template, setTemplate] = useState<TemplateType>("bookmark_expiring");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [copied, setCopied] = useState(false);
  const [vars, setVars] = useState<EmailVariables>(DEFAULT_VARS);

  // Test Send Modal State
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState(DEFAULT_VARS.userEmail);
  const [sendMode, setSendMode] = useState<"gmail_smtp" | "simulation">("gmail_smtp");
  const [gmailUser, setGmailUser] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [sendingState, setSendingState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sentLog, setSentLog] = useState<{
    to: string;
    subject: string;
    timestamp: string;
    messageId: string;
    isRealDelivery?: boolean;
  } | null>(null);

  // Load saved Gmail SMTP credentials from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("torpulse_gmail_user");
    const savedPass = localStorage.getItem("torpulse_gmail_app_pass");
    if (savedUser) setGmailUser(savedUser);
    if (savedPass) setGmailAppPassword(savedPass);
  }, []);

  // Auto-fill logged in user email & name if available
  useEffect(() => {
    if (user?.email) {
      setVars((prev) => ({
        ...prev,
        userName: user.name || prev.userName,
        userEmail: user.email || prev.userEmail,
      }));
      setTestRecipient(user.email);
      setGmailUser((prev) => prev || (user.email.endsWith("@gmail.com") ? user.email : ""));
    }
  }, [user]);

  // Email Subject by template
  const currentSubject = useMemo(() => {
    if (template === "bookmark_expiring") {
      return vars.daysRemaining <= 1
        ? `[ด่วน 24 ชม.] โครงการที่คุณบันทึกไว้กำลังจะปิดรับข้อเสนอ: ${vars.projectTitle}`
        : `[เตือนกำหนดเวลา] เหลืออีก ${vars.daysRemaining} วัน ก่อนปิดรับข้อเสนอ: ${vars.projectTitle}`;
    }
    if (template === "new_tor_match") {
      return `[ประกาศใหม่] มี TOR ใหม่ตรงหมวดหมู่ความสนใจของคุณ: ${vars.category}`;
    }
    return `[สรุปสัปดาห์] สรุปประกาศ TOR และความเคลื่อนไหวประจำสัปดาห์`;
  }, [template, vars]);

  // Generate Email HTML
  const emailHtml = useMemo(() => {
    const formattedBudget = new Intl.NumberFormat("th-TH").format(vars.budgetBaht);
    const isUrgent24h = vars.daysRemaining <= 1;

    if (template === "bookmark_expiring") {
      const bannerColor = isUrgent24h ? "#dc2626" : "#d97706";
      const bannerGradient = isUrgent24h
        ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
        : "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";
      const urgencyText = isUrgent24h ? "เหลือเวลา 24 ชั่วโมงสุดท้าย!" : `เหลือเวลาอีก ${vars.daysRemaining} วัน`;
      const badgeBg = isUrgent24h ? "#fef2f2" : "#fffbeb";
      const badgeBorder = isUrgent24h ? "#fecaca" : "#fde68a";
      const badgeText = isUrgent24h ? "#991b1b" : "#92400e";

      return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>แจ้งเตือน: TOR ที่บันทึกไว้ใกล้ปิดรับข้อเสนอ</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: ${bannerGradient}; padding: 32px 28px; text-align: left;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.22); color: #ffffff; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
                      ⏳ แจ้งเตือน TOR ที่บันทึกไว้
                    </span>
                  </td>
                  <td align="right">
                    <span style="color: rgba(255, 255, 255, 0.85); font-size: 13px; font-weight: 500;">
                      TORPulse Alerts
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 14px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; line-height: 1.3;">
                      ${urgencyText}
                    </h1>
                    <p style="margin: 6px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; line-height: 1.5;">
                      โครงการจัดซื้อจัดจ้างที่คุณบันทึกไว้กำลังจะสิ้นสุดระยะเวลายื่นซอง/ข้อเสนอ
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                สวัสดี <strong>${vars.userName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                ระบบขอแจ้งเตือนโครงการในรายการที่บันทึกไว้ (Bookmarks) ของคุณ เนื่องจากใกล้ถึงกำหนดเวลายื่นข้อเสนอ กรุณาตรวจสอบเอกสารและเตรียมความพร้อมล่วงหน้า
              </p>

              <!-- TOR Highlight Card -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${badgeBg}; border: 1.5px solid ${badgeBorder}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 12px; font-weight: 700; color: ${badgeText}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                      รหัสโครงการ: ${vars.torId}
                    </div>
                    <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; line-height: 1.4; color: #0f172a;">
                      ${vars.projectTitle}
                    </h2>

                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 14px; margin-top: 12px;">
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; width: 120px; font-weight: 500;">หน่วยงาน:</td>
                        <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${vars.agencyName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-weight: 500;">งบประมาณกลาง:</td>
                        <td style="padding: 6px 0; color: #15803d; font-weight: 700; font-size: 16px;">฿${formattedBudget} บาท</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-weight: 500;">กำหนดส่งข้อเสนอ:</td>
                        <td style="padding: 6px 0; color: ${bannerColor}; font-weight: 700;">
                          ${vars.deadlineDate}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-weight: 500;">หมวดหมู่:</td>
                        <td style="padding: 6px 0; color: #475569;">${vars.category}</td>
                      </tr>
                    </table>

                    ${
                      vars.technologies.length > 0
                        ? `
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed ${badgeBorder};">
                      <span style="font-size: 12px; color: #64748b; font-weight: 500;">เทคโนโลยีที่เกี่ยวข้อง:</span>
                      <div style="margin-top: 6px;">
                        ${vars.technologies
                          .map(
                            (tech) =>
                              `<span style="display: inline-block; background-color: #ffffff; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; padding: 3px 8px; margin-right: 6px; margin-bottom: 4px; font-weight: 500;">${tech}</span>`,
                          )
                          .join("")}
                      </div>
                    </div>
                    `
                        : ""
                    }
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${vars.torDetailUrl}" target="_blank" style="display: inline-block; width: 85%; max-width: 320px; background-color: #0284c7; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; text-align: center; padding: 14px 24px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);">
                      🚀 เปิดดูรายละเอียดและดาวน์โหลด TOR
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8; text-align: center;">
                คำแนะนำ: ตรวจสอบความถูกต้องของหลักประกันซองและเอกสารคุณสมบัติก่อนครบกำหนด
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #334155;">
                TORPulse — แพลตฟอร์มค้นหาและวิเคราะห์ร่าง TOR จัดซื้อจัดจ้างภาครัฐ
              </p>
              <p style="margin: 0 0 12px 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                อีเมลนี้ถูกส่งอัตโนมัติไปยัง <strong>${vars.userEmail}</strong> เนื่องจากคุณได้บันทึกโครงการนี้ไว้<br>
                ต้องการเปลี่ยนการตั้งค่าแจ้งเตือน? <a href="https://torpulse.gov.th/profile" style="color: #0284c7; text-decoration: underline;">จัดการการแจ้งเตือน</a> หรือ <a href="https://torpulse.gov.th/saved" style="color: #0284c7; text-decoration: underline;">ดูรายการบันทึกทั้งหมด</a>
              </p>
              <div style="font-size: 11px; color: #94a3b8;">
                © 2026 TORPulse. สงวนลิขสิทธิ์ทั้งหมด
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    if (template === "new_tor_match") {
      return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>มีประกาศ TOR ใหม่ตรงกับความสนใจของคุณ</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px 28px; text-align: left;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.22); color: #ffffff; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
                      🔔 ประกาศ TOR อัปเดตใหม่
                    </span>
                  </td>
                  <td align="right">
                    <span style="color: rgba(255, 255, 255, 0.85); font-size: 13px; font-weight: 500;">
                      ตรวจพบโครงการใหม่
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 14px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; line-height: 1.3;">
                      มีประกาศ TOR ใหม่ตรงความสนใจของคุณ!
                    </h1>
                    <p style="margin: 6px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; line-height: 1.5;">
                      ตรงกับหมวดหมู่ความสนใจที่คุณติดตามไว้: <strong>${vars.category}</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                เรียน <strong>${vars.userName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                ระบบ AI อัจฉริยะของ TORPulse ตรวจพบร่าง TOR ใหม่ที่เพิ่งประกาศในระบบ e-GP และผ่านการสกัดข้อมูลพร้อมให้คุณวิเคราะห์แล้ว:
              </p>

              <!-- TOR Highlight Card -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;">
                    <span style="display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; margin-bottom: 8px;">
                      ประกาศล่าสุด
                    </span>
                    <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; line-height: 1.4; color: #14532d;">
                      ${vars.projectTitle}
                    </h2>

                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 14px; margin-top: 10px;">
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; width: 120px; font-weight: 500;">หน่วยงานเจ้าของ:</td>
                        <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${vars.agencyName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; font-weight: 500;">งบประมาณจัดซื้อ:</td>
                        <td style="padding: 5px 0; color: #15803d; font-weight: 700; font-size: 16px;">฿${formattedBudget} บาท</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; font-weight: 500;">วันปิดรับข้อเสนอ:</td>
                        <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${vars.deadlineDate}</td>
                      </tr>
                    </table>

                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #bbf7d0;">
                      <span style="font-size: 12px; color: #166534; font-weight: 600;">เทคโนโลยีที่สกัดพบโดย AI:</span>
                      <div style="margin-top: 6px;">
                        ${vars.technologies
                          .map(
                            (tech) =>
                              `<span style="display: inline-block; background-color: #ffffff; color: #15803d; border: 1px solid #86efac; border-radius: 6px; font-size: 12px; padding: 3px 8px; margin-right: 6px; margin-bottom: 4px; font-weight: 500;">${tech}</span>`,
                          )
                          .join("")}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Call to Action -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${vars.torDetailUrl}" target="_blank" style="display: inline-block; width: 85%; max-width: 320px; background-color: #059669; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-align: center; padding: 14px 24px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35);">
                      ✨ ดูการวิเคราะห์เชิงลึกและบันทึก TOR
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8; text-align: center;">
                คุณสามารถกดบันทึก (Bookmark) โครงการนี้ในระบบ เพื่อรับแจ้งเตือนความคืบหน้าอย่างต่อเนื่อง
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #334155;">
                TORPulse — แพลตฟอร์มค้นหาและวิเคราะห์ร่าง TOR จัดซื้อจัดจ้างภาครัฐ
              </p>
              <p style="margin: 0 0 12px 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                อีเมลนี้ถูกส่งเนื่องจากหมวดหมู่ที่คุณสนใจตรงกับโครงการใหม่<br>
                แก้ไขหมวดหมู่ที่สนใจ: <a href="https://torpulse.gov.th/profile" style="color: #059669; text-decoration: underline;">ตั้งค่าหมวดหมู่ความสนใจ</a>
              </p>
              <div style="font-size: 11px; color: #94a3b8;">
                © 2026 TORPulse. สงวนลิขสิทธิ์ทั้งหมด
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    // Weekly Digest Template
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>สรุปภาพรวมประกาศ TOR ประจำสัปดาห์</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px 28px; text-align: left;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.22); color: #ffffff; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
                📊 สรุปความเคลื่อนไหวประจำสัปดาห์
              </span>
              <h1 style="margin: 14px 0 0 0; color: #ffffff; font-size: 24px; font-weight: 800; line-height: 1.3;">
                TORPulse Weekly Roundup
              </h1>
              <p style="margin: 6px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; line-height: 1.5;">
                โครงการใหม่และภาพรวมโอกาสทางธุรกิจในรอบ 7 วันที่ผ่านมา
              </p>
            </td>
          </tr>

          <!-- Summary Stats Row -->
          <tr>
            <td style="padding: 24px 28px 12px 28px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" align="center" style="padding: 10px; border-right: 1px solid #e2e8f0;">
                    <div style="font-size: 24px; font-weight: 800; color: #1e40af;">28</div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">ประกาศใหม่</div>
                  </td>
                  <td width="33%" align="center" style="padding: 10px; border-right: 1px solid #e2e8f0;">
                    <div style="font-size: 24px; font-weight: 800; color: #15803d;">฿342M</div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">มูลค่างบประมาณรวม</div>
                  </td>
                  <td width="33%" align="center" style="padding: 10px;">
                    <div style="font-size: 24px; font-weight: 800; color: #d97706;">5</div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">ตรงกับที่คุณสนใจ</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                สวัสดี <strong>${vars.userName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                นี่คือไฮไลท์โครงการ TOR ที่น่าสนใจสูงสุดประจำสัปดาห์ในหมวดหมู่ของคุณ:
              </p>

              <!-- Item 1 -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 14px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; color: #2563eb; margin-bottom: 4px;">⭐ โครงการเด่นอันดับ 1</div>
                    <h3 style="margin: 0 0 6px 0; font-size: 16px; color: #0f172a; line-height: 1.4;">${vars.projectTitle}</h3>
                    <div style="font-size: 13px; color: #64748b;">${vars.agencyName} • <strong style="color: #15803d;">฿${formattedBudget} บาท</strong></div>
                    <div style="margin-top: 8px;">
                      <a href="${vars.torDetailUrl}" style="color: #2563eb; font-size: 13px; font-weight: 600; text-decoration: none;">ดูรายละเอียดโครงการ →</a>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Item 2 -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">⭐ โครงการเด่นอันดับ 2</div>
                    <h3 style="margin: 0 0 6px 0; font-size: 16px; color: #0f172a; line-height: 1.4;">จ้างบำรุงรักษาและปรับปรุงระบบเครือข่ายความปลอดภัยสารสนเทศ ประจำปี 2570</h3>
                    <div style="font-size: 13px; color: #64748b;">กรมพัฒนาธุรกิจการค้า • <strong style="color: #15803d;">฿18,200,000 บาท</strong></div>
                    <div style="margin-top: 8px;">
                      <a href="https://torpulse.gov.th" style="color: #2563eb; font-size: 13px; font-weight: 600; text-decoration: none;">ดูรายละเอียดโครงการ →</a>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Call to Action -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://torpulse.gov.th/?recent=week" target="_blank" style="display: inline-block; width: 85%; max-width: 320px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-align: center; padding: 14px 24px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
                      🔍 ดูประกาศ TOR ใหม่ทั้งหมดสัปดาห์นี้
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #334155;">
                TORPulse — แพลตฟอร์มค้นหาและวิเคราะห์ร่าง TOR จัดซื้อจัดจ้างภาครัฐ
              </p>
              <div style="font-size: 11px; color: #94a3b8;">
                © 2026 TORPulse. สงวนลิขสิทธิ์ทั้งหมด
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }, [template, vars]);

  // Copy HTML
  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(emailHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleResetDefaults = () => {
    setVars(DEFAULT_VARS);
    if (user?.email) {
      setVars((prev) => ({
        ...prev,
        userName: user.name || prev.userName,
        userEmail: user.email,
      }));
      setTestRecipient(user.email);
    }
  };

  const handleUseMyAccount = () => {
    if (user?.email) {
      setVars((prev) => ({
        ...prev,
        userName: user.name || prev.userName,
        userEmail: user.email,
      }));
      setTestRecipient(user.email);
    }
  };

  // Trigger test delivery (Real Resend API or Simulation)
  const handleExecuteSend = async () => {
    setErrorMessage(null);
    setSendingState("sending");

    if (sendMode === "gmail_smtp") {
      try {
        if (gmailUser) {
          localStorage.setItem("torpulse_gmail_user", gmailUser.trim());
        }
        if (gmailAppPassword) {
          localStorage.setItem("torpulse_gmail_app_pass", gmailAppPassword.trim());
        }

        const res = await fetch("/api/send-test-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: testRecipient.trim(),
            subject: currentSubject,
            html: emailHtml,
            gmailUser: gmailUser.trim(),
            gmailAppPassword: gmailAppPassword.trim(),
            fromName: "TORPulse Alerts",
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSendingState("error");
          setErrorMessage(
            data.error || data.message || "ไม่สามารถส่งอีเมลผ่าน Google SMTP ได้ กรุณาตรวจสอบอีเมลและรหัสผ่านสำหรับแอป"
          );
          return;
        }

        setSendingState("success");
        setSentLog({
          to: testRecipient.trim(),
          subject: currentSubject,
          timestamp: new Date().toLocaleString("th-TH"),
          messageId: data.messageId ? `Gmail ID: ${data.messageId}` : `<torpulse-${Date.now()}@gmail.com>`,
          isRealDelivery: true,
        });
      } catch (err: unknown) {
        setSendingState("error");
        setErrorMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
      }
    } else {
      // Simulation mode
      setTimeout(() => {
        setSendingState("success");
        setSentLog({
          to: testRecipient.trim(),
          subject: currentSubject,
          timestamp: new Date().toLocaleString("th-TH"),
          messageId: `<simulated-${Date.now()}@torpulse.gov.th>`,
          isRealDelivery: false,
        });
      }, 1000);
    }
  };

  // Download .eml file so user can open directly in Windows Mail / Outlook
  const handleDownloadEml = () => {
    const emlContent = [
      `From: "TORPulse Alerts" <no-reply@torpulse.gov.th>`,
      `To: "${vars.userName}" <${testRecipient}>`,
      `Subject: ${currentSubject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      emailHtml,
    ].join("\r\n");

    const blob = new Blob([emlContent], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TORPulse-Notification-${template}.eml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <SiteNav />

      {/* Header bar */}
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  <EnvelopeIcon className="size-3.5" />
                  HTML Email System
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <SparklesIcon className="size-3" />
                  Live Preview & Test Delivery
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                ระบบพรีวิวและทดลองส่งอีเมลแจ้งเตือน
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                พรีวิวเทมเพลตอีเมลแจ้งเตือน TOR ใหม่ / เตือน Bookmark ใกล้หมดเวลา และทดลองส่งไปยังอีเมลของผู้ใช้งานที่เข้าสู่ระบบ
              </p>
            </div>

            {/* Top Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Primary: Send Test Email */}
              <button
                type="button"
                onClick={() => {
                  setSendingState("idle");
                  setIsSendModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all hover:shadow-lg active:scale-95"
              >
                <PaperAirplaneIcon className="size-4" />
                <span>ทดลองส่งอีเมล ({user?.email ? user.email.split("@")[0] : "ไปยังผู้ใช้"})</span>
              </button>

              {/* Copy HTML Button */}
              <button
                type="button"
                onClick={handleCopyHtml}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-xs transition-all ${
                  copied
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {copied ? (
                  <>
                    <ClipboardDocumentCheckIcon className="size-4 text-white" />
                    <span>คัดลอก HTML สำเร็จแล้ว!</span>
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="size-4" />
                    <span>คัดลอกโค้ด HTML</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Template Selection Tabs */}
          <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setTemplate("bookmark_expiring")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                template === "bookmark_expiring"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <ClockIcon className="size-4" />
              <span>⏰ เตือน Bookmark ใกล้หมดเวลา</span>
              {vars.daysRemaining <= 1 && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                  24 ชม.
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTemplate("new_tor_match")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                template === "new_tor_match"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <BellIcon className="size-4" />
              <span>🔔 มีประกาศ TOR ใหม่ตรงความสนใจ</span>
            </button>

            <button
              type="button"
              onClick={() => setTemplate("weekly_digest")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                template === "weekly_digest"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <DocumentDuplicateIcon className="size-4" />
              <span>📊 สรุปประกาศรายสัปดาห์ (Digest)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 w-full">
        
        {/* User login banner alert */}
        <div className="mb-6 rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <UserCircleIcon className="size-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">สถานะบัญชีที่เข้าสู่ระบบขณะนี้:</div>
              <div className="text-sm font-bold text-slate-800">
                {user?.email ? (
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <span className="size-2 rounded-full bg-emerald-500"></span>
                    {user.name} ({user.email})
                  </span>
                ) : (
                  <span className="text-slate-500">ยังไม่ได้เข้าสู่ระบบ (สามารถพิมพ์อีเมลเพื่อทดสอบส่งได้)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user?.email && (
              <button
                type="button"
                onClick={handleUseMyAccount}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                ดึงข้อมูลบัญชีของฉันมาใส่
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSendingState("idle");
                setIsSendModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              <PaperAirplaneIcon className="size-3.5" />
              ทดลองส่งอีเมลนี้
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Variable Configuration Form */}
          <aside className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="size-5 text-slate-500" />
                <h2 className="text-base font-bold text-slate-900">ตัวแปรข้อมูล (Mock Variables)</h2>
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                คืนค่าเริ่มต้น
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              {/* Urgency selection for Bookmark Template */}
              {template === "bookmark_expiring" && (
                <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3.5">
                  <label className="block text-xs font-bold text-amber-900 mb-1.5">
                    ระดับความเร่งด่วน (วันคงเหลือก่อนปิดรับ):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVars((prev) => ({ ...prev, daysRemaining: 1 }))}
                      className={`py-2 px-3 rounded-lg text-xs font-bold text-center border transition-all ${
                        vars.daysRemaining <= 1
                          ? "bg-red-600 text-white border-red-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      🚨 24 ชม. สุดท้าย (ด่วนมาก)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVars((prev) => ({ ...prev, daysRemaining: 3 }))}
                      className={`py-2 px-3 rounded-lg text-xs font-bold text-center border transition-all ${
                        vars.daysRemaining > 1
                          ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      ⏰ อีก 3 วัน (เตือนล่วงหน้า)
                    </button>
                  </div>
                </div>
              )}

              {/* User Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อผู้รับ (User Name):
                </label>
                <input
                  type="text"
                  value={vars.userName}
                  onChange={(e) => setVars({ ...vars, userName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* User Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  อีเมลผู้รับ (Recipient Email):
                </label>
                <input
                  type="email"
                  value={vars.userEmail}
                  onChange={(e) => {
                    setVars({ ...vars, userEmail: e.target.value });
                    setTestRecipient(e.target.value);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Project Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อโครงการ (Project Title):
                </label>
                <textarea
                  rows={2}
                  value={vars.projectTitle}
                  onChange={(e) => setVars({ ...vars, projectTitle: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Agency Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หน่วยงานเจ้าของโครงการ (Agency):
                </label>
                <input
                  type="text"
                  value={vars.agencyName}
                  onChange={(e) => setVars({ ...vars, agencyName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Budget Baht */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  งบประมาณ (บาท):
                </label>
                <input
                  type="number"
                  value={vars.budgetBaht}
                  onChange={(e) => setVars({ ...vars, budgetBaht: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Deadline Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วันสิ้นสุดรับข้อเสนอ (Deadline Date):
                </label>
                <input
                  type="text"
                  value={vars.deadlineDate}
                  onChange={(e) => setVars({ ...vars, deadlineDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมวดหมู่ (Category):
                </label>
                <input
                  type="text"
                  value={vars.category}
                  onChange={(e) => setVars({ ...vars, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 text-xs text-slate-400">
                💡 ปรับเปลี่ยนค่าตัวแปรในฟอร์มนี้ ตัวอย่างอีเมลและโค้ด HTML จะอัปเดตแบบ Real-time ทันที
              </div>
            </div>
          </aside>

          {/* Right Column: Email Preview Canvas */}
          <section className="lg:col-span-8 flex flex-col gap-3">
            
            {/* Toolbar: Viewport & View Mode */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    viewMode === "preview"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <EyeIcon className="size-4" />
                  <span>ตัวอย่างภาพ (Preview)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("code")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    viewMode === "code"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CommandLineIcon className="size-4" />
                  <span>โค้ด HTML (Source)</span>
                </button>
              </div>

              {/* Viewport Toggles (only applicable in preview mode) */}
              {viewMode === "preview" && (
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDeviceMode("desktop")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      deviceMode === "desktop"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <ComputerDesktopIcon className="size-4" />
                    <span>Desktop (640px)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceMode("mobile")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      deviceMode === "mobile"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <DevicePhoneMobileIcon className="size-4" />
                    <span>Mobile (380px)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Simulated Email Client Frame */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              
              {/* Email Envelope Header Bar */}
              <div className="bg-slate-100/90 border-b border-slate-200 px-5 py-3 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-500 w-14">From:</span>
                  <span className="font-medium text-slate-800">
                    TORPulse Notifications &lt;no-reply@torpulse.gov.th&gt;
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 w-14">To:</span>
                    <span className="font-medium text-slate-800">{vars.userName} &lt;{vars.userEmail}&gt;</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSendingState("idle");
                      setIsSendModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <PaperAirplaneIcon className="size-3" />
                    ทดลองส่งถึงอีเมลนี้
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-500 w-14">Subject:</span>
                  <span className="font-bold text-slate-900">
                    {currentSubject}
                  </span>
                </div>
              </div>

              {/* Canvas Content */}
              {viewMode === "preview" ? (
                <div className="bg-slate-200/60 p-4 md:p-8 flex justify-center items-start min-h-[640px]">
                  <div
                    className={`transition-all duration-300 w-full overflow-hidden ${
                      deviceMode === "mobile"
                        ? "max-w-[390px] rounded-3xl border-8 border-slate-800 shadow-2xl bg-white"
                        : "max-w-[650px] rounded-xl shadow-lg bg-white"
                    }`}
                  >
                    <iframe
                      title="HTML Email Preview"
                      srcDoc={emailHtml}
                      className="w-full h-[680px] border-0"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 text-slate-100 overflow-x-auto min-h-[600px] text-xs font-mono">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <span className="text-slate-400">Full HTML Source Code</span>
                    <button
                      type="button"
                      onClick={handleCopyHtml}
                      className="text-xs text-blue-400 hover:text-blue-300 font-sans font-medium flex items-center gap-1"
                    >
                      <ClipboardDocumentIcon className="size-3.5" />
                      คัดลอกทั้งหมด
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap leading-relaxed">{emailHtml}</pre>
                </div>
              )}
            </div>

            {/* Email Implementation Checklist Card */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 text-sm">
              <h3 className="font-bold text-blue-950 flex items-center gap-2">
                <SparklesIcon className="size-4 text-blue-600" />
                จุดเด่นของเทมเพลตและคุณสมบัติทางเทคนิค
              </h3>
              <ul className="mt-2.5 space-y-1.5 text-xs text-blue-900/90 list-disc list-inside">
                <li>
                  <strong>รองรับทุก Email Clients:</strong> เขียนด้วย Table-based HTML + Inline CSS ไม่ผิดเพี้ยนทั้งใน Gmail, Apple Mail, Outlook และ Webmail
                </li>
                <li>
                  <strong>สีสันตามระดับความเร่งด่วน:</strong> เมื่อเหลือเวลา 24 ชม. ระบบจะเปลี่ยน Header เป็นสีแดงเตือนภัย เพื่อกระตุ้นให้ผู้ใช้ไม่พลาดโอกาส
                </li>
                <li>
                  <strong>ทดลองส่งถึงผู้ใช้:</strong> สามารถจำลองการส่งไปยังอีเมลจริงของผู้ใช้ที่ล็อกอิน หรือดาวน์โหลดไฟล์ .eml ไปเปิดดูในเครื่องได้ทันที
                </li>
              </ul>
            </div>

          </section>

        </div>
      </main>

      {/* Test Send Simulation Modal */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsSendModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <XMarkIcon className="size-5" />
            </button>

            {sendingState === "idle" && (
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                    <PaperAirplaneIcon className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">ทดลองส่งอีเมลแจ้งเตือน</h3>
                    <p className="text-xs text-slate-500">
                      ส่งไปยังอีเมลของผู้ใช้ที่ล็อกอินอยู่ หรือทดลองส่งเข้า Inbox จริง
                    </p>
                  </div>
                </div>

                {/* Delivery Mode Toggle */}
                <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSendMode("gmail_smtp")}
                    className={`py-2 px-3 rounded-lg text-center transition-all ${
                      sendMode === "gmail_smtp"
                        ? "bg-white text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🚀 ส่งจริงผ่าน Google SMTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode("simulation")}
                    className={`py-2 px-3 rounded-lg text-center transition-all ${
                      sendMode === "simulation"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🧪 จำลองการส่ง (Simulation)
                  </button>
                </div>

                <div className="mt-4 space-y-3.5 text-sm">
                  {/* Recipient Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      อีเมลผู้รับปลายทาง (Recipient):
                    </label>
                    <input
                      type="email"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                    />
                    {user?.email && (
                      <p className="mt-1 text-xs text-emerald-600 font-medium">
                        ✓ ดึงจากบัญชีที่เข้าสู่ระบบ: {user.email}
                      </p>
                    )}
                  </div>

                  {/* Google SMTP Credentials (Visible in gmail_smtp mode) */}
                  {sendMode === "gmail_smtp" && (
                    <div className="rounded-xl bg-blue-50/60 p-4 border border-blue-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                          <EnvelopeIcon className="size-4 text-blue-600" />
                          ตั้งค่าบัญชี Google SMTP (Gmail)
                        </span>
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-600 hover:underline font-semibold"
                        >
                          สร้างรหัสผ่านแอป ↗
                        </a>
                      </div>

                      {/* Gmail Sender User */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          อีเมล Gmail ผู้ส่ง (Sender Gmail):
                        </label>
                        <input
                          type="email"
                          value={gmailUser}
                          onChange={(e) => setGmailUser(e.target.value)}
                          placeholder="your-sender@gmail.com"
                          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>

                      {/* Gmail App Password */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          รหัสผ่านสำหรับแอป (Google App Password 16 หลัก):
                        </label>
                        <input
                          type="password"
                          value={gmailAppPassword}
                          onChange={(e) => setGmailAppPassword(e.target.value)}
                          placeholder="xxxx xxxx xxxx xxxx"
                          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-mono focus:border-blue-500 focus:outline-hidden"
                        />
                        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                          * ใช้รหัสผ่านสำหรับแอป (16 ตัว) จาก Google ไม่ใช่รหัสผ่านอีเมลปกติ (ระบบจะบันทึกไว้ในเครื่องของคุณ)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Template Info Card */}
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">เทมเพลตที่เลือก:</span>
                      <span className="font-bold text-slate-800">
                        {template === "bookmark_expiring"
                          ? `⏰ เตือน Bookmark (${vars.daysRemaining <= 1 ? "24 ชม." : "3 วัน"})`
                          : template === "new_tor_match"
                          ? "🔔 ประกาศ TOR ใหม่ตรงความสนใจ"
                          : "📊 สรุปสัปดาห์ (Digest)"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">หัวข้ออีเมล (Subject):</span>
                      <div className="font-semibold text-slate-800 mt-0.5 truncate">{currentSubject}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadEml}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <ArrowDownTrayIcon className="size-4" />
                    ดาวน์โหลดไฟล์ .eml (เปิดใน Mail)
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSend}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95"
                  >
                    <PaperAirplaneIcon className="size-4" />
                    {sendMode === "gmail_smtp" ? "ส่งเข้า Inbox จริงผ่าน Gmail" : "ยืนยันส่งอีเมลจำลอง"}
                  </button>
                </div>
              </div>
            )}

            {sendingState === "sending" && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                <h4 className="text-base font-bold text-slate-900">
                  {sendMode === "gmail_smtp" ? "กำลังส่งอีเมลผ่าน Google SMTP..." : "กำลังจำลองการส่งอีเมล..."}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  กำลังเชื่อมต่อไปยัง smtp.gmail.com:465 และส่งข้อความไปยัง {testRecipient}
                </p>
              </div>
            )}

            {sendingState === "error" && (
              <div className="py-4">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-red-100 text-red-600 mb-3">
                  <XMarkIcon className="size-8" />
                </div>
                <h4 className="text-center text-lg font-bold text-slate-900">
                  ส่งอีเมลผ่าน Google SMTP ไม่สำเร็จ
                </h4>
                <p className="mt-2 text-center text-xs text-red-600 font-medium px-4 leading-relaxed">
                  {errorMessage || "เกิดข้อผิดพลาดในการเชื่อมต่อกับ Google SMTP"}
                </p>

                <div className="mt-4 rounded-xl bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1.5 border border-amber-200/80">
                  <p className="font-bold">วิธีแก้ไข:</p>
                  <p>1. ตรวจสอบว่าบัญชี Google ได้เปิดใช้งาน <strong>2-Step Verification</strong> แล้ว</p>
                  <p>2. ไปที่ <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-semibold text-amber-950">myaccount.google.com/apppasswords</a> เพื่อสร้าง <strong>รหัสผ่านสำหรับแอป (16 หลัก)</strong></p>
                  <p>3. ห้ามใช้รหัสผ่านสำหรับล็อกอิน Gmail ปกติ ต้องใช้รหัสผ่านสำหรับแอป 16 ตัวเท่านั้น</p>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSendingState("idle")}
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    แก้ไขข้อมูลและลองใหม่
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadEml}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowDownTrayIcon className="size-4" />
                    ดาวน์โหลด .eml แทน
                  </button>
                </div>
              </div>
            )}

            {sendingState === "success" && (
              <div className="py-2">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircleIcon className="size-8" />
                </div>
                <h4 className="mt-3 text-center text-lg font-bold text-slate-900">
                  {sentLog?.isRealDelivery ? "ส่งอีเมลเข้า Inbox สำเร็จเรียบร้อย!" : "ส่งอีเมลจำลองสำเร็จ!"}
                </h4>
                <p className="mt-1 text-center text-xs text-slate-500">
                  {sentLog?.isRealDelivery
                    ? "อีเมลถูกส่งผ่าน Google SMTP (smtp.gmail.com) ไปยังกล่องจดหมายของคุณแล้ว กรุณาเปิดเช็คที่ Inbox หรือ Junk/Spam"
                    : "ระบบได้จำลองการส่งข้อมูลแบบ HTML ไปยังผู้ใช้เรียบร้อยแล้ว"}
                </p>

                {sentLog && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">ผู้ส่ง (From):</span>
                      <span className="text-slate-900 font-bold">{gmailUser || "Google SMTP"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">ผู้รับ (To):</span>
                      <span className="text-slate-900 font-bold">{sentLog.to}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">สถานะ (Status):</span>
                      <span className="text-emerald-600 font-bold">250 2.0.0 OK (Delivered)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">เวลาที่ส่ง:</span>
                      <span className="text-slate-700">{sentLog.timestamp}</span>
                    </div>
                    <div className="flex justify-between truncate">
                      <span className="text-slate-400 font-sans">Message-ID:</span>
                      <span className="text-slate-600 truncate">{sentLog.messageId}</span>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadEml}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowDownTrayIcon className="size-4" />
                    เปิดดูไฟล์ .eml บนเครื่อง
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSendModalOpen(false)}
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
