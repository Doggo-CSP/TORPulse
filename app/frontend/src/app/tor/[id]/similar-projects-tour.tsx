"use client";

import { TourProvider, useTour as useReactour } from "@reactour/tour";
import type { StepType } from "@reactour/tour";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Step, TourContent, tourCss, tourStyles } from "./tor-detail-tour";

/* ------------------------------------------------------------------ */
/*  Detailed tour for "TOR คล้ายกันที่ปิดรับข้อเสนอแล้ว" (SimilarProjects) */
/* ------------------------------------------------------------------ */

export const similarProjectsTourSteps: StepType[] = [
  {
    selector: "#tour-similar-header",
    position: "bottom",
    content: (
      <Step title="TOR คล้ายกัน 📊">
        ระบบดึงโครงการที่มีหมวดหมู่และเทคโนโลยีตรงกับ TOR นี้ ทั้งที่ยังเปิดรับและปิดรับแล้ว
        เพื่อเทียบราคากลางของ TOR นี้กับงานลักษณะเดียวกัน
      </Step>
    ),
  },
  {
    selector: "#tour-similar-current-mid",
    position: "bottom",
    content: (
      <Step title="1. ราคากลางของ TOR นี้">
        ราคากลางที่หน่วยงานกำหนดสำหรับโครงการที่คุณกำลังดูอยู่
        ใช้เป็นตัวตั้งในการเทียบกับโครงการอื่นทุกตัวในส่วนนี้
      </Step>
    ),
  },
  {
    selector: "#tour-similar-median-mid",
    position: "bottom",
    content: (
      <Step title="2. ค่ากลางราคากลางงานคล้ายกัน">
        มัธยฐานของราคากลางจากโครงการที่คล้ายกัน พร้อมช่วงราคาต่ำสุดถึงสูงสุด
        ใช้มัธยฐานเพื่อไม่ให้โครงการที่ใหญ่หรือเล็กผิดปกติดึงตัวเลขไป
      </Step>
    ),
  },
  {
    selector: "#tour-similar-comparison",
    position: "bottom",
    content: (
      <Step title="3. TOR นี้เทียบกับงานคล้ายกัน">
        คำนวณว่าราคากลางของ TOR นี้ สูงกว่าหรือต่ำกว่าค่ากลางของงานคล้ายกันคิดเป็นกี่ %
        ช่วยให้เห็นเบื้องต้นว่าขนาดงบของงานนี้อยู่ตรงไหนเมื่อเทียบกับงานแบบเดียวกัน
      </Step>
    ),
  },
  {
    selector: "#tour-similar-first-item",
    position: "top",
    content: (
      <Step title="รายการโครงการที่คล้ายกัน">
        แต่ละโครงการแสดงสถานะเปิดรับหรือปิดรับแล้ว ราคากลาง
        และป้ายบอกว่าสูงหรือต่ำกว่าราคากลางของ TOR นี้กี่ % คลิกชื่อโครงการเพื่อดูรายละเอียดได้
      </Step>
    ),
  },
  {
    selector: "#tour-similar-tags",
    position: "top",
    content: (
      <Step title="หมวดหมู่ เทคโนโลยี และประกาศ e-GP">
        ดูหมวดหมู่และเทคโนโลยีที่ตรวจพบว่าตรงกัน
        พร้อมกดเปิดดู “ข้อกำหนดหลักของโครงการนี้” หรือคลิก “ดูประกาศบน e-GP” เพื่อตรวจสอบเอกสารต้นทาง
      </Step>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Persistence + auto start                                            */
/* ------------------------------------------------------------------ */

const STORAGE_PREFIX = "torpulse:similar-projects-tour-seen";

/**
 * @param enabled  true when the similar projects section is rendered and ready.
 * @param userEmail optional user email for per-user first-login tracking.
 */
export function useSimilarProjectsTour(enabled: boolean, userEmail?: string | null) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const storageKey = userEmail ? `${STORAGE_PREFIX}:${userEmail}` : STORAGE_PREFIX;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === "1";
    } catch {
      /* storage blocked: treat as not seen */
    }
    if (seen) return;

    let timeoutId: NodeJS.Timeout;

    // Wait until any existing tour (like main page tour or qualification tour) is closed
    const checkAndOpen = () => {
      const activeTour = document.querySelector(".tour-card") || document.querySelector("[data-reactour]");
      if (activeTour) {
        timeoutId = setTimeout(checkAndOpen, 1000);
        return;
      }
      setIsOpen(true);
    };

    timeoutId = setTimeout(checkAndOpen, 1000);
    return () => clearTimeout(timeoutId);
  }, [enabled, userEmail]);

  const onClose = useCallback(() => {
    const storageKey = userEmail ? `${STORAGE_PREFIX}:${userEmail}` : STORAGE_PREFIX;
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setIsOpen(false);
  }, [userEmail]);

  const restart = useCallback(() => setIsOpen(true), []);

  return { isOpen, onClose, restart };
}

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */

interface SimilarProjectsTourProviderProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

function TourSync({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { isOpen: open, setIsOpen, setSteps, setCurrentStep } = useReactour();
  const wasOpen = useRef(false);
  const propOpen = useRef(isOpen);
  propOpen.current = isOpen;

  useEffect(() => {
    if (isOpen) {
      const available = similarProjectsTourSteps.filter(
        (s) => s.selector === "body" || !!document.querySelector(s.selector as string),
      );
      setSteps?.(available);
      setCurrentStep(0);
    }
    setIsOpen(isOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (wasOpen.current && !open && propOpen.current) onClose();
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return null;
}

export function SimilarProjectsTourProvider({
  children,
  isOpen,
  onClose,
}: SimilarProjectsTourProviderProps) {
  return (
    <TourProvider
      steps={similarProjectsTourSteps}
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

