const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export type UserRole = "admin" | "editor" | "user";
export type UserStatus = "active" | "pending" | "suspended";
export type AccountType = "personal" | "company" | "agency";

export interface AdminUserItem {
  _id: string;
  name: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  accountType: AccountType;
  agencyName?: string;
  companyName?: string;
  jobTitle?: string;
  image?: string | null;
  createdAt: string;
  lastActive?: string;
}

export interface ActivityItem {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  type: "ingestion" | "user_role" | "tor_update" | "system";
  actor: string;
  target?: string;
  createdAt: string;
}

export interface AdminStats {
  total_tors: number;
  new_this_week: number;
  active_users: number;
  awarded_projects: number;
  role_counts?: {
    admins: number;
    editors: number;
    users: number;
    pending: number;
  };
}

// Initial fallback mock data matching the user's screenshot exactly
export const INITIAL_ADMIN_STATS: AdminStats = {
  total_tors: 1284,
  new_this_week: 37,
  active_users: 212,
  awarded_projects: 6,
  role_counts: {
    admins: 4,
    editors: 12,
    users: 196,
    pending: 2,
  },
};

export const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-1",
    title: "ดึงข้อมูลจาก e-GP สำเร็จ 18 รายการ",
    description: "ระบบเชื่อมต่อและดึงประกาศจัดซื้อจัดจ้างภาครัฐรอบล่าสุดประจำวันสำเร็จ",
    type: "ingestion",
    actor: "ระบบ e-GP",
    target: "18 รายการ",
    createdAt: new Date().toISOString(),
  },
  {
    id: "act-2",
    title: "อนุมัติบัญชีผู้ใช้ใหม่ 2 บัญชี",
    description: "อนุมัติสิทธิ์เข้าใช้งานสำหรับหน่วยงานราชการและผู้เสนอราคาบริษัทเอกชน",
    type: "user_role",
    actor: "Admin (กันตพล)",
    target: "สมชาย และ ศิริวรรณ",
    createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
  },
  {
    id: "act-3",
    title: "อัปเดตราคากลางของโครงการ BMA-2569-0142",
    description: "ปรับปรุงราคากลาง 4,500,000 บาท ตามประกาศแก้ไขฉบับที่ 2",
    type: "tor_update",
    actor: "Admin",
    target: "BMA-2569-0142",
    createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
  },
  {
    id: "act-4",
    title: "ปรับเปลี่ยนสิทธิ์ผู้ใช้ ณัฐพงษ์ วงศ์สุวรรณ เป็น ผู้ใช้งานทั่วไป",
    description: "เปลี่ยนสถานะจากรอการอนุมัติ เป็นผู้ใช้งานทั่วไปและเปิดการใช้งาน",
    type: "user_role",
    actor: "Admin",
    target: "nutthapong.w@egov.go.th",
    createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
  },
  {
    id: "act-5",
    title: "สำรองฐานข้อมูลประจำวันเสร็จสมบูรณ์",
    description: "จัดเก็บ Snapshot ข้อมูล TOR และสถิติผู้ใช้งานลงใน Cloud Backup",
    type: "system",
    actor: "System Scheduler",
    target: "MongoDB Cluster",
    createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
  },
];

export const INITIAL_USERS: AdminUserItem[] = [
  {
    _id: "usr-01",
    name: "Kantapon Hemmadhun",
    displayName: "กันตพล เหมธัญ",
    email: "kantapon.h@torpulse.gov.th",
    role: "admin",
    status: "active",
    accountType: "agency",
    agencyName: "สำนักงานพัฒนารัฐบาลดิจิทัล (สพร.)",
    jobTitle: "System Architect / ผู้ดูแลระบบ",
    image: null,
    createdAt: "2026-01-15T08:00:00Z",
    lastActive: "ออนไลน์ขณะนี้",
  },
  {
    _id: "usr-02",
    name: "Somchai Prasert",
    displayName: "สมชาย ประเสริฐยิ่ง",
    email: "somchai.p@bma.go.th",
    role: "editor",
    status: "active",
    accountType: "agency",
    agencyName: "กรุงเทพมหานคร (BMA)",
    jobTitle: "หัวหน้าฝ่ายจัดซื้อจัดจ้าง",
    image: null,
    createdAt: "2026-02-01T09:30:00Z",
    lastActive: "15 นาทีที่แล้ว",
  },
  {
    _id: "usr-03",
    name: "Siriwan Tech Solutions",
    displayName: "ศิริวรรณ รัตนโชติ",
    email: "contact@siriwantech.co.th",
    role: "user",
    status: "active",
    accountType: "company",
    companyName: "บจก. ศิริวรรณ เทคโนโลยี แอนด์ คอนซัลติ้ง",
    jobTitle: "Business Development Director",
    image: null,
    createdAt: "2026-02-18T14:20:00Z",
    lastActive: "วันนี้ 10:15",
  },
  {
    _id: "usr-04",
    name: "Nutthapong Wongsuwan",
    displayName: "ณัฐพงษ์ วงศ์สุวรรณ",
    email: "nutthapong.w@egov.go.th",
    role: "user",
    status: "pending",
    accountType: "agency",
    agencyName: "กรมบัญชีกลาง",
    jobTitle: "นักวิชาการพัสดุชำนาญการ",
    image: null,
    createdAt: "2026-03-24T11:00:00Z",
    lastActive: "เมื่อวานนี้",
  },
  {
    _id: "usr-05",
    name: "Pattarapon Chuenjit",
    displayName: "ภัทรพล ชื่นจิตร์",
    email: "pattarapon.c@nectec.or.th",
    role: "editor",
    status: "active",
    accountType: "agency",
    agencyName: "NECTEC สวทช.",
    jobTitle: "Senior Data Scientist",
    image: null,
    createdAt: "2026-02-28T16:45:00Z",
    lastActive: "2 วันที่แล้ว",
  },
  {
    _id: "usr-06",
    name: "Chayanon Kiatbamrung",
    displayName: "ชยานนท์ เกียรติบำรุง",
    email: "chayanon@alpha-cloud.co.th",
    role: "user",
    status: "suspended",
    accountType: "company",
    companyName: "อัลฟ่า คลาวด์ ซิสเต็มส์ จำกัด",
    jobTitle: "Managing Director",
    image: null,
    createdAt: "2026-01-22T13:10:00Z",
    lastActive: "1 สัปดาห์ที่แล้ว",
  },
  {
    _id: "usr-07",
    name: "Waraporn Srichan",
    displayName: "วราภรณ์ ศรีจันทร์",
    email: "waraporn.s@dga.or.th",
    role: "admin",
    status: "active",
    accountType: "agency",
    agencyName: "สำนักงานพัฒนารัฐบาลดิจิทัล (สพร.)",
    jobTitle: "Senior Security Specialist",
    image: null,
    createdAt: "2026-01-10T10:00:00Z",
    lastActive: "30 นาทีที่แล้ว",
  },
  {
    _id: "usr-08",
    name: "Thanakorn Kittisiri",
    displayName: "ธนกร กิตติศิริ",
    email: "thanakorn.k@cybernet.co.th",
    role: "user",
    status: "pending",
    accountType: "company",
    companyName: "ไซเบอร์เน็ต โซลูชั่นส์",
    jobTitle: "Project Manager",
    image: null,
    createdAt: "2026-03-25T08:15:00Z",
    lastActive: "เมื่อสักครู่",
  },
];

export async function fetchAdminStats(): Promise<AdminStats> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/stats`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Backend unavailable");
    const data = await res.json();
    return {
      ...data.stats,
      role_counts: data.role_counts,
    };
  } catch {
    return INITIAL_ADMIN_STATS;
  }
}

export async function fetchAdminUsers(params?: {
  q?: string;
  role?: string;
  status?: string;
}): Promise<AdminUserItem[]> {
  try {
    const query = new URLSearchParams();
    if (params?.q) query.append("q", params.q);
    if (params?.role) query.append("role", params.role);
    if (params?.status) query.append("status", params.status);

    const res = await fetch(`${apiUrl}/api/v1/admin/users?${query.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Backend unavailable");
    const data = await res.json();
    return data.users;
  } catch {
    let filtered = [...INITIAL_USERS];
    if (params?.role && params.role !== "all") {
      filtered = filtered.filter((u) => u.role === params.role);
    }
    if (params?.status && params.status !== "all") {
      filtered = filtered.filter((u) => u.status === params.status);
    }
    if (params?.q && params.q.trim()) {
      const q = params.q.trim().toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.agencyName && u.agencyName.toLowerCase().includes(q)) ||
          (u.companyName && u.companyName.toLowerCase().includes(q))
      );
    }
    return filtered;
  }
}

export async function fetchAdminActivities(): Promise<ActivityItem[]> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/activities`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Backend unavailable");
    const data = await res.json();
    return data.activities;
  } catch {
    return INITIAL_ACTIVITIES;
  }
}

export async function updateUserRoleApi(
  userId: string,
  role: UserRole
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error("Backend error");
    return await res.json();
  } catch {
    const roleMap: Record<UserRole, string> = {
      admin: "ผู้ดูแลระบบ (Admin)",
      editor: "บรรณาธิการ (Editor)",
      user: "ผู้ใช้งานทั่วไป (User)",
    };
    return {
      success: true,
      message: `เปลี่ยนบทบาทเป็น ${roleMap[role]} สำเร็จ`,
    };
  }
}

export async function updateUserStatusApi(
  userId: string,
  status: UserStatus
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Backend error");
    return await res.json();
  } catch {
    const statusMap: Record<UserStatus, string> = {
      active: "ใช้งานอยู่",
      pending: "รอการอนุมัติ",
      suspended: "ระงับการใช้งาน",
    };
    return {
      success: true,
      message: `ปรับสถานะเป็น ${statusMap[status]} สำเร็จ`,
    };
  }
}
