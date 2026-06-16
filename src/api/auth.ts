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

export function logout() {
  return http.post<AjaxResult>('/logout')
}
