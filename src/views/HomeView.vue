<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview, showToast } from 'vant'
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Filter,
  Layers3,
  Search,
} from '@lucide/vue'
import { useSessionStore } from '@/stores/session'
import {
  listFloors,
  listPublicReservationItems,
  listPublicRooms,
  listReservationItems,
  type BackendReservationItem,
} from '@/api/space'
import {
  addDays,
  BOOKABLE_END_TIME,
  BOOKABLE_START_TIME,
  formatBackendTime,
  formatDateCn,
  formatDateValue,
  formatWeekday,
  minutesToTime,
  resolveItemAuditStage,
  resolveSpaceAssetUrl,
  timeToMinutes,
  toAuditStageText,
  toRoomStatus,
  toUiRoomBase,
} from '@/services/spaceMapper'
import type { Room, RoomStatus } from '@/types/space'

type HomeRoomStatusFilter = 'all' | RoomStatus

interface HomeOccupancySegment {
  id: string
  status: Exclude<RoomStatus, 'free'>
  title: string
  startTime: string
  endTime: string
  auditStage?: string
  auditStageText?: string
  left: number
  width: number
  reservationId?: string
  itemId?: string
}

interface HomeRoom extends Omit<Room, 'slots'> {
  slots: []
  segments: HomeOccupancySegment[]
  dayStatus: RoomStatus
  statusText: string
}

interface HomeFloorGroup {
  name: string
  roomCount: number
  rooms: HomeRoom[]
  imageUrl?: string
}

interface HomeBuildingGroup {
  name: string
  floorCount: number
  roomCount: number
  floors: HomeFloorGroup[]
}

const router = useRouter()
const route = useRoute()
const session = useSessionStore()
const keyword = ref('')
const selectedDate = ref(parseDateValue(route.query.date) || new Date())
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
const statusFilterOptions: Array<{ label: string; value: HomeRoomStatusFilter }> = [
  { label: '全部', value: 'all' },
  { label: '全天空闲', value: 'free' },
  { label: '审核中', value: 'reviewing' },
  { label: '占用', value: 'occupied' },
]
const timelineStartMinute = timeToMinutes(BOOKABLE_START_TIME)
const timelineEndMinute = timeToMinutes(BOOKABLE_END_TIME)
const timelineTotalMinutes = timelineEndMinute - timelineStartMinute
const timelineMiddleText = computed(() => {
  return minutesToTime(Math.floor((timelineStartMinute + timelineEndMinute) / 2))
})

function firstQueryValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return typeof value === 'string' ? value : ''
}

function parseDateValue(value: unknown) {
  const dateText = firstQueryValue(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return undefined
  const [year = 0, month = 1, day = 1] = dateText.split('-').map(Number)
  return new Date(year, month - 1, day)
}

async function loadReservationItems(date: string, canViewReviewing: boolean) {
  if (canViewReviewing) {
    try {
      const result = await listReservationItems({
        bookingDate: date,
        occupiedOnly: true,
      })
      return result.rows
    } catch {
      // 权限变化后本地缓存可能滞后，失败时降级到公开占用列表。
    }
  }

  const result = await listPublicReservationItems({
    bookingDate: date,
  })
  return result.rows
}

async function loadHomeSchedule(date: string) {
  const [roomsResult, items] = await Promise.all([
    listPublicRooms(),
    loadReservationItems(date, session.canViewReviewingSlots),
  ])

  return roomsResult.rows.map((room) => buildHomeRoom(room, items))
}

const homeQuery = useQuery({
  queryKey: computed(() => ['h5-home-schedule', bookingDate.value, session.canViewReviewingSlots ? 'full' : 'public']),
  queryFn: () => loadHomeSchedule(bookingDate.value),
  staleTime: 30_000,
})
const floorsQuery = useQuery({
  queryKey: ['h5-space-floors'],
  queryFn: async () => {
    try {
      const result = await listFloors({ pageSize: 999 })
      return result.rows
    } catch {
      // 楼层图片是增强展示信息；接口无权限或失败时保留图标占位，不影响预约主流程。
      return []
    }
  },
  staleTime: 5 * 60_000,
})

const rooms = computed(() => homeQuery.data.value ?? [])
const floors = computed(() => floorsQuery.data.value ?? [])
const isLoading = computed(() => homeQuery.isLoading.value)
const isError = computed(() => homeQuery.isError.value)
const buildingOptions = computed(() => {
  return Array.from(new Set(rooms.value.map((room) => room.building).filter(Boolean))).sort()
})
const floorOptions = computed(() => {
  const sourceRooms =
    buildingFilter.value === 'all' ? rooms.value : rooms.value.filter((room) => room.building === buildingFilter.value)
  return Array.from(new Set(sourceRooms.map((room) => room.floor).filter(Boolean))).sort((prev, next) =>
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
    const searchText = `${room.name}${room.code}${room.type}${room.location}${room.building}${room.floor}`.toLowerCase()
    const matchesKeyword = !keyword.value || searchText.includes(keyword.value.toLowerCase())
    const matchesStatus = roomStatusFilter.value === 'all' || room.dayStatus === roomStatusFilter.value
    const matchesBuilding = buildingFilter.value === 'all' || room.building === buildingFilter.value
    const matchesFloor = floorFilter.value === 'all' || room.floor === floorFilter.value
    const matchesRoomType = roomTypeFilter.value === 'all' || room.type === roomTypeFilter.value
    const matchesEquipment =
      equipmentFilters.value.length === 0 ||
      equipmentFilters.value.every((equipment) => room.equipment.includes(equipment))
    return matchesKeyword && matchesStatus && matchesBuilding && matchesFloor && matchesRoomType && matchesEquipment
  })
})
// 首页分级菜单始终基于当前搜索与筛选结果构建，保证楼栋、楼层、房间三层看到的是同一批数据。
const buildingGroups = computed<HomeBuildingGroup[]>(() => {
  const buildingMap = new Map<string, HomeBuildingGroup>()

  filteredRooms.value.forEach((room) => {
    const buildingName = room.building || '未设置楼栋'
    const floorName = room.floor || '未设置楼层'
    let buildingGroup = buildingMap.get(buildingName)

    if (!buildingGroup) {
      buildingGroup = {
        name: buildingName,
        floorCount: 0,
        roomCount: 0,
        floors: [],
      }
      buildingMap.set(buildingName, buildingGroup)
    }

    let floorGroup = buildingGroup.floors.find((floor) => floor.name === floorName)
    if (!floorGroup) {
      const floorInfo = floors.value.find((floor) => floor.buildingName === buildingName && floor.floorNo === floorName)
      floorGroup = {
        name: floorName,
        roomCount: 0,
        rooms: [],
        imageUrl: resolveSpaceAssetUrl(floorInfo?.imageUrl),
      }
      buildingGroup.floors.push(floorGroup)
    }

    floorGroup.rooms.push(room)
    floorGroup.roomCount += 1
    buildingGroup.roomCount += 1
  })

  return Array.from(buildingMap.values())
    .map((buildingGroup) => {
      buildingGroup.floors.sort((prev, next) => next.name.localeCompare(prev.name, 'zh-CN', { numeric: true }))
      buildingGroup.floorCount = buildingGroup.floors.length
      return buildingGroup
    })
    .sort((prev, next) => prev.name.localeCompare(next.name, 'zh-CN', { numeric: true }))
})
const selectedBuilding = computed(() => (buildingFilter.value === 'all' ? '' : buildingFilter.value))
const selectedFloor = computed(() => (floorFilter.value === 'all' ? '' : floorFilter.value))
const selectedBuildingGroup = computed(() => buildingGroups.value.find((group) => group.name === selectedBuilding.value))
const floorGroups = computed(() => selectedBuildingGroup.value?.floors ?? [])
const selectedFloorGroup = computed(() => floorGroups.value.find((group) => group.name === selectedFloor.value))
const currentFloorRooms = computed(() => selectedFloorGroup.value?.rooms ?? [])
const hierarchyLevel = computed<'building' | 'floor' | 'room'>(() => {
  if (!selectedBuilding.value) return 'building'
  return selectedFloor.value ? 'room' : 'floor'
})
const hierarchyIsEmpty = computed(() => {
  if (hierarchyLevel.value === 'building') return buildingGroups.value.length === 0
  if (hierarchyLevel.value === 'floor') return floorGroups.value.length === 0
  return currentFloorRooms.value.length === 0
})
const hierarchyEmptyDescription = computed(() => {
  if (hierarchyLevel.value === 'building') return '暂无匹配楼栋'
  if (hierarchyLevel.value === 'floor') return '暂无匹配楼层'
  return '暂无匹配房间'
})

watch(buildingOptions, (options) => {
  if (buildingFilter.value !== 'all' && !options.includes(buildingFilter.value)) {
    changeBuildingFilter('all')
  }
})

watch(floorOptions, (options) => {
  if (floorFilter.value !== 'all' && !options.includes(floorFilter.value)) {
    changeFloorFilter('all')
  }
})

watch(
  () => [route.query.date, route.query.building, route.query.floor],
  ([dateValue, buildingValue, floorValue]) => {
    const nextDate = parseDateValue(dateValue)
    if (nextDate) selectedDate.value = nextDate
    const nextBuilding = firstQueryValue(buildingValue)
    const nextFloor = firstQueryValue(floorValue)
    if (nextBuilding) changeBuildingFilter(nextBuilding, { preserveFloor: true })
    if (nextFloor) changeFloorFilter(nextFloor)
  },
  { immediate: true },
)

function buildHomeRoom(room: Parameters<typeof toUiRoomBase>[0], items: BackendReservationItem[]): HomeRoom {
  const baseRoom = toUiRoomBase(room)
  const roomItems = items.filter((item) => String(item.roomId ?? '') === baseRoom.id)
  const segments = roomItems
    .map((item) => buildSegment(item))
    .filter((segment): segment is HomeOccupancySegment => Boolean(segment))
    .sort((prev, next) => timeToMinutes(prev.startTime) - timeToMinutes(next.startTime))
  const dayStatus = resolveDayStatus(segments)

  return {
    ...baseRoom,
    slots: [],
    segments,
    dayStatus,
    statusText: dayStatus === 'free' ? '全天空闲' : dayStatus === 'reviewing' ? '有待审核' : '有占用',
  }
}

function buildSegment(item: BackendReservationItem): HomeOccupancySegment | null {
  const status = toRoomStatus(item.itemStatus)
  if (!status || status === 'free') return null

  const startTime = formatBackendTime(item.startTime)
  const endTime = formatBackendTime(item.endTime)
  const startMinute = Math.max(timeToMinutes(startTime), timelineStartMinute)
  const endMinute = Math.min(timeToMinutes(endTime), timelineEndMinute)
  if (endMinute <= startMinute) return null
  const auditStage = resolveItemAuditStage(item)
  const auditStageText = status === 'reviewing' ? toAuditStageText(auditStage, item.auditType).replace('预约审核 · ', '') : ''

  return {
    id: String(item.itemId ?? `${item.roomId}-${startTime}-${endTime}`),
    status,
    title: item.title || (status === 'reviewing' ? auditStageText || '待审核预约' : '已占用'),
    startTime,
    endTime,
    auditStage,
    auditStageText,
    left: ((startMinute - timelineStartMinute) / timelineTotalMinutes) * 100,
    width: Math.max(((endMinute - startMinute) / timelineTotalMinutes) * 100, 2.8),
    reservationId: item.reservationId ? String(item.reservationId) : undefined,
    itemId: item.itemId ? String(item.itemId) : undefined,
  } satisfies HomeOccupancySegment
}

function resolveDayStatus(segments: HomeOccupancySegment[]): RoomStatus {
  if (segments.some((segment) => segment.status === 'reviewing')) return 'reviewing'
  if (segments.some((segment) => segment.status === 'occupied')) return 'occupied'
  return 'free'
}

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

function hasFloorInBuilding(building: string, floor: string) {
  if (floor === 'all') return true
  return rooms.value.some((room) => (building === 'all' || room.building === building) && room.floor === floor)
}

function changeBuildingFilter(building: string, options: { preserveFloor?: boolean } = {}) {
  buildingFilter.value = building
  if (!options.preserveFloor || !hasFloorInBuilding(building, floorFilter.value)) {
    floorFilter.value = 'all'
  }
}

function changeFloorFilter(floor: string) {
  floorFilter.value = floor
}

function selectBuilding(group: HomeBuildingGroup) {
  changeBuildingFilter(group.name, { preserveFloor: true })
}

function selectFloor(group: HomeFloorGroup) {
  changeFloorFilter(group.name)
}

function previewFloorImage(group: HomeFloorGroup) {
  if (!group.imageUrl) return

  showImagePreview({
    images: [group.imageUrl],
    closeable: true,
    showIndex: false,
  })
}

function backToBuildings() {
  changeBuildingFilter('all')
}

function backToFloors() {
  changeFloorFilter('all')
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

function openRoomDetail(room: HomeRoom) {
  router.push({
    path: `/rooms/${room.id}`,
    query: {
      date: bookingDate.value,
      from: 'home',
      building: selectedBuilding.value || room.building || undefined,
      floor: selectedFloor.value || room.floor || undefined,
    },
  })
}

function reserveRoom(room: HomeRoom) {
  if (!session.canReserve) {
    showToast('当前账号暂无预约权限')
    return
  }

  router.push({
    name: 'reservation-apply',
    query: { roomId: room.id, date: bookingDate.value },
  })
}

function statusClass(status: RoomStatus) {
  if (status === 'reviewing') return 'is-reviewing'
  if (status === 'occupied') return 'is-occupied'
  return 'is-free'
}
</script>

<template>
  <main class="home-page">
    <header class="home-hero">
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

      <div class="room-list">
        <div v-if="hierarchyLevel !== 'building'" class="hierarchy-nav">
          <button type="button" @click="hierarchyLevel === 'room' ? backToFloors() : backToBuildings()">
            <ChevronLeft :size="18" />
            <span>{{ hierarchyLevel === 'room' ? selectedFloor : selectedBuilding }}</span>
          </button>
          <p>{{ hierarchyLevel === 'room' ? `${selectedBuilding} / ${selectedFloor}` : '选择楼层' }}</p>
        </div>

        <template v-if="hierarchyLevel === 'building'">
          <button
            v-for="group in buildingGroups"
            :key="group.name"
            class="hierarchy-card"
            type="button"
            :aria-label="`查看${group.name}楼层`"
            @click="selectBuilding(group)"
          >
            <span class="hierarchy-card__icon">
              <Building2 :size="25" />
            </span>
            <span class="hierarchy-card__content">
              <strong>{{ group.name }}</strong>
              <small>{{ group.floorCount }} 个楼层 · {{ group.roomCount }} 间房</small>
            </span>
            <ChevronRight :size="20" />
          </button>
        </template>

        <template v-else-if="hierarchyLevel === 'floor'">
          <article
            v-for="group in floorGroups"
            :key="group.name"
            class="hierarchy-card hierarchy-card--floor"
          >
            <button
              v-if="group.imageUrl"
              class="hierarchy-card__icon hierarchy-card__image-button"
              type="button"
              :aria-label="`放大查看${selectedBuilding}${group.name}楼层图`"
              @click="previewFloorImage(group)"
            >
              <img v-if="group.imageUrl" :src="group.imageUrl" :alt="`${selectedBuilding}${group.name}楼层图`" />
            </button>
            <span v-else class="hierarchy-card__icon">
              <Layers3 :size="25" />
            </span>
            <button
              class="hierarchy-card__entry"
              type="button"
              :aria-label="`查看${selectedBuilding}${group.name}房间`"
              @click="selectFloor(group)"
            >
              <span class="hierarchy-card__content">
                <strong>{{ group.name }}</strong>
                <small>{{ group.roomCount }} 间房</small>
              </span>
              <ChevronRight :size="20" />
            </button>
          </article>
        </template>

        <template v-else>
          <article v-for="room in currentFloorRooms" :key="room.id" class="room-card">
            <div class="room-card__main">
              <button class="room-icon" type="button" :aria-label="`查看${room.code}房间详情`" @click="openRoomDetail(room)">
                <DoorOpen :size="26" />
              </button>

              <div class="room-info">
                <button class="room-title" type="button" @click="openRoomDetail(room)">
                  <strong>{{ room.building }}/{{ room.floor }}/{{ room.code }}</strong>
                  <ChevronRight :size="20" />
                </button>

                <div class="tag-row">
                  <span>{{ room.type }}</span>
                  <span v-if="room.equipment[0]">{{ room.equipment[0] }}</span>
                  <span>{{ room.capacityText || `${room.capacity}人` }}</span>
                </div>
              </div>
            </div>

            <div class="timeline" role="group" :aria-label="`${room.code}当日占用时间轴`">
              <button
                class="timeline-track-button"
                type="button"
                :aria-label="`查看${room.code}房间详情`"
                @click="openRoomDetail(room)"
              ></button>
              <button
                v-for="segment in room.segments"
                :key="segment.id"
                type="button"
                class="timeline-segment"
                :class="statusClass(segment.status)"
                :style="{ left: `${segment.left}%`, width: `${segment.width}%` }"
                :aria-label="`${segment.startTime}-${segment.endTime}${segment.auditStageText || segment.title}`"
              >
                <span>{{ segment.title }}</span>
              </button>
            </div>

            <div class="time-labels">
              <span>{{ BOOKABLE_START_TIME }}</span>
              <span>{{ timelineMiddleText }}</span>
              <span>{{ BOOKABLE_END_TIME }}</span>
            </div>
          </article>
        </template>

        <van-loading v-if="isLoading" class="matrix-state" type="spinner">加载空间数据中</van-loading>

        <div v-else-if="isError" class="matrix-state">
          <p>空间数据加载失败</p>
          <button type="button" @click="retryLoad">重新加载</button>
        </div>

        <van-empty v-else-if="hierarchyIsEmpty" :description="hierarchyEmptyDescription" />
      </div>
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
          <button :class="{ active: buildingFilter === 'all' }" type="button" @click="changeBuildingFilter('all')">
            全部楼栋
          </button>
          <button
            v-for="building in buildingOptions"
            :key="building"
            :class="{ active: buildingFilter === building }"
            type="button"
            @click="changeBuildingFilter(building)"
          >
            {{ building }}
          </button>
        </div>
      </div>

      <div v-if="floorOptions.length" class="filter-group">
        <h3>楼层</h3>
        <div class="filter-options">
          <button :class="{ active: floorFilter === 'all' }" type="button" @click="changeFloorFilter('all')">
            全部楼层
          </button>
          <button
            v-for="floor in floorOptions"
            :key="floor"
            :class="{ active: floorFilter === floor }"
            type="button"
            @click="changeFloorFilter(floor)"
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
}

.home-hero {
  flex: 0 0 auto;
  position: relative;
  margin: 0 -16px;
  padding: calc(env(safe-area-inset-top) + 14px) 16px 14px;
  color: #fff;
  background:
    linear-gradient(90deg, rgba(0, 103, 255, 0.98), rgba(22, 119, 255, 0.78)),
    #1677ff;
}

.home-hero::after {
  position: absolute;
  inset: 0;
  content: '';
  background:
    linear-gradient(90deg, rgba(0, 103, 255, 0), rgba(255, 255, 255, 0.1)),
    repeating-linear-gradient(90deg, transparent 0 34px, rgba(255, 255, 255, 0.1) 35px 36px);
  opacity: 0.32;
  pointer-events: none;
}

.home-hero__content {
  position: relative;
  z-index: 1;
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
  width: 82px;
  color: var(--space-text);
  font-size: 15px;
  font-weight: 800;
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

.schedule-card {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  margin: -2px 0 0;
  padding: 12px 0 0;
  overflow: hidden;
}

.date-row {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px 50px;
  gap: 6px;
  align-items: center;
  padding-bottom: 10px;
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

.room-list {
  flex: 1 1 auto;
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: 0 0 14px;
}

.hierarchy-nav {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 4px 0;
  background: var(--space-bg);
}

.hierarchy-nav button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px 0 9px;
  color: var(--space-blue);
  background: #fff;
  border: 1px solid rgba(22, 119, 255, 0.2);
  border-radius: 12px;
  font-size: 15px;
  font-weight: 850;
}

.hierarchy-nav button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-nav p {
  margin: 0;
  overflow: hidden;
  color: var(--space-subtext);
  font-size: 13px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-card {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 88px;
  padding: 14px 12px;
  color: var(--space-text);
  text-align: left;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 8px;
  box-shadow: 0 8px 22px rgba(54, 89, 150, 0.08);
}

.hierarchy-card__icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  min-height: 64px;
  overflow: hidden;
  color: #0f7a57;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
}

.hierarchy-card--floor .hierarchy-card__icon {
  color: var(--space-blue);
  background: #edf5ff;
  border-color: rgba(22, 119, 255, 0.22);
}

.hierarchy-card__image-button {
  padding: 0;
}

.hierarchy-card__icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.hierarchy-card__entry {
  grid-column: 2 / 4;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  padding: 0;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
}

.hierarchy-card__content {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.hierarchy-card__content strong {
  overflow: hidden;
  font-size: 19px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-card__content small {
  overflow: hidden;
  color: var(--space-subtext);
  font-size: 13px;
  font-weight: 760;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-card > svg,
.hierarchy-card__entry > svg {
  color: var(--space-muted);
}

.room-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 8px;
  box-shadow: 0 8px 22px rgba(54, 89, 150, 0.08);
}

.room-card__main {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.room-icon {
  display: grid;
  place-items: center;
  width: 54px;
  min-height: 54px;
  color: #0f7a57;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 999px;
}

.room-info {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.room-title {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 0;
  color: var(--space-text);
  text-align: left;
  background: transparent;
  border: 0;
}

.room-title strong {
  overflow: hidden;
  font-size: 19px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-title svg {
  color: var(--space-muted);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.tag-row span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  color: #08724a;
  background: #eaf8f0;
  border-radius: 2px;
  font-size: 13px;
  font-weight: 760;
}

.tag-row span:nth-child(3) {
  color: #6b7280;
  background: #f2f4f7;
}

.timeline {
  --timeline-line-top: 14px;
  --timeline-line-height: 6px;
  --timeline-segment-height: 8px;
  position: relative;
  width: 100%;
  min-height: 32px;
  padding: 0;
}

/* 灰色轨道和占用段统一挂在 .timeline 坐标系，避免刷新或不同屏宽下按钮子层级造成垂直错位。 */
.timeline::before {
  position: absolute;
  top: var(--timeline-line-top);
  right: 0;
  left: 0;
  z-index: 1;
  height: var(--timeline-line-height);
  background: #eef2f7;
  border-radius: 999px;
  content: '';
  pointer-events: none;
}

.timeline-track-button {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  line-height: 0;
}

.timeline-segment {
  position: absolute;
  top: calc(var(--timeline-line-top) + (var(--timeline-line-height) - var(--timeline-segment-height)) / 2);
  z-index: 2;
  height: var(--timeline-segment-height);
  min-width: 14px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  pointer-events: none;
}

.timeline-segment span {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.is-reviewing {
  color: #9a5b00;
  background: #f59e0b;
}

.is-occupied {
  color: #0f65e8;
  background: #a7f3d0;
}

.is-free {
  color: #078047;
  background: #eaf8f0;
}

.time-labels {
  display: flex;
  justify-content: space-between;
  color: var(--space-text);
  font-size: 14px;
  line-height: 1.2;
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

  .room-title strong {
    font-size: 17px;
  }

  .tag-row span {
    min-height: 26px;
    padding: 0 8px;
    font-size: 12px;
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
