import type {
  BackendReservation,
  BackendReservationItem,
  BackendSpaceRoom,
  BackendTimePeriod,
} from '@/api/space'
import type { Reservation, ReservationStatus, Room, RoomSlot, RoomStatus, TimePeriod } from '@/types/space'

const WEEKDAY_TEXT = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

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
    equipment,
  }
}

export function toRoomStatus(itemStatus?: string): RoomStatus | undefined {
  // 首页占用矩阵只允许三种状态：无场次为空闲，待审核/冲突为审核中，通过/结束为占用。
  if (itemStatus === '1' || itemStatus === '4') return 'reviewing'
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
  return 'pending'
}

export function toItemReservationStatus(status?: string): ReservationStatus {
  if (status === '1' || status === '4') return 'pending'
  if (status === '2') return 'approved'
  if (status === '3') return 'rejected'
  if (status === '5') return 'cancelled'
  if (status === '6') return 'finished'
  return 'pending'
}

function timeToMinutes(time?: string) {
  const normalizedTime = formatBackendTime(time)
  const [hourText = '0', minuteText = '0'] = normalizedTime.split(':')
  return Number(hourText) * 60 + Number(minuteText)
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
    people: reservation.peopleCount ?? 0,
    purpose: reservation.purpose || '',
    remark: reservation.detailRemark || '',
    submittedAt: reservation.submitTime || '',
    auditOpinion: reservation.rejectReason || undefined,
    sessions: items.map((item) => ({
      id: String(item.itemId ?? ''),
      roomName: item.roomName || reservation.roomName || '',
      date: item.bookingDate || '',
      time: `${formatBackendTime(item.startTime)}-${formatBackendTime(item.endTime)}`,
      status: toItemReservationStatus(item.itemStatus),
    })),
  }
}

export function toUiReservations(reservations: BackendReservation[]) {
  return reservations.map(toUiReservation)
}
