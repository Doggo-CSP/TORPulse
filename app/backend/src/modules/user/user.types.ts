export interface PastProjectInput {
  name: string
  client: string
  valueBaht: number | null
  year: number | null // พ.ศ.
}

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

  // company profile (used by qualification matching)
  registeredDate?: string // YYYY-MM-DD, '' when unset
  registeredCapital?: number | null
  yearsExperience?: number | null
  teamSize?: number | null
  budgetMin?: number | null
  budgetMax?: number | null
  businessObjectives?: string
  certifications?: string[]
  isEgpRegistered?: boolean
  pastProjects?: PastProjectInput[]
}

export interface UpdateInterestsInput {
  interests: string[]
}
