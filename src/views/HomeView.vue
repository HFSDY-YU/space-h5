<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Filter, Search } from '@lucide/vue'
import { useSessionStore } from '@/stores/session'
import {
  listPublicReservationItems,
  listPublicRooms,
  listPublicTimePeriods,
  listReservationItems,
  type BackendReservationItem,
} from '@/api/space'
import {
  addDays,
  buildRoomsWithSlots,
  formatDateCn,
  formatDateValue,
  formatWeekday,
  sortBackendTimePeriods,
  toUiTimePeriod,
} from '@/services/spaceMapper'
import type { Room, RoomSlot, RoomStatus, TimePeriod } from '@/types/space'

type HomeRoomStatusFilter = 'all' | RoomStatus

const router = useRouter()
const session = useSessionStore()
const keyword = ref('')
const selectedDate = ref(new Date())
const showFilterPanel = ref(false)
const showCalendar = ref(false)
const roomStatusFilter = ref<HomeRoomStatusFilter>('all')
const buildingFilter = ref('all')
const floorFilter = ref('all')
const roomTypeFilter = ref('all')
const equipmentFilters = ref<string[]>([])
const calendarMinDate = new Date(new Date().getFullYear() - 1, 0, 1)
const calendarMaxDate = new Date(new Date().getFullYear() + 1, 11, 31)
const bookingDate = computed(() => formatDateValue(selectedDate.value))
const dateText = computed(() => formatDateCn(selectedDate.value))
const weekdayText = computed(() => formatWeekday(selectedDate.value))
const canViewReviewingSlots = computed(() => {
  return session.isAdmin || session.permissions.includes('*:*:*') || session.permissions.includes('space:reservationItem:list')
})
const baseStatusFilterOptions: Array<{ label: string; value: HomeRoomStatusFilter; requiresFullAccess?: boolean }> = [
  { label: '全部', value: 'all' },
  { label: '空闲', value: 'free' },
  { label: '审核中', value: 'reviewing', requiresFullAccess: true },
  { label: '占用', value: 'occupied' },
]
const statusFilterOptions = computed(() => {
  return baseStatusFilterOptions
})

async function loadReservationItems(date: string, canViewReviewing: boolean) {
  if (canViewReviewing) {
    try {
      const result = await listReservationItems({
        bookingDate: date,
        occupiedOnly: true,
      })
      return result.rows
    } catch {
      // 权限配置和本地角色缓存不一致时降级为公开视图，避免刷新后残留“审核中”。
    }
  }

  const result = await listPublicReservationItems({
    bookingDate: date,
  })
  return result.rows
}

async function loadHomeSchedule(date: string, canViewReviewing: boolean) {
  const [roomsResult, periodsResult, items] = await Promise.all([
    listPublicRooms(),
    listPublicTimePeriods(),
    loadReservationItems(date, canViewReviewing),
  ])

  const periods = sortBackendTimePeriods(periodsResult.rows).map(toUiTimePeriod)
  return {
    periods,
    rooms: buildRoomsWithSlots(roomsResult.rows, periods, items as BackendReservationItem[]),
  }
}

const homeQuery = useQuery({
  queryKey: computed(() => ['h5-home-schedule', bookingDate.value, canViewReviewingSlots.value ? 'full' : 'public']),
  queryFn: () => loadHomeSchedule(bookingDate.value, canViewReviewingSlots.value),
  staleTime: 30_000,
})

const timePeriods = computed(() => homeQuery.data.value?.periods ?? [])
const rooms = computed(() => homeQuery.data.value?.rooms ?? [])
const isLoading = computed(() => homeQuery.isLoading.value)
const isError = computed(() => homeQuery.isError.value)
const buildingOptions = computed(() => {
  return Array.from(new Set(rooms.value.map((room) => room.building).filter(Boolean))).sort()
})
const floorOptions = computed(() => {
  return Array.from(new Set(rooms.value.map((room) => room.floor).filter(Boolean))).sort((prev, next) =>
    prev.localeCompare(next, 'zh-CN', { numeric: true }),
  )
})
const roomTypeOptions = computed(() => {
  return Array.from(new Set(rooms.value.map((room) => room.type).filter(Boolean))).sort()
})
const equipmentOptions = computed(() => {
  return Array.from(new Set(rooms.value.flatMap((room) => room.equipment).filter(Boolean))).sort()
})
const activeFilterCount = computed(() => {
  return (
    Number(roomStatusFilter.value !== 'all') +
    Number(buildingFilter.value !== 'all') +
    Number(floorFilter.value !== 'all') +
    Number(roomTypeFilter.value !== 'all') +
    equipmentFilters.value.length
  )
})
const hasActiveFilters = computed(() => activeFilterCount.value > 0)

const filteredRooms = computed(() => {
  return rooms.value.filter((room) => {
    const searchText = `${room.name}${room.code}${room.type}${room.location}`.toLowerCase()
    const matchesKeyword = !keyword.value || searchText.includes(keyword.value.toLowerCase())
    const matchesStatus =
      roomStatusFilter.value === 'all' || room.slots.some((slot) => slot.status === roomStatusFilter.value)
    const matchesBuilding = buildingFilter.value === 'all' || room.building === buildingFilter.value
    const matchesFloor = floorFilter.value === 'all' || room.floor === floorFilter.value
    const matchesRoomType = roomTypeFilter.value === 'all' || room.type === roomTypeFilter.value
    const matchesEquipment =
      equipmentFilters.value.length === 0 ||
      equipmentFilters.value.every((equipment) => room.equipment.includes(equipment))
    return matchesKeyword && matchesStatus && matchesBuilding && matchesFloor && matchesRoomType && matchesEquipment
  })
})

function changeDate(days: number) {
  selectedDate.value = addDays(selectedDate.value, days)
}

function backToday() {
  selectedDate.value = new Date()
}

function resetFilters() {
  roomStatusFilter.value = 'all'
  buildingFilter.value = 'all'
  floorFilter.value = 'all'
  roomTypeFilter.value = 'all'
  equipmentFilters.value = []
}

function toggleEquipmentFilter(equipment: string) {
  if (equipmentFilters.value.includes(equipment)) {
    equipmentFilters.value = equipmentFilters.value.filter((item) => item !== equipment)
    return
  }

  equipmentFilters.value = [...equipmentFilters.value, equipment]
}

function confirmCalendarDate(date: Date | Date[]) {
  const nextDate = Array.isArray(date) ? date[0] : date
  if (!nextDate) return
  selectedDate.value = nextDate
  showCalendar.value = false
}

async function retryLoad() {
  try {
    await homeQuery.refetch()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '刷新失败')
  }
}

function getStatusMeta(status: RoomStatus) {
  if (status === 'free') {
    return {
      label: '空闲',
      icon: CheckCircle2,
      className: 'slot-status--free',
    }
  }

  if (status === 'reviewing') {
    return {
      label: '审核中',
      icon: Clock3,
      className: 'slot-status--reviewing',
    }
  }

  return {
    label: '占用',
    icon: CalendarDays,
    className: 'slot-status--occupied',
  }
}

function handleSlotClick(room: Room, slot: RoomSlot) {
  if (slot.status === 'free') {
    router.push({
      path: `/rooms/${room.id}`,
      query: { period: slot.periodId, date: bookingDate.value },
    })
    return
  }

  router.push({
    path: `/rooms/${room.id}/slot`,
    query: { period: slot.periodId, date: bookingDate.value },
  })
}

function getSlotAriaLabel(room: Room, slot: RoomSlot) {
  const period = timePeriods.value.find((item: TimePeriod) => item.id === slot.periodId)
  const status = getStatusMeta(slot.status).label
  const actionText = slot.status === 'free' ? '查看房间占用图' : '查看占用信息'
  return `${room.code}${period?.name ?? ''}${period?.time ?? ''}${status}，${actionText}`
}
</script>

<template>
  <main class="home-page">
    <header class="home-hero">
      <div class="hero-room" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div class="home-hero__content">
        <div class="home-toolbar">
          <div class="search-box">
            <Search :size="20" />
            <input v-model.trim="keyword" placeholder="搜索房间名称 / 编号" />
          </div>
          <button class="filter-button" :class="{ active: hasActiveFilters }" type="button" @click="showFilterPanel = true">
            <Filter :size="20" />
            筛选
            <span v-if="activeFilterCount">{{ activeFilterCount }}</span>
          </button>
          <button class="message-button" type="button" aria-label="消息" @click="router.push('/messages')">
            <i></i>
            <Bell :size="24" />
          </button>
        </div>
      </div>
    </header>

    <section class="schedule-card">
      <div class="date-row">
        <button class="date-arrow" type="button" aria-label="前一天" @click="changeDate(-1)">
          <ChevronLeft :size="24" />
        </button>

        <button class="date-main" type="button" @click="showCalendar = true">
          <CalendarDays :size="20" />
          <span class="date-main__text">
            <span>{{ dateText }}</span>
            <strong>{{ weekdayText }}</strong>
          </span>
        </button>

        <button class="date-arrow" type="button" aria-label="后一天" @click="changeDate(1)">
          <ChevronRight :size="24" />
        </button>

        <button class="today-button" type="button" @click="backToday">今天</button>
      </div>

      <div class="matrix-scroll">
        <table class="schedule-table">
          <thead>
            <tr>
              <th class="room-head">房间</th>
              <th v-for="period in timePeriods" :key="period.id">{{ period.time }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="room in filteredRooms" :key="room.id">
              <td class="room-cell">
                <button type="button" :aria-label="`查看${room.code}房间详情`" @click="router.push(`/rooms/${room.id}`)">
                  <span class="room-cell__title">
                    <strong>{{ room.code }}</strong>
                    <ChevronRight :size="17" aria-hidden="true" />
                  </span>
                  <span class="room-cell__type">{{ room.type }}</span>
                  <span>{{ room.building.replace('澳琴', '') }} · {{ room.floor }}</span>
                  <small>{{ room.capacity }}人</small>
                </button>
              </td>

              <td v-for="slot in room.slots" :key="slot.periodId" class="status-cell">
                <button
                  :class="['slot-status', getStatusMeta(slot.status).className]"
                  type="button"
                  :aria-label="getSlotAriaLabel(room, slot)"
                  @click.stop="handleSlotClick(room, slot)"
                >
                  <component :is="getStatusMeta(slot.status).icon" :size="24" />
                  <span>{{ getStatusMeta(slot.status).label }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <van-loading v-if="isLoading" class="matrix-state" type="spinner">加载空间数据中</van-loading>

      <div v-else-if="isError" class="matrix-state">
        <p>空间数据加载失败</p>
        <button type="button" @click="retryLoad">重新加载</button>
      </div>

      <van-empty v-else-if="filteredRooms.length === 0" description="暂无匹配房间" />
    </section>
  </main>

  <van-popup v-model:show="showFilterPanel" position="bottom" round safe-area-inset-bottom>
    <section class="filter-panel">
      <header class="filter-panel__head">
        <div>
          <strong>筛选房间</strong>
          <span>按状态、楼层、类型和设备缩小范围</span>
        </div>
        <button type="button" @click="resetFilters">重置</button>
      </header>

      <div class="filter-group">
        <h3>状态</h3>
        <div class="filter-options">
          <button
            v-for="option in statusFilterOptions"
            :key="option.value"
            :class="{ active: roomStatusFilter === option.value }"
            type="button"
            @click="roomStatusFilter = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div v-if="buildingOptions.length" class="filter-group">
        <h3>楼栋</h3>
        <div class="filter-options">
          <button :class="{ active: buildingFilter === 'all' }" type="button" @click="buildingFilter = 'all'">
            全部楼栋
          </button>
          <button
            v-for="building in buildingOptions"
            :key="building"
            :class="{ active: buildingFilter === building }"
            type="button"
            @click="buildingFilter = building"
          >
            {{ building }}
          </button>
        </div>
      </div>

      <div v-if="floorOptions.length" class="filter-group">
        <h3>楼层</h3>
        <div class="filter-options">
          <button :class="{ active: floorFilter === 'all' }" type="button" @click="floorFilter = 'all'">
            全部楼层
          </button>
          <button
            v-for="floor in floorOptions"
            :key="floor"
            :class="{ active: floorFilter === floor }"
            type="button"
            @click="floorFilter = floor"
          >
            {{ floor }}
          </button>
        </div>
      </div>

      <div v-if="roomTypeOptions.length" class="filter-group">
        <h3>教室类型</h3>
        <div class="filter-options">
          <button :class="{ active: roomTypeFilter === 'all' }" type="button" @click="roomTypeFilter = 'all'">
            全部类型
          </button>
          <button
            v-for="roomType in roomTypeOptions"
            :key="roomType"
            :class="{ active: roomTypeFilter === roomType }"
            type="button"
            @click="roomTypeFilter = roomType"
          >
            {{ roomType }}
          </button>
        </div>
      </div>

      <div v-if="equipmentOptions.length" class="filter-group">
        <h3>设备</h3>
        <div class="filter-options">
          <button :class="{ active: equipmentFilters.length === 0 }" type="button" @click="equipmentFilters = []">
            全部设备
          </button>
          <button
            v-for="equipment in equipmentOptions"
            :key="equipment"
            :class="{ active: equipmentFilters.includes(equipment) }"
            type="button"
            @click="toggleEquipmentFilter(equipment)"
          >
            {{ equipment }}
          </button>
        </div>
      </div>

      <button class="filter-confirm" type="button" @click="showFilterPanel = false">
        查看 {{ filteredRooms.length }} 间房间
      </button>
    </section>
  </van-popup>

  <van-calendar
    v-model:show="showCalendar"
    color="#1677ff"
    :default-date="selectedDate"
    :min-date="calendarMinDate"
    :max-date="calendarMaxDate"
    @confirm="confirmCalendarDate"
  />
</template>

<style scoped>
.home-page {
  --home-tabbar-space: calc(50px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  padding: 0 16px var(--home-tabbar-space);
  background: var(--space-bg);
  overflow: hidden;
  overflow-x: hidden;
}

.home-hero {
  flex: 0 0 auto;
  position: relative;
  margin: 0 -16px;
  /* 首页顶部只保留查询工具，减少无效信息对首屏矩阵的挤压。 */
  padding: calc(env(safe-area-inset-top) + 14px) 16px 14px;
  color: #fff;
  background:
    linear-gradient(90deg, rgba(0, 103, 255, 0.98), rgba(22, 119, 255, 0.78)),
    radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.24), transparent 26%),
    #1677ff;
}

.home-hero::after {
  position: absolute;
  inset: 0;
  content: '';
  background:
    linear-gradient(90deg, rgba(0, 103, 255, 0), rgba(255, 255, 255, 0.1)),
    repeating-linear-gradient(90deg, transparent 0 34px, rgba(255, 255, 255, 0.1) 35px 36px);
  opacity: 0.36;
  pointer-events: none;
}

.home-hero__content {
  position: relative;
  z-index: 1;
}

.hero-room {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 32%;
  height: 64px;
  opacity: 0.14;
  pointer-events: none;
}

.hero-room span {
  position: absolute;
  right: 10px;
  bottom: 0;
  width: 58px;
  height: 28px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 8px 8px 4px 4px;
  transform: skewX(-12deg);
}

.hero-room span:nth-child(2) {
  right: 52px;
  bottom: 16px;
  width: 46px;
  height: 24px;
}

.hero-room span:nth-child(3) {
  right: 18px;
  bottom: 40px;
  width: 24px;
  height: 32px;
  border-radius: 18px 18px 4px 4px;
}

.message-button {
  position: relative;
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 48px;
  min-height: 48px;
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  border: 0;
  border-radius: 14px;
  backdrop-filter: blur(8px);
}

.message-button i {
  position: absolute;
  top: 9px;
  right: 11px;
  width: 8px;
  height: 8px;
  background: #ff4d4f;
  border-radius: 50%;
}

.home-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-box,
.filter-button {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 48px;
  background: #fff;
  border: 0;
  border-radius: 14px;
  box-shadow: 0 10px 22px rgba(11, 76, 160, 0.12);
}

.search-box {
  flex: 1 1 auto;
  gap: 9px;
  min-width: 0;
  padding: 0 14px;
  color: var(--space-muted);
}

.search-box input {
  width: 100%;
  min-width: 0;
  color: var(--space-text);
  background: transparent;
  border: 0;
  outline: 0;
  font-size: 15px;
}

.filter-button {
  position: relative;
  justify-content: center;
  gap: 6px;
  color: var(--space-text);
  font-size: 15px;
  font-weight: 800;
  width: 82px;
}

.filter-button.active {
  color: var(--space-blue);
}

.filter-button span {
  position: absolute;
  top: 6px;
  right: 8px;
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  color: #fff;
  background: var(--space-blue);
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
}

.schedule-card {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  margin: -2px 0 0;
  padding: 12px 10px 14px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.9);
  border-radius: 18px;
  box-shadow: 0 12px 30px rgba(54, 89, 150, 0.1);
}

.date-row {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px 50px;
  gap: 6px;
  align-items: center;
}

.date-arrow,
.date-main,
.today-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  color: var(--space-blue);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 12px;
}

.date-arrow {
  color: var(--space-text);
}

.date-main {
  gap: 7px;
  min-width: 0;
  font-size: 15px;
}

.date-main svg {
  flex: 0 0 auto;
}

/* 日期在窄屏会被左右按钮挤压，内部允许分行显示，保证年月日和星期都可见。 */
.date-main__text {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1.2;
}

.date-main__text span,
.date-main__text strong {
  min-width: 0;
  white-space: nowrap;
}

.date-main__text strong {
  flex: 0 0 auto;
  font-weight: 800;
}

.today-button {
  font-size: 14px;
  font-weight: 800;
}

.matrix-scroll {
  flex: 1 1 auto;
  margin-top: 12px;
  min-height: 0;
  max-width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.matrix-state {
  display: grid;
  place-items: center;
  min-height: 120px;
  color: var(--space-subtext);
}

.matrix-state p {
  margin: 0 0 10px;
}

.matrix-state button {
  min-height: 36px;
  padding: 0 14px;
  color: #fff;
  background: var(--space-blue);
  border: 0;
  border-radius: 12px;
  font-weight: 800;
}

.schedule-table {
  table-layout: fixed;
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}

.schedule-table th,
.schedule-table td {
  border-right: 1px solid var(--space-line);
  border-bottom: 1px solid var(--space-line);
}

.schedule-table th:last-child,
.schedule-table td:last-child {
  border-right: 0;
}

.schedule-table tr:last-child td {
  border-bottom: 0;
}

.schedule-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 58px;
  color: var(--space-text);
  font-size: 16px;
  font-weight: 800;
  text-align: center;
  background: #f8fbff;
}

.room-head {
  width: 29%;
}

.room-cell {
  width: 29%;
  background: #fff;
}

.room-cell button {
  display: grid;
  gap: 5px;
  width: 100%;
  min-height: 96px;
  padding: 10px 8px;
  color: var(--space-text);
  text-align: left;
  background: transparent;
  border: 0;
}

.room-cell__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 4px;
}

.room-cell__title svg {
  flex: 0 0 auto;
  color: var(--space-blue);
}

.room-cell strong {
  min-width: 0;
  overflow: hidden;
  font-size: 18px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-word;
}

.room-cell span,
.room-cell small {
  color: var(--space-subtext);
  font-size: 12px;
  line-height: 1.25;
}

.room-cell__type {
  color: var(--space-text);
  font-weight: 780;
}

.status-cell {
  width: 23.666%;
  padding: 10px 6px;
}

.slot-status {
  display: grid;
  align-items: center;
  justify-content: center;
  justify-items: center;
  gap: 5px;
  width: 100%;
  min-height: 64px;
  border: 0;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 800;
}

.slot-status--free {
  color: #07a85b;
  background: #eaf8f0;
}

.slot-status--reviewing {
  color: #a15d00;
  background: #fff7e6;
}

.slot-status--occupied {
  color: #0f65e8;
  background: #eaf2ff;
}

.filter-panel {
  padding: 18px 18px calc(env(safe-area-inset-bottom) + 18px);
  background: #fff;
}

.filter-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.filter-panel__head div {
  display: grid;
  gap: 4px;
}

.filter-panel__head strong {
  font-size: 19px;
  font-weight: 850;
}

.filter-panel__head span {
  color: var(--space-subtext);
  font-size: 13px;
}

.filter-panel__head button {
  min-height: 34px;
  padding: 0 12px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 800;
}

.filter-group {
  margin-top: 16px;
}

.filter-group h3 {
  margin: 0 0 10px;
  color: var(--space-text);
  font-size: 15px;
  font-weight: 850;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.filter-options button {
  min-height: 44px;
  padding: 0 14px;
  color: var(--space-text);
  background: #f6f9fe;
  border: 1px solid var(--space-line);
  border-radius: 13px;
  font-size: 14px;
  font-weight: 780;
}

.filter-options button.active {
  color: #fff;
  background: var(--space-blue);
  border-color: var(--space-blue);
}

.filter-confirm {
  width: 100%;
  min-height: 46px;
  margin-top: 22px;
  color: #fff;
  background: var(--space-blue);
  border: 0;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 850;
}

@media (max-width: 380px) {
  .search-box input,
  .filter-button,
  .today-button {
    font-size: 15px;
  }

  .home-hero {
    padding-right: 14px;
    padding-left: 14px;
  }

  .home-toolbar {
    gap: 7px;
  }

  .filter-button {
    width: 76px;
  }

  .message-button {
    width: 44px;
    min-height: 48px;
  }

  .date-row {
    grid-template-columns: 36px minmax(0, 1fr) 36px 44px;
    gap: 5px;
  }

  .date-arrow,
  .date-main,
  .today-button {
    min-height: 44px;
  }

  .date-main {
    gap: 5px;
    font-size: 13px;
  }

  .date-main svg {
    width: 18px;
    height: 18px;
  }

  .date-main__text {
    display: grid;
    gap: 1px;
    line-height: 1.1;
  }
}

@media (min-width: 560px) {
  .home-page {
    max-width: 430px;
    margin: 0 auto;
    border-right: 1px solid var(--space-line);
    border-left: 1px solid var(--space-line);
  }
}
</style>
