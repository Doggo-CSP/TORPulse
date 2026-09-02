export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  accountType: "personal" | "company" | "agency";
  displayName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  contactEmail: string;
  phone: string;
  address: string;
  about: string;
  interests: string[];
  bookmarkedTorIds: string[];
  completionPercentage: number;
}

export interface TorItem {
  _id: string;
  projectTitle: string;
  agencyName?: string;
  summary?: string;
  budgetBaht?: number;
  submissionDeadline?: string;
  technologies?: string[];
  classificationReason?: string;
  detailUrl?: string;
  createdAt?: string;
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

/**
 * API Function to fetch authenticated user profile (including logged-in email and Google OAuth data)
 */
export async function fetchUserProfile(): Promise<UserProfile> {
  const res = await fetch(`${apiUrl}/api/v1/user/profile`, {
    credentials: "include",
  });

  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    throw new Error("Failed to fetch user profile");
  }

  const data = await res.json();
  return data.user;
}

/**
 * API Function to update user profile information (CRUD update)
 */
export async function updateUserProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
  const res = await fetch(`${apiUrl}/api/v1/user/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(profileData),
  });

  if (!res.ok) {
    throw new Error("Failed to update profile");
  }

  const data = await res.json();
  return data.user;
}

/**
 * API Function to update category preferences
 */
export async function updateUserInterests(interests: string[]): Promise<{ interests: string[]; completionPercentage: number }> {
  const res = await fetch(`${apiUrl}/api/v1/user/interests`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ interests }),
  });

  if (!res.ok) {
    throw new Error("Failed to update interest categories");
  }

  return await res.json();
}

/**
 * API Function to toggle TOR bookmark
 */
export async function toggleUserBookmark(torId: string): Promise<{ bookmarked: boolean; bookmarkedTorIds: string[] }> {
  const res = await fetch(`${apiUrl}/api/v1/user/bookmarks/${torId}`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to toggle bookmark");
  }

  return await res.json();
}

/**
 * API Function to fetch bookmarked TORs
 */
export async function fetchUserBookmarks(): Promise<TorItem[]> {
  const res = await fetch(`${apiUrl}/api/v1/user/bookmarks`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch bookmarks");
  }

  const data = await res.json();
  return data.tors || [];
}

/**
 * API Function to fetch recommended TORs based on user interest categories
 */
export async function fetchUserRecommended(): Promise<TorItem[]> {
  const res = await fetch(`${apiUrl}/api/v1/user/recommended`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch recommendations");
  }

  const data = await res.json();
  return data.tors || [];
}
