const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

export interface TorDocument {
  fileName: string;
  mimeType: string;
  sourceUrl: string;
}

export interface TorDetail {
  id: string;
  externalId: string;
  sourceAdapter: string;
  sourceVersion: string;
  detailUrl: string;
  projectTitle: string;
  agencyName: string | null;
  summary: string | null;
  objectives: string[];
  requirements: string[];
  bidderQualifications: string[];
  technologies: string[];
  budgetBaht: number | null;
  submissionDeadline: string | null;
  contactInformation: string[];
  classificationReason: string;
  confidence: number;
  analyzedAt: string;
  documents: TorDocument[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchTorById(id: string): Promise<TorDetail | null> {
  const response = await fetch(
    `${apiUrl}/api/v1/tors/${encodeURIComponent(id)}`,
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch TOR (${response.status})`);

  return response.json();
}
