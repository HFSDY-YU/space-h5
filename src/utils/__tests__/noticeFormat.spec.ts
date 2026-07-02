import { describe, expect, it } from 'vitest'
import { stripNoticeHtml, toNoticeMessage } from '@/utils/noticeFormat'

describe('stripNoticeHtml', () => {
  it('去除标签与 &nbsp;', () => {
    expect(stripNoticeHtml('<p>你好&nbsp;世界</p>')).toBe('你好 世界')
  })

  it('默认不保留换行', () => {
    expect(stripNoticeHtml('第一行<br/>第二行')).toBe('第一行第二行')
  })

  it('preserveLineBreaks 时把 <br>/</p> 转成换行', () => {
    expect(stripNoticeHtml('第一行<br/>第二行', true)).toBe('第一行\n第二行')
    expect(stripNoticeHtml('<p>段一</p><p>段二</p>', true)).toBe('段一\n段二')
  })

  it('空值安全', () => {
    expect(stripNoticeHtml(undefined)).toBe('')
  })
})

describe('toNoticeMessage', () => {
  it('列表版：正文兜底与已读映射', () => {
    const msg = toNoticeMessage({ noticeId: 5, noticeTitle: '标题', noticeType: '2', isRead: true })
    expect(msg.id).toBe('5')
    expect(msg.title).toBe('标题')
    expect(msg.content).toBe('点击查看通知详情')
    expect(msg.unread).toBe(false)
    expect(msg.type).toBe('system')
  })

  it('详情版：不同兜底文案与未读', () => {
    const msg = toNoticeMessage({ noticeId: 6, noticeType: '1', isRead: false }, { detail: true })
    expect(msg.content).toBe('暂无通知内容')
    expect(msg.unread).toBe(true)
    expect(msg.type).toBe('reservation')
  })

  it('缺标题时兜底为“通知”', () => {
    expect(toNoticeMessage({ noticeId: 7 }).title).toBe('通知')
  })
})
