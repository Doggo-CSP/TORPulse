import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "TOR — รวม TOR งานซอฟต์แวร์ กทม. ไว้ที่เดียว",
  description:
    "รวบรวม ค้นหา และวิเคราะห์เอกสาร TOR งานซอฟต์แวร์จากแหล่งจัดซื้อจัดจ้างของกรุงเทพมหานคร พร้อมเทียบราคาโครงการที่ประมูลเสร็จแล้ว",
  openGraph: {
    title: "TOR — รวม TOR งานซอฟต์แวร์ กทม. ไว้ที่เดียว",
    description:
      "แดชบอร์ดเดียวสำหรับทุก TOR ซอฟต์แวร์: รวมประกาศ สกัดข้อมูลด้วย AI วิเคราะห์งบประมาณ และเทียบราคาโครงการที่ผ่านแล้ว",
  },
};

export default function HomepageLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
