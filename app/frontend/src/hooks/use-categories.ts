"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCategories, type Category } from "@/api/category.api";

// Active categories change only when an admin edits them
export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
