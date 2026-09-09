"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchUserProfile,
  updateUserProfile,
  updateUserInterests,
  toggleUserBookmark,
  fetchUserBookmarks,
  type UserProfile,
  type TorItem,
} from "@/api/user.api";

export type { UserProfile, TorItem };
export type UserProfileData = UserProfile;

export function useUserProfile(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Fetch User Profile with TanStack Query
  const {
    data: profile,
    isLoading: loadingProfile,
    error: profileError,
  } = useQuery({
    queryKey: ["userProfile"],
    queryFn: fetchUserProfile,
    retry: false,
    enabled,
  });

  // 2. Fetch User Bookmarks with TanStack Query
  const { data: bookmarkedTors = [], isLoading: loadingBookmarks } = useQuery({
    queryKey: ["userBookmarks"],
    queryFn: fetchUserBookmarks,
    enabled: !!profile,
  });

  // 4. Profile Update Mutation
  const profileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(["userProfile"], updatedProfile);
      setMessage({ type: "success", text: "บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว" });
    },
    onError: (err: any) => {
      setMessage({ type: "error", text: err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    },
  });

  // 5. Interests Update Mutation
  const interestsMutation = useMutation({
    mutationFn: updateUserInterests,
    onSuccess: (data) => {
      queryClient.setQueryData(["userProfile"], (old: UserProfile | undefined) =>
        old
          ? {
              ...old,
              interests: data.interests,
              completionPercentage: data.completionPercentage,
            }
          : undefined
      );
      void queryClient.invalidateQueries({ queryKey: ["torRecommendations"] });
    },
    onError: () => {
      setMessage({ type: "error", text: "ไม่สามารถบันทึกความสนใจได้" });
    },
  });

  // 6. Bookmark Toggle Mutation
  const bookmarkMutation = useMutation({
    mutationFn: toggleUserBookmark,
    onSuccess: (data) => {
      queryClient.setQueryData(["userProfile"], (old: UserProfile | undefined) =>
        old
          ? {
              ...old,
              bookmarkedCount: data.bookmarkedCount,
            }
          : undefined
      );
      void queryClient.invalidateQueries({ queryKey: ["userBookmarks"] });
    },
  });

  return {
    profile: profile ?? null,
    loading: loadingProfile,
    saving: profileMutation.isPending || interestsMutation.isPending,
    message,
    bookmarkedTors,
    updateProfile: profileMutation.mutateAsync,
    updateInterests: interestsMutation.mutateAsync,
    toggleBookmark: bookmarkMutation.mutateAsync,
    profileError,
  };
}
