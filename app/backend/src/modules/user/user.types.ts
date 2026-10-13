import type { CompanyQualification } from '../notification/qualification.js'

export interface UpdateProfileInput {
  accountType?: 'personal' | 'company' | 'agency'
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
  agencyName?: string
  agencyType?: string
  website?: string
  qualification?: CompanyQualification
  notificationPrefs?: { emailEnabled: boolean }
}

export interface UpdateInterestsInput {
  interests: string[]
}
