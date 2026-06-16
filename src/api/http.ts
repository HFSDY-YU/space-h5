import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { clearSessionStorage, TOKEN_STORAGE_KEY } from '@/api/storage'

export interface AjaxResult<T = unknown> {
  code: number
  msg: string
  data?: T
  token?: string
  [key: string]: unknown
}

export interface TableDataInfo<T> {
  code: number
  msg: string
  rows: T[]
  total: number
}

export interface PageParams {
  pageNum?: number
  pageSize?: number
  orderByColumn?: string
  isAsc?: 'ascending' | 'descending' | 'asc' | 'desc'
}

export class ApiError extends Error {
  code?: number
  status?: number

  constructor(message: string, options: { code?: number; status?: number } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = options.code
    this.status = options.status
  }
}

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/dev-api',
  timeout: 15000,
})

// 登录态过期时集中清理 H5 本地缓存，并回到登录页，避免各页面重复处理 401。
function redirectToLoginWhenExpired() {
  clearSessionStorage()

  if (typeof window === 'undefined') return

  const loginPath = `${import.meta.env.BASE_URL}login`
  if (!window.location.pathname.endsWith('/login')) {
    window.location.assign(loginPath)
  }
}

function isBusinessResponse(data: unknown): data is AjaxResult | TableDataInfo<unknown> {
  return Boolean(data && typeof data === 'object' && 'code' in data)
}

service.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)

  // RuoYi 后端统一使用 Authorization: Bearer <token>，这里集中注入，页面不直接处理 token。
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

service.interceptors.response.use(
  (response) => {
    const body = response.data

    // RuoYi 二进制下载或非标准返回不做业务码判断，直接交给调用方处理。
    if (!isBusinessResponse(body)) {
      return body
    }

    const code = Number(body.code)
    if (code === 200) {
      return body
    }

    if (code === 401) {
      redirectToLoginWhenExpired()
    }

    throw new ApiError(String(body.msg || '请求处理失败'), {
      code,
      status: response.status,
    })
  },
  (error: AxiosError<AjaxResult>) => {
    const status = error.response?.status
    const code = Number(error.response?.data?.code ?? status)
    const message = error.response?.data?.msg || error.message || '后端服务连接失败'

    if (code === 401 || status === 401) {
      redirectToLoginWhenExpired()
    }

    throw new ApiError(message, { code, status })
  },
)

export const http = {
  get<T>(url: string, config?: AxiosRequestConfig) {
    return service.get<unknown, T>(url, config)
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return service.post<unknown, T>(url, data, config)
  },
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return service.put<unknown, T>(url, data, config)
  },
  delete<T>(url: string, config?: AxiosRequestConfig) {
    return service.delete<unknown, T>(url, config)
  },
}

export function unwrapAjaxData<T>(result: AjaxResult<T>) {
  return result.data as T
}
