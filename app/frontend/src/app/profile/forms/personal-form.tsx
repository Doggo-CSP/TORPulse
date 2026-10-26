// app/profile/forms/personal-form.tsx
// The individual bidder's details, used by the profile page and the onboarding wizard.
"use client";

import { NumberField, errorCls, hintCls, inputCls, labelCls } from "./form-ui";
import type { MainProfileForm } from "./main-profile";

type TextKey = "displayName" | "firstName" | "lastName" | "jobTitle" | "contactEmail" | "phone";

export function PersonalForm({
  value,
  onChange,
  strict = false,
}: {
  value: MainProfileForm;
  onChange: (patch: Partial<MainProfileForm>) => void;
  /** Mark the fields the qualification score requires (onboarding). */
  strict?: boolean;
}) {
  const star = (required: boolean) => (strict && required ? " *" : "");
  const budgetInvalid =
    value.budgetMin != null && value.budgetMax != null && value.budgetMin > value.budgetMax;

  const text = (key: TextKey, label: string, required = false, type = "text", placeholder = "") => (
    <div>
      <label htmlFor={`personal-${key}`} className={labelCls}>
        {label}
        {star(required)}
      </label>
      <input
        id={`personal-${key}`}
        type={type}
        value={value[key] ?? ""}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-5 pt-2 md:grid-cols-2">
      {text("firstName", "ชื่อ", true)}
      {text("lastName", "นามสกุล", true)}
      {text("displayName", "ชื่อที่แสดง")}
      {text("jobTitle", "ตำแหน่งงาน", false, "text", "เช่น นักพัฒนาซอฟต์แวร์")}
      {text("contactEmail", "อีเมล", true, "email")}
      {text("phone", "เบอร์โทรศัพท์", false, "tel")}
      {strict && (
        <p className={`${hintCls} -mt-3 md:col-span-2`}>* กรอกอีเมลหรือเบอร์โทรศัพท์อย่างน้อย 1 อย่าง</p>
      )}
      <div className="md:col-span-2">
        <label htmlFor="personal-address" className={labelCls}>
          ที่อยู่
        </label>
        <textarea
          id="personal-address"
          rows={2}
          value={value.address ?? ""}
          onChange={(e) => onChange({ address: e.target.value })}
          className={inputCls}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="personal-about" className={labelCls}>
          เกี่ยวกับคุณ
        </label>
        <textarea
          id="personal-about"
          rows={3}
          value={value.about ?? ""}
          onChange={(e) => onChange({ about: e.target.value })}
          placeholder="แนะนำตัวสั้น ๆ เช่น ทักษะ ความถนัด หรือประสบการณ์"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-2">
        <p className={labelCls}>ช่วงงบประมาณโครงการที่สนใจ</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <NumberField
            id="personal-budget-min"
            value={value.budgetMin}
            onChange={(n) => onChange({ budgetMin: n })}
            suffix="บาท"
            placeholder="ต่ำสุด"
          />
          <span className="hidden text-center text-xs text-[#998f80] sm:block">ถึง</span>
          <NumberField
            id="personal-budget-max"
            value={value.budgetMax}
            onChange={(n) => onChange({ budgetMax: n })}
            suffix="บาท"
            placeholder="สูงสุด (เว้นว่าง = ไม่จำกัด)"
          />
        </div>
        {budgetInvalid ? (
          <p className={errorCls}>งบประมาณต่ำสุดต้องไม่มากกว่างบประมาณสูงสุด</p>
        ) : (
          <p className={hintCls}>ใช้เป็นแนวทางคัดกรอง ไม่นับเป็นเงื่อนไขคุณสมบัติใน TOR</p>
        )}
      </div>
    </div>
  );
}
