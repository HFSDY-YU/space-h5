import { http, type AjaxResult } from '@/api/http'

export interface BackendNotice {
  noticeId?: number
  noticeTitle?: string
  noticeType?: string
  noticeContent?: string
  status?: string
  createBy?: string
  createTime?: string
  isRead?: boolean
}

type NoticeListResult = AjaxResult<BackendNotice[]> & {
  unreadCount?: number
}

export async function listTopNotices() {
  const result = await http.get<NoticeListResult>('/system/notice/listTop')
  return {
    rows: result.data ?? [],
    unreadCount: Number(result.unreadCount ?? 0),
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
