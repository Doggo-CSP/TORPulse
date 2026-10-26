// Bidder profile and AI qualification match API (backend: modules/user/bidder-profile.*,
// modules/qualification). Dates are YYYY-MM-DD in ค.ศ.

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

/** Carries the HTTP status, so callers can tell 409 (profile not ready) from a real failure. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiUrl}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: unknown } | null)?.error;
    const message = typeof error === "string" ? error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

/* ───────────── Bidder profile ───────────── */

export interface Certification {
  name: string;
  issuer: string;
  issuedAt: string | null;
  expiresAt: string | null;
  yearsHeld: number | null;
  isExpired: boolean;
}

export type CertificationInput = Pick<Certification, "name"> &
  Partial<Pick<Certification, "issuer" | "issuedAt" | "expiresAt">>;

export interface Education {
  level: string;
  field: string;
  institution: string;
  graduatedYear: number | null;
}

export interface Person {
  id: string;
  fullName: string;
  positionTitle: string;
  roles: string[];
  yearsExperience: number | null;
  employmentType: string | null;
  joinedAt: string | null;
  yearsAtCompany: number | null;
  education: Education[];
  certifications: Certification[];
  skills: string[];
}

export type PersonInput = Partial<
  Omit<Person, "id" | "yearsAtCompany" | "certifications" | "education">
> & {
  education?: Array<Partial<Education> & Pick<Education, "level">>;
  certifications?: CertificationInput[];
};

export interface Organization {
  juristicType: string | null;
  registeredDate: string | null;
  registeredCapitalBaht: number | null;
  isSme: boolean | null;
  hasPositiveNetWorth: boolean | null;
  hasBangkokOffice: boolean | null;
  certifications: Certification[];
}

export type OrganizationInput = Partial<Omit<Organization, "certifications">> & {
  certifications?: CertificationInput[];
};

export interface Preferences {
  budgetMinBaht: number | null;
  budgetMaxBaht: number | null;
  businessObjectives: string;
}

export interface PastProject {
  id: string;
  name: string;
  clientName: string;
  clientType: string | null;
  contractValueBaht: number | null;
  startDate: string | null;
  endDate: string | null; // delivery date; null while still running
  role: string | null;
  categories: string[];
  technologies: string[];
  description: string;
  hasCompletionCertificate: boolean;
  memberIds: string[];
}

export type PastProjectInput = Partial<Omit<PastProject, "id">>;

export interface ProfileCompleteness {
  isComplete: boolean;
  missing: string[];
  percentage: number;
}

export interface BidderProfile {
  accountType: "personal" | "company";
  organization: Organization;
  preferences: Preferences;
  self: Person | null;
  team: Person[];
  projects: PastProject[];
  completeness: ProfileCompleteness;
}

export interface BidderProfileOptions {
  accountTypes: string[];
  juristicTypes: string[];
  staffRoles: string[];
  educationLevels: string[];
  employmentTypes: string[];
  projectClientTypes: string[];
  projectRoles: string[];
  limits: { teamMembers: number; projects: number };
}

type ProfileResponse = { bidderProfile: BidderProfile };
const profileOf = (res: ProfileResponse) => res.bidderProfile;
const json = (body: unknown) => JSON.stringify(body);

export const fetchBidderProfile = () => request<ProfileResponse>("/user/bidder-profile").then(profileOf);

export const fetchBidderProfileOptions = () =>
  request<BidderProfileOptions>("/user/bidder-profile/options");

export const updateOrganization = (body: OrganizationInput) =>
  request<ProfileResponse>("/user/bidder-profile/organization", { method: "PUT", body: json(body) }).then(profileOf);

export const updatePreferences = (body: Partial<Preferences>) =>
  request<ProfileResponse>("/user/bidder-profile/preferences", { method: "PUT", body: json(body) }).then(profileOf);

export const updateSelf = (body: PersonInput) =>
  request<ProfileResponse>("/user/bidder-profile/self", { method: "PUT", body: json(body) }).then(profileOf);

export const addTeamMember = (body: PersonInput) =>
  request<ProfileResponse>("/user/bidder-profile/team", { method: "POST", body: json(body) }).then(profileOf);

export const updateTeamMember = (id: string, body: PersonInput) =>
  request<ProfileResponse>(`/user/bidder-profile/team/${id}`, { method: "PATCH", body: json(body) }).then(profileOf);

export const removeTeamMember = (id: string) =>
  request<ProfileResponse>(`/user/bidder-profile/team/${id}`, { method: "DELETE" }).then(profileOf);

export const addProject = (body: PastProjectInput) =>
  request<ProfileResponse>("/user/bidder-profile/projects", { method: "POST", body: json(body) }).then(profileOf);

export const updateProject = (id: string, body: PastProjectInput) =>
  request<ProfileResponse>(`/user/bidder-profile/projects/${id}`, { method: "PATCH", body: json(body) }).then(profileOf);

export const removeProject = (id: string) =>
  request<ProfileResponse>(`/user/bidder-profile/projects/${id}`, { method: "DELETE" }).then(profileOf);

/* ───────────── Qualification match ───────────── */

export type RequirementStatus = "met" | "partial" | "not_met" | "unknown";
export type RequirementCategory =
  | "legal"
  | "financial"
  | "experience"
  | "personnel"
  | "certification"
  | "technical"
  | "other";

export interface RequirementResult {
  requirement: string;
  category: RequirementCategory;
  mandatory: boolean;
  status: RequirementStatus;
  reason: string;
  suggestion: string;
}

export interface QualificationMatch {
  percentage: number | null;
  allMandatoryMet: boolean;
  counts: { met: number; partial: number; notMet: number; unknown: number };
  requirements: RequirementResult[];
  summary: string;
  aiModel: string;
  evaluatedAt: string;
}

export interface QualificationMatchResponse {
  match: QualificationMatch | null;
  isStale: boolean;
  completeness: ProfileCompleteness;
}

/** The stored result for one TOR; never calls the AI. */
export const fetchTorQualification = (torId: string) =>
  request<QualificationMatchResponse>(`/tors/${torId}/qualification`);

/** Runs the AI (about 10 seconds) unless a current result is stored, or force is set. */
export const evaluateTorQualification = (torId: string, force = false) =>
  request<QualificationMatchResponse>(`/tors/${torId}/qualification${force ? "?force=true" : ""}`, {
    method: "POST",
  });

export type CardMatchStatus =
  | "ready"
  | "stale"
  | "pending"
  | "failed"
  | "not_evaluated"
  | "profile_incomplete"
  | "no_requirements";

export interface CardMatch {
  torId: string;
  status: CardMatchStatus;
  percentage: number | null;
  allMandatoryMet: boolean | null;
  evaluatedAt: string | null;
}

/** Precomputed scores for up to 50 TOR cards in one request. */
export const fetchCardMatches = (torIds: string[]) =>
  request<{ completeness: ProfileCompleteness; items: CardMatch[] }>(
    `/user/qualification-matches?torIds=${torIds.map(encodeURIComponent).join(",")}`,
  );
