import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview, showToast } from 'vant'
import {
  getRoom,
  getPublicRoom,
  listPublicReservationItems,
  listReservationItems,
  listPublicTimePeriods,
  updateRoom,
  type BackendReservationItem,
  type BackendSpaceRoom,
} from '@/api/space'
import {
  addDays,
  BOOKABLE_END_MINUTE,
  BOOKABLE_END_TIME,
  BOOKABLE_SLOT_MINUTES,
  BOOKABLE_START_MINUTE,
  BOOKABLE_START_TIME,
  BOOKABLE_TOTAL_MINUTES,
  buildBookableTimeSlots,
  currentDayMinute,
  formatBackendTime,
  formatDateValue,
  formatWeekday,
  minutesToTime,
  resolveSpaceAssetUrl,
  roundUpToBookableSlot,
  sortBackendTimePeriods,
  timeToMinutes,
  toRoomStatus,
  toUiRoomBase,
  toUiTimePeriod,
} from '@/services/spaceMapper'
import { useSessionStore } from '@/stores/session'
import type { Room } from '@/types/space'
import {
  buildSegmentContactText,
  clampPercent,
  formatMonthDay,
  getPeriodEnd,
  getPeriodStart,
  normalizeDisplayText,
  pickPeriodItem,
  roomOpenStatusText,
  startOfWeek,
  statusText,
  type AgendaTimeTick,
  type SelectedTimeRange,
  type WeekCell,
  type WeekDayPanel,
  type WeekTimelineSegment,
} from '@/services/roomSchedule'

// 房间详情：周时间轴占用、半小时时段选择、管理员启停等逻辑。从 RoomDetailView.vue 抽出。
export function useRoomSchedule() {
  const route = useRoute()
  const router = useRouter()
  const queryClient = useQueryClient()
  const session = useSessionStore()
  const showRoomStatusPanel = ref(false)
  const adminRoom = ref<BackendSpaceRoom>()
  const adminRoomLoading = ref(false)
  const roomStatusSubmitting = ref('')
  const expandedDateValue = ref(firstQueryValue(route.query.date) || formatDateValue(new Date()))
  const selectedSlotKeys = ref<string[]>([])

  function firstQueryValue(value: unknown) {
    if (Array.isArray(value)) return String(value[0] ?? '')
    return typeof value === 'string' ? value : ''
  }

  function goBack() {
    if (firstQueryValue(route.query.from) === 'home') {
      router.push({
        name: 'home',
        query: {
          date: bookingDate.value,
          building: firstQueryValue(route.query.building) || room.value.building || undefined,
          floor: firstQueryValue(route.query.floor) || room.value.floor || undefined,
        },
      })
      return
    }

    if (firstQueryValue(route.query.from) === 'rooms-admin') {
      router.push({
        name: 'rooms-admin',
        query: {
          keyword: firstQueryValue(route.query.keyword) || undefined,
          building: firstQueryValue(route.query.building) || room.value.building || undefined,
          floor: firstQueryValue(route.query.floor) || room.value.floor || undefined,
          type: firstQueryValue(route.query.type) || undefined,
          status: firstQueryValue(route.query.status) || undefined,
          equipment: route.query.equipment || undefined,
        },
      })
      return
    }

    router.back()
  }

  function getSourceRouteQuery() {
    return {
      from: firstQueryValue(route.query.from) || undefined,
      keyword: firstQueryValue(route.query.keyword) || undefined,
      building: firstQueryValue(route.query.building) || room.value.building || undefined,
      floor: firstQueryValue(route.query.floor) || room.value.floor || undefined,
      type: firstQueryValue(route.query.type) || undefined,
      status: firstQueryValue(route.query.status) || undefined,
      equipment: route.query.equipment || undefined,
    }
  }

  function parseDateValue(value: unknown) {
    const dateText = firstQueryValue(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return new Date()

    const [year = 0, month = 1, day = 1] = dateText.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const selectedDate = ref(parseDateValue(route.query.date))
  const selectedPeriodId = ref(firstQueryValue(route.query.period))
  const selectedStartTime = ref(firstQueryValue(route.query.startTime))
  const selectedEndTime = ref(firstQueryValue(route.query.endTime))
  const bookingDate = computed(() => formatDateValue(selectedDate.value))
  const weekStart = computed(() => startOfWeek(selectedDate.value))
  const weekEnd = computed(() => addDays(weekStart.value, 6))
  const weekStartValue = computed(() => formatDateValue(weekStart.value))
  const weekRangeText = computed(() => `${formatDateValue(weekStart.value)} 至 ${formatDateValue(weekEnd.value)}`)
  const todayValue = formatDateValue(new Date())
  const timelineStartMinute = BOOKABLE_START_MINUTE
  const timelineEndMinute = BOOKABLE_END_MINUTE
  const timelineTotalMinutes = BOOKABLE_TOTAL_MINUTES
  const timelineMiddleText = minutesToTime(timelineStartMinute + timelineTotalMinutes / 2)
  // 展开后的详情区采用纵向日程轴：刻度、占用块、选择块共用同一套比例，避免视觉位置和真实时间错位。
  const DETAIL_PIXELS_PER_MINUTE = 1.6
  const AGENDA_TICK_MINUTES = 30
  const DETAIL_MINOR_TICK_MINUTES = 10
  const detailSlotHeight = Math.round(BOOKABLE_SLOT_MINUTES * DETAIL_PIXELS_PER_MINUTE)
  const detailMinorTickHeight = Math.round(DETAIL_MINOR_TICK_MINUTES * DETAIL_PIXELS_PER_MINUTE)
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

  function getRoundedNowMinute() {
    return roundUpToBookableSlot(currentDayMinute())
  }

  function getExpiredCutoffMinute(dateValue: string) {
    if (dateValue < todayValue) return timelineEndMinute
    if (dateValue > todayValue) return timelineStartMinute
    return Math.min(Math.max(getRoundedNowMinute(), timelineStartMinute), timelineEndMinute)
  }

  function isPastTimeRange(dateValue: string, endTime?: string) {
    const endText = formatBackendTime(endTime)
    if (!endText) return false
    if (dateValue < todayValue) return true
    if (dateValue > todayValue) return false
    return timeToMinutes(endText) <= getExpiredCutoffMinute(dateValue)
  }

  async function loadDayReservationItems(roomId: string, date: string, canViewReviewing: boolean) {
    if (canViewReviewing) {
      try {
        const result = await listReservationItems({
          roomId: Number(roomId),
          bookingDate: date,
          occupiedOnly: true,
        })
        return result.rows
      } catch {
        // 高权限接口失败时降级到公开接口，保证普通账号或权限缓存异常时页面仍可用。
      }
    }

    const result = await listPublicReservationItems({
      roomId: Number(roomId),
      bookingDate: date,
    })
    return result.rows
  }

  async function loadRoomDetail() {
    const roomId = String(route.params.roomId)
    const dateValues = weekDays.value.map((day) => day.value)
    const [room, periodsResult, itemResults] = await Promise.all([
      getPublicRoom(roomId),
      listPublicTimePeriods(),
      Promise.all(dateValues.map((date) => loadDayReservationItems(roomId, date, session.canViewReviewingSlots))),
    ])
    const periods = sortBackendTimePeriods(periodsResult.rows).map(toUiTimePeriod)
    const roomBase = room ? toUiRoomBase(room) : undefined
    const itemsByDate = dateValues.reduce<Record<string, BackendReservationItem[]>>((itemsMap, date, index) => {
      itemsMap[date] = itemResults[index] ?? []
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
    queryKey: computed(() => [
      'h5-room-detail-week',
      String(route.params.roomId),
      weekStartValue.value,
      session.canViewReviewingSlots ? 'full' : 'public',
    ]),
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
  const timePeriods = computed(() => {
    const periods = detailQuery.data.value?.periods ?? []
    return periods.length ? periods : buildBookableTimeSlots()
  })

  function getExpiredPercent(dateValue: string) {
    const cutoffMinute = getExpiredCutoffMinute(dateValue)
    return clampPercent(((cutoffMinute - timelineStartMinute) / timelineTotalMinutes) * 100)
  }

  function getTimelineStyle(startTime: string, endTime: string) {
    const startMinute = Math.max(timeToMinutes(startTime), timelineStartMinute)
    const endMinute = Math.min(timeToMinutes(endTime), timelineEndMinute)
    const widthMinutes = Math.max(endMinute - startMinute, BOOKABLE_SLOT_MINUTES)

    return {
      left: clampPercent(((startMinute - timelineStartMinute) / timelineTotalMinutes) * 100),
      width: clampPercent((widthMinutes / timelineTotalMinutes) * 100),
    }
  }

  function buildTimelineSegment(item: BackendReservationItem, dateValue: string): WeekTimelineSegment | null {
    const status = toRoomStatus(item.itemStatus)
    if (!status || status === 'free') return null

    const startTime = formatBackendTime(item.startTime)
    const endTime = formatBackendTime(item.endTime)
    if (!startTime || !endTime || timeToMinutes(endTime) <= timelineStartMinute || timeToMinutes(startTime) >= timelineEndMinute) {
      return null
    }

    const style = getTimelineStyle(startTime, endTime)
    const segmentStatus = isPastTimeRange(dateValue, endTime) ? 'expired' : status
    const label = segmentStatus === 'expired' ? '已过期' : status === 'reviewing' ? '审核中' : '占用'
    const applicantName = normalizeDisplayText(item.applicantName)
    const applicantPhone = normalizeDisplayText(item.applicantPhone)
    const contactAddress = normalizeDisplayText(item.orgName)

    return {
      id: String(item.itemId ?? `${item.roomId}-${dateValue}-${startTime}-${endTime}`),
      date: dateValue,
      status: segmentStatus,
      sourceStatus: status,
      title: item.title || label,
      label,
      applicantName,
      applicantPhone,
      contactAddress,
      contactText: buildSegmentContactText(item),
      startTime,
      endTime,
      left: style.left,
      width: style.width,
      reservationId: item.reservationId ? String(item.reservationId) : undefined,
      itemId: item.itemId ? String(item.itemId) : undefined,
    }
  }

  function buildWeekDayPanel(day: (typeof weekDays.value)[number], rawItems: BackendReservationItem[]): WeekDayPanel {
    const roomId = String(route.params.roomId)
    const roomItems = rawItems.filter((item) => String(item.roomId ?? '') === roomId)
    const cells = timePeriods.value.map<WeekCell>((period, slotIndex) => {
      const startTime = getPeriodStart(period)
      const endTime = getPeriodEnd(period)
      const item = pickPeriodItem(roomItems, period)
      const itemStatus = toRoomStatus(item?.itemStatus)
      const isExpired = isPastTimeRange(day.value, endTime)
      const status = isExpired ? 'expired' : itemStatus ?? 'free'

      return {
        slotIndex,
        date: day.value,
        period,
        status,
        summary: item?.title || (status === 'free' ? '可预约' : status === 'expired' ? '已过期' : statusText(status)),
        applicantName: item?.applicantName || '',
        startTime,
        endTime,
        reservationId: item?.reservationId ? String(item.reservationId) : undefined,
        itemId: item?.itemId ? String(item.itemId) : undefined,
      }
    })
    const segments = roomItems
      .map((item) => buildTimelineSegment(item, day.value))
      .filter((segment): segment is WeekTimelineSegment => Boolean(segment))
      .sort((prev, next) => timeToMinutes(prev.startTime) - timeToMinutes(next.startTime))
    const freeCount = cells.filter((cell) => cell.status === 'free').length

    return {
      ...day,
      cells,
      segments,
      expiredPercent: getExpiredPercent(day.value),
      availableText: freeCount ? `${freeCount} 个半小时可约` : day.value < todayValue ? '已过期' : '暂无可约时段',
    }
  }

  const weekDayPanels = computed<WeekDayPanel[]>(() => {
    const itemsByDate = detailQuery.data.value?.itemsByDate ?? {}

    return weekDays.value.map((day) => buildWeekDayPanel(day, itemsByDate[day.value] ?? []))
  })
  const expandedDay = computed(() => weekDayPanels.value.find((day) => day.value === expandedDateValue.value))
  const selectedCell = computed(() => {
    const startTime = formatBackendTime(selectedStartTime.value)
    const cells = weekDayPanels.value.flatMap((day) => day.cells)
    return (
      cells.find(
        (cell) =>
          cell.date === bookingDate.value &&
          cell.startTime === startTime &&
          cell.endTime === formatBackendTime(selectedEndTime.value),
      ) ??
      (startTime ? cells.find((cell) => cell.date === bookingDate.value && cell.startTime === startTime) : undefined) ??
      (selectedPeriodId.value
        ? cells.find((cell) => cell.date === bookingDate.value && cell.period.id === selectedPeriodId.value)
        : undefined) ??
      undefined
    )
  })
  const selectedPeriodText = computed(() => {
    const cell = selectedCell.value
    const startTime = formatBackendTime(selectedStartTime.value) || cell?.startTime || ''
    const endTime = formatBackendTime(selectedEndTime.value) || cell?.endTime || ''
    return startTime && endTime ? `${startTime}-${endTime}` : ''
  })
  const selectedCells = computed(() => {
    const keys = new Set(selectedSlotKeys.value)
    if (!keys.size) return []

    return weekDayPanels.value
      .flatMap((day) => day.cells)
      .filter((cell) => cell.date === bookingDate.value && cell.status === 'free' && keys.has(getCellKey(cell)))
      .sort((prev, next) => timeToMinutes(prev.startTime) - timeToMinutes(next.startTime))
  })
  const selectedSlotCount = computed(() => selectedCells.value.length)
  const selectedTimeRanges = computed<SelectedTimeRange[]>(() => {
    const ranges: SelectedTimeRange[] = []

    selectedCells.value.forEach((cell) => {
      const lastRange = ranges[ranges.length - 1]
      if (lastRange && lastRange.date === cell.date && lastRange.endTime === cell.startTime) {
        lastRange.endTime = cell.endTime
        lastRange.cells.push(cell)
        lastRange.key = `${lastRange.date}-${lastRange.startTime}-${lastRange.endTime}`
        return
      }

      ranges.push({
        key: `${cell.date}-${cell.startTime}-${cell.endTime}`,
        date: cell.date,
        periodId: cell.period.id,
        startTime: cell.startTime,
        endTime: cell.endTime,
        cells: [cell],
      })
    })

    return ranges
  })
  const selectedRangeText = computed(() => {
    if (!selectedCells.value.length) return selectedPeriodText.value
    return selectedTimeRanges.value.map((range) => `${range.startTime}-${range.endTime}`).join('、')
  })
  const expandedDateText = computed(() => {
    const day = expandedDay.value
    return day ? `${day.value} ${formatWeekday(day.date)}` : selectedDateText.value
  })
  const selectedDateText = computed(() => `${bookingDate.value} ${formatWeekday(selectedDate.value)}`)
  const canReserveSelectedSlot = computed(() => selectedCell.value?.status === 'free' && selectedSlotCount.value > 0)
  const reserveButtonText = computed(() => {
    if (!selectedCell.value) return '请选择时段'
    if (selectedCell.value.status === 'expired') return '已过期不可预约'
    if (selectedCell.value.status === 'free') return selectedSlotCount.value > 1 ? `预约 ${selectedSlotCount.value} 个时段` : '预约选中时段'
    return '当前时段不可预约'
  })
  const isLoading = computed(() => detailQuery.isLoading.value)
  const isError = computed(() => detailQuery.isError.value)
  const adminRoomStatus = computed(() => adminRoom.value?.status ?? detailQuery.data.value?.backendRoom?.status ?? '0')
  const roomStatusText = computed(() => roomOpenStatusText(adminRoomStatus.value))
  const roomStatusCanEnable = computed(() => adminRoomStatus.value === '1')
  const roomStatusCanDisable = computed(() => adminRoomStatus.value !== '1')
  const roomImageUrl = computed(() => resolveSpaceAssetUrl(room.value.imageUrl))

  function previewRoomImage() {
    if (!roomImageUrl.value) return

    showImagePreview({
      images: [roomImageUrl.value],
      closeable: true,
      showIndex: false,
    })
  }

  function updateSelection(dateValue: string, periodId = '', startTime = '', endTime = '') {
    selectedDate.value = parseDateValue(dateValue)
    selectedPeriodId.value = periodId
    selectedStartTime.value = formatBackendTime(startTime)
    selectedEndTime.value = formatBackendTime(endTime)
    void router.replace({
      query: {
        ...route.query,
        date: dateValue,
        period: periodId,
        startTime: selectedStartTime.value || undefined,
        endTime: selectedEndTime.value || undefined,
      },
    })
  }

  function expandDay(day: WeekDayPanel) {
    expandedDateValue.value = expandedDateValue.value === day.value ? '' : day.value
    selectedDate.value = parseDateValue(day.value)
    selectedPeriodId.value = ''
    selectedStartTime.value = ''
    selectedEndTime.value = ''
    selectedSlotKeys.value = []
    void router.replace({
      query: {
        ...route.query,
        date: day.value,
        period: undefined,
        startTime: undefined,
        endTime: undefined,
      },
    })
  }

  function changeWeek(weeks: number) {
    const nextDate = addDays(selectedDate.value, weeks * 7)
    updateSelection(formatDateValue(nextDate))
    expandedDateValue.value = formatDateValue(nextDate)
    selectedSlotKeys.value = []
  }

  function backThisWeek() {
    const today = formatDateValue(new Date())
    updateSelection(today)
    expandedDateValue.value = today
    selectedSlotKeys.value = []
  }

  function getCellKey(cell: WeekCell) {
    return `${cell.date}-${cell.startTime}-${cell.endTime}`
  }

  function getSelectableCells(day: WeekDayPanel) {
    return day.cells.filter((cell) => cell.status !== 'expired')
  }

  function getUnselectedSelectableCells(day: WeekDayPanel) {
    return getSelectableCells(day).filter((cell) => cell.status !== 'free' || !isCellInSelectedRange(cell))
  }

  function getVisibleAgendaStartMinute(day: WeekDayPanel) {
    const firstVisibleCell = getSelectableCells(day)[0]
    return firstVisibleCell ? timeToMinutes(firstVisibleCell.startTime) : timelineEndMinute
  }

  function getVisibleAgendaHeight(day: WeekDayPanel) {
    const startMinute = getVisibleAgendaStartMinute(day)
    if (startMinute >= timelineEndMinute) return 120
    return Math.round((timelineEndMinute - startMinute) * DETAIL_PIXELS_PER_MINUTE)
  }

  function getAgendaTicks(day: WeekDayPanel): AgendaTimeTick[] {
    const startMinute = getVisibleAgendaStartMinute(day)
    if (startMinute >= timelineEndMinute) return []

    const firstTick = Math.ceil(startMinute / AGENDA_TICK_MINUTES) * AGENDA_TICK_MINUTES
    const ticks: AgendaTimeTick[] = []
    for (let minute = firstTick; minute <= timelineEndMinute; minute += AGENDA_TICK_MINUTES) {
      ticks.push({
        key: `${day.value}-${minute}`,
        time: minutesToTime(minute),
        top: Math.round((minute - startMinute) * DETAIL_PIXELS_PER_MINUTE),
      })
    }
    return ticks
  }

  function selectDetailCell(day: WeekDayPanel, cell: WeekCell) {
    if (cell.status !== 'free') {
      if (cell.status === 'expired') {
        showToast('该时段已过期')
        return
      }
      openSlotDetail(cell)
      return
    }

    const key = getCellKey(cell)
    const currentKeys = bookingDate.value === day.value ? selectedSlotKeys.value : []
    const nextKeys = currentKeys.includes(key) ? currentKeys.filter((item) => item !== key) : [...currentKeys, key]
    selectedSlotKeys.value = nextKeys

    if (nextKeys.length) {
      const selectedDayCells = day.cells
        .filter((item) => nextKeys.includes(getCellKey(item)))
        .sort((prev, next) => timeToMinutes(prev.startTime) - timeToMinutes(next.startTime))
      const firstCell = selectedDayCells[0]
      const lastCell = selectedDayCells[selectedDayCells.length - 1]
      updateSelection(day.value, firstCell?.period.id ?? '', firstCell?.startTime ?? '', lastCell?.endTime ?? '')
      return
    }

    updateSelection(day.value)
  }

  function clickDetailCell(day: WeekDayPanel, cell: WeekCell) {
    selectDetailCell(day, cell)
  }

  function openSlotDetail(cell: WeekCell) {
    router.push({
      path: `/rooms/${room.value.id}/slot`,
      query: {
        ...getSourceRouteQuery(),
        date: cell.date,
        period: cell.period.id,
        startTime: cell.startTime,
        endTime: cell.endTime,
        itemId: cell.itemId,
      },
    })
  }

  function openSegment(segment: WeekTimelineSegment) {
    if (segment.status === 'expired') {
      showToast('该时段已过期')
      return
    }

    router.push({
      path: `/rooms/${room.value.id}/slot`,
      query: {
        ...getSourceRouteQuery(),
        date: segment.date,
        startTime: segment.startTime,
        endTime: segment.endTime,
        itemId: segment.itemId,
      },
    })
  }

  function reserveSelectedSlot() {
    const firstRange = selectedTimeRanges.value[0]
    const lastRange = selectedTimeRanges.value[selectedTimeRanges.value.length - 1]
    if (!firstRange || !lastRange) return
    const slots = selectedTimeRanges.value.map((range) => `${range.startTime}-${range.endTime}`).join(',')

    router.push({
      name: 'reservation-apply',
      query: {
        roomId: room.value.id,
        period: firstRange.periodId,
        date: firstRange.date,
        startTime: firstRange.startTime,
        endTime: lastRange.endTime,
        slots,
      },
    })
  }

  function isSelectedDay(day: WeekDayPanel) {
    return day.value === expandedDateValue.value
  }

  function isSelectedSegment(segment: WeekTimelineSegment) {
    return (
      segment.date === bookingDate.value &&
      segment.startTime === selectedCell.value?.startTime &&
      segment.endTime === selectedCell.value?.endTime
    )
  }

  function getSegmentStyle(segment: WeekTimelineSegment) {
    return {
      left: `${segment.left}%`,
      width: `${segment.width}%`,
    }
  }

  function getCellTimelineStyle(cell: WeekCell) {
    const style = getTimelineStyle(cell.startTime, cell.endTime)
    return {
      left: `${style.left}%`,
      width: `${style.width}%`,
    }
  }

  function getAgendaRangeStyle(startTime: string, endTime: string) {
    return getAgendaOffsetRangeStyle(timelineStartMinute, startTime, endTime)
  }

  function getAgendaOffsetRangeStyle(baseMinute: number, startTime: string, endTime: string) {
    const startMinute = Math.max(timeToMinutes(startTime), baseMinute)
    const endMinute = Math.min(timeToMinutes(endTime), timelineEndMinute)
    const duration = Math.max(endMinute - startMinute, BOOKABLE_SLOT_MINUTES)

    return {
      top: `${Math.round((startMinute - baseMinute) * DETAIL_PIXELS_PER_MINUTE)}px`,
      height: `${Math.max(Math.round(duration * DETAIL_PIXELS_PER_MINUTE), 48)}px`,
    }
  }

  function getAgendaCellStyle(day: WeekDayPanel, cell: WeekCell) {
    return getAgendaOffsetRangeStyle(getVisibleAgendaStartMinute(day), cell.startTime, cell.endTime)
  }

  function getAgendaRangeButtonStyle(day: WeekDayPanel, range: SelectedTimeRange) {
    return getAgendaOffsetRangeStyle(getVisibleAgendaStartMinute(day), range.startTime, range.endTime)
  }

  function getAgendaSegmentStyle(day: WeekDayPanel, segment: WeekTimelineSegment) {
    return getAgendaOffsetRangeStyle(getVisibleAgendaStartMinute(day), segment.startTime, segment.endTime)
  }

  function durationText(startTime: string, endTime: string) {
    const minutes = Math.max(timeToMinutes(endTime) - timeToMinutes(startTime), 0)
    if (!minutes) return ''
    return `${minutes}分钟`
  }

  function isCellInSelectedRange(cell: WeekCell) {
    return selectedSlotKeys.value.includes(getCellKey(cell))
  }

  function cancelSelectedRange(range: SelectedTimeRange) {
    const cancelKeys = new Set(range.cells.map(getCellKey))
    selectedSlotKeys.value = selectedSlotKeys.value.filter((key) => !cancelKeys.has(key))

    const nextCells = selectedCells.value.filter((cell) => !cancelKeys.has(getCellKey(cell)))
    const firstCell = nextCells[0]
    const lastCell = nextCells[nextCells.length - 1]
    updateSelection(range.date, firstCell?.period.id ?? '', firstCell?.startTime ?? '', lastCell?.endTime ?? '')
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

  // 仅内部计算使用、模板不直接引用的函数，保留引用避免未使用告警。
  void getAgendaRangeStyle

  return {
    BOOKABLE_START_TIME,
    BOOKABLE_END_TIME,
    timelineMiddleText,
    detailSlotHeight,
    detailMinorTickHeight,
    room,
    roomImageUrl,
    weekRangeText,
    weekDayPanels,
    expandedDateText,
    selectedCell,
    selectedDateText,
    selectedRangeText,
    selectedSlotCount,
    selectedTimeRanges,
    canReserveSelectedSlot,
    reserveButtonText,
    isLoading,
    isError,
    showRoomStatusPanel,
    adminRoomStatus,
    adminRoomLoading,
    roomStatusSubmitting,
    roomStatusText,
    roomStatusCanEnable,
    roomStatusCanDisable,
    goBack,
    previewRoomImage,
    backThisWeek,
    changeWeek,
    isSelectedDay,
    expandDay,
    isCellInSelectedRange,
    getCellTimelineStyle,
    isSelectedSegment,
    getSegmentStyle,
    openSegment,
    getVisibleAgendaHeight,
    getAgendaTicks,
    getUnselectedSelectableCells,
    getAgendaCellStyle,
    clickDetailCell,
    getAgendaRangeButtonStyle,
    cancelSelectedRange,
    getAgendaSegmentStyle,
    durationText,
    reserveSelectedSlot,
    openRoomStatusPanel,
    changeRoomStatus,
  }
}
