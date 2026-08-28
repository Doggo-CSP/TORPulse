export type Tor = {
  id: string;
  title: string;
  agency: string;
  source: string;
  publishedAt: string;
  closesAt: string;
  category: string;
  budget: number;
  match: number;
  tech: string[];
  status: string;
};

export const tors: Tor[] = [
  {
    id: "กทม.-2569-0142",
    title: "จ้างพัฒนาระบบบริหารจัดการงานทะเบียนราษฎรออนไลน์",
    agency: "สำนักงานเขตบางรัก",
    source: "e-GP",
    publishedAt: "20 ส.ค. 69",
    closesAt: "10 ก.ย. 69",
    category: "Web Application",
    budget: 18_500_000,
    match: 82,
    tech: ["React", "Node.js", "PostgreSQL"],
    status: "เปิดรับสมัคร",
  },
  {
    id: "กทม.-2569-0139",
    title: "จ้างเหมาพัฒนาแดชบอร์ดวิเคราะห์ข้อมูลจราจรอัจฉริยะ",
    agency: "สำนักการจราจรและขนส่ง",
    source: "ระบบจัดซื้อจัดจ้าง กทม.",
    publishedAt: "18 ส.ค. 69",
    closesAt: "5 ก.ย. 69",
    category: "Data / BI",
    budget: 24_900_000,
    match: 74,
    tech: ["Python", "Power BI", "Airflow"],
    status: "เปิดรับสมัคร",
  },
  {
    id: "กทม.-2569-0131",
    title: "พัฒนาแอปพลิเคชันมือถือสำหรับแจ้งปัญหาสาธารณะ",
    agency: "สำนักยุทธศาสตร์และประเมินผล",
    source: "e-GP",
    publishedAt: "15 ส.ค. 69",
    closesAt: "2 ก.ย. 69",
    category: "Mobile App",
    budget: 12_300_000,
    match: 65,
    tech: ["Flutter", "Firebase"],
    status: "ใกล้ปิดรับ",
  },
  {
    id: "กทม.-2569-0125",
    title: "จัดหาระบบ ERP สำหรับบริหารงบประมาณและพัสดุ",
    agency: "สำนักการคลัง",
    source: "ข้อมูลเปิด DGA",
    publishedAt: "10 ส.ค. 69",
    closesAt: "28 ส.ค. 69",
    category: "Enterprise System",
    budget: 42_000_000,
    match: 58,
    tech: [".NET", "SQL Server", "SAP"],
    status: "ปิดรับสมัครแล้ว",
  },
  {
    id: "กทม.-2569-0119",
    title: "พัฒนาเว็บไซต์ให้บริการประชาชนแบบเบ็ดเสร็จจุดเดียว",
    agency: "สำนักงานเขตปทุมวัน",
    source: "e-GP",
    publishedAt: "6 ส.ค. 69",
    closesAt: "25 ส.ค. 69",
    category: "Web Application",
    budget: 9_800_000,
    match: 71,
    tech: ["Next.js", "Node.js", "MySQL"],
    status: "เปิดรับสมัคร",
  },
  {
    id: "กทม.-2569-0112",
    title: "จัดทำระบบวิเคราะห์และพยากรณ์งบประมาณด้วย AI",
    agency: "สำนักงบประมาณกรุงเทพมหานคร",
    source: "ระบบจัดซื้อจัดจ้าง กทม.",
    publishedAt: "3 ส.ค. 69",
    closesAt: "20 ส.ค. 69",
    category: "Data / BI",
    budget: 31_200_000,
    match: 69,
    tech: ["Python", "TensorFlow", "BigQuery"],
    status: "ใกล้ปิดรับ",
  },
  {
    id: "กทม.-2569-0104",
    title: "พัฒนาแอปพลิเคชันติดตามสถานะขยะและความสะอาดเขต",
    agency: "สำนักสิ่งแวดล้อม",
    source: "ข้อมูลเปิด DGA",
    publishedAt: "28 ก.ค. 69",
    closesAt: "15 ส.ค. 69",
    category: "Mobile App",
    budget: 7_600_000,
    match: 60,
    tech: ["React Native", "Firebase"],
    status: "ปิดรับสมัครแล้ว",
  },
];

export const categorySplit = [
  { label: "Web Application", pct: 34 },
  { label: "Data / BI", pct: 22 },
  { label: "Mobile App", pct: 18 },
  { label: "Enterprise System", pct: 26 },
];

export const totalBudgetAmount = 6_128_192;
export const totalProjectCount = 51_800;

export const homeStats = {
  avgMid: 21_400_000,
  avgAwarded: 18_900_000,
  avgDiscountPct: 11.7,
};

export const priceComparisonData = [
  { category: "Consulting / Architecture", ราคากลาง: 38.5, ราคาที่ชนะการประมูล: 35.4 },
  { category: "Data / BI", ราคากลาง: 26.2, ราคาที่ชนะการประมูล: 22.9 },
  { category: "Web Application", ราคากลาง: 12.1, ราคาที่ชนะการประมูล: 10.2 },
  { category: "Mobile App", ราคากลาง: 9.3, ราคาที่ชนะการประมูล: 7.1 },
  { category: "Enterprise System", ราคากลาง: 5.6, ราคาที่ชนะการประมูล: 4.8 },
];

export const priceChartSeries = [
  { key: "ราคากลาง", label: "ราคากลาง", color: "#e0a978" },
  { key: "ราคาที่ชนะการประมูล", label: "ราคาที่ชนะการประมูล", color: "#6f9e80" },
];

export const isLoggedIn = false;

export const recommended: Array<Tor & { interestScore: number; reason: string }> = [];
