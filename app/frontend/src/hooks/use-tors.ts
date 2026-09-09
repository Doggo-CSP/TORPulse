"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTorById } from "@/api/tor.api";

export function useTor(id: string) {
  return useQuery({
    queryKey: ["tor", id],
    queryFn: () => fetchTorById(id),
    enabled: id !== "",
  });
}
