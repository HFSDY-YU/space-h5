import { http, type AjaxResult, type PageParams, type TableDataInfo } from '@/api/http'

export interface BackendSpaceRoom {
  roomId?: number
  roomCode?: string
  roomName?: string
  buildingId?: number
  buildingName?: string
  floorId?: number
  floorNo?: string
  typeId?: number
  roomType?: string
  area?: number
  capacityMin?: number
  capacityMax?: number
  capacityDesc?: string
  assignedOrgId?: number
  assignedOrgName?: string
  equipmentDesc?: string
  roomEquipmentList?: unknown[]
  locationDesc?: string
  bookable?: string
  status?: string
  delFlag?: string
  remark?: string
  [key: string]: unknown
}

export interface BackendTimePeriod {
  periodId?: number
  periodCode?: string
  periodName?: string
  startTime?: string
  endTime?: string
  orderNum?: number
  status?: string
}

export interface BackendReservationItem {
  itemId?: number
  reservationId?: number
  roomId?: number
  roomCode?: string
  roomName?: string
  roomType?: string
  bookingDate?: string
  weekday?: string
  startTime?: string
  endTime?: string
  itemStatus?: string
  reservationStatus?: string
  auditType?: string
  reservationNo?: string
  reservationType?: string
  title?: string
  peopleCount?: number
  applicantName?: string
  orgName?: string
  detailRemark?: string
  auditTime?: string
  auditorName?: string
  rejectReason?: string
}

export interface BackendReservation {
  reservationId?: number
  reservationNo?: string
  reservationType?: string
  applicantName?: string
  applicantRole?: string
  applicantPhone?: string
  orgName?: string
  title?: string
  purpose?: string
  peopleCount?: number
  detailRemark?: string
  status?: string
  auditType?: string
  submitTime?: string
  auditorName?: string
  auditTime?: string
  rejectReason?: string
  roomId?: number
  roomCode?: string
  roomName?: string
  bookingDateStart?: string
  bookingDateEnd?: string
  dateRangeText?: string
  timeRangeText?: string
  approvedItemCount?: number
  items?: BackendReservationItem[]
}

export interface ReservationSubmitPayload {
  reservationType: '0' | '1'
  title: string
  purpose: string
  peopleCount: number
  detailRemark?: string
  items: Array<{
    roomId: number
    bookingDate: string
    weekday: string
    startTime: string
    endTime: string
  }>
  rule?: {
    ruleType?: string
    startDate?: string
    endDate?: string
    weekdays?: string
    customDatesText?: string
    startTime?: string
    endTime?: string
    ruleDesc?: string
  }
}

export interface ReservationListParams extends PageParams {
  status?: string
  roomId?: number
  roomName?: string
  bookingDateStart?: string
  bookingDateEnd?: string
}

export interface ReservationItemListParams extends PageParams {
  bookingDate?: string
  roomId?: number
  periodStartTime?: string
  periodEndTime?: string
  occupiedOnly?: boolean
}

export type RoomListParams = PageParams & Partial<BackendSpaceRoom>

const LARGE_PAGE = {
  pageNum: 1,
  pageSize: 999,
}

export function listRooms(params: RoomListParams = {}) {
  return http.get<TableDataInfo<BackendSpaceRoom>>('/space/room/list', {
    params: {
      ...LARGE_PAGE,
      ...params,
    },
  })
}

export async function getRoom(roomId: string | number) {
  const result = await http.get<AjaxResult<BackendSpaceRoom>>(`/space/room/${roomId}`)
  return result.data
}

export function updateRoom(payload: BackendSpaceRoom) {
  return http.put<AjaxResult>('/space/room', payload)
}

// H5 首页和预约页只展示可预约、启用中的公开房间；内部字段由后端 public 接口清理。
export function listPublicRooms(params: PageParams & Partial<BackendSpaceRoom> = {}) {
  return http.get<TableDataInfo<BackendSpaceRoom>>('/space/room/public/list', {
    params: {
      ...LARGE_PAGE,
      status: '0',
      bookable: '0',
      ...params,
    },
  })
}

export async function getPublicRoom(roomId: string | number) {
  const result = await http.get<AjaxResult<BackendSpaceRoom>>(`/space/room/public/${roomId}`)
  return result.data
}

export function listPublicTimePeriods(params: PageParams & Partial<BackendTimePeriod> = {}) {
  return http.get<TableDataInfo<BackendTimePeriod>>('/space/time-period/public/list', {
    params: {
      ...LARGE_PAGE,
      ...params,
    },
  })
}

export function listPublicReservationItems(params: ReservationItemListParams = {}) {
  return http.get<TableDataInfo<BackendReservationItem>>('/space/reservation/item/public/list', {
    params: {
      ...LARGE_PAGE,
      ...params,
    },
  })
}

// 该接口权限更高，可展示普通待审核场次；调用处应在失败时降级到 public/list。
export function listReservationItems(params: ReservationItemListParams = {}) {
  return http.get<TableDataInfo<BackendReservationItem>>('/space/reservation/item/list', {
    params: {
      ...LARGE_PAGE,
      ...params,
    },
  })
}

export function listPublicReservationSummary(params: ReservationListParams = {}) {
  return http.get<TableDataInfo<BackendReservation>>('/space/reservation/public/summary/list', {
    params: {
      ...LARGE_PAGE,
      ...params,
    },
  })
}

export function listMyReservations(params: ReservationListParams = {}) {
  return http.get<TableDataInfo<BackendReservation>>('/space/reservation/my/list', {
    params: {
      pageNum: 1,
      pageSize: 20,
      ...params,
    },
  })
}

export function listReservations(params: ReservationListParams = {}) {
  return http.get<TableDataInfo<BackendReservation>>('/space/reservation/list', {
    params: {
      pageNum: 1,
      pageSize: 50,
      ...params,
    },
  })
}

export function listPendingReservations(params: ReservationListParams = {}) {
  return http.get<TableDataInfo<BackendReservation>>('/space/reservation/pending/list', {
    params: {
      pageNum: 1,
      pageSize: 50,
      ...params,
    },
  })
}

export function listCancelPendingReservations(params: ReservationListParams = {}) {
  return http.get<TableDataInfo<BackendReservation>>('/space/reservation/cancel-pending/list', {
    params: {
      pageNum: 1,
      pageSize: 50,
      ...params,
    },
  })
}

export async function getReservation(reservationId: string | number) {
  const result = await http.get<AjaxResult<BackendReservation>>(`/space/reservation/${reservationId}`)
  return result.data
}

export function createReservation(payload: ReservationSubmitPayload) {
  return http.post<AjaxResult>('/space/reservation', payload)
}

export function cancelReservation(reservationId: string | number) {
  return http.put<AjaxResult>(`/space/reservation/${reservationId}/cancel`)
}

export function approveReservation(reservationId: string | number, auditOpinion = '审核通过') {
  return http.put<AjaxResult>(`/space/reservation/${reservationId}/approve`, { auditOpinion })
}

export function rejectReservation(reservationId: string | number, auditOpinion = '审核驳回') {
  return http.put<AjaxResult>(`/space/reservation/${reservationId}/reject`, { auditOpinion })
}

export function batchApproveReservations(reservationIds: Array<string | number>, auditOpinion = '批量审核通过') {
  return http.put<AjaxResult>('/space/reservation/batch/approve', {
    reservationIds: reservationIds.map(Number),
    auditOpinion,
  })
}

export function batchRejectReservations(reservationIds: Array<string | number>, auditOpinion = '批量审核驳回') {
  return http.put<AjaxResult>('/space/reservation/batch/reject', {
    reservationIds: reservationIds.map(Number),
    auditOpinion,
  })
}
