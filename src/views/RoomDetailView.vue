<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, Bell, CalendarDays, MapPin, Users } from '@lucide/vue'
import {
  getRoom,
  getPublicRoom,
  listPublicReservationItems,
  listPublicTimePeriods,
  updateRoom,
  type BackendReservationItem,
  type BackendSpaceRoom,
} from '@/api/space'
import {
  addDays,
  buildRoomSlots,
  formatDateValue,
  formatWeekday,
  sortBackendTimePeriods,
  toUiRoomBase,
  toUiTimePeriod,
} from '@/services/spaceMapper'
import { useSessionStore } from '@/stores/session'
import type { Room, RoomStatus, TimePeriod } from '@/types/space'

type WeekCellStatus = RoomStatus | 'expired'

interface WeekCell {
  date: string
  period: TimePeriod
  status: WeekCellStatus
  summary: string
  reservationId?: string
}

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const session = useSessionStore()
const showRoomStatusPanel = ref(false)
const adminRoom = ref<BackendSpaceRoom>()
const adminRoomLoading = ref(false)
const roomStatusSubmitting = ref('')

function firstQueryValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return typeof value === 'string' ? value : ''
}

function parseDateValue(value: unknown) {
  const dateText = firstQueryValue(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return new Date()

  const [year = 0, month = 1, day = 1] = dateText.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfWeek(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  const day = nextDate.getDay()
  nextDate.setDate(nextDate.getDate() + (day === 0 ? -6 : 1 - day))
  return nextDate
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function statusText(status: RoomStatus) {
  if (status === 'free') return '空闲'
  if (status === 'reviewing') return '审核中'
  return '占用'
}

function weekCellStatusText(status: WeekCellStatus) {
  if (status === 'expired') return '已过期'
  return statusText(status)
}

function roomOpenStatusText(status?: string) {
  return status === '1' ? '已停用' : '启用中'
}

function normalizeTime(time?: string) {
  if (!time) return '00:00:00'
  if (/^\d{1,2}:\d{2}$/.test(time)) return `${time.padStart(5, '0')}:00`
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(time)) return time.padStart(8, '0')
  return time
}

function isPastPeriod(dateValue: string, period: TimePeriod) {
  const endTime = normalizeTime(period.endTime || period.time.split('-')[1])
  return new Date(`${dateValue}T${endTime}`).getTime() <= Date.now()
}

const selectedDate = ref(parseDateValue(route.query.date))
const selectedPeriodId = ref(firstQueryValue(route.query.period))
const bookingDate = computed(() => formatDateValue(selectedDate.value))
const weekStart = computed(() => startOfWeek(selectedDate.value))
const weekEnd = computed(() => addDays(weekStart.value, 6))
const weekStartValue = computed(() => formatDateValue(weekStart.value))
const weekRangeText = computed(() => `${formatDateValue(weekStart.value)} 至 ${formatDateValue(weekEnd.value)}`)
const todayValue = formatDateValue(new Date())
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart.value, index)
    const value = formatDateValue(date)
    return {
      date,
      value,
      monthDay: formatMonthDay(date),
      weekday: formatWeekday(date).replace('星期', '周'),
      isToday: value === todayValue,
    }
  }),
)

async function loadRoomDetail() {
  const roomId = String(route.params.roomId)
  const dateValues = weekDays.value.map((day) => day.value)
  const [room, periodsResult, itemResults] = await Promise.all([
    getPublicRoom(roomId),
    listPublicTimePeriods(),
    Promise.all(
      dateValues.map((date) =>
        listPublicReservationItems({
          roomId: Number(roomId),
          bookingDate: date,
        }),
      ),
    ),
  ])
  const periods = sortBackendTimePeriods(periodsResult.rows).map(toUiTimePeriod)
  const roomBase = room ? toUiRoomBase(room) : undefined
  const itemsByDate = dateValues.reduce<Record<string, BackendReservationItem[]>>((itemsMap, date, index) => {
    itemsMap[date] = itemResults[index]?.rows ?? []
    return itemsMap
  }, {})

  return {
    backendRoom: room,
    periods,
    room: roomBase
      ? ({
          ...roomBase,
          slots: [],
        } satisfies Room)
      : undefined,
    itemsByDate,
  }
}

const detailQuery = useQuery({
  queryKey: computed(() => ['h5-room-detail-week', String(route.params.roomId), weekStartValue.value]),
  queryFn: loadRoomDetail,
  staleTime: 30_000,
})

const room = computed<Room>(() => {
  return (
    detailQuery.data.value?.room ?? {
      id: String(route.params.roomId),
      code: '',
      name: '房间加载中',
      type: '',
      building: '',
      floor: '',
      location: '',
      capacity: 0,
      equipment: [],
      slots: [],
    }
  )
})
const timePeriods = computed(() => detailQuery.data.value?.periods ?? [])
const activePeriod = computed(() => selectedPeriodId.value || timePeriods.value[0]?.id || '')
const weekDayPanels = computed(() => {
  const backendRoom = detailQuery.data.value?.backendRoom as BackendSpaceRoom | undefined
  const itemsByDate = detailQuery.data.value?.itemsByDate ?? {}

  return weekDays.value.map((day) => {
    const slots = backendRoom ? buildRoomSlots(backendRoom, timePeriods.value, itemsByDate[day.value] ?? []) : []
    const cells = timePeriods.value.map<WeekCell>((period, index) => {
      const slot = slots[index]
      const isExpired = isPastPeriod(day.value, period)
      return {
        date: day.value,
        period,
        status: isExpired ? 'expired' : ((slot?.status ?? 'free') as RoomStatus),
        summary: slot?.summary ?? '可预约',
        reservationId: slot?.reservationId,
      }
    })

    return {
      ...day,
      cells,
    }
  })
})
const selectedCell = computed(() => {
  const cells = weekDayPanels.value.flatMap((day) => day.cells)
  return (
    cells.find((cell) => cell.date === bookingDate.value && cell.period.id === activePeriod.value) ??
    cells.find((cell) => cell.date === bookingDate.value) ??
    cells[0]
  )
})
const selectedPeriodText = computed(() => {
  const cell = selectedCell.value
  return cell ? `${cell.period.name} ${cell.period.time}` : ''
})
const selectedDateText = computed(() => `${bookingDate.value} ${formatWeekday(selectedDate.value)}`)
const canReserveSelectedSlot = computed(() => selectedCell.value?.status === 'free')
const reserveButtonText = computed(() => {
  if (selectedCell.value?.status === 'expired') return '已过期不可预约'
  if (selectedCell.value?.status === 'free') return '预约选中时段'
  return '当前时段不可预约'
})
const isLoading = computed(() => detailQuery.isLoading.value)
const isError = computed(() => detailQuery.isError.value)
const adminRoomStatus = computed(() => adminRoom.value?.status ?? detailQuery.data.value?.backendRoom?.status ?? '0')
const roomStatusText = computed(() => roomOpenStatusText(adminRoomStatus.value))
const roomStatusCanEnable = computed(() => adminRoomStatus.value === '1')
const roomStatusCanDisable = computed(() => adminRoomStatus.value !== '1')

function updateSelection(dateValue: string, periodId = activePeriod.value) {
  selectedDate.value = parseDateValue(dateValue)
  selectedPeriodId.value = periodId
  void router.replace({
    query: {
      ...route.query,
      date: dateValue,
      period: periodId,
    },
  })
}

function changeWeek(weeks: number) {
  const nextDate = addDays(selectedDate.value, weeks * 7)
  updateSelection(formatDateValue(nextDate))
}

function backThisWeek() {
  updateSelection(formatDateValue(new Date()))
}

function selectCell(cell: WeekCell) {
  if (isPastPeriod(cell.date, cell.period)) return
  updateSelection(cell.date, cell.period.id)
}

function isSelectedCell(cell: WeekCell) {
  return cell.date === bookingDate.value && cell.period.id === selectedCell.value?.period.id
}

function reserveSelectedSlot() {
  const cell = selectedCell.value
  if (!cell || cell.status !== 'free') return

  router.push({
    name: 'reservation-apply',
    query: { roomId: room.value.id, period: cell.period.id, date: cell.date },
  })
}

async function loadAdminRoomStatus() {
  adminRoomLoading.value = true
  try {
    adminRoom.value = await getRoom(room.value.id)
  } catch (error) {
    showToast(error instanceof Error ? error.message : '房间状态加载失败')
  } finally {
    adminRoomLoading.value = false
  }
}

function openRoomStatusPanel() {
  showRoomStatusPanel.value = true
  void loadAdminRoomStatus()
}

async function changeRoomStatus(status: '0' | '1') {
  if (adminRoomLoading.value || roomStatusSubmitting.value) return

  roomStatusSubmitting.value = status
  try {
    const latestRoom = await getRoom(room.value.id)
    if (!latestRoom?.roomId) {
      showToast('房间数据异常，无法处理')
      return
    }

    await updateRoom({
      ...latestRoom,
      status,
      // 后端更新房间时若携带 null 的设备明细不会重写设备，这里显式避免误清空。
      roomEquipmentList: undefined,
    })
    adminRoom.value = {
      ...latestRoom,
      status,
    }
    await detailQuery.refetch()
    await queryClient.invalidateQueries({ queryKey: ['h5-admin-room-list'] })
    await queryClient.invalidateQueries({ queryKey: ['h5-home-schedule'] })
    showRoomStatusPanel.value = false
    showToast(status === '0' ? '房间已启用' : '房间已停用')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '房间状态更新失败')
  } finally {
    roomStatusSubmitting.value = ''
  }
}
</script>

<template>
  <main class="safe-page">
    <header class="detail-nav">
      <button type="button" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>{{ room.code }}</strong>
      <button type="button" @click="router.push('/messages')">
        <Bell :size="20" />
      </button>
    </header>

    <section class="card room-hero">
      <p class="mini">{{ room.type }} · {{ room.building }}</p>
      <h1>{{ room.name }}</h1>
      <div class="room-meta">
        <span><MapPin :size="15" />{{ room.location }}</span>
        <span><Users :size="15" />{{ room.capacity }} 人</span>
      </div>
      <div class="equipment-row">
        <span v-for="item in room.equipment" :key="item">{{ item }}</span>
      </div>
    </section>

    <section class="card week-card">
      <div class="section-row">
        <div>
          <h2 class="section-title">本周占用图</h2>
          <p class="week-range">{{ weekRangeText }}</p>
        </div>
        <button class="plain-button" type="button" @click="backThisWeek">
          <CalendarDays :size="16" />
          本周
        </button>
      </div>

      <div class="date-actions">
        <button type="button" @click="changeWeek(-1)">上一周</button>
        <button type="button" @click="changeWeek(1)">下一周</button>
      </div>

      <div class="week-schedule" aria-label="房间本周占用图">
        <article
          v-for="day in weekDayPanels"
          :key="day.value"
          class="day-row"
          :class="{ 'day-row--today': day.isToday, 'day-row--active': day.value === bookingDate }"
        >
          <button class="day-label" type="button" @click="updateSelection(day.value)">
            <strong>{{ day.weekday }}</strong>
            <span>{{ day.monthDay }}</span>
            <small v-if="day.isToday">今天</small>
          </button>

          <div class="day-slots">
            <button
              v-for="cell in day.cells"
              :key="`${cell.date}-${cell.period.id}`"
              type="button"
              class="week-cell"
              :class="[`week-cell--${cell.status}`, { active: isSelectedCell(cell) }]"
              :disabled="cell.status === 'expired'"
              :aria-label="`${day.weekday}${cell.period.name}${cell.period.time}${weekCellStatusText(cell.status)}`"
              @click="selectCell(cell)"
            >
              <span>{{ cell.period.name }}</span>
              <b>{{ weekCellStatusText(cell.status) }}</b>
            </button>
          </div>
        </article>
      </div>

      <van-loading v-if="isLoading" class="state-box">加载房间占用中</van-loading>
      <van-empty v-else-if="isError" description="房间数据加载失败" />
    </section>

    <section class="card selected-card">
      <div>
        <p class="mini">当前选择</p>
        <strong>{{ selectedDateText }}</strong>
        <span>{{ selectedPeriodText }}</span>
      </div>
      <span v-if="selectedCell" class="selected-status" :class="`selected-status--${selectedCell.status}`">
        {{ weekCellStatusText(selectedCell.status) }}
      </span>
    </section>

    <section v-if="session.isTeacher || session.isAdmin" class="fixed-actions">
      <van-button
        v-if="session.isTeacher"
        block
        round
        type="primary"
        :disabled="!canReserveSelectedSlot"
        @click="reserveSelectedSlot"
      >
        {{ reserveButtonText }}
      </van-button>
      <van-button v-if="session.isAdmin" block round plain type="primary" @click="openRoomStatusPanel">
        启用 / 停用管理
      </van-button>
    </section>
  </main>

  <van-popup v-model:show="showRoomStatusPanel" position="bottom" round safe-area-inset-bottom>
    <section class="room-status-panel" aria-label="启用停用管理弹窗">
      <header class="panel-head">
        <div>
          <strong>启用 / 停用管理</strong>
          <span>{{ room.code }} · {{ room.type }}</span>
        </div>
        <button type="button" @click="showRoomStatusPanel = false">关闭</button>
      </header>

      <van-loading v-if="adminRoomLoading" class="panel-loading">加载房间状态</van-loading>
      <template v-else>
        <div class="status-summary">
          <span>当前状态</span>
          <strong :class="{ 'is-disabled': adminRoomStatus === '1' }">{{ roomStatusText }}</strong>
        </div>
        <p class="status-note">停用后该房间不可继续发起预约；如存在未结束或待审核预约，后端会自动阻止停用。</p>

        <div class="status-actions">
          <van-button
            block
            round
            type="primary"
            :disabled="!roomStatusCanEnable"
            :loading="roomStatusSubmitting === '0'"
            @click="changeRoomStatus('0')"
          >
            启用房间
          </van-button>
          <van-button
            block
            round
            plain
            type="danger"
            :disabled="!roomStatusCanDisable"
            :loading="roomStatusSubmitting === '1'"
            @click="changeRoomStatus('1')"
          >
            停用房间
          </van-button>
        </div>
      </template>
    </section>
  </van-popup>
</template>

<style scoped>
.detail-nav {
  display: grid;
  grid-template-columns: 42px 1fr 42px;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.detail-nav strong {
  text-align: center;
}

.detail-nav button {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  color: var(--space-text);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.room-hero {
  margin-bottom: 12px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(15, 87, 214, 0.92)),
    #1677ff;
}

.room-hero .mini,
.room-hero .muted {
  color: rgba(255, 255, 255, 0.76);
}

.room-hero h1 {
  margin: 8px 0 12px;
  font-size: 27px;
}

.room-meta {
  display: grid;
  gap: 8px;
  color: rgba(255, 255, 255, 0.86);
}

.room-meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.equipment-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.equipment-row span {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  font-size: 12px;
}

.date-actions {
  display: flex;
  gap: 8px;
  margin: -2px 0 12px;
}

.date-actions button {
  min-height: 32px;
  padding: 0 12px;
  color: var(--space-subtext);
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 750;
}

.state-box {
  margin-top: 12px;
}

.week-card {
  margin-bottom: 12px;
}

.week-range {
  margin: 4px 0 0;
  color: var(--space-subtext);
  font-size: 13px;
  line-height: 1.35;
}

.week-schedule {
  display: grid;
  gap: 10px;
}

.day-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
  padding: 8px;
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.day-row--active {
  border-color: rgba(22, 119, 255, 0.42);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.08);
}

.day-label {
  display: grid;
  place-items: center;
  min-height: 58px;
  padding: 6px 4px;
  color: var(--space-text);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 13px;
}

.day-label strong,
.day-label span,
.day-label small {
  display: block;
  line-height: 1.15;
}

.day-label strong {
  font-size: 14px;
  font-weight: 850;
}

.day-label span {
  color: var(--space-subtext);
  font-size: 12px;
}

.day-label small {
  color: var(--space-blue);
  font-size: 11px;
  font-weight: 800;
}

.day-row--today .day-label {
  color: var(--space-blue-deep);
  border-color: rgba(22, 119, 255, 0.28);
}

.day-slots {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  min-width: 0;
}

.week-cell {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 58px;
  padding: 7px 3px;
  border: 1px solid transparent;
  border-radius: 13px;
  line-height: 1.2;
}

.week-cell span,
.week-cell b {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.week-cell span {
  font-size: 12px;
  font-weight: 750;
}

.week-cell b {
  font-size: 13px;
  font-weight: 850;
}

.week-cell--free {
  color: #078047;
  background: #eaf8f0;
}

.week-cell--reviewing {
  color: #9a5b00;
  background: #fff7e6;
}

.week-cell--occupied {
  color: #b54708;
  background: #fff1e8;
}

.week-cell--expired {
  color: #6b768c;
  background: #eef2f7;
}

.week-cell:disabled {
  cursor: not-allowed;
  opacity: 0.78;
}

.week-cell.active {
  border-color: currentColor;
  box-shadow: 0 0 0 2px rgba(15, 31, 61, 0.08);
}

.selected-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.selected-card div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.selected-card strong,
.selected-card span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-card strong {
  font-size: 16px;
}

.selected-card div > span {
  color: var(--space-subtext);
  font-size: 13px;
}

.selected-status {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 850;
}

.selected-status--free {
  color: #078047;
  background: #eaf8f0;
}

.selected-status--reviewing {
  color: #9a5b00;
  background: #fff7e6;
}

.selected-status--occupied {
  color: #b54708;
  background: #fff1e8;
}

.selected-status--expired {
  color: #6b768c;
  background: #eef2f7;
}

.room-status-panel {
  display: grid;
  gap: 16px;
  padding: 20px 16px calc(env(safe-area-inset-bottom) + 18px);
  background: #fff;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-head div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.panel-head strong {
  color: var(--space-text);
  font-size: 18px;
  line-height: 1.25;
}

.panel-head span {
  overflow: hidden;
  color: var(--space-subtext);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-head button {
  flex: 0 0 auto;
  min-width: 54px;
  min-height: 36px;
  color: var(--space-subtext);
  background: #f3f6fb;
  border: 0;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
}

.panel-loading {
  min-height: 126px;
  padding: 28px 0;
}

.status-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  padding: 0 14px;
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.status-summary span {
  color: var(--space-subtext);
  font-size: 14px;
}

.status-summary strong {
  color: #078047;
  font-size: 16px;
}

.status-summary strong.is-disabled {
  color: var(--space-red);
}

.status-note {
  margin: 0;
  color: var(--space-subtext);
  font-size: 13px;
  line-height: 1.55;
}

.status-actions {
  display: grid;
  gap: 10px;
}

@media (max-width: 360px) {
  .day-row {
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 6px;
    padding: 7px;
  }

  .day-slots {
    gap: 5px;
  }

  .week-cell {
    min-height: 56px;
  }

  .week-cell span,
  .day-label span {
    font-size: 11px;
  }

  .week-cell b {
    font-size: 12px;
  }
}
</style>
