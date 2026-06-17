import { http, type AjaxResult } from '@/api/http'

export interface LoginPayload {
  username: string
  password: string
  code?: string
  uuid?: string
}

export interface CaptchaImageResponse extends AjaxResult {
  captchaEnabled?: boolean
  img?: string
  uuid?: string
}

export interface LoginResponse extends AjaxResult {
  token: string
}

export interface BackendRole {
  roleKey?: string
  roleName?: string
}

export interface BackendDept {
  deptId?: number
  deptName?: string
}

export interface BackendUser {
  userId?: number
  userName?: string
  nickName?: string
  phonenumber?: string
  email?: string
  sex?: string
  admin?: boolean
  dept?: BackendDept
  roles?: BackendRole[]
}

export interface ProfileResponse extends AjaxResult<BackendUser> {
  roleGroup?: string
  postGroup?: string
}

export interface UserInfoResponse extends AjaxResult {
  user?: BackendUser
  roles?: string[]
  permissions?: string[]
  isDefaultModifyPwd?: boolean
  isPasswordExpired?: boolean
}

export interface PasswordResetConfig {
  contactTypes?: string[]
  passwordMinLength?: number
  passwordMaxLength?: number
  codeExpirationMinutes?: number
  resendIntervalSeconds?: number
}

export interface PasswordResetCodePayload {
  username: string
  contactType: 'email'
  contact: string
  code?: string
  uuid?: string
}

export interface PasswordResetPayload {
  username: string
  contactType: 'email'
  contact: string
  verifyCode: string
  newPassword: string
}

export function getCaptchaImage() {
  return http.get<CaptchaImageResponse>('/captchaImage')
}

export function login(payload: LoginPayload) {
  return http.post<LoginResponse>('/login', payload)
}

export function getInfo() {
  return http.get<UserInfoResponse>('/getInfo')
}

export function getProfile() {
  return http.get<ProfileResponse>('/system/user/profile')
}

export function updatePassword(payload: { oldPassword: string; newPassword: string }) {
  return http.put<AjaxResult>('/system/user/profile/updatePwd', payload)
}

export function getPasswordResetConfig() {
  return http.get<AjaxResult<PasswordResetConfig>>('/password/reset/config')
}

export function sendPasswordResetCode(payload: PasswordResetCodePayload) {
  return http.post<AjaxResult<string>>('/password/reset/code', payload)
}

export function resetLoginPassword(payload: PasswordResetPayload) {
  return http.post<AjaxResult<string>>('/password/reset', payload)
}

export function logout() {
  return http.post<AjaxResult>('/logout')
}
