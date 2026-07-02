import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview, showToast } from 'vant'
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

export type HomeRoomStatusFilter = 'all' | RoomStatus

export interface HomeOccupancySegment {
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

export interface HomeRoom extends Omit<Room, 'slots'> {
  slots: []
  segments: HomeOccupancySegment[]
  dayStatus: RoomStatus
  statusText: string
}

export interface HomeFloorGroup {
  name: string
  roomCount: number
  rooms: HomeRoom[]
  imageUrl?: string
}

export interface HomeBuildingGroup {
  name: string
  floorCount: number
  roomCount: number
  floors: HomeFloorGroup[]
}

// 首页多级菜单（楼栋->楼层->房间）、时间轴占用与筛选逻辑。从 HomeView.vue 抽出。
export function useHomeSchedule() {
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

  return {
    BOOKABLE_START_TIME,
    BOOKABLE_END_TIME,
    keyword,
    selectedDate,
    showFilterPanel,
    showCalendar,
    roomStatusFilter,
    buildingFilter,
    floorFilter,
    roomTypeFilter,
    equipmentFilters,
    calendarMinDate,
    calendarMaxDate,
    dateText,
    weekdayText,
    statusFilterOptions,
    timelineMiddleText,
    isLoading,
    isError,
    buildingOptions,
    floorOptions,
    roomTypeOptions,
    equipmentOptions,
    activeFilterCount,
    hasActiveFilters,
    filteredRooms,
    buildingGroups,
    selectedBuilding,
    selectedFloor,
    floorGroups,
    currentFloorRooms,
    hierarchyLevel,
    hierarchyIsEmpty,
    hierarchyEmptyDescription,
    changeDate,
    backToday,
    resetFilters,
    toggleEquipmentFilter,
    changeBuildingFilter,
    changeFloorFilter,
    selectBuilding,
    selectFloor,
    previewFloorImage,
    backToBuildings,
    backToFloors,
    confirmCalendarDate,
    retryLoad,
    openRoomDetail,
    reserveRoom,
    statusClass,
  }
}
