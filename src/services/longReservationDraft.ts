export type LongReservationMode = 'weekly' | 'daily' | 'custom'

export interface LongReservationTimeRange {
  id: string
  name?: string
  startTime: string
  endTime: string
}

export interface LongReservationRoomSnapshot {
  id: string
  code: string
  name: string
  building: string
  floor: string
  capacity: number
}

export interface LongReservationCustomDateSlot {
  date: string
  timeRanges: LongReservationTimeRange[]
}

export interface LongReservationRuleDraft {
  mode: LongReservationMode
  ruleType: string
  startDate: string
  endDate: string
  weekdays: string[]
  weekdayTimeRanges?: Record<string, LongReservationTimeRange[]>
  customDates: string[]
  customSlots?: LongReservationCustomDateSlot[]
  /**
   * 前端按当前时间过滤后的实际提交场次。
   * 例如长期每周预约从今天开始，但今天上午已过期时，只在这里剔除今天上午，
   * 规则 startDate/endDate 仍保留用户选择的原始范围。
   */
  resolvedSlots?: LongReservationCustomDateSlot[]
  timeRanges: LongReservationTimeRange[]
  dates: string[]
  slotCount: number
  ruleDesc: string
}

export interface LongReservationDraft extends LongReservationRuleDraft {
  room: LongReservationRoomSnapshot
}

export const LONG_RESERVATION_DRAFT_KEY = 'h5-long-reservation-draft'
export const LONG_RESERVATION_RULE_DRAFT_KEY = 'h5-long-reservation-rule-draft'

export const LONG_RESERVATION_MODE_LABELS: Record<LongReservationMode, string> = {
  weekly: '每周固定',
  daily: '每日固定',
  custom: '自定义批量',
}

// 后端长期规则表当前使用字符串枚举，H5 统一在这里转换，避免页面里散落魔法值。
export const LONG_RESERVATION_RULE_TYPES: Record<LongReservationMode, string> = {
  weekly: '0',
  daily: '1',
  custom: '2',
}

export function saveLongReservationRuleDraft(draft: LongReservationRuleDraft) {
  sessionStorage.setItem(LONG_RESERVATION_RULE_DRAFT_KEY, JSON.stringify(draft))
}

export function loadLongReservationRuleDraft(): LongReservationRuleDraft | null {
  const rawDraft = sessionStorage.getItem(LONG_RESERVATION_RULE_DRAFT_KEY)
  if (!rawDraft) return null

  try {
    const draft = JSON.parse(rawDraft) as Partial<LongReservationRuleDraft>
    if (!Array.isArray(draft.dates) || !Array.isArray(draft.timeRanges)) {
      return null
    }
    return draft as LongReservationRuleDraft
  } catch {
    return null
  }
}

export function clearLongReservationRuleDraft() {
  sessionStorage.removeItem(LONG_RESERVATION_RULE_DRAFT_KEY)
}

export function saveLongReservationDraft(draft: LongReservationDraft) {
  sessionStorage.setItem(LONG_RESERVATION_DRAFT_KEY, JSON.stringify(draft))
}

export function loadLongReservationDraft(): LongReservationDraft | null {
  const rawDraft = sessionStorage.getItem(LONG_RESERVATION_DRAFT_KEY)
  if (!rawDraft) return null

  try {
    const draft = JSON.parse(rawDraft) as Partial<LongReservationDraft>
    if (!draft.room || !Array.isArray(draft.dates) || !Array.isArray(draft.timeRanges)) {
      return null
    }
    return draft as LongReservationDraft
  } catch {
    return null
  }
}

export function clearLongReservationDraft() {
  sessionStorage.removeItem(LONG_RESERVATION_DRAFT_KEY)
}
