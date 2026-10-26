"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addProject,
  addTeamMember,
  fetchBidderProfile,
  fetchBidderProfileOptions,
  removeProject,
  removeTeamMember,
  updateOrganization,
  updatePreferences,
  updateProject,
  updateSelf,
  updateTeamMember,
  type BidderProfile,
  type BidderProfileOptions,
  type OrganizationInput,
  type PastProjectInput,
  type PersonInput,
  type Preferences,
} from "@/api/bidder-profile.api";

export const BIDDER_PROFILE_KEY = ["bidderProfile"] as const;

export function useBidderProfileOptions() {
  return useQuery<BidderProfileOptions>({
    queryKey: ["bidderProfileOptions"],
    queryFn: fetchBidderProfileOptions,
    staleTime: Infinity,
  });
}

export function useBidderProfile(enabled: boolean = true) {
  const queryClient = useQueryClient();

  const query = useQuery<BidderProfile>({
    queryKey: BIDDER_PROFILE_KEY,
    queryFn: fetchBidderProfile,
    retry: false,
    enabled,
  });

  // Every write returns the whole profile. Scores change in the background after a profile
  // edit, so cached match results are refetched too.
  const onSaved = (profile: BidderProfile) => {
    queryClient.setQueryData(BIDDER_PROFILE_KEY, profile);
    void queryClient.invalidateQueries({ queryKey: ["torQualification"] });
    void queryClient.invalidateQueries({ queryKey: ["cardMatches"] });
  };

  const mutation = useMutation({
    mutationFn: (save: () => Promise<BidderProfile>) => save(),
    onSuccess: onSaved,
  });

  const run = (save: () => Promise<BidderProfile>) => mutation.mutateAsync(save);

  return {
    profile: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    saving: mutation.isPending,
    saveOrganization: (body: OrganizationInput) => run(() => updateOrganization(body)),
    savePreferences: (body: Partial<Preferences>) => run(() => updatePreferences(body)),
    saveSelf: (body: PersonInput) => run(() => updateSelf(body)),
    addTeamMember: (body: PersonInput) => run(() => addTeamMember(body)),
    updateTeamMember: (id: string, body: PersonInput) => run(() => updateTeamMember(id, body)),
    removeTeamMember: (id: string) => run(() => removeTeamMember(id)),
    addProject: (body: PastProjectInput) => run(() => addProject(body)),
    updateProject: (id: string, body: PastProjectInput) => run(() => updateProject(id, body)),
    removeProject: (id: string) => run(() => removeProject(id)),
    // After PUT /user/profile changes accountType, name or business type
    refresh: () => queryClient.invalidateQueries({ queryKey: BIDDER_PROFILE_KEY }),
  };
}
