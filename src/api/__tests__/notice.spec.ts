import { describe, expect, it } from 'vitest'
import { isNoticeRead, isNoticeUnread, type BackendNotice } from '@/api/notice'

// isNoticeRead 需容忍后端可能返回 boolean / number / string 形态的已读标记。
describe('isNoticeRead / isNoticeUnread', () => {
  const cases: Array<{ label: string; notice: BackendNotice; read: boolean }> = [
    { label: 'boolean true', notice: { isRead: true }, read: true },
    { label: 'boolean false', notice: { isRead: false }, read: false },
    { label: 'number 1', notice: { isRead: 1 }, read: true },
    { label: 'number 0', notice: { isRead: 0 }, read: false },
    { label: 'string "1"', notice: { isRead: '1' }, read: true },
    { label: 'string "true"', notice: { isRead: 'true' }, read: true },
    { label: 'string "0"', notice: { isRead: '0' }, read: false },
    { label: 'string "false"', notice: { isRead: 'false' }, read: false },
    { label: 'undefined -> 未读', notice: {}, read: false },
    { label: 'fallback read 字段', notice: { read: true }, read: true },
  ]

  it.each(cases)('$label', ({ notice, read }) => {
    expect(isNoticeRead(notice)).toBe(read)
    expect(isNoticeUnread(notice)).toBe(!read)
  })
})
