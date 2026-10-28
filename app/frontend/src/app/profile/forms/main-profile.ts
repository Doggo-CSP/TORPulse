// The main profile form shared by the profile page and onboarding: what it holds, how it is
// loaded and saved, and which fields the qualification score requires. Keeping it in one place
// keeps the two pages asking for exactly the same things.
"use client";

import type { BidderProfile, CertificationInput } from "@/api/bidder-profile.api";
import type { UserProfile } from "@/api/user.api";
import { useBidderProfile } from "@/hooks/use-bidder-profile";
import { useUserProfile } from "@/hooks/use-user-profile";
import { EGP_CERTIFICATION_NAME, getCompanyFormError, type CompanyFormData } from "./company-form";
import { toCertificationInputs } from "./form-ui";

export type MainProfileForm = Partial<UserProfile> & Partial<CompanyFormData>;

/** The form as saved: account and contact fields from the user, the rest from the bidder profile. */
export function toMainProfileForm(profile: UserProfile, bidder: BidderProfile | null): MainProfileForm {
  const certs = toCertificationInputs(bidder?.organization.certifications ?? []);
  return {
    accountType: profile.accountType === "company" ? "company" : "personal",
    displayName: profile.displayName || profile.name || "",
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    jobTitle: profile.jobTitle || "",
    contactEmail: profile.contactEmail || profile.email || "",
    phone: profile.phone || "",
    address: profile.address || "",
    about: profile.about || "",
    website: profile.website || "",
    companyName: profile.companyName || "",
    registrationNumber: profile.registrationNumber || "",
    businessType: profile.businessType || "",
    registeredDate: bidder?.organization.registeredDate ?? "",
    registeredCapital: bidder?.organization.registeredCapitalBaht ?? null,
    isSme: bidder?.organization.isSme ?? null,
    hasPositiveNetWorth: bidder?.organization.hasPositiveNetWorth ?? null,
    hasBangkokOffice: bidder?.organization.hasBangkokOffice ?? null,
    certifications: certs.filter((c) => c.name !== EGP_CERTIFICATION_NAME),
    isEgpRegistered: certs.some((c) => c.name === EGP_CERTIFICATION_NAME),
    budgetMin: bidder?.preferences.budgetMinBaht ?? null,
    budgetMax: bidder?.preferences.budgetMaxBaht ?? null,
    businessObjectives: bidder?.preferences.businessObjectives ?? "",
    primaryContact: profile.primaryContact ?? {
      name: "",
      position: "",
      education: "",
      startDate: "",
    },
  };
}

const filled = (v?: string | null) => Boolean(v?.trim());

/**
 * Required fields still empty, as Thai labels. The same list the qualification score needs
 * (backend profileCompleteness), apart from past projects, which have their own step.
 */
export function missingMainFields(form: MainProfileForm): string[] {
  if (form.accountType === "company") {
    return [
      !filled(form.companyName) && "ชื่อบริษัท",
      !filled(form.businessType) && "ประเภทธุรกิจ",
      form.registeredCapital == null && "ทุนจดทะเบียน",
    ].filter((x): x is string => Boolean(x));
  }
  return [
    !filled(form.firstName) && "ชื่อ",
    !filled(form.lastName) && "นามสกุล",
    !filled(form.contactEmail) && !filled(form.phone) && "อีเมลหรือเบอร์โทรศัพท์",
  ].filter((x): x is string => Boolean(x));
}

/** Values that cannot be saved as they are (wrong format), whatever is required. */
export function mainFormError(form: MainProfileForm): string | null {
  if (form.accountType === "company") return getCompanyFormError(form);
  if (form.budgetMin != null && form.budgetMax != null && form.budgetMin > form.budgetMax) {
    return "งบประมาณต่ำสุดต้องไม่มากกว่างบประมาณสูงสุด";
  }
  return null;
}

// The e-GP checkbox is saved as a certification, so the AI matcher sees it
const withEgpCertification = (
  certs: CertificationInput[],
  isEgpRegistered: boolean,
  previous: CertificationInput | undefined,
): CertificationInput[] =>
  isEgpRegistered
    ? [
        ...certs,
        previous ?? { name: EGP_CERTIFICATION_NAME, issuer: "", issuedAt: null, expiresAt: null },
      ]
    : certs;

/**
 * Saves the main form: account and contact fields with PUT /user/profile, then the organization
 * (company only) and the preferences. Team members and projects are saved by their own editors.
 */
export function useSaveMainProfile() {
  const { updateProfile } = useUserProfile(false);
  const bidder = useBidderProfile(false);

  return async (form: MainProfileForm) => {
    const isCompany = form.accountType === "company";
    await updateProfile({
      accountType: form.accountType,
      displayName: form.displayName,
      firstName: form.firstName,
      lastName: form.lastName,
      jobTitle: form.jobTitle,
      contactEmail: form.contactEmail,
      phone: form.phone,
      address: form.address,
      about: form.about,
      website: form.website,
      ...(isCompany && {
        companyName: form.companyName,
        registrationNumber: form.registrationNumber,
        businessType: form.businessType,
        primaryContact: form.primaryContact ?? {
          name: "",
          position: "",
          education: "",
          startDate: "",
        },
      }),
    });

    if (isCompany) {
      const previousEgp = bidder.profile?.organization.certifications.find(
        (c) => c.name === EGP_CERTIFICATION_NAME,
      );
      await bidder.saveOrganization({
        registeredDate: form.registeredDate || null,
        registeredCapitalBaht: form.registeredCapital ?? null,
        isSme: form.isSme ?? null,
        hasPositiveNetWorth: form.hasPositiveNetWorth ?? null,
        hasBangkokOffice: form.hasBangkokOffice ?? null,
        certifications: withEgpCertification(
          (form.certifications ?? []).filter((c) => c.name.trim()),
          Boolean(form.isEgpRegistered),
          previousEgp && toCertificationInputs([previousEgp])[0],
        ),
      });
    }

    await bidder.savePreferences({
      budgetMinBaht: form.budgetMin ?? null,
      budgetMaxBaht: form.budgetMax ?? null,
      ...(isCompany && { businessObjectives: form.businessObjectives ?? "" }),
    });
    // Name, contact and business type count towards completeness too
    await bidder.refresh();
  };
}
