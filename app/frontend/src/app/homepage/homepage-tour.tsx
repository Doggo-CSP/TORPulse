"use client";

import { TourProvider, useTour as useReactour } from "@reactour/tour";
import type { PopoverContentProps, StepType } from "@reactour/tour";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Tour steps (Thai UI) — shown to logged-in first-time visitors       */
/* ------------------------------------------------------------------ */

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 className="tour-title">{title}</h3>
      <p className="tour-desc">{children}</p>
    </>
  );
}

export const homepageTourSteps: StepType[] = [
  {
    selector: "body",
    position: "center",
    content: (
      <Step title="ยินดีต้อนรับสู่ TORPulse! 🎉">
        เว็บไซต์รวบรวมและค้นหา TOR (Terms of Reference) งานซอฟต์แวร์ทั้งหมดไว้ในที่เดียว
        มาทัวร์ฟีเจอร์หลักๆ กันก่อนเลย
      </Step>
    ),
  },
  {
    selector: "h1",
    position: "bottom",
    content: (
      <Step title="แพลตฟอร์มค้นหา TOR">
        TORPulse รวบรวม TOR จากแหล่งจัดซื้อจัดจ้างหลายแหล่ง
        ไม่ต้องตามหาเองจากหลายเว็บอีกต่อไป
      </Step>
    ),
  },
  {
    selector: ".panel.p-6",
    position: "left",
    content: (
      <Step title="ดัชนีล่าสุด">
        ดูจำนวน TOR ที่จัดเก็บ แหล่งข้อมูลที่เชื่อมต่อ
        และงบประมาณรวมที่ระบบกำลังติดตามอยู่
      </Step>
    ),
  },
  {
    selector: "#smart-search",
    position: "top",
    content: (
      <Step title="ค้นหา TOR อัจฉริยะ">
        พิมพ์ชื่อโครงการ หน่วยงาน หมายเลข TOR หรือเทคโนโลยีที่ต้องการ
        แล้วระบบจะแสดงผลที่เกี่ยวข้องทันที
      </Step>
    ),
  },
  {
    selector: "#smart-search-input",
    position: "bottom",
    content: (
      <Step title="ช่องค้นหา">
        พิมพ์คำค้นหาที่นี่ ระบบจะค้นหาให้อัตโนมัติโดยไม่ต้องกด Enter
        รองรับชื่อโครงการ เทคโนโลยี และหน่วยงาน
      </Step>
    ),
  },
  {
    selector: ".panel.overflow-hidden .flex.flex-wrap.gap-1\\.5",
    position: "bottom",
    content: (
      <Step title="กรองตามหมวดหมู่">
        คลิกหมวดหมู่เพื่อกรอง TOR เช่น AI/ML, เว็บ, คลาวด์, ความมั่นคงปลอดภัยไซเบอร์
        เลือกได้หลายหมวดพร้อมกัน
      </Step>
    ),
  },
  {
    // ปุ่ม "จัดการความสนใจ" ในส่วนแนะนำ (ลิงก์ในเมนู avatar ไม่ถูก render จนกว่าจะเปิด dropdown)
    selector: "#tour-profile-link",
    position: "top",
    content: (
      <Step title="ตั้งค่าความสนใจ">
        กดที่นี่เพื่อไปหน้าโปรไฟล์และเลือกหมวดหมู่ที่สนใจ
        ระบบจะนำไปคำนวณคะแนนและแนะนำ TOR ที่ตรงกับความเชี่ยวชาญของคุณโดยอัตโนมัติ
      </Step>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Popover content: title/desc, "n จาก N", Skip + Next                 */
/* ------------------------------------------------------------------ */

function TourContent({
  currentStep,
  setCurrentStep,
  setIsOpen,
  steps,
}: PopoverContentProps) {
  const raw = steps[currentStep]?.content;
  const content = typeof raw === "function" ? null : raw;
  const total = steps.length;
  const isFirst = currentStep === 0;
  const isLast = currentStep === total - 1;

  return (
    <div className="tour-card">
      {content as ReactNode}

      <div className="tour-footer">
        <div className="tour-counter">
          {!isFirst && (
            <button
              type="button"
              className="tour-back"
              aria-label="ย้อนกลับ"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            >
              ‹
            </button>
          )}
          <span>
            {currentStep + 1} จาก {total}
          </span>
        </div>

        <div className="tour-actions">
          {!isLast && (
            <button type="button" className="tour-skip" onClick={() => setIsOpen(false)}>
              ข้าม
            </button>
          )}
          <button
            type="button"
            className="tour-next"
            onClick={() => (isLast ? setIsOpen(false) : setCurrentStep((s) => s + 1))}
          >
            {isLast ? "เริ่มใช้งาน" : "ถัดไป"}
            {!isLast && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const tourCss = `
.tour-card { min-width: 280px; max-width: 360px; font-family: inherit; }
.tour-title { margin: 0 0 10px; font-size: 18px; font-weight: 700; color: #18181b; line-height: 1.3; }
.tour-desc { margin: 0; font-size: 14px; line-height: 1.65; color: #3f3f46; }
.tour-footer { margin-top: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tour-counter { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #52525b; }
.tour-back { border: none; background: transparent; cursor: pointer; font-size: 20px; line-height: 1; color: #71717a; padding: 0 4px; }
.tour-back:hover { color: #18181b; }
.tour-actions { display: flex; align-items: center; gap: 8px; }
.tour-skip { padding: 8px 16px; border-radius: 10px; border: 1px solid #e4e4e7; background: #fff; font-size: 13px; font-weight: 600; color: #27272a; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
.tour-skip:hover { background: #fafafa; }
.tour-next { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; border: none; background: #3730d4; font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; }
.tour-next:hover { background: #2f28b8; }
@keyframes tour-pulse {
  0%   { stroke-opacity: 1;   stroke-width: 2; }
  70%  { stroke-opacity: .25; stroke-width: 8; }
  100% { stroke-opacity: 1;   stroke-width: 2; }
}
`;

/* ------------------------------------------------------------------ */
/*  Provider wrapper — wrap your page with this                         */
/* ------------------------------------------------------------------ */

interface HomepageTourProviderProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

// TourProvider has no `isOpen` prop, so open/close is driven through reactour's own hook:
// follow the `isOpen` prop, and call `onClose` once when the tour goes from open to closed.
function TourSync({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { isOpen: open, setIsOpen } = useReactour();
  const wasOpen = useRef(false);
  const propOpen = useRef(isOpen);
  propOpen.current = isOpen;

  useEffect(() => {
    setIsOpen(isOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    // Only count it as "seen" when the user closed the tour (the prop is still true).
    // If the parent turned it off (e.g. redirecting to onboarding), don't call onClose.
    if (wasOpen.current && !open && propOpen.current) onClose();
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return null;
}

export function HomepageTourProvider({
  children,
  isOpen,
  onClose,
}: HomepageTourProviderProps) {
  return (
    <TourProvider
      steps={homepageTourSteps}
      onClickMask={({ setIsOpen }) => setIsOpen(false)}
      showNavigation={false}
      showBadge={false}
      showDots={false}
      showCloseButton={false}
      scrollSmooth
      padding={{ mask: 6, popover: [12, 12] }}
      ContentComponent={TourContent}
      styles={{
        popover: (base) => ({
          ...base,
          borderRadius: 20,
          padding: 24,
          color: "#18181b",
          border: "2px solid transparent",
          // white card with a pink → indigo gradient border
          background:
            "linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, #f472b6 0%, #8b5cf6 55%, #4f46e5 100%) border-box",
          boxShadow: "0 24px 60px rgba(30, 27, 75, 0.18), 0 4px 16px rgba(0,0,0,0.06)",
          maxWidth: 400,
        }),
        maskWrapper: (base) => ({
          ...base,
          color: "rgba(244, 244, 245, 0.78)",
        }),
        maskArea: (base) => ({
          ...base,
          rx: 14,
        }),
        highlightedArea: (base) => ({
          ...base,
          rx: 14,
          stroke: "#4338ca",
          strokeWidth: 2,
          fill: "rgba(99, 102, 241, 0.10)",
          animation: "tour-pulse 1.6s ease-out infinite",
        }),
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: tourCss }} />
      <TourSync isOpen={isOpen} onClose={onClose} />
      {children}
    </TourProvider>
  );
}