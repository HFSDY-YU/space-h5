export type UserRole = 'student' | 'teacher' | 'property' | 'admin'

export type RoomStatus = 'free' | 'reviewing' | 'occupied'

export type ReservationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'finished'
  | 'partial'
  | 'returned'

export interface TimePeriod {
  id: string
  name: string
  time: string
  startTime?: string
  endTime?: string
  orderNum?: number
}

export interface RoomSlot {
  periodId: string
  status: RoomStatus
  summary: string
  reservationId?: string
  startTime?: string
  endTime?: string
  itemId?: string
}

export interface Room {
  id: string
  code: string
  name: string
  type: string
  building: string
  floor: string
  location: string
  capacity: number
  capacityText?: string
  capacityMin?: number
  capacityMax?: number
  imageUrl?: string
  equipment: string[]
  slots: RoomSlot[]
}

export interface Reservation {
  id: string
  title: string
  applicant: string
  applicantRole: string
  applicantPhone: string
  roomId: string
  roomName: string
  date: string
  time: string
  type: 'single' | 'long'
  status: ReservationStatus
  auditType?: string
  auditStage?: string
  auditStageText?: string
  people: number
  purpose: string
  remark: string
  submittedAt: string
  auditOpinion?: string
  sessions: ReservationSession[]
}

export interface ReservationSession {
  id: string
  reservationId?: string
  roomId?: string
  roomCode?: string
  roomName: string
  date: string
  weekday?: string
  startTime?: string
  endTime?: string
  time: string
  status: ReservationStatus
  itemStatus?: string
  auditStage?: string
  effectiveAuditStage?: string
  rejectReason?: string
  teacherAuditOpinion?: string
  propertyAuditOpinion?: string
}

export interface MessageItem {
  id: string
  title: string
  content: string
  time: string
  unread: boolean
  type: 'audit' | 'reservation' | 'system'
}
