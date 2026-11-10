"use client";

import { TourProvider, useTour as useReactour } from "@reactour/tour";
import type { PopoverContentProps, StepType } from "@reactour/tour";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Tour steps (Thai UI) — TOR detail page (app/tor/[id])               */
/* ------------------------------------------------------------------ */

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 className="tour-title">{title}</h3>
      <p className="tour-desc">{children}</p>
    </>
  );
}

export const torDetailTourSteps: StepType[] = [
  {
    selector: "body",
    position: "center",
    content: (
      <Step title="มาดูหน้ารายละเอียด TOR กัน 📄">
        หน้านี้รวมข้อมูลโครงการ กำหนดปิดรับข้อเสนอ
        และผลวิเคราะห์ว่าบริษัทของคุณเหมาะกับ TOR นี้แค่ไหน
      </Step>
    ),
  },
  {
    selector: "h1",
    position: "bottom",
    content: (
      <Step title="ชื่อโครงการและหน่วยงาน">
        ดูเลขที่โครงการ ชื่อโครงการ และหน่วยงานผู้ว่าจ้างได้ที่นี่
        ส่วนรายละเอียดอื่นๆ อยู่ด้านล่าง
      </Step>
    ),
  },
  {
    selector: "#tour-budget",
    position: "left",
    content: (
      <Step title="วงเงินโครงการ">
        งบประมาณของโครงการนี้ ใช้ประเมินขนาดงานและความคุ้มค่าก่อนตัดสินใจเสนอราคา
      </Step>
    ),
  },
  {
    selector: "#tour-bookmark",
    position: "left",
    content: (
      <Step title="บันทึก TOR">
        กดเพื่อบันทึก TOR ที่สนใจไว้ แล้วกลับมาดูภายหลังได้ที่หน้า “TOR ที่บันทึกไว้”
      </Step>
    ),
  },
  {
    selector: "#tour-deadline",
    position: "left",
    content: (
      <Step title="กำหนดปิดรับข้อเสนอ">
        ดูวันปิดรับและจำนวนวันที่เหลือ
        ป้ายสีแดงหมายถึงใกล้หมดเวลาแล้ว ควรรีบเตรียมเอกสาร
      </Step>
    ),
  },
  {
    selector: "#tour-qualification-score",
    position: "left",
    content: (
      <Step title="คะแนนความเหมาะสมของบริษัท">
        AI เทียบเงื่อนไขใน TOR กับข้อมูลและผลงานในโปรไฟล์บริษัทของคุณ
        แล้วสรุปเป็นคะแนนและผลการประเมินโดยรวม
        เมื่อจบทัวร์นี้ จะมีทัวร์อธิบายการ์ดนี้โดยละเอียดต่อให้ทันที
      </Step>
    ),
  },
  {
    selector: "#tour-source-link",
    position: "left",
    content: (
      <Step title="ดูจากแหล่งข้อมูลต้นทาง">
        ตรวจสอบเอกสารและประกาศฉบับจริงได้จากลิงก์นี้
        โดยเฉพาะข้อมูลสำคัญอย่างวันปิดรับข้อเสนอ
      </Step>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Popover content: title/desc, "n จาก N", Skip + Next                 */
/* ------------------------------------------------------------------ */

export function TourContent({
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
            {isLast ? "เข้าใจแล้ว" : "ถัดไป"}
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

export const tourCss = `
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
.tour-next { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; border: none; background: #38a169; font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; }
.tour-next:hover { background: #0e9116ff; }
@keyframes tour-pulse {
  0%   { stroke-opacity: 1;   stroke-width: 2; }
  70%  { stroke-opacity: .25; stroke-width: 8; }
  100% { stroke-opacity: 1;   stroke-width: 2; }
}
`;

/* ------------------------------------------------------------------ */
/*  Persistence: show once per browser, can be replayed manually        */
/* ------------------------------------------------------------------ */

// Shared look for every tour popover / mask (also used by qualification-tour.tsx)
export const tourStyles: ComponentProps<typeof TourProvider>["styles"] = {
  popover: (base) => ({
    ...base,
    borderRadius: 20,
    padding: 24,
    color: "#18181b",
    border: "2px solid transparent",
    background:
      "linear-gradient(#ffffff, #f1f1e6ff) padding-box, linear-gradient(135deg, #efb88eff 0%, #4a7c59  55%, #3b7a4eff 100%) border-box",
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
    stroke: "#38ca83ff",
    strokeWidth: 2,
    fill: "rgba(99, 102, 241, 0.10)",
    animation: "tour-pulse 1.6s ease-out infinite",
  }),
};

const STORAGE_KEY = "torpulse:tor-detail-tour-seen";

/**
 * @param enabled  true once the page is ready (e.g. `!!tor && !!user`)
 * Returns `isOpen` / `onClose` for <TorDetailTourProvider> plus `restart`
 * (hook it to a "?" / "ดูทัวร์อีกครั้ง" button if you want a replay).
 */
export function useTorDetailTour(enabled: boolean) {
  const [isOpen, setIsOpen] = useState(false);
  // true once the page tour was seen before or has just been closed
  // (the qualification card tour waits for this before it auto-starts)
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      /* storage blocked: treat as not seen */
    }
    if (seen) {
      setFinished(true);
      return;
    }
    // wait a moment so the AI-match card & sidebar have rendered
    const t = setTimeout(() => setIsOpen(true), 800);
    return () => clearTimeout(t);
  }, [enabled]);

  const onClose = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setIsOpen(false);
    setFinished(true);
  }, []);

  const restart = useCallback(() => setIsOpen(true), []);

  return { isOpen, onClose, restart, finished };
}

/* ------------------------------------------------------------------ */
/*  Provider wrapper — wrap the page's main content with this           */
/* ------------------------------------------------------------------ */

interface TorDetailTourProviderProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

// Syncs the `isOpen` prop with reactour, and on open drops steps whose target isn't in the DOM
// (e.g. no deadline, AI match still loading / profile incomplete) so the tour never gets stuck.
function TourSync({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { isOpen: open, setIsOpen, setSteps, setCurrentStep } = useReactour();
  const wasOpen = useRef(false);
  const propOpen = useRef(isOpen);
  propOpen.current = isOpen;

  useEffect(() => {
    if (isOpen) {
      const available = torDetailTourSteps.filter(
        (s) => s.selector === "body" || !!document.querySelector(s.selector as string),
      );
      setSteps?.(available);
      setCurrentStep(0);
    }
    setIsOpen(isOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    // Count as "seen" only when the user closes it (prop still true)
    if (wasOpen.current && !open && propOpen.current) onClose();
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return null;
}

export function TorDetailTourProvider({
  children,
  isOpen,
  onClose,
}: TorDetailTourProviderProps) {
  return (
    <TourProvider
      steps={torDetailTourSteps}
      onClickMask={({ setIsOpen }) => setIsOpen(false)}
      showNavigation={false}
      showBadge={false}
      showDots={false}
      showCloseButton={false}
      scrollSmooth
      padding={{ mask: 6, popover: [12, 12] }}
      ContentComponent={TourContent}
      styles={tourStyles}
    >
      <style dangerouslySetInnerHTML={{ __html: tourCss }} />
      <TourSync isOpen={isOpen} onClose={onClose} />
      {children}
    </TourProvider>
  );
}