const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

// An active TOR category, in display order. Hidden categories are not listed.
export interface Category {
  key: string;
  name: string;
  description: string;
}

/**
 * Every active category (GET /api/v1/categories), whether or not any TOR uses it right now.
 * Use this for choices such as user interests. /tors/filter-options lists only categories that
 * some TOR uses, which suits TOR search filters but not interests.
 */
export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${apiUrl}/api/v1/categories`);
  if (!res.ok) {
    throw new Error(`Failed to fetch categories (${res.status})`);
  }
  return await res.json();
}
