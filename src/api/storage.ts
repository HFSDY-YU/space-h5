import type { UserRole } from '@/types/space'

export const TOKEN_STORAGE_KEY = 'space-h5-token'
export const ROLE_STORAGE_KEY = 'space-h5-role'
export const USER_STORAGE_KEY = 'space-h5-user'
export const ROLES_STORAGE_KEY = 'space-h5-roles'
export const PERMISSIONS_STORAGE_KEY = 'space-h5-permissions'
export const MUST_CHANGE_PASSWORD_STORAGE_KEY = 'space-h5-must-change-password'
export const PASSWORD_EXPIRED_STORAGE_KEY = 'space-h5-password-expired'
export const PASSWORD_CHAR_TYPE_STORAGE_KEY = 'space-h5-password-char-type'

export function readJsonStorage<T>(key: string, fallback: T): T {
  const rawValue = localStorage.getItem(key)
  if (!rawValue) return fallback

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

export function writeJsonStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function readRoleStorage(fallback: UserRole = 'student') {
  const storedRole = localStorage.getItem(ROLE_STORAGE_KEY)
  return storedRole === 'admin' || storedRole === 'property' || storedRole === 'teacher' || storedRole === 'student'
    ? storedRole
    : fallback
}

export function clearSessionStorage() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(ROLE_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
  localStorage.removeItem(ROLES_STORAGE_KEY)
  localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
  localStorage.removeItem(MUST_CHANGE_PASSWORD_STORAGE_KEY)
  localStorage.removeItem(PASSWORD_EXPIRED_STORAGE_KEY)
  localStorage.removeItem(PASSWORD_CHAR_TYPE_STORAGE_KEY)
}
