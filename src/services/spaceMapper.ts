import type {
  BackendReservation,
  BackendReservationItem,
  BackendSpaceRoom,
  BackendTimePeriod,
} from '@/api/space'
import type { Reservation, ReservationStatus, Room, RoomSlot, RoomStatus, TimePeriod } from '@/types/space'

const WEEKDAY_TEXT = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
export const BOOKABLE_START_TIME = '08:30'
export const BOOKABLE_END_TIME = '22:30'
export const BOOKABLE_SLOT_MINUTES = 30

export function formatDateValue(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateCn(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatWeekday(date: Date) {
  return WEEKDAY_TEXT[date.getDay()] ?? ''
}

export function formatWeekdayValue(date: Date) {
  // 后端 space_reservation_item.weekday 是 char(1)：0周日、1周一 ... 6周六。
  return String(date.getDay())
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

export function formatBackendTime(time?: string) {
  if (!time) return ''
  return time.slice(0, 5)
}

export function timeToMinutes(time?: string) {
  const normalizedTime = formatBackendTime(time)
  const [hourText = '0', minuteText = '0'] = normalizedTime.split(':')
  return Number(hourText) * 60 + Number(minuteText)
}

export function minutesToTime(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// 后端限定预约时间为 08:30-22:30，且开始/结束时间都必须落在 30 分钟格点上。
export function buildBookableTimePoints() {
  const points: string[] = []
  const start = timeToMinutes(BOOKABLE_START_TIME)
  const end = timeToMinutes(BOOKABLE_END_TIME)
  for (let minute = start; minute <= end; minute += BOOKABLE_SLOT_MINUTES) {
    points.push(minutesToTime(minute))
  }
  return points
}

export function buildBookableTimeSlots() {
  const points = buildBookableTimePoints()
  return points.slice(0, -1).map((startTime, index) => ({
    id: `${startTime}-${points[index + 1]}`,
    name: startTime,
    time: `${startTime}-${points[index + 1]}`,
    startTime,
    endTime: points[index + 1],
    orderNum: index + 1,
  }))
}

export function isAlignedBookableRange(startTime?: string, endTime?: string) {
  const points = buildBookableTimePoints()
  const normalizedStart = formatBackendTime(startTime)
  const normalizedEnd = formatBackendTime(endTime)
  return (
    points.includes(normalizedStart) &&
    points.includes(normalizedEnd) &&
    timeToMinutes(normalizedStart) < timeToMinutes(normalizedEnd)
  )
}

export function toUiTimePeriod(period: BackendTimePeriod): TimePeriod {
  const id = String(period.periodId ?? period.periodCode ?? '')
  return {
    id,
    name: period.periodName || period.periodCode || '时段',
    time: `${formatBackendTime(period.startTime)}-${formatBackendTime(period.endTime)}`,
    startTime: period.startTime || '',
    endTime: period.endTime || '',
    orderNum: period.orderNum ?? 0,
  }
}

/**
 * 判断预约人数是否超过房间最大容量。后端仅在房间设置了正数 capacityMax 且人数超过时才拦截，
 * 此处与后端口径保持一致，用于提交前提示用户确认是否仍然超额提交。
 */
export function isCapacityOverflow(peopleCount: number, capacityMax?: number | null) {
  const max = Number(capacityMax)
  return !Number.isNaN(max) && max > 0 && Number(peopleCount) > max
}

export function sortBackendTimePeriods(periods: BackendTimePeriod[]) {
  return [...periods].sort((prev, next) => {
    const orderDiff = (prev.orderNum ?? Number.MAX_SAFE_INTEGER) - (next.orderNum ?? Number.MAX_SAFE_INTEGER)
    if (orderDiff !== 0) return orderDiff
    return Number(prev.periodId ?? 0) - Number(next.periodId ?? 0)
  })
}

export function toUiRoomBase(room: BackendSpaceRoom): Omit<Room, 'slots'> {
  const capacity = room.capacityMax ?? room.capacityMin ?? (parseInt(room.capacityDesc || '0', 10) || 0)
  // 后端设备说明是中文顿号或逗号分隔的展示字段，移动端统一转换为标签数组。
  const equipment = (room.equipmentDesc || '')
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    id: String(room.roomId ?? room.roomCode ?? ''),
    code: room.roomCode || String(room.roomId ?? ''),
    name: room.roomName || room.roomCode || '未命名房间',
    type: room.roomType || '空间',
    building: room.buildingName || '',
    floor: room.floorNo || '',
    location: room.locationDesc || [room.buildingName, room.floorNo].filter(Boolean).join(' '),
    capacity,
    capacityText: room.capacityDesc || (capacity ? `${capacity}人` : ''),
    capacityMin: room.capacityMin,
    capacityMax: room.capacityMax,
    imageUrl: room.imageUrl || '',
    equipment,
  }
}

export function resolveSpaceAssetUrl(url?: string) {
  const assetUrl = (url || '').trim()
  if (!assetUrl) return ''
  if (/^(https?:)?\/\//.test(assetUrl) || assetUrl.startsWith('data:') || assetUrl.startsWith('blob:')) {
    return assetUrl
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/dev-api'
  const normalizedUrl = assetUrl.startsWith('/') ? assetUrl : `/${assetUrl}`
  if (baseUrl && normalizedUrl.startsWith(baseUrl)) return normalizedUrl
  return `${String(baseUrl).replace(/\/$/, '')}${normalizedUrl}`
}

export function toRoomStatus(itemStatus?: string): RoomStatus | undefined {
  // 首页占用矩阵只允许三种状态：无场次为空闲，待审核/冲突为审核中，通过/结束为占用。
  if (itemStatus === '1' || itemStatus === '4' || itemStatus === '7') return 'reviewing'
  if (itemStatus === '2' || itemStatus === '6') return 'occupied'
  return undefined
}

export function toReservationStatus(status?: string): ReservationStatus {
  if (status === '1') return 'pending'
  if (status === '2') return 'approved'
  if (status === '3') return 'partial'
  if (status === '4') return 'rejected'
  if (status === '5') return 'cancelled'
  if (status === '6') return 'finished'
  if (status === '7') return 'returned'
  return 'pending'
}

export function toItemReservationStatus(status?: string): ReservationStatus {
  if (status === '1' || status === '4') return 'pending'
  if (status === '2') return 'approved'
  if (status === '3') return 'rejected'
  if (status === '5') return 'cancelled'
  if (status === '6') return 'finished'
  if (status === '7') return 'returned'
  return 'pending'
}

function isOverlapping(item: BackendReservationItem, period: TimePeriod) {
  const itemStart = timeToMinutes(item.startTime)
  const itemEnd = timeToMinutes(item.endTime)
  const periodStart = timeToMinutes(period.startTime)
  const periodEnd = timeToMinutes(period.endTime)

  return itemStart < periodEnd && itemEnd > periodStart
}

function pickSlotItem(items: BackendReservationItem[], roomId: string, period: TimePeriod) {
  const matchedItems = items.filter((item) => String(item.roomId ?? '') === roomId && isOverlapping(item, period))
  // 同一时段同时存在不同状态时，优先提示审核中，方便管理员和申请人看到仍会占用审批资源的场次。
  return (
    matchedItems.find((item) => toRoomStatus(item.itemStatus) === 'reviewing') ??
    matchedItems.find((item) => toRoomStatus(item.itemStatus) === 'occupied')
  )
}

export function buildRoomSlots(room: BackendSpaceRoom, periods: TimePeriod[], items: BackendReservationItem[]) {
  const roomId = String(room.roomId ?? room.roomCode ?? '')

  return periods.map<RoomSlot>((period) => {
    const item = pickSlotItem(items, roomId, period)
    const status = toRoomStatus(item?.itemStatus) ?? 'free'

    return {
      periodId: period.id,
      status,
      summary: item?.title || (status === 'free' ? '可预约' : status === 'reviewing' ? '申请审核中' : '已占用'),
      reservationId: item?.reservationId ? String(item.reservationId) : undefined,
      itemId: item?.itemId ? String(item.itemId) : undefined,
      startTime: item?.startTime ? formatBackendTime(item.startTime) : period.startTime,
      endTime: item?.endTime ? formatBackendTime(item.endTime) : period.endTime,
    }
  })
}

export function buildRoomsWithSlots(
  rooms: BackendSpaceRoom[],
  periods: TimePeriod[],
  items: BackendReservationItem[],
) {
  return rooms.map<Room>((room) => ({
    ...toUiRoomBase(room),
    slots: buildRoomSlots(room, periods, items),
  }))
}

export function toUiReservation(reservation: BackendReservation): Reservation {
  const items = reservation.items ?? []
  const firstItem = items[0]
  const reservationId = String(reservation.reservationId ?? '')

  return {
    id: reservationId,
    title: reservation.title || '未命名预约',
    applicant: reservation.applicantName || '',
    applicantRole: reservation.applicantRole || '',
    applicantPhone: reservation.applicantPhone || firstItem?.applicantPhone || '',
    roomId: String(reservation.roomId ?? firstItem?.roomId ?? ''),
    roomName: reservation.roomName || firstItem?.roomName || '',
    date:
      reservation.dateRangeText ||
      firstItem?.bookingDate ||
      reservation.bookingDateStart ||
      reservation.submitTime?.slice(0, 10) ||
      '',
    time:
      reservation.timeRangeText ||
      (firstItem ? `${formatBackendTime(firstItem.startTime)}-${formatBackendTime(firstItem.endTime)}` : ''),
    type: reservation.reservationType === '1' ? 'long' : 'single',
    status: toReservationStatus(reservation.status),
    auditType: reservation.auditType,
    auditStage: reservation.auditStage,
    auditStageText: toAuditStageText(resolveReservationAuditStage(reservation), reservation.auditType),
    people: reservation.peopleCount ?? 0,
    purpose: reservation.purpose || '',
    remark: reservation.detailRemark || '',
    submittedAt: reservation.submitTime || '',
    auditOpinion: reservation.rejectReason || undefined,
    sessions: items.map((item) => ({
      id: String(item.itemId ?? ''),
      reservationId: String(item.reservationId ?? reservation.reservationId ?? ''),
      roomId: String(item.roomId ?? reservation.roomId ?? ''),
      roomCode: item.roomCode || '',
      roomName: item.roomName || reservation.roomName || '',
      date: item.bookingDate || '',
      weekday: item.weekday || '',
      startTime: formatBackendTime(item.startTime),
      endTime: formatBackendTime(item.endTime),
      time: `${formatBackendTime(item.startTime)}-${formatBackendTime(item.endTime)}`,
      status: toItemReservationStatus(item.itemStatus),
      itemStatus: item.itemStatus,
      auditStage: item.auditStage,
      effectiveAuditStage: item.effectiveAuditStage,
      rejectReason: item.rejectReason,
      teacherAuditOpinion: item.teacherAuditOpinion,
      propertyAuditOpinion: item.propertyAuditOpinion,
    })),
  }
}

export function toAuditStageText(auditStage?: string, auditType?: string) {
  const prefix = auditType === '1' ? '取消审核' : '预约审核'
  if (auditStage === '1') return `${prefix} · 老师审核`
  if (auditStage === '2') return `${prefix} · 物业审核`
  if (auditStage === '0') return '审核完成'
  return prefix
}

export function resolveItemAuditStage(item?: BackendReservationItem) {
  return item?.effectiveAuditStage || item?.auditStage || ''
}

export function resolveReservationAuditStage(reservation: BackendReservation) {
  const openItem = (reservation.items ?? []).find((item) => {
    const status = item.itemStatus
    return status === '1' || status === '4' || status === '7'
  })
  return resolveItemAuditStage(openItem) || reservation.auditStage
}

export function toUiReservations(reservations: BackendReservation[]) {
  return reservations.map(toUiReservation)
}
