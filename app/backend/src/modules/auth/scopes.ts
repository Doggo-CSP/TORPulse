// Scope-based authorisation layered on top of the admin/user roles.
// A role grants a fixed set of scopes. Each route asks for the scope it needs, so a handler
// is protected by "what may this account do" rather than only "who is this account".

export type Role = 'admin' | 'user'

export const USER_SCOPES = [
  'profile:read',
  'profile:write',
  'bookmarks:read',
  'bookmarks:write',
  'qualification:read',
  'qualification:run',
] as const

export const ADMIN_SCOPES = [
  'stats:read',
  'users:read',
  'users:write',
  // Role and status changes (promote, demote, suspend, reactivate)
  'users:manage',
  'activity:read',
  'settings:read',
  'settings:write',
  'tors:read',
  'tors:write',
  'tors:delete',
  'categories:read',
  'categories:write',
  'ingestion:read',
  'ingestion:write',
] as const

export const SCOPES = [...USER_SCOPES, ...ADMIN_SCOPES] as const

export type Scope = (typeof SCOPES)[number]

export const ROLE_SCOPES: Readonly<Record<Role, readonly Scope[]>> = {
  user: USER_SCOPES,
  admin: SCOPES,
}

interface ScopedAccount {
  role?: Role
  status?: 'active' | 'suspended'
}

// Suspended accounts hold no scopes at all.
export const scopesFor = (account: ScopedAccount | undefined): Scope[] => {
  if (!account || account.status === 'suspended') {
    return []
  }

  return [...ROLE_SCOPES[account.role ?? 'user']]
}

export const missingScopes = (
  account: ScopedAccount | undefined,
  required: readonly Scope[],
): Scope[] => {
  const granted = new Set(scopesFor(account))
  return required.filter((scope) => !granted.has(scope))
}

export const hasScopes = (
  account: ScopedAccount | undefined,
  required: readonly Scope[],
): boolean => missingScopes(account, required).length === 0
