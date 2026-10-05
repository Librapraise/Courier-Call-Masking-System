/**
 * Role-Based Access Control (RBAC) helpers
 * Centralized logic for Super Admin and Staff validation.
 * Reads root owner email from environment variable instead of hardcoding.
 */

export const ROOT_SUPER_ADMIN_EMAIL =
  process.env.ROOT_SUPER_ADMIN_EMAIL ||
  process.env.NEXT_PUBLIC_ROOT_SUPER_ADMIN_EMAIL ||
  ''

export function isSuperAdminUser(
  user: { email?: string | null; user_metadata?: Record<string, any> | null } | null | undefined,
  profile?: { role?: string | null } | null
): boolean {
  if (!user) return false
  if (ROOT_SUPER_ADMIN_EMAIL && user.email && user.email.toLowerCase() === ROOT_SUPER_ADMIN_EMAIL.toLowerCase()) {
    return true
  }
  const meta = user.user_metadata || {}
  const profileRole = profile?.role
  return (
    meta.role === 'super_admin' ||
    meta.is_super_admin === true ||
    profileRole === 'super_admin'
  )
}

export function isStaffUser(
  user: { email?: string | null; user_metadata?: Record<string, any> | null } | null | undefined,
  profile?: { role?: string | null } | null
): boolean {
  if (isSuperAdminUser(user, profile)) return true
  const role = profile?.role || user?.user_metadata?.role
  return role === 'admin' || role === 'super_admin' || role === 'warehouseman'
}
