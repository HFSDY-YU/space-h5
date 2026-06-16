import type { MessageItem, Reservation, Room, RoomStatus, TimePeriod, UserRole } from '@/types/space'

export const roleLabels: Record<UserRole, string> = {
  student: '学生',
  teacher: '老师',
  admin: '管理员',
}

export const timePeriods: TimePeriod[] = [
  { id: 'morning', name: '上午', time: '08:30-12:00' },
  { id: 'afternoon', name: '下午', time: '14:00-17:30' },
  { id: 'evening', name: '晚间', time: '19:00-21:30' },
]

export const rooms: Room[] = [
  {
    id: 'room-101',
    code: 'A-101',
    name: '琴海研讨室',
    type: '研讨室',
    building: '澳琴教学楼 A 座',
    floor: '1F',
    location: 'A 座一层东侧',
    capacity: 24,
    equipment: ['投影', '白板', '视频会议'],
    slots: [
      { periodId: 'morning', status: 'free', summary: '可预约' },
      {
        periodId: 'afternoon',
        status: 'occupied',
        summary: '课程研讨已占用',
        reservationId: 'res-001',
      },
      { periodId: 'evening', status: 'reviewing', summary: '申请审核中', reservationId: 'res-004' },
    ],
  },
  {
    id: 'room-206',
    code: 'B-206',
    name: '横琴会议室',
    type: '会议室',
    building: '澳琴教学楼 B 座',
    floor: '2F',
    location: 'B 座二层中庭',
    capacity: 48,
    equipment: ['投影', '音响', '无线麦'],
    slots: [
      { periodId: 'morning', status: 'occupied', summary: '教师会议', reservationId: 'res-002' },
      { periodId: 'afternoon', status: 'free', summary: '可预约' },
      { periodId: 'evening', status: 'free', summary: '可预约' },
    ],
  },
  {
    id: 'room-318',
    code: 'C-318',
    name: '创新活动室',
    type: '活动室',
    building: '澳琴综合楼 C 座',
    floor: '3F',
    location: 'C 座三层南侧',
    capacity: 72,
    equipment: ['移动桌椅', '白板', '舞台灯'],
    slots: [
      { periodId: 'morning', status: 'free', summary: '可预约' },
      { periodId: 'afternoon', status: 'reviewing', summary: '申请审核中', reservationId: 'res-003' },
      { periodId: 'evening', status: 'occupied', summary: '社团活动', reservationId: 'res-005' },
    ],
  },
  {
    id: 'room-502',
    code: 'D-502',
    name: '智慧教室',
    type: '教室',
    building: '澳琴教学楼 D 座',
    floor: '5F',
    location: 'D 座五层西侧',
    capacity: 96,
    equipment: ['智慧屏', '录播', '扩声系统'],
    slots: [
      { periodId: 'morning', status: 'reviewing', summary: '申请审核中', reservationId: 'res-006' },
      { periodId: 'afternoon', status: 'occupied', summary: '公开课', reservationId: 'res-007' },
      { periodId: 'evening', status: 'free', summary: '可预约' },
    ],
  },
]

export const reservations: Reservation[] = [
  {
    id: 'res-001',
    title: '跨学科课程研讨',
    applicant: '陈老师',
    applicantRole: '老师',
    roomId: 'room-101',
    roomName: '琴海研讨室',
    date: '2026-06-15',
    time: '14:00-17:30',
    type: 'single',
    status: 'approved',
    people: 18,
    purpose: '课程研讨',
    remark: '需要提前开启投影和视频会议设备。',
    submittedAt: '2026-06-12 09:12',
    auditOpinion: '已通过，请按时使用。',
    sessions: [
      {
        id: 'item-001',
        roomName: '琴海研讨室',
        date: '2026-06-15',
        time: '14:00-17:30',
        status: 'approved',
      },
    ],
  },
  {
    id: 'res-003',
    title: '创新创业工作坊',
    applicant: '林老师',
    applicantRole: '老师',
    roomId: 'room-318',
    roomName: '创新活动室',
    date: '2026-06-15',
    time: '14:00-17:30',
    type: 'long',
    status: 'pending',
    people: 42,
    purpose: '工作坊',
    remark: '连续三周周一下午使用。',
    submittedAt: '2026-06-12 11:25',
    sessions: [
      {
        id: 'item-003-1',
        roomName: '创新活动室',
        date: '2026-06-15',
        time: '14:00-17:30',
        status: 'pending',
      },
      {
        id: 'item-003-2',
        roomName: '创新活动室',
        date: '2026-06-22',
        time: '14:00-17:30',
        status: 'pending',
      },
      {
        id: 'item-003-3',
        roomName: '创新活动室',
        date: '2026-06-29',
        time: '14:00-17:30',
        status: 'pending',
      },
    ],
  },
  {
    id: 'res-006',
    title: '智慧课堂公开课',
    applicant: '吴老师',
    applicantRole: '老师',
    roomId: 'room-502',
    roomName: '智慧教室',
    date: '2026-06-15',
    time: '08:30-12:00',
    type: 'single',
    status: 'pending',
    people: 80,
    purpose: '公开课',
    remark: '需要录播系统和扩声系统。',
    submittedAt: '2026-06-12 13:40',
    sessions: [
      {
        id: 'item-006',
        roomName: '智慧教室',
        date: '2026-06-15',
        time: '08:30-12:00',
        status: 'pending',
      },
    ],
  },
]

export const messages: MessageItem[] = [
  {
    id: 'msg-001',
    title: '预约审核通过',
    content: '跨学科课程研讨已通过审核，请按预约时段使用琴海研讨室。',
    time: '09:45',
    unread: true,
    type: 'audit',
  },
  {
    id: 'msg-002',
    title: '新的待审核申请',
    content: '智慧课堂公开课等待管理员审核。',
    time: '13:42',
    unread: true,
    type: 'reservation',
  },
  {
    id: 'msg-003',
    title: '系统提示',
    content: '移动端第一版已开启空间占用查询。',
    time: '昨天',
    unread: false,
    type: 'system',
  },
]

export function getRoomStatusCount() {
  return rooms.reduce(
    (summary, room) => {
      room.slots.forEach((slot) => {
        summary[slot.status] += 1
      })
      return summary
    },
    { free: 0, reviewing: 0, occupied: 0 } satisfies Record<RoomStatus, number>,
  )
}

export function getRoomById(roomId: string) {
  const fallbackRoom = rooms[0]
  if (!fallbackRoom) {
    throw new Error('缺少房间 mock 数据')
  }

  return rooms.find((room) => room.id === roomId) ?? fallbackRoom
}

export function getReservationById(reservationId: string) {
  const fallbackReservation = reservations[0]
  if (!fallbackReservation) {
    throw new Error('缺少预约 mock 数据')
  }

  return reservations.find((reservation) => reservation.id === reservationId) ?? fallbackReservation
}

export function getReservationsByRoom(roomId: string) {
  return reservations.filter((reservation) => reservation.roomId === roomId)
}
