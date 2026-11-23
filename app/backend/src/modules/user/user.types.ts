import type { CompanyQualification } from '../notification/qualification.js'

export interface PrimaryContactInput {
  name?: string
  position?: string
  education?: string
  startDate?: string
}

export interface UpdateProfileInput {
  accountType?: 'personal' | 'company'
  displayName?: string
  firstName?: string
  lastName?: string
  jobTitle?: string
  contactEmail?: string
  phone?: string
  image?: string
  address?: string
  about?: string
  companyName?: string
  registrationNumber?: string
  businessType?: string
  website?: string
  qualification?: CompanyQualification
  notificationPrefs?: { emailEnabled: boolean }
  onboardingStatus?: 'completed' | 'dismissed'
  primaryContact?: PrimaryContactInput
}

export interface UpdateInterestsInput {
  interests: string[]
}
