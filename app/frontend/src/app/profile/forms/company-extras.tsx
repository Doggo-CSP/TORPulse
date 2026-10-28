"use client";

import { useRef, useState } from "react";
import {
  DocumentArrowUpIcon,
  TrashIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

const inputCls =
  "w-full rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3 text-sm text-[#2d2d2d] focus:border-[#4a7c59] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4a7c59]";
const labelCls = "block text-xs font-semibold text-[#5c5446] mb-1.5";

/* ───────── ผู้รับผิดชอบหลัก ───────── */

export interface PrimaryContact {
  name: string;
  position: string;
  education: string;
  startDate: string; // yyyy-mm-dd
}

const EDUCATION_OPTIONS = [
  "ต่ำกว่าปริญญาตรี",
  "ประกาศนียบัตร (ปวช./ปวส.)",
  "ปริญญาตรี",
  "ปริญญาโท",
  "ปริญญาเอก",
  "อื่นๆ",
];

export function PrimaryContactFields({
  value,
  onChange,
}: {
  value?: PrimaryContact;
  onChange: (v: PrimaryContact) => void;
}) {
  const v: PrimaryContact = value ?? { name: "", position: "", education: "", startDate: "" };
  const set = (patch: Partial<PrimaryContact>) => onChange({ ...v, ...patch });

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <label className={labelCls}>ชื่อ-นามสกุล</label>
        <input
          type="text"
          className={inputCls}
          value={v.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div>
        <label className={labelCls}>ตำแหน่งงาน</label>
        <input
          type="text"
          className={inputCls}
          value={v.position}
          placeholder="เช่น ผู้จัดการโครงการ / วิศวกรใหญ่"
          onChange={(e) => set({ position: e.target.value })}
        />
      </div>
      <div>
        <label className={labelCls}>วุฒิการศึกษา</label>
        <select
          className={inputCls}
          value={v.education}
          onChange={(e) => set({ education: e.target.value })}
        >
          <option value="">เลือกวุฒิการศึกษา</option>
          {EDUCATION_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>วันที่เข้ามาทำงานที่บริษัท</label>
        <input
          type="date"
          className={inputCls}
          value={v.startDate}
          onChange={(e) => set({ startDate: e.target.value })}
        />
      </div>
    </div>
  );
}

/** จำนวนช่องที่กรอกแล้ว (0–4) ใช้แสดง badge เช่น "2/4" */
export const primaryContactProgress = (v?: PrimaryContact) =>
  [v?.name, v?.position, v?.education, v?.startDate].filter((x) => x?.trim()).length;

/* ───────── อัปโหลด Certificate ───────── */

export interface CertificateFile {
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
}

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ACCEPT_TYPES = ["application/pdf", "image/jpeg", "image/png"];

// TODO: ปรับ endpoint ให้ตรงกับ backend (ส่ง FormData field "file" แล้วคืน { url })
async function uploadCertificate(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads/certificate", {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!res.ok) throw new Error("อัปโหลดไม่สำเร็จ");
  const data = await res.json();
  return data.url as string;
}

export function CertificateUploader({
  files,
  onChange,
}: {
  files: CertificateFile[];
  onChange: (files: CertificateFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;

    setError(null);
    if (files.length + picked.length > MAX_FILES) {
      setError(`อัปโหลดได้สูงสุด ${MAX_FILES} ไฟล์`);
      return;
    }
    const bad = picked.find((f) => !ACCEPT_TYPES.includes(f.type) || f.size > MAX_SIZE);
    if (bad) {
      setError(`"${bad.name}" ต้องเป็น PDF/JPG/PNG และขนาดไม่เกิน 10MB`);
      return;
    }

    setUploading(true);
    try {
      const uploaded: CertificateFile[] = [];
      for (const f of picked) {
        const url = await uploadCertificate(f);
        uploaded.push({
          name: f.name,
          url,
          size: f.size,
          uploadedAt: new Date().toISOString(),
        });
      }
      onChange([...files, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {files.length > 0 && (
        <ul className="mb-3 space-y-2">
          {files.map((f, i) => (
            <li
              key={f.url}
              className="flex items-center gap-3 rounded-2xl border border-[#e8e0d0] bg-[#faf7f2] px-4 py-3"
            >
              <DocumentTextIcon className="size-5 shrink-0 text-[#4a7c59]" />
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-[#2d2d2d] hover:underline"
              >
                {f.name}
              </a>
              <span className="shrink-0 text-xs text-[#998f80]">
                {(f.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="grid size-8 shrink-0 place-items-center rounded-full text-[#CC0000] hover:bg-red-50"
                aria-label={`ลบ ${f.name}`}
              >
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={uploading || files.length >= MAX_FILES}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#ddd5c8] bg-[#faf7f2] px-4 py-6 text-sm text-[#5c5446] hover:border-[#4a7c59] hover:text-[#4a7c59] disabled:opacity-50"
      >
        <DocumentArrowUpIcon className="size-5" />
        {uploading ? "กำลังอัปโหลด..." : "เลือกไฟล์ Certificate"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_TYPES.join(",")}
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      <p className="mt-1.5 text-[11px] text-[#998f80]">
        รองรับ PDF, JPG, PNG ไม่เกิน 10MB ต่อไฟล์ (สูงสุด {MAX_FILES} ไฟล์) เช่น ISO,
        หนังสือรับรองบริษัท, ใบรับรองมาตรฐานต่างๆ
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}