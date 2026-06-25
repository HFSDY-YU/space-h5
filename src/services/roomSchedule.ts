import { formatBackendTime, timeToMinutes, toRoomStatus } from '@/services/spaceMapper'
import type { BackendReservationItem } from '@/api/space'
import type { RoomStatus, TimePeriod } from '@/types/space'

// 房间详情周时间轴用到的领域类型与无状态纯函数。从 RoomDetailView 抽出，便于复用与单测；
// 依赖响应式状态（选段、当前周、过期截断）的逻辑仍留在视图里。

export type WeekCellStatus = RoomStatus | 'expired'
export type TimelineSegmentStatus = Exclude<RoomStatus, 'free'> | 'expired'

export interface WeekCell {
  slotIndex: number
  date: string
  period: TimePeriod
  status: WeekCellStatus
  summary: string
  applicantName: string
  startTime: string
  endTime: string
  reservationId?: string
  itemId?: string
}

export interface WeekTimelineSegment {
  id: string
  date: string
  status: TimelineSegmentStatus
  sourceStatus: Exclude<RoomStatus, 'free'>
  title: string
  label: string
  applicantName: string
  applicantPhone: string
  contactAddress: string
  contactText: string
  startTime: string
  endTime: string
  left: number
  width: number
  reservationId?: string
  itemId?: string
}

export interface WeekDayPanel {
  date: Date
  value: string
  monthDay: string
  weekday: string
  isToday: boolean
  cells: WeekCell[]
  segments: WeekTimelineSegment[]
  expiredPercent: number
  availableText: string
}

export interface AgendaTimeTick {
  key: string
  time: string
  top: number
}

export interface SelectedTimeRange {
  key: string
  date: string
  periodId: string
  startTime: string
  endTime: string
  cells: WeekCell[]
}

export function startOfWeek(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  const day = nextDate.getDay()
  nextDate.setDate(nextDate.getDate() + (day === 0 ? -6 : 1 - day))
  return nextDate
}

export function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function statusText(status: RoomStatus) {
  if (status === 'free') return '空闲'
  if (status === 'reviewing') return '审核中'
  return '占用'
}

export function weekCellStatusText(status: WeekCellStatus) {
  if (status === 'expired') return '已过期'
  return statusText(status)
}

export function segmentStatusText(status: TimelineSegmentStatus) {
  if (status === 'expired') return '已过期'
  return statusText(status)
}

export function normalizeDisplayText(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

export function buildSegmentContactText(item: BackendReservationItem) {
  const contactParts: string[] = []
  const applicantPhone = normalizeDisplayText(item.applicantPhone)
  const contactAddress = normalizeDisplayText(item.orgName)

  // 后端场次列表会合并主预约的申请人快照；这里统一压缩成一行联系信息，避免 30 分钟日程块被撑高。
  if (applicantPhone) contactParts.push(`联系 ${applicantPhone}`)
  if (contactAddress) contactParts.push(contactAddress)
  return contactParts.join(' · ')
}

export function roomOpenStatusText(status?: string) {
  return status === '1' ? '已停用' : '启用中'
}

export function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

export function getPeriodStart(period: TimePeriod) {
  return formatBackendTime(period.startTime || period.time.split('-')[0])
}

export function getPeriodEnd(period: TimePeriod) {
  return formatBackendTime(period.endTime || period.time.split('-')[1])
}

export function isOverlappingTimeRange(startTime: string, endTime: string, period: TimePeriod) {
  const itemStart = timeToMinutes(startTime)
  const itemEnd = timeToMinutes(endTime)
  const periodStart = timeToMinutes(getPeriodStart(period))
  const periodEnd = timeToMinutes(getPeriodEnd(period))
  return itemStart < periodEnd && itemEnd > periodStart
}

export function pickPeriodItem(items: BackendReservationItem[], period: TimePeriod) {
  const matchedItems = items.filter((item) => {
    const status = toRoomStatus(item.itemStatus)
    if (!status || status === 'free') return false
    const startTime = formatBackendTime(item.startTime)
    const endTime = formatBackendTime(item.endTime)
    return startTime && endTime && isOverlappingTimeRange(startTime, endTime, period)
  })

  return (
    matchedItems.find((item) => toRoomStatus(item.itemStatus) === 'reviewing') ??
    matchedItems.find((item) => toRoomStatus(item.itemStatus) === 'occupied')
  )
}
