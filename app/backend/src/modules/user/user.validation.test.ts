import assert from 'node:assert/strict'
import test from 'node:test'

import { updateInterestsSchema, updateProfileSchema } from './user.validation.js'

test('profile accepts well-formed values and empty strings', () => {
  const parsed = updateProfileSchema.safeParse({
    displayName: 'Somchai',
    contactEmail: 'somchai@example.co.th',
    phone: '081-234-5678',
    registrationNumber: '0105556000000',
    website: 'https://example.co.th',
    address: '',
  })

  assert.equal(parsed.success, true)
  assert.equal(
    updateProfileSchema.safeParse({ contactEmail: '', phone: '', website: '' }).success,
    true,
  )
})

test('profile stores a bare domain as an https URL', () => {
  const parsed = updateProfileSchema.parse({ website: 'example.com' })

  assert.equal(parsed.website, 'https://example.com')
})

test('profile refuses script and data URLs', () => {
  for (const website of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'ftp://x.y']) {
    assert.equal(updateProfileSchema.safeParse({ website }).success, false, website)
  }
  assert.equal(updateProfileSchema.safeParse({ image: 'javascript:alert(1)' }).success, false)
})

test('profile refuses malformed formats and oversized text', () => {
  assert.equal(updateProfileSchema.safeParse({ contactEmail: 'not-an-email' }).success, false)
  assert.equal(updateProfileSchema.safeParse({ phone: 'call me maybe' }).success, false)
  assert.equal(updateProfileSchema.safeParse({ registrationNumber: '<script>' }).success, false)
  assert.equal(updateProfileSchema.safeParse({ displayName: 'x'.repeat(101) }).success, false)
  assert.equal(updateProfileSchema.safeParse({ about: 'x'.repeat(2001) }).success, false)
})

test('interests are limited in count and length', () => {
  const tooMany = Array.from({ length: 51 }, (_, i) => `interest-${i}`)

  assert.equal(updateInterestsSchema.safeParse({ interests: tooMany }).success, false)
  assert.equal(updateInterestsSchema.safeParse({ interests: ['x'.repeat(101)] }).success, false)
  assert.equal(updateInterestsSchema.safeParse({ interests: ['software'] }).success, true)
})
