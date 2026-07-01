import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getProfile,
  getInfo,
  login as loginByPassword,
  logout as logoutApi,
  onecardLogin as onecardLoginApi,
  type BackendUser,
  type LoginPayload,
} from '@/api/auth'
import {
  clearSessionStorage,
  INITIAL_PASSWORD_UNSET_STORAGE_KEY,
  PERMISSIONS_STORAGE_KEY,
  MUST_CHANGE_PASSWORD_STORAGE_KEY,
  PASSWORD_CHAR_TYPE_STORAGE_KEY,
  PASSWORD_EXPIRED_STORAGE_KEY,
  readJsonStorage,
  readRoleStorage,
  ROLE_STORAGE_KEY,
  ROLES_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  writeJsonStorage,
} from '@/api/storage'
import type { UserRole } from '@/types/space'

const roleLabels: Record<UserRole, string> = {
  student: '学生',
  teacher: '老师',
  property: '物业',
  admin: '管理员',
}

interface SessionUser {
  userId?: number
  userName: string
  nickName: string
  phone?: string
  email?: string
  deptName?: string
}

function normalizeTextList(values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ').toLowerCase()
}

function deriveRole(user: BackendUser | undefined, roles: string[], permissions: string[]): UserRole {
  const roleText = normalizeTextList([
    ...roles,
    ...(user?.roles ?? []).map((role) => role.roleKey),
    ...(user?.roles ?? []).map((role) => role.roleName),
  ])
  const permissionText = permissions.join(' ').toLowerCase()

  if (user?.admin || roleText.includes('admin')) {
    return 'admin'
  }

  if (roleText.includes('space_property') || roleText.includes('property') || roleText.includes('物业')) {
    return 'property'
  }

  if (
    roleText.includes('space_teacher') ||
    roleText.includes('teacher') ||
    roleText.includes('老师') ||
    roleText.includes('教师') ||
    permissionText.includes('space:audit:')
  ) {
    return 'teacher'
  }

  return 'student'
}

function toSessionUser(user: BackendUser | undefined): SessionUser {
  return {
    userId: user?.userId,
    userName: user?.userName || '',
    nickName: user?.nickName || user?.userName || '',
    phone: user?.phonenumber,
    email: user?.email,
    deptName: user?.dept?.deptName,
  }
}

export const useSessionStore = defineStore('session', () => {
  const role = ref<UserRole>(readRoleStorage())
  const token = ref(localStorage.getItem(TOKEN_STORAGE_KEY) ?? '')
  const user = ref<SessionUser>(readJsonStorage(USER_STORAGE_KEY, toSessionUser(undefined)))
  const roles = ref<string[]>(readJsonStorage(ROLES_STORAGE_KEY, []))
  const permissions = ref<string[]>(readJsonStorage(PERMISSIONS_STORAGE_KEY, []))
  const mustChangePassword = ref(localStorage.getItem(MUST_CHANGE_PASSWORD_STORAGE_KEY) === '1')
  const passwordExpired = ref(localStorage.getItem(PASSWORD_EXPIRED_STORAGE_KEY) === '1')
  const passwordCharType = ref(localStorage.getItem(PASSWORD_CHAR_TYPE_STORAGE_KEY) || '0')
  const initialPasswordUnset = ref(localStorage.getItem(INITIAL_PASSWORD_UNSET_STORAGE_KEY) === '1')

  const userName = computed(() => {
    if (user.value.nickName) return user.value.nickName
    if (user.value.userName) return user.value.userName
    if (role.value === 'admin') return '澳琴管理员'
    if (role.value === 'property') return '物业审核员'
    if (role.value === 'teacher') return '陈老师'
    return '李同学'
  })

  const roleLabel = computed(() => roleLabels[role.value])
  const isStudent = computed(() => role.value === 'student')
  const isTeacher = computed(() => role.value === 'teacher')
  const isProperty = computed(() => role.value === 'property')
  const isAdmin = computed(() => role.value === 'admin')
  const isLoggedIn = computed(() => Boolean(token.value))
  const hasAllPermissions = computed(() => permissions.value.includes('*:*:*'))
  const isSpaceUser = computed(
    () => role.value === 'student' || role.value === 'teacher' || role.value === 'property' || role.value === 'admin',
  )
  const canReserve = computed(
    () => hasAllPermissions.value || permissions.value.includes('space:reservation:add') || isSpaceUser.value,
  )
  const canViewMyReservations = computed(
    () => hasAllPermissions.value || permissions.value.includes('space:reservation:mine') || isSpaceUser.value,
  )
  const canAudit = computed(
    () =>
      hasAllPermissions.value ||
      permissions.value.includes('space:audit:list') ||
      permissions.value.some((permission) => permission.startsWith('space:audit:')) ||
      role.value === 'teacher' ||
      role.value === 'property',
  )
  const canManageRooms = computed(
    () =>
      hasAllPermissions.value ||
      permissions.value.includes('space:room:list') ||
      role.value === 'admin' ||
      role.value === 'property',
  )
  const canViewReviewingSlots = computed(
    () =>
      hasAllPermissions.value ||
      permissions.value.includes('space:reservationItem:list') ||
      permissions.value.includes('space:audit:list') ||
      role.value === 'teacher' ||
      role.value === 'property',
  )

  function setRole(nextRole: UserRole) {
    role.value = nextRole
    localStorage.setItem(ROLE_STORAGE_KEY, nextRole)
  }

  function setPasswordSecurityState(options: {
    mustChange?: boolean
    expired?: boolean
    charType?: string | number
    initialUnset?: boolean
  }) {
    // 后端 getInfo 返回的安全状态会同时被路由守卫和修改密码页使用，集中保存避免刷新后丢失。
    if (typeof options.mustChange === 'boolean') {
      mustChangePassword.value = options.mustChange
      localStorage.setItem(MUST_CHANGE_PASSWORD_STORAGE_KEY, options.mustChange ? '1' : '0')
    }

    if (typeof options.expired === 'boolean') {
      passwordExpired.value = options.expired
      localStorage.setItem(PASSWORD_EXPIRED_STORAGE_KEY, options.expired ? '1' : '0')
    }

    if (options.charType !== undefined) {
      passwordCharType.value = String(options.charType || '0')
      localStorage.setItem(PASSWORD_CHAR_TYPE_STORAGE_KEY, passwordCharType.value)
    }

    if (typeof options.initialUnset === 'boolean') {
      initialPasswordUnset.value = options.initialUnset
      localStorage.setItem(INITIAL_PASSWORD_UNSET_STORAGE_KEY, options.initialUnset ? '1' : '0')
    }
  }

  async function refreshProfile() {
    const info = await getInfo()
    let profilePwdSet: number | undefined
    try {
      const profile = await getProfile()
      profilePwdSet = typeof profile.pwdSet === 'number' ? profile.pwdSet : undefined
    } catch {
      // pwdSet 只影响一卡通首次设置登录密码；读取失败时保留 getInfo 的强制改密流程。
    }
    const nextUser = toSessionUser(info.user)
    const nextRoles = info.roles ?? []
    const nextPermissions = info.permissions ?? []
    const nextRole = deriveRole(info.user, nextRoles, nextPermissions)

    user.value = nextUser
    roles.value = nextRoles
    permissions.value = nextPermissions
    setRole(nextRole)
    setPasswordSecurityState({
      mustChange: Boolean(info.isDefaultModifyPwd),
      expired: Boolean(info.isPasswordExpired),
      charType: info.pwdChrtype,
      initialUnset: profilePwdSet === undefined ? undefined : profilePwdSet === 0,
    })
    writeJsonStorage(USER_STORAGE_KEY, nextUser)
    writeJsonStorage(ROLES_STORAGE_KEY, nextRoles)
    writeJsonStorage(PERMISSIONS_STORAGE_KEY, nextPermissions)
  }

  async function login(payload: LoginPayload) {
    const result = await loginByPassword(payload)

    token.value = result.token
    localStorage.setItem(TOKEN_STORAGE_KEY, result.token)

    try {
      await refreshProfile()
    } catch (error) {
      clearSessionStorage()
      token.value = ''
      throw error
    }
  }

  async function onecardLogin(p: string) {
    const result = await onecardLoginApi({ p })

    // 一卡通登录和账号密码登录最终都依赖后端 token，拿到 token 后统一刷新账号、角色和强制改密状态。
    token.value = result.token
    localStorage.setItem(TOKEN_STORAGE_KEY, result.token)

    try {
      await refreshProfile()
    } catch (error) {
      clearSessionStorage()
      token.value = ''
      throw error
    }
  }

  async function logout() {
    if (token.value) {
      try {
        await logoutApi()
      } catch {
        // 登出接口失败时仍清理本地状态，避免用户被卡在失效 token 中。
      }
    }

    token.value = ''
    user.value = toSessionUser(undefined)
    roles.value = []
    permissions.value = []
    mustChangePassword.value = false
    passwordExpired.value = false
    passwordCharType.value = '0'
    initialPasswordUnset.value = false
    clearSessionStorage()
  }

  return {
    role,
    token,
    user,
    roles,
    permissions,
    mustChangePassword,
    passwordExpired,
    passwordCharType,
    initialPasswordUnset,
    userName,
    roleLabel,
    isStudent,
    isTeacher,
    isProperty,
    isAdmin,
    isLoggedIn,
    hasAllPermissions,
    isSpaceUser,
    canReserve,
    canViewMyReservations,
    canAudit,
    canManageRooms,
    canViewReviewingSlots,
    setRole,
    setPasswordSecurityState,
    refreshProfile,
    login,
    onecardLogin,
    logout,
  }
})
