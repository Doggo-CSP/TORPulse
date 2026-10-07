const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

// Every admin call goes to the real backend. A failed call throws AdminApiError with the
// backend's own message (Thai), so the page can show why it failed instead of pretending.
export class AdminApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.body = body;
  }
}

async function adminRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/v1/admin${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new AdminApiError(0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่");
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const data = (body ?? {}) as { message?: unknown; error?: unknown };
    const message =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
          ? data.error
          : `คำขอไม่สำเร็จ (HTTP ${res.status})`;
    throw new AdminApiError(res.status, message, body);
  }
  return body as T;
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};

// ---------------------------------------------------------------------------
// Dashboard stats: GET /admin/stats
// ---------------------------------------------------------------------------

export interface AdminStats {
  tors: { total: number; newThisWeek: number; awarded: number };
  users: {
    total: number;
    byRole: { admin: number; user: number };
    byStatus: { active: number; suspended: number };
  };
  savedTors: { total: number };
  ingestionJobs: {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    rejected: number;
    reviewRequired: number;
  };
}

export function fetchAdminStats(): Promise<AdminStats> {
  return adminRequest<AdminStats>("/stats");
}

// ---------------------------------------------------------------------------
// Users: /admin/users
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "user";
export type UserStatus = "active" | "suspended";
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
}

export interface AdminUserUpdateInput {
  name?: string;
  jobTitle?: string;
  agencyName?: string;
  companyName?: string;
  accountType?: AccountType;
}

export async function fetchAdminUsers(): Promise<AdminUserItem[]> {
  const data = await adminRequest<{ users: AdminUserItem[] }>("/users");
  return data.users;
}

export async function updateAdminUser(
  userId: string,
  input: AdminUserUpdateInput
): Promise<string> {
  const data = await adminRequest<{ message: string }>(`/users/${userId}`, {
    method: "PATCH",
    body: input,
  });
  return data.message;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<string> {
  const data = await adminRequest<{ message: string }>(`/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
  return data.message;
}

export async function updateUserStatus(userId: string, status: UserStatus): Promise<string> {
  const data = await adminRequest<{ message: string }>(`/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });
  return data.message;
}

// ---------------------------------------------------------------------------
// Activity feed: GET /admin/activity
// ---------------------------------------------------------------------------

export type ActivityGroup = "users" | "ingestion" | "tor" | "system";

export interface ActivityItem {
  id: string;
  action: string;
  group: ActivityGroup | null;
  actor: { type: "system" } | { type: "user"; id: string | null; name: string | null };
  target: { type: string; id: string; label: string | null };
  // Free-form details; `changes` holds { field: { from, to } } for edits.
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityPage {
  items: ActivityItem[];
  total: number;
  page: number;
  limit: number;
}

export function fetchAdminActivity(
  params: { page?: number; limit?: number; group?: ActivityGroup } = {}
): Promise<ActivityPage> {
  return adminRequest<ActivityPage>(`/activity${query(params)}`);
}

// ---------------------------------------------------------------------------
// System settings: /admin/settings
// ---------------------------------------------------------------------------

export interface AdminSettings {
  ingestionEnabled: boolean;
  senderEmail: string | null;
  // Read-only: set by the scheduler's environment
  ingestionIntervalMinutes: number;
}

export async function fetchAdminSettings(): Promise<AdminSettings> {
  const data = await adminRequest<{ settings: AdminSettings }>("/settings");
  return data.settings;
}

export function updateAdminSettings(input: {
  ingestionEnabled?: boolean;
  senderEmail?: string | null;
}): Promise<{ message: string; settings: AdminSettings }> {
  return adminRequest("/settings", { method: "PATCH", body: input });
}

// ---------------------------------------------------------------------------
// e-GP sync: /admin/ingestion
// ---------------------------------------------------------------------------

export interface CollectionRun {
  id: string;
  trigger: "scheduled" | "manual";
  triggeredBy: string | null;
  status: "running" | "success" | "failed";
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  createdCount: number;
  existingCount: number;
  errorMessage: string | null;
}

export function fetchIngestionStatus(): Promise<{
  lastRun: CollectionRun | null;
  isRunning: boolean;
}> {
  return adminRequest("/ingestion/status");
}

export function triggerIngestionSync(): Promise<{ message: string; runId: string }> {
  return adminRequest("/ingestion/sync", { method: "POST" });
}

// ---------------------------------------------------------------------------
// TOR management: /admin/tors
// ---------------------------------------------------------------------------

export type TorReviewStatus = "unverified" | "verified" | "archived" | "deleted";

export interface AdminTorItem {
  id: string;
  externalId: string;
  projectTitle: string;
  agencyName: string | null;
  sourceAdapter: string;
  dataSourceId: string;
  category: string;
  categoryLabel: string;
  confidence: number;
  reviewStatus: TorReviewStatus;
  // Falls back to the mid (reference) price when the budget is missing; see budgetSource
  budgetBaht: number | null;
  budgetSource: "budget" | "mid_price" | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTorDetail extends Omit<AdminTorItem, "budgetSource"> {
  ingestionJobId: string;
  sourceVersion: string;
  detailUrl: string;
  documents: { fileName: string; mimeType: string; sourceUrl: string }[];
  departmentName: string | null;
  departmentSubName: string | null;
  projectStatus: string | null;
  summary: string | null;
  scope: string | null;
  objectives: string[];
  requirements: string[];
  technologies: string[];
  bidderQualifications: string[];
  deliverables: string[];
  timeline: string[];
  evaluationCriteria: string[];
  midPriceBaht: number | null;
  awardedPriceBaht: number | null;
  submissionDeadline: string | null;
  contactInformation: string[];
  classificationReason: string;
  analysisModel: string;
  analysisVersion: string;
  analyzedAt: string;
}

export interface AdminTorUpdateInput {
  budgetBaht?: number | null;
  scope?: string | null;
  technologies?: string[];
  bidderQualifications?: string[];
  deliverables?: string[];
  timeline?: string[];
  evaluationCriteria?: string[];
  category?: string;
}

export interface AdminTorPage {
  tors: AdminTorItem[];
  total: number;
  page: number;
  totalPages: number;
}

export function fetchAdminTors(
  params: {
    q?: string;
    status?: TorReviewStatus | "all";
    category?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<AdminTorPage> {
  return adminRequest<AdminTorPage>(
    `/tors${query({
      q: params.q,
      status: params.status,
      category: params.category,
      page: params.page,
      page_size: params.pageSize,
    })}`
  );
}

export async function fetchAdminTor(torId: string): Promise<AdminTorDetail> {
  const data = await adminRequest<{ tor: AdminTorDetail }>(`/tors/${torId}`);
  return data.tor;
}

export function updateAdminTor(
  torId: string,
  input: AdminTorUpdateInput
): Promise<{ message: string; tor: AdminTorDetail }> {
  return adminRequest(`/tors/${torId}`, { method: "PATCH", body: input });
}

export function changeAdminTorStatus(
  torId: string,
  action: "verify" | "archive" | "delete"
): Promise<{ message: string; reviewStatus: TorReviewStatus }> {
  if (action === "delete") {
    return adminRequest(`/tors/${torId}`, { method: "DELETE" });
  }
  return adminRequest(`/tors/${torId}/${action}`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// TOR categories: /admin/categories
// ---------------------------------------------------------------------------

export interface AdminCategory {
  id: string;
  key: string;
  name: string;
  description: string;
  aiHint: string | null;
  keywords: string[];
  isActive: boolean;
  // The keyword fallback's category; the backend refuses to hide or delete it
  isDefault: boolean;
  sortOrder: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCategoryInput {
  name?: string;
  description?: string;
  aiHint?: string | null;
  keywords?: string[];
}

export function fetchAdminCategories(): Promise<{
  categories: AdminCategory[];
  total: number;
  activeCount: number;
}> {
  return adminRequest("/categories");
}

export function createAdminCategory(
  input: AdminCategoryInput & { name: string }
): Promise<{ message: string; category: AdminCategory }> {
  return adminRequest("/categories", { method: "POST", body: input });
}

export function updateAdminCategory(
  categoryId: string,
  input: AdminCategoryInput
): Promise<{ message: string; category: AdminCategory }> {
  return adminRequest(`/categories/${categoryId}`, { method: "PATCH", body: input });
}

export function setAdminCategoryStatus(
  categoryId: string,
  isActive: boolean
): Promise<{ message: string; category: AdminCategory }> {
  return adminRequest(`/categories/${categoryId}/status`, {
    method: "PATCH",
    body: { isActive },
  });
}

export function deleteAdminCategory(categoryId: string): Promise<{ message: string }> {
  return adminRequest(`/categories/${categoryId}`, { method: "DELETE" });
}
