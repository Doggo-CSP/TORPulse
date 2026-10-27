import { database } from '../config/mongoose.js'
import { User } from '../modules/auth/user.model.js'
import { isFullyQualified, missingNotificationFields } from '../modules/notification/eligibility.js'
import { enqueueForUser } from '../modules/notification/notification.service.js'
import type { CompanyQualification } from '../modules/notification/qualification.js'
import { TorNotificationModel } from '../modules/notification/tor-notification.model.js'
import { PUBLIC_TOR_FILTER, TorModel } from '../modules/tor/tor.model.js'
import { BidderProfileModel } from '../modules/user/bidder-profile.model.js'
import { assertNotProduction } from './dev-session-token.js'

// DEV ONLY: creates (or refreshes) a mock company user whose profile fully qualifies for the
// TORs that are open for bidding right now, then queues their notification emails.
//   npm run seed:notify-user -- you@example.com          create/refresh, emails go to you@example.com
//   npm run seed:notify-user -- you@example.com --clean  delete the user and its notifications
// Run the notification worker (npm run dev:notification) to send the queued email.

const MOCK_GOOGLE_ID = 'mock-notify-user'
const MOCK_EMAIL = 'mock-notify-user@example.com'

function maxOf(values: (number | null | undefined)[], fallback: number): number {
  const numbers = values.filter((value): value is number => typeof value === 'number')
  return numbers.length > 0 ? Math.max(...numbers, fallback) : fallback
}

async function clean(): Promise<void> {
  const user = await User.findOne({ googleId: MOCK_GOOGLE_ID }).select({ _id: 1 }).lean()
  if (!user) {
    console.log('No mock notification user to remove')
    return
  }

  const { deletedCount } = await TorNotificationModel.deleteMany({ userId: user._id })
  await User.deleteOne({ _id: user._id })
  console.log(`Removed mock user ${MOCK_EMAIL} and ${deletedCount} notification row(s)`)
}

async function seed(contactEmail: string): Promise<void> {
  const now = new Date()
  const openTors = await TorModel.find({
    ...PUBLIC_TOR_FILTER,
    $or: [{ submissionDeadlineAt: null }, { submissionDeadlineAt: { $gt: now } }],
  })
    .select({
      projectTitle: 1,
      reviewStatus: 1,
      submissionDeadlineAt: 1,
      category: 1,
      categories: 1,
      eligibility: 1,
    })
    .lean()
  const mappedTors = openTors.filter((tor) => tor.eligibility)

  // Meet the highest bar among the open TORs so the profile qualifies by construction.
  const eligibilities = mappedTors.map((tor) => tor.eligibility!)
  const qualification: CompanyQualification = {
    registeredCapitalBaht: maxOf(eligibilities.map((e) => e.minRegisteredCapitalBaht), 10_000_000),
    yearsInBusiness: maxOf(eligibilities.map((e) => e.minYearsInBusiness), 10),
    maxPastContractValueBaht: maxOf(
      eligibilities.map((e) => e.minPastContractValueBaht),
      5_000_000,
    ),
    certifications: [...new Set(eligibilities.flatMap((e) => e.requiredCertifications))],
    isThaiJuristicPerson: true,
    isSme: true,
    hasPositiveNetWorth: true,
    pastContractAgeYears: 1,
    hasBangkokOffice: true,
    staffRoles: [...new Set(eligibilities.flatMap((e) => e.requiredStaffRoles))],
  }
  const interests = [
    ...new Set(
      mappedTors.flatMap((tor) => [...(tor.categories ?? []), ...(tor.category ? [tor.category] : [])]),
    ),
  ]

  const user = await User.findOneAndUpdate(
    { googleId: MOCK_GOOGLE_ID },
    {
      $set: {
        name: 'Mock Notify Co.',
        email: MOCK_EMAIL,
        contactEmail,
        status: 'active',
        role: 'user',
        accountType: 'company',
        displayName: 'Mock Notify Co.',
        companyName: 'Mock Notify Co., Ltd.',
        registrationNumber: '0105560000000',
        interests,
        qualification,
        notificationPrefs: { emailEnabled: true },
      },
      $setOnInsert: { googleId: MOCK_GOOGLE_ID, image: null },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean()

  if (!user) {
    throw new Error('Mock user upsert returned no record')
  }

  console.log(`Mock user ${MOCK_EMAIL} (id ${user._id}) → emails to ${contactEmail}`)
  const missing = missingNotificationFields(
    user,
    await BidderProfileModel.findOne({ userId: user._id }).lean(),
  )
  if (missing.length > 0) {
    console.log(`Profile not ready for notifications, missing: ${missing.join(', ')}`)
  }

  console.log(`\n${openTors.length} open TOR(s), ${mappedTors.length} with eligibility:`)
  for (const tor of openTors) {
    const result = isFullyQualified(user, tor)
    console.log(
      `${result.qualified ? '✔' : '✖'} ${tor._id} ${tor.projectTitle.slice(0, 70)}` +
        (result.qualified ? '' : `\n    ${result.reasons.join('; ')}`),
    )
  }

  const { queued, existing } = await enqueueForUser(user._id)
  console.log(`\nNotifications queued: ${queued}, already queued or sent: ${existing}`)
  console.log('Send them with: npm run dev:notification')
  console.log(`Log in as this user with: npm run dev:token -- ${MOCK_EMAIL}`)
}

async function main(): Promise<void> {
  assertNotProduction()
  const args = process.argv.slice(2)
  const contactEmail = args.find((arg) => !arg.startsWith('--'))

  if (!contactEmail && !args.includes('--clean')) {
    console.error('Usage: npm run seed:notify-user -- <contactEmail> [--clean]')
    process.exitCode = 1
    return
  }

  await database.connect()
  try {
    if (args.includes('--clean')) {
      await clean()
    } else {
      await seed(contactEmail!.trim())
    }
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Seeding the mock notification user failed:', error)
  process.exitCode = 1
})
