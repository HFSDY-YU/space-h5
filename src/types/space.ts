export type UserRole = 'student' | 'teacher' | 'admin'

export type RoomStatus = 'free' | 'reviewing' | 'occupied'

export type ReservationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'finished'
  | 'partial'

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
  equipment: string[]
  slots: RoomSlot[]
}

export interface Reservation {
  id: string
  title: string
  applicant: string
  applicantRole: string
  roomId: string
  roomName: string
  date: string
  time: string
  type: 'single' | 'long'
  status: ReservationStatus
  people: number
  purpose: string
  remark: string
  submittedAt: string
  auditOpinion?: string
  sessions: Array<{
    id: string
    roomName: string
    date: string
    time: string
    status: ReservationStatus
  }>
}

export interface MessageItem {
  id: string
  title: string
  content: string
  time: string
  unread: boolean
  type: 'audit' | 'reservation' | 'system'
}
