export type TorDocument = {
  fileName: string;
  mimeType: string;
  sourceUrl: string;
};

export type TorBidder = {
  name: string;
  taxId: string;
  signedAt: string;
  deadline: string;
  submissionDeadline: string;
  amount: number;
  status: string;
  detail: string;
};

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
  // Detail-page fields (optional — populated for mock records)
  summary?: string;
  objectives?: string[];
  requirements?: string[];
  contactInformation?: string[];
  detailUrl?: string;
  documents?: TorDocument[];
  midPriceBaht?: number;
  awardedPriceBaht?: number;
  savingRatePct?: number;
  disbursementRatePct?: number;
  projectType?: string;
  contractType?: string;
  mainProduct?: string;
  quantity?: string;
  budgetYear?: string;
  bidders?: TorBidder[];
  relatedNotices?: { title: string; date: string; url?: string }[];
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
    budgetYear: "2569",
    projectType: "จ้างทำของ/จ้างเหมาบริการ",
    contractType: "สัญญาจ้างพัฒนาระบบ",
    mainProduct: "ซอฟต์แวร์และระบบสารสนเทศ",
    quantity: "1 ระบบ",
    midPriceBaht: 18_500_000,
    awardedPriceBaht: 0,
    savingRatePct: 0,
    disbursementRatePct: 0,
    summary:
      "โครงการพัฒนาระบบบริหารจัดการงานทะเบียนราษฎรออนไลน์ เพื่อรองรับการให้บริการประชาชนในพื้นที่เขตบางรัก ผ่านระบบดิจิทัลแบบครบวงจร ลดขั้นตอนการให้บริการ และเพิ่มประสิทธิภาพการทำงาน",
    objectives: [
      "พัฒนาระบบรับคำร้องขอทะเบียนราษฎรออนไลน์แบบครบวงจร",
      "เชื่อมต่อข้อมูลกับฐานข้อมูลทะเบียนราษฎรกลางของกรมการปกครอง",
      "พัฒนาระบบแจ้งเตือนและติดตามสถานะคำร้องแบบเรียลไทม์",
      "ออกแบบ UI/UX ให้รองรับผู้สูงอายุและผู้พิการตามมาตรฐาน WCAG 2.1",
    ],
    requirements: [
      "ระบบต้องรองรับผู้ใช้งานพร้อมกันไม่น้อยกว่า 500 คน",
      "ความพร้อมใช้งานของระบบ (Uptime) ไม่น้อยกว่า 99.5% ต่อปี",
      "รองรับ OAuth 2.0 / OpenID Connect สำหรับการยืนยันตัวตน",
      "เข้ารหัสข้อมูลด้วย AES-256 และรองรับ TLS 1.3",
      "จัดส่ง Source Code และเอกสารครบถ้วนภายในกำหนด",
    ],
    contactInformation: [
      "นายสมชาย รักดี ตำแหน่ง นักวิชาการคอมพิวเตอร์ชำนาญการ",
      "โทรศัพท์: 02-234-5678 ต่อ 1234",
      "อีเมล: somchai.r@bangrak.go.th",
    ],
    documents: [
      {
        fileName: "TOR-กทม.-2569-0142-ฉบับสมบูรณ์.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
      {
        fileName: "แบบฟอร์มใบเสนอราคา.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sourceUrl: "#",
      },
      {
        fileName: "ราคากลาง-กทม.-2569-0142.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
    ],
    bidders: [
      {
        name: "บริษัท ดิจิทัล โซลูชั่นส์ จำกัด",
        taxId: "0105565012345",
        signedAt: "20 ส.ค. 69",
        deadline: "10 ก.ย. 69",
        submissionDeadline: "10 ก.ย. 69",
        amount: 18_500_000,
        status: "อยู่ระหว่างพิจารณา",
        detail: "ยื่นซองเอกสาร",
      },
    ],
    relatedNotices: [
      {
        title: "ประกาศราคากลางโครงการพัฒนาระบบทะเบียนราษฎรออนไลน์",
        date: "20 ส.ค. 69",
      },
      {
        title: "ประกาศรับสมัครผู้รับจ้าง / ประกาศซื้อจ้างที่ผ่านการคัดเลือก",
        date: "09 ก.ย. 69",
      },
    ],
    detailUrl:
      "https://process3.gprocurement.go.th/EPROCRsrvWeb/pages/menu/login.jsp",
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
    budgetYear: "2569",
    projectType: "จ้างทำของ/จ้างเหมาบริการ",
    contractType: "สัญญาจ้างพัฒนาระบบ",
    mainProduct: "ระบบวิเคราะห์ข้อมูลและ Business Intelligence",
    quantity: "1 ระบบ",
    midPriceBaht: 24_900_000,
    awardedPriceBaht: 0,
    savingRatePct: 0,
    disbursementRatePct: 0,
    summary:
      "โครงการพัฒนาแดชบอร์ดวิเคราะห์ข้อมูลจราจรอัจฉริยะ เพื่อรวบรวมและวิเคราะห์ข้อมูลจากกล้อง CCTV และเซนเซอร์จราจรทั่วกรุงเทพมหานคร แสดงผลแบบ Real-time และพยากรณ์สภาพจราจรล่วงหน้า",
    objectives: [
      "รวบรวมข้อมูลจราจรจากกล้อง CCTV และเซนเซอร์มากกว่า 2,000 จุด",
      "วิเคราะห์และพยากรณ์สภาพจราจรด้วย Machine Learning",
      "สร้างแดชบอร์ดแสดงผล Real-time สำหรับศูนย์ควบคุมจราจร",
      "เชื่อมต่อกับระบบสัญญาณไฟจราจรอัจฉริยะ",
    ],
    requirements: [
      "รองรับการประมวลผลข้อมูล Stream ได้ไม่น้อยกว่า 10,000 events/second",
      "ความแม่นยำในการพยากรณ์สภาพจราจรไม่น้อยกว่า 85%",
      "แสดงผลบน Dashboard ด้วย Latency ไม่เกิน 5 วินาที",
      "รองรับการส่งออกรายงานในรูปแบบ PDF, Excel, CSV",
    ],
    contactInformation: [
      "นางสาวพิมพ์ใจ ศรีทอง ตำแหน่ง วิศวกรโยธาชำนาญการ",
      "โทรศัพท์: 02-354-6789",
      "อีเมล: pimjai.s@bangkok.go.th",
    ],
    documents: [
      {
        fileName: "TOR-กทม.-2569-0139-แดชบอร์ดจราจร.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
      {
        fileName: "ข้อกำหนดทางเทคนิค.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
    ],
    bidders: [],
    relatedNotices: [
      {
        title: "ประกาศราคากลางโครงการแดชบอร์ดจราจรอัจฉริยะ",
        date: "18 ส.ค. 69",
      },
    ],
    detailUrl: "https://www.bangkok.go.th/procurement",
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
    budgetYear: "2569",
    projectType: "จ้างทำของ/จ้างเหมาบริการ",
    contractType: "สัญญาจ้างพัฒนาแอปพลิเคชัน",
    mainProduct: "แอปพลิเคชันมือถือ (iOS/Android)",
    quantity: "1 แอปพลิเคชัน",
    midPriceBaht: 12_300_000,
    awardedPriceBaht: 0,
    savingRatePct: 0,
    disbursementRatePct: 0,
    summary:
      "โครงการพัฒนาแอปพลิเคชันมือถือเพื่อให้ประชาชนแจ้งปัญหาสาธารณะ เช่น ถนนชำรุด ไฟฟ้าขัดข้อง น้ำท่วม ผ่านสมาร์ทโฟน พร้อมระบบติดตามสถานะการแก้ไขแบบเรียลไทม์",
    objectives: [
      "พัฒนาแอปพลิเคชันรองรับทั้ง iOS และ Android ด้วย Flutter",
      "ระบบถ่ายภาพและระบุพิกัด GPS แบบอัตโนมัติ",
      "ส่งต่อเรื่องร้องเรียนไปยังหน่วยงานที่รับผิดชอบโดยอัตโนมัติ",
      "แจ้งเตือน Push Notification ทุกขั้นตอนการดำเนินการ",
    ],
    requirements: [
      "รองรับ iOS 15+ และ Android 10+",
      "แอปพลิเคชันมีขนาดไม่เกิน 50 MB",
      "รองรับการทำงานแบบออฟไลน์บางส่วน (Offline-first)",
      "ผ่านการตรวจสอบความปลอดภัยจาก OWASP Mobile Top 10",
    ],
    contactInformation: [
      "นายอนุชา วงค์สุวรรณ ตำแหน่ง นักวิเคราะห์นโยบายและแผนชำนาญการ",
      "โทรศัพท์: 02-203-2698",
      "อีเมล: anucha.w@bangkok.go.th",
    ],
    documents: [
      {
        fileName: "TOR-กทม.-2569-0131-แอปแจ้งปัญหา.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
    ],
    bidders: [],
    relatedNotices: [
      {
        title: "ประกาศรับสมัครผู้รับจ้างพัฒนาแอปพลิเคชันแจ้งปัญหาสาธารณะ",
        date: "15 ส.ค. 69",
      },
    ],
    detailUrl: "https://process3.gprocurement.go.th",
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
    budgetYear: "2569",
    projectType: "จัดซื้อจัดจ้างโดยวิธีคัดเลือก",
    contractType: "สัญญาจัดหาและติดตั้งระบบ",
    mainProduct: "ระบบ ERP (Enterprise Resource Planning)",
    quantity: "1 ระบบ พร้อมใบอนุญาต 500 Users",
    midPriceBaht: 42_000_000,
    awardedPriceBaht: 38_500_000,
    savingRatePct: 8.33,
    disbursementRatePct: 45.2,
    summary:
      "โครงการจัดหาระบบ ERP เพื่อบริหารจัดการงบประมาณ พัสดุ และการเงิน ของสำนักการคลัง กรุงเทพมหานคร แบบบูรณาการ ลดความซ้ำซ้อนของข้อมูล และเพิ่มความโปร่งใสในการบริหารงานภาครัฐ",
    objectives: [
      "จัดหาระบบ ERP ที่ครอบคลุมโมดูล การเงิน บัญชี พัสดุ และงบประมาณ",
      "เชื่อมต่อกับระบบ GFMIS ของกรมบัญชีกลาง",
      "ลดขั้นตอนการทำงานด้วย Workflow อัตโนมัติ",
      "รองรับการรายงานตามมาตรฐาน IPSAS",
    ],
    requirements: [
      "ระบบต้องมีใบรับรอง ISO/IEC 27001",
      "รองรับผู้ใช้งานพร้อมกัน 500 คน",
      "ข้อมูลต้องจัดเก็บในประเทศไทยตาม PDPA",
      "มีทีม Support ภาษาไทยตลอด 24 ชั่วโมง",
    ],
    contactInformation: [
      "นางรัตนา พงษ์ประเสริฐ ตำแหน่ง นักวิชาการคลังชำนาญการพิเศษ",
      "โทรศัพท์: 02-224-3000 ต่อ 2301",
      "อีเมล: rattana.p@finance.bangkok.go.th",
    ],
    documents: [
      {
        fileName: "TOR-กทม.-2569-0125-ระบบ-ERP.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
      {
        fileName: "ราคากลาง-ERP-2569.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
      {
        fileName: "สัญญาจัดซื้อ-ERP.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
    ],
    bidders: [
      {
        name: "บริษัท SAP (ประเทศไทย) จำกัด",
        taxId: "0105537012345",
        signedAt: "10 ส.ค. 69",
        deadline: "28 ส.ค. 69",
        submissionDeadline: "28 ส.ค. 69",
        amount: 38_500_000,
        status: "ได้รับการคัดเลือก",
        detail: "ผู้ชนะการเสนอราคา",
      },
      {
        name: "บริษัท ออราเคิล คอร์ปอเรชั่น (ประเทศไทย) จำกัด",
        taxId: "0105540023456",
        signedAt: "10 ส.ค. 69",
        deadline: "28 ส.ค. 69",
        submissionDeadline: "28 ส.ค. 69",
        amount: 41_200_000,
        status: "ไม่ได้รับการคัดเลือก",
        detail: "ราคาสูงกว่าผู้ชนะ",
      },
    ],
    relatedNotices: [
      {
        title: "ประกาศผลผู้ได้รับการคัดเลือก / ประกาศซื้อจ้างที่ผ่านการคัดเลือก",
        date: "09 ก.ย. 69",
      },
      {
        title: "ประกาศราคากลางโครงการจัดหาระบบ ERP",
        date: "10 ส.ค. 69",
      },
    ],
    detailUrl: "https://data.go.th/dataset/bma-erp-2569",
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
    budgetYear: "2569",
    projectType: "จ้างทำของ/จ้างเหมาบริการ",
    contractType: "สัญญาจ้างพัฒนาเว็บไซต์",
    mainProduct: "เว็บไซต์ให้บริการประชาชน",
    quantity: "1 เว็บไซต์",
    midPriceBaht: 9_800_000,
    awardedPriceBaht: 0,
    savingRatePct: 0,
    disbursementRatePct: 0,
    summary:
      "โครงการพัฒนาเว็บไซต์ One-Stop Service เพื่อให้ประชาชนในพื้นที่เขตปทุมวันสามารถขอรับบริการภาครัฐออนไลน์ได้ครบทุกประเภท โดยไม่ต้องเดินทางมาที่สำนักงานเขต",
    objectives: [
      "พัฒนาระบบรับคำร้องออนไลน์ครอบคลุมบริการกว่า 50 ประเภท",
      "ระบบนัดหมายออนไลน์ลดเวลาคอยที่สำนักงาน",
      "เชื่อมต่อระบบชำระเงินออนไลน์ผ่าน QR Code และบัตรเครดิต",
      "รองรับการเข้าถึงด้วย LINE Official Account",
    ],
    requirements: [
      "ผ่านมาตรฐาน WCAG 2.1 Level AA",
      "รองรับภาษาไทยและอังกฤษ",
      "Core Web Vitals ผ่านเกณฑ์ Google (LCP < 2.5s)",
      "เชื่อมต่อ DigitalID ของรัฐบาล",
    ],
    contactInformation: [
      "นายกิตติ เจริญสุข ตำแหน่ง นักวิชาการคอมพิวเตอร์ปฏิบัติการ",
      "โทรศัพท์: 02-252-7171 ต่อ 8812",
      "อีเมล: kitti.c@pathumwan.go.th",
    ],
    documents: [
      {
        fileName: "TOR-กทม.-2569-0119-เว็บไซต์เบ็ดเสร็จ.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
    ],
    bidders: [],
    relatedNotices: [
      {
        title: "ประกาศรับสมัครผู้รับจ้างพัฒนาเว็บไซต์ One-Stop Service",
        date: "06 ส.ค. 69",
      },
    ],
    detailUrl: "https://process3.gprocurement.go.th",
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
    budgetYear: "2569",
    projectType: "จ้างทำของ/จ้างเหมาบริการ",
    contractType: "สัญญาจ้างพัฒนาระบบ AI",
    mainProduct: "ระบบ AI วิเคราะห์และพยากรณ์งบประมาณ",
    quantity: "1 ระบบ",
    midPriceBaht: 31_200_000,
    awardedPriceBaht: 0,
    savingRatePct: 0,
    disbursementRatePct: 0,
    summary:
      "โครงการพัฒนาระบบ AI เพื่อวิเคราะห์แนวโน้มและพยากรณ์งบประมาณกรุงเทพมหานคร ช่วยผู้บริหารตัดสินใจวางแผนงบประมาณประจำปีได้แม่นยำและโปร่งใสมากขึ้น",
    objectives: [
      "พัฒนาโมเดล AI พยากรณ์งบประมาณล่วงหน้า 3-5 ปี",
      "วิเคราะห์ความเบี่ยงเบนจากงบประมาณที่ตั้งไว้แบบ Real-time",
      "สร้าง Dashboard สำหรับผู้บริหารระดับสูง",
      "รายงานอัตโนมัติส่งถึงผู้บริหารทุกสัปดาห์",
    ],
    requirements: [
      "โมเดล AI ต้องมีความแม่นยำไม่น้อยกว่า 90% (MAPE < 10%)",
      "ประมวลผลข้อมูลประวัติไม่น้อยกว่า 10 ปีย้อนหลัง",
      "รองรับการอธิบายผลลัพธ์ AI (Explainable AI)",
      "เชื่อมต่อ API กับระบบการเงินภาครัฐ",
    ],
    contactInformation: [
      "นางสาวศิริพร ทองแท้ ตำแหน่ง นักวิชาการงบประมาณชำนาญการพิเศษ",
      "โทรศัพท์: 02-203-5000 ต่อ 6601",
      "อีเมล: siriporn.t@budget.bangkok.go.th",
    ],
    documents: [
      {
        fileName: "TOR-กทม.-2569-0112-AI-Budget.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
      {
        fileName: "ข้อกำหนดทางเทคนิค-AI.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
    ],
    bidders: [],
    relatedNotices: [
      {
        title: "ประกาศรับสมัครผู้รับจ้างพัฒนาระบบ AI วิเคราะห์งบประมาณ",
        date: "03 ส.ค. 69",
      },
    ],
    detailUrl: "https://www.bangkok.go.th/procurement",
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
    budgetYear: "2569",
    projectType: "จ้างทำของ/จ้างเหมาบริการ",
    contractType: "สัญญาจ้างพัฒนาแอปพลิเคชัน",
    mainProduct: "แอปพลิเคชันติดตามขยะและความสะอาด",
    quantity: "1 แอปพลิเคชัน",
    midPriceBaht: 7_600_000,
    awardedPriceBaht: 6_980_000,
    savingRatePct: 8.16,
    disbursementRatePct: 72.5,
    summary:
      "โครงการพัฒนาแอปพลิเคชันติดตามสถานะการเก็บขยะและความสะอาดในแต่ละเขตของกรุงเทพมหานคร รองรับการรายงานปัญหาและติดตามการแก้ไขโดยเจ้าหน้าที่",
    objectives: [
      "ติดตามเส้นทางและสถานะรถเก็บขยะแบบ Real-time",
      "ระบบรายงานจุดขยะตกค้างจากประชาชน",
      "Dashboard สำหรับผู้บริหารสำนักสิ่งแวดล้อม",
      "รายงานสถิติความสะอาดรายเขตรายสัปดาห์",
    ],
    requirements: [
      "รองรับ iOS 14+ และ Android 9+",
      "ระบุตำแหน่ง GPS แม่นยำไม่เกิน 10 เมตร",
      "แสดงแผนที่ด้วย OpenStreetMap หรือ Google Maps",
      "รองรับการอัปโหลดรูปภาพขนาดไม่เกิน 5 MB/ภาพ",
    ],
    contactInformation: [
      "นายปิยะ ดวงดาว ตำแหน่ง นักวิชาการสิ่งแวดล้อมชำนาญการ",
      "โทรศัพท์: 02-203-2965",
      "อีเมล: piya.d@environment.bangkok.go.th",
    ],
    documents: [
      {
        fileName: "TOR-กทม.-2569-0104-แอปขยะ.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
      {
        fileName: "สัญญาจ้างพัฒนาแอป-2569.pdf",
        mimeType: "application/pdf",
        sourceUrl: "#",
      },
    ],
    bidders: [
      {
        name: "บริษัท กรีน เทค โซลูชั่นส์ จำกัด",
        taxId: "0105560056789",
        signedAt: "28 ก.ค. 69",
        deadline: "15 ส.ค. 69",
        submissionDeadline: "15 ส.ค. 69",
        amount: 6_980_000,
        status: "ได้รับการคัดเลือก",
        detail: "ผู้ชนะการเสนอราคา",
      },
    ],
    relatedNotices: [
      {
        title: "ประกาศผลผู้ได้รับการคัดเลือกพัฒนาแอปติดตามขยะ",
        date: "20 ส.ค. 69",
      },
      {
        title: "ประกาศราคากลางโครงการแอปพลิเคชันสิ่งแวดล้อม",
        date: "28 ก.ค. 69",
      },
    ],
    detailUrl: "https://data.go.th/dataset/bma-environment-app",
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
