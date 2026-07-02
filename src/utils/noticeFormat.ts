import { isNoticeUnread, type BackendNotice } from '@/api/notice'
import type { MessageItem } from '@/types/space'

// 通知文本/时间格式化工具。原先散落在 MessagesView / MessageDetailView 各一份，
// 列表版与详情版在“是否保留换行、时间粒度、正文兜底文案”上有意不同，这里用参数统一。

// 去除公告 HTML 标签。detail=true 时把 <br>/</p> 转成换行，用于详情页多段展示。
export function stripNoticeHtml(value: string | undefined, preserveLineBreaks = false) {
  let text = value ?? ''
  if (preserveLineBreaks) {
    text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
  }
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

// 列表版时间：今天显示 HH:mm，昨天显示“昨天”，更早显示 M/D。
export function formatNoticeListTime(value?: string) {
  if (!value) return ''
  const date = new Date(value.replace(/-/g, '/'))
  if (Number.isNaN(date.getTime())) return value

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isYesterday) return '昨天'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 详情版时间：完整 YYYY-MM-DD HH:mm。
export function formatNoticeDetailTime(value?: string) {
  if (!value) return ''
  const date = new Date(value.replace(/-/g, '/'))
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// 后端公告 -> UI 消息项。detail 区分列表页/详情页的换行、时间粒度与正文兜底文案。
export function toNoticeMessage(notice: BackendNotice, options: { detail?: boolean } = {}): MessageItem {
  const detail = options.detail ?? false
  return {
    id: String(notice.noticeId ?? ''),
    title: notice.noticeTitle || '通知',
    content:
      stripNoticeHtml(notice.noticeContent, detail) || (detail ? '暂无通知内容' : '点击查看通知详情'),
    time: detail ? formatNoticeDetailTime(notice.createTime) : formatNoticeListTime(notice.createTime),
    unread: isNoticeUnread(notice),
    type: notice.noticeType === '2' ? 'system' : 'reservation',
  }
}
