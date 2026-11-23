"use client";

import { TourProvider, useTour as useReactour } from "@reactour/tour";
import type { StepType } from "@reactour/tour";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Step, TourContent, tourCss, tourStyles } from "./tor-detail-tour";

/* ------------------------------------------------------------------ */
/*  Detailed tour for the "ความเหมาะสมของบริษัท" (qualification match)  */
/*  card. Steps whose target isn't rendered are skipped automatically.  */
/* ------------------------------------------------------------------ */

const EXPAND_SELECTOR = "#tour-qm-item";

export const qualificationTourSteps: StepType[] = [
  {
    selector: "#tour-qm-company",
    position: "left",
    content: (
      <Step title="ข้อมูลที่ใช้เปรียบเทียบ">
        ระบบนำเงื่อนไขใน TOR มาเทียบกับโปรไฟล์ของบริษัทที่แสดงตรงนี้
        ตัวเลขด้านขวาคือจำนวนเงื่อนไขทั้งหมดที่ AI ดึงออกมาจาก TOR ฉบับนี้
      </Step>
    ),
  },
  {
    selector: "#tour-qm-percent",
    position: "left",
    content: (
      <Step title="คะแนนความเหมาะสม">
        คะแนนรวมจากการเทียบทุกเงื่อนไข ยิ่งสูงยิ่งตรงกับ TOR นี้
        ใช้เป็นแนวทางเบื้องต้นเท่านั้น ไม่ใช่ผลการพิจารณาจริงของหน่วยงาน
      </Step>
    ),
  },
  {
    selector: "#tour-qm-verdict",
    position: "left",
    content: (
      <Step title="ป้ายสรุปผล">
        สรุปผลเป็นคำ โดยดูทั้งคะแนนและการผ่านเกณฑ์บังคับ
        ถ้าขึ้นว่า “ขาดคุณสมบัติสำคัญ” แปลว่ายังมีเกณฑ์บังคับที่ไม่ผ่าน
        ควรแก้ข้อนั้นก่อน แม้คะแนนรวมจะไม่ต่ำ
      </Step>
    ),
  },
  {
    selector: "#tour-qm-summary",
    position: "left",
    content: (
      <Step title="สรุปจาก AI">
        อธิบายสั้นๆ ว่าทำไมได้ผลนี้ เช่น ขาดผลงานหรือบุคลากรด้านใด
        และด้านไหนที่ผ่านแล้ว อ่านส่วนนี้ก่อนเพื่อเห็นภาพรวมอย่างรวดเร็ว
      </Step>
    ),
  },
  {
    selector: "#tour-qm-stale",
    position: "left",
    content: (
      <Step title="ผลประเมินอาจไม่เป็นปัจจุบัน">
        ข้อความนี้ปรากฏเมื่อโปรไฟล์หรือ TOR เปลี่ยนไปหลังประเมินครั้งล่าสุด
        กด “ประเมินใหม่” เพื่ออัปเดตคะแนน
      </Step>
    ),
  },
  {
    selector: "#tour-qualification-tiles",
    position: "left",
    content: (
      <Step title="สรุปตามสถานะ">
        <b>ตรงตามเงื่อนไข</b> = ผ่านแล้ว · <b>ตรงบางส่วน</b> = มีบางอย่างแต่ยังไม่ครบ ·{" "}
        <b>ยังไม่ตรง</b> = ไม่ผ่าน · <b>ไม่มีข้อมูล</b> = ประเมินไม่ได้
        เพราะโปรไฟล์ยังไม่มีข้อมูลที่เกี่ยวข้อง คลิกช่องใดก็ได้เพื่อกรองรายการ
      </Step>
    ),
  },
  {
    selector: "#tour-qm-item-head",
    position: "left",
    content: (
      <Step title="วิธีอ่านแต่ละเงื่อนไข">
        แต่ละรายการมีป้ายสถานะ หมวดหมู่ (เช่น ผลงาน/ประสบการณ์ บุคลากร)
        และป้าย “เกณฑ์บังคับ” สำหรับข้อที่ต้องผ่านเท่านั้น
        รายการที่ต้องแก้จะอยู่ด้านบนเสมอ โดยเกณฑ์บังคับมาก่อน
      </Step>
    ),
  },
  {
    selector: EXPAND_SELECTOR,
    position: "left",
    resizeObservables: [EXPAND_SELECTOR],
    mutationObservables: [EXPAND_SELECTOR],
    content: (
      <Step title="เหตุผลและคำแนะนำ">
        กดที่รายการเพื่อขยาย จะเห็นว่าทำไม AI ถึงประเมินแบบนั้น
        และมีคำแนะนำ 💡 ว่าควรเตรียมหรือเพิ่มข้อมูลอะไรในโปรไฟล์เพื่อให้ผ่าน
      </Step>
    ),
  },
  {
    selector: "#tour-qm-footer",
    position: "left",
    content: (
      <Step title="เวลาประเมินและประเมินใหม่">
        ดูเวลาที่ AI ประเมินล่าสุด หากแก้โปรไฟล์แล้วอยากเห็นผลทันที
        กด “ประเมินใหม่” (ใช้เวลาประมาณ 10 วินาที)
      </Step>
    ),
  },
  {
    selector: "#tour-qualification-detail",
    position: "left",
    content: (
      <Step title="ดูการเปรียบเทียบทั้งหมด">
        เปิดหน้าต่างขนาดใหญ่ที่รวมทุกเงื่อนไข พร้อมเหตุผลและคำแนะนำ
        เหมาะสำหรับอ่านละเอียดหรือใช้ประกอบการเตรียมเอกสารเสนอราคา
      </Step>
    ),
  },
  {
    selector: "#tour-qm-edit",
    position: "left",
    content: (
      <Step title="แก้โปรไฟล์เพื่อเพิ่มคะแนน">
        ไปหน้าโปรไฟล์เพื่อเพิ่มผลงาน บุคลากร หรือข้อมูลบริษัท
        เมื่อบันทึกแล้วระบบจะประเมินใหม่ให้อัตโนมัติ
      </Step>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Persistence + auto start                                            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "torpulse:qualification-tour-seen";

/**
 * @param enabled  true when the card is ready AND the page tour has finished.
 * Auto-opens once; `restart` reopens it (the "?" button in the card header).
 */
export function useQualificationTour(enabled: boolean) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      /* storage blocked: treat as not seen */
    }
    if (seen) return;
    const t = setTimeout(() => setIsOpen(true), 600);
    return () => clearTimeout(t);
  }, [enabled]);

  const onClose = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setIsOpen(false);
  }, []);

  const restart = useCallback(() => setIsOpen(true), []);

  return { isOpen, onClose, restart };
}

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */

export interface QualificationTourControls {
  /** expand (true) or collapse (false) the first requirement in the card */
  expandFirst: (open: boolean) => void;
  /** show all requirements (clear any status filter) */
  resetFilter: () => void;
}

interface QualificationTourProviderProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  controls: QualificationTourControls;
}

function TourSync({
  isOpen,
  onClose,
  controls,
}: {
  isOpen: boolean;
  onClose: () => void;
  controls: QualificationTourControls;
}) {
  const { isOpen: open, currentStep, steps, setIsOpen, setSteps, setCurrentStep } = useReactour();
  const wasOpen = useRef(false);
  const propOpen = useRef(isOpen);
  propOpen.current = isOpen;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  // follow the `isOpen` prop; on open, keep only the steps whose target exists
  useEffect(() => {
    if (isOpen) {
      controlsRef.current.resetFilter();
      controlsRef.current.expandFirst(false);
      const available = qualificationTourSteps.filter(
        (s) => !!document.querySelector(s.selector as string),
      );
      setSteps?.(available);
      setCurrentStep(0);
    }
    setIsOpen(isOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // expand the first requirement only while its "reason & suggestion" step is showing
  useEffect(() => {
    if (!open) return;
    const selector = steps[currentStep]?.selector;
    controlsRef.current.expandFirst(selector === EXPAND_SELECTOR);
  }, [open, currentStep, steps]);

  // count as "seen" only when the user closes it (prop still true); collapse on close
  useEffect(() => {
    if (wasOpen.current && !open) {
      controlsRef.current.expandFirst(false);
      if (propOpen.current) onClose();
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return null;
}

export function QualificationTourProvider({
  children,
  isOpen,
  onClose,
  controls,
}: QualificationTourProviderProps) {
  return (
    <TourProvider
      steps={qualificationTourSteps}
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
      <TourSync isOpen={isOpen} onClose={onClose} controls={controls} />
      {children}
    </TourProvider>
  );
}
