import { http, type AjaxResult } from '@/api/http'

type NoticeReadFlag = boolean | number | string

export interface BackendNotice {
  noticeId?: number
  noticeTitle?: string
  noticeType?: string
  noticeContent?: string
  status?: string
  createBy?: string
  createTime?: string
  isRead?: NoticeReadFlag
  read?: NoticeReadFlag
}

type NoticeListResult = AjaxResult<BackendNotice[]> & {
  unreadCount?: number
}

export interface NoticeListData {
  rows: BackendNotice[]
  unreadCount: number
}

export const NOTICE_QUERY_KEY = ['h5-notices'] as const

function normalizeReadFlag(value: NoticeReadFlag | undefined) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  return false
}

export function isNoticeRead(notice: BackendNotice) {
  return normalizeReadFlag(notice.isRead ?? notice.read)
}

export function isNoticeUnread(notice: BackendNotice) {
  return !isNoticeRead(notice)
}

export async function listTopNotices(): Promise<NoticeListData> {
  const result = await http.get<NoticeListResult>('/system/notice/listTop')
  const rows = result.data ?? []
  const unreadCount = Number(result.unreadCount)

  return {
    rows,
    unreadCount: Number.isFinite(unreadCount) ? unreadCount : rows.filter(isNoticeUnread).length,
  }
}

export async function getNotice(noticeId: string | number) {
  const result = await http.get<AjaxResult<BackendNotice>>(`/system/notice/${noticeId}`)
  return result.data
}

export function markNoticeRead(noticeId: string | number) {
  return http.post<AjaxResult>('/system/notice/markRead', undefined, {
    params: { noticeId },
  })
}

export function markNoticesReadAll(noticeIds: Array<string | number>) {
  return http.post<AjaxResult>('/system/notice/markReadAll', undefined, {
    params: { ids: noticeIds.join(',') },
  })
}
