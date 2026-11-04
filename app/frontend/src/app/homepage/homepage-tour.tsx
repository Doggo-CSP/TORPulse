"use client";

import { TourProvider, useTour as useReactour } from "@reactour/tour";
import type { StepType } from "@reactour/tour";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Tour steps (Thai UI) — shown to logged-in first-time visitors       */
/* ------------------------------------------------------------------ */

export const homepageTourSteps: StepType[] = [
  {
    // Intro step — no specific element, centered
    selector: "body",
    content: (
      <div className="space-y-2">
        <p className="text-base font-semibold">ยินดีต้อนรับสู่ TORPulse! 🎉</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          เว็บไซต์รวบรวมและค้นหา TOR (Terms of Reference) งานซอฟต์แวร์ทั้งหมดไว้ในที่เดียว
          มาทัวร์ฟีเจอร์หลักๆ กันก่อนเลย!
        </p>
      </div>
    ),
    position: "center",
  },
  {
    // Hero heading
    selector: "h1",
    content: (
      <div className="space-y-2">
        <p className="text-base font-semibold">🌐 แพลตฟอร์มค้นหา TOR</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          TORPulse รวบรวม TOR จากแหล่งจัดซื้อจัดจ้างหลายแหล่ง
          ไม่ต้องตามหาเองจากหลายเว็บอีกต่อไป
        </p>
      </div>
    ),
    position: "bottom",
  },
  {
    // Stats panel (index card on the right side of the hero)
    selector: ".panel.p-6",
    content: (
      <div className="space-y-2">
        <p className="text-base font-semibold">📊 ดัชนีล่าสุด</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          ดูจำนวน TOR ที่จัดเก็บ แหล่งข้อมูลที่เชื่อมต่อ
          และงบประมาณรวมที่ระบบกำลังติดตามอยู่แบบ real-time
        </p>
      </div>
    ),
    position: "left",
  },
  {
    // Smart-search section
    selector: "#smart-search",
    content: (
      <div className="space-y-2">
        <p className="text-base font-semibold">🔍 ค้นหา TOR อัจฉริยะ</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          พิมพ์ชื่อโครงการ หน่วยงาน หมายเลข TOR หรือเทคโนโลยีที่ต้องการ
          แล้วระบบจะแสดงผลที่เกี่ยวข้องทันที
        </p>
      </div>
    ),
    position: "top",
  },
  {
    // Search input inside the panel
    selector: "#smart-search-input",
    content: (
      <div className="space-y-2">
        <p className="text-base font-semibold">⌨️ ช่องค้นหา</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          พิมพ์คำค้นหาที่นี่ ระบบจะค้นหาแบบ real-time
          โดยไม่ต้องกด Enter รองรับชื่อโครงการ, เทคโนโลยี และหน่วยงาน
        </p>
      </div>
    ),
    position: "bottom",
  },
  {
    // Category chip row
    selector: ".panel.overflow-hidden .flex.flex-wrap.gap-1\\.5",
    content: (
      <div className="space-y-2">
        <p className="text-base font-semibold">🏷️ กรองตามหมวดหมู่</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          คลิก chip หมวดหมู่เพื่อกรอง TOR เช่น AI/ML, Web App, Cloud, Cybersecurity
          สามารถเลือกได้หลายหมวดพร้อมกัน
        </p>
      </div>
    ),
    position: "bottom",
  },
  {
    // Profile page link in navbar — guides user to set up their interests
    selector: "#tour-profile-link",
    content: (
      <div className="space-y-2">
        <p className="text-base font-semibold">👤 ตั้งค่าโปรไฟล์</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          ไปที่หน้าโปรไฟล์เพื่อเลือกหมวดหมู่ที่สนใจ
          ระบบจะนำไปคำนวณคะแนนและแนะนำ TOR ที่ตรงกับความเชี่ยวชาญของคุณโดยอัตโนมัติ
        </p>
      </div>
    ),
    position: "top",
  },
];

/* ------------------------------------------------------------------ */
/*  Custom navigation inside the popover                                */
/* ------------------------------------------------------------------ */

function TourNavigation() {
  const { currentStep, steps, setCurrentStep, setIsOpen } = useReactour();
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      {/* step dot indicators */}
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            aria-label={`ไปยังขั้นตอนที่ ${i + 1}`}
            style={{
              width: i === currentStep ? 16 : 6,
              height: 6,
              borderRadius: 9999,
              background: i === currentStep ? "var(--primary, #4a7c59)" : "#d1d5db",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
              padding: 0,
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        {!isFirst && (
          <button
            onClick={() => setCurrentStep((s) => s - 1)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "white",
              fontSize: 12,
              fontWeight: 500,
              color: "#6b7280",
              cursor: "pointer",
            }}
          >
            ← ก่อนหน้า
          </button>
        )}

        {isLast ? (
          <button
            onClick={() => setIsOpen(false)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary, #4a7c59)",
              fontSize: 12,
              fontWeight: 600,
              color: "white",
              cursor: "pointer",
            }}
          >
            เริ่มใช้งานเลย! 🚀
          </button>
        ) : (
          <button
            onClick={() => setCurrentStep((s) => s + 1)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary, #4a7c59)",
              fontSize: 12,
              fontWeight: 600,
              color: "white",
              cursor: "pointer",
            }}
          >
            ถัดไป →
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom content component (replaces default @reactour content)       */
/* ------------------------------------------------------------------ */

function TourContent({
  content,
  currentStep,
}: {
  content: React.ReactNode;
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div style={{ minWidth: 260, maxWidth: 340, fontFamily: "inherit" }}>
      <div style={{ marginBottom: 4, fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
        {currentStep + 1} / {homepageTourSteps.length}
      </div>
      {content}
      <TourNavigation />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider wrapper — wrap your page with this                         */
/* ------------------------------------------------------------------ */

interface HomepageTourProviderProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export function HomepageTourProvider({
  children,
  isOpen,
  onClose,
}: HomepageTourProviderProps) {
  return (
    <TourProvider
      steps={homepageTourSteps}
      isOpen={isOpen}
      setIsOpen={(open) => {
        if (!open) onClose();
      }}
      onClickClose={onClose}
      onClickMask={({ setIsOpen }) => setIsOpen(false)}
      showNavigation={false}
      showBadge={false}
      showDots={false}
      ContentComponent={TourContent}
      styles={{
        popover: (base) => ({
          ...base,
          borderRadius: 16,
          padding: 20,
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
          border: "1px solid rgba(0,0,0,0.06)",
          background: "#ffffff",
          maxWidth: 360,
        }),
        maskArea: (base) => ({
          ...base,
          rx: 10,
        }),
        maskWrapper: (base) => ({
          ...base,
          color: "rgba(0, 0, 0, 0.55)",
        }),
      }}
    >
      {children}
    </TourProvider>
  );
}
