import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  BOOKABLE_END_MINUTE,
  BOOKABLE_START_MINUTE,
  addDays,
  buildBookableTimeSlots,
  currentDayMinute,
  formatDateValue,
  isAlignedBookableRange,
  roundUpToBookableSlot,
  timeToMinutes,
} from '@/services/spaceMapper'
import {
  LONG_RESERVATION_MODE_LABELS,
  LONG_RESERVATION_RULE_TYPES,
  saveLongReservationRuleDraft,
  type LongReservationCustomDateSlot,
  type LongReservationMode,
  type LongReservationTimeRange,
} from '@/services/longReservationDraft'

// 长期预约排课规则（每周固定/每日固定/自定义多日期多时段）的表单与时段选择逻辑。
// 从 LongReservationApplyView.vue 抽出，视图仅保留模板与子组件。
export function useLongReservationForm() {
  const router = useRouter()
  const today = formatDateValue(new Date())
  const nextMonth = formatDateValue(addDays(new Date(), 30))
  const weekdayOptions = [
    { value: '1', label: '周一' },
    { value: '2', label: '周二' },
    { value: '3', label: '周三' },
    { value: '4', label: '周四' },
    { value: '5', label: '周五' },
    { value: '6', label: '周六' },
    { value: '0', label: '周日' },
  ]

  const modeOptions: Array<{ value: LongReservationMode; label: string; tip: string }> = [
    { value: 'weekly', label: '每周固定', tip: '适合固定排课' },
    { value: 'daily', label: '每日固定', tip: '适合连续训练' },
    { value: 'custom', label: '自定义', tip: '多日期多时段' },
  ]

  const timeSlots = buildBookableTimeSlots().map((slot) =>
    createTimeRange(slot.startTime, slot.endTime || slot.time.split('-')[1] || slot.startTime),
  )
  const timelineStartMinute = BOOKABLE_START_MINUTE
  const timelineEndMinute = BOOKABLE_END_MINUTE
  const timelineMiddleText = '15:30'
  const defaultTimeRange = createTimeRange('08:30', '09:00')

  const form = reactive({
    mode: 'weekly' as LongReservationMode,
    startDate: today,
    endDate: nextMonth,
    weekdays: ['1'],
    weekdayTimeRanges: {
      '1': [defaultTimeRange],
    } as Record<string, LongReservationTimeRange[]>,
    customSlots: [] as LongReservationCustomDateSlot[],
    timeRanges: [defaultTimeRange] as LongReservationTimeRange[],
  })
  const activeWeekday = ref('1')

  const customPicker = reactive({
    open: false,
    step: 'date' as 'date' | 'time',
    monthDate: new Date(today),
    selectedDate: today,
    selectedRanges: [defaultTimeRange] as LongReservationTimeRange[],
  })

  const normalizedTimeRanges = computed<LongReservationTimeRange[]>(() =>
    form.mode === 'custom' ? [] : form.mode === 'weekly' ? normalizedWeekdayRanges.value : normalizedDailyRanges.value,
  )
  const normalizedDailyRanges = computed(() => normalizeRanges(form.timeRanges))
  const normalizedWeekdayRanges = computed(() =>
    form.weekdays.flatMap((weekday) => getWeekdayRanges(weekday).map((range) => ({ ...range, name: weekdayLabel(weekday) }))),
  )
  const activeWeekdayRanges = computed(() => getWeekdayRanges(activeWeekday.value))
  const customSlots = computed(() => [...form.customSlots].sort((prev, next) => prev.date.localeCompare(next.date)))
  const customSlotCount = computed(() =>
    customSlots.value.reduce((total, slot) => total + slot.timeRanges.length, 0),
  )
  const pickedDates = computed(() => buildPickedDates())
  const dateSummary = computed(() => {
    const dates = pickedDates.value
    if (form.mode === 'custom') {
      return dates.length ? `${dates.length} 个日期` : '暂无日期'
    }
    if (!form.startDate || !form.endDate) return '暂无日期'
    return `${form.startDate} 至 ${form.endDate}`
  })
  const summaryTimeCount = computed(() => (form.mode === 'custom' ? customSlotCount.value : normalizedTimeRanges.value.length))
  const totalSlotCount = computed(() =>
    form.mode === 'custom' ? customSlotCount.value : buildFixedRuleSlots().length,
  )
  const canPickRoom = computed(() => pickedDates.value.length > 0)
  const calendarMonthTitle = computed(
    () => `${customPicker.monthDate.getFullYear()}年${customPicker.monthDate.getMonth() + 1}月`,
  )
  const calendarDays = computed(() => {
    const monthStart = new Date(customPicker.monthDate.getFullYear(), customPicker.monthDate.getMonth(), 1)
    const gridStart = addDays(monthStart, -monthStart.getDay())

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index)
      const dateText = formatDateValue(date)
      return {
        date: dateText,
        day: date.getDate(),
        outside: date.getMonth() !== customPicker.monthDate.getMonth(),
        disabled: dateText < today,
        selected: dateText === customPicker.selectedDate,
        hasSlots: form.customSlots.some((slot) => slot.date === dateText),
      }
    })
  })
  const weeklyTimelineRows = computed(() =>
    weekdayOptions.map((weekday) => {
      const firstDate = getFirstDateForWeekday(weekday.value)
      return {
        ...weekday,
        enabled: form.weekdays.includes(weekday.value),
        ranges: getWeekdayRanges(weekday.value),
        date: firstDate,
        dateText: formatMonthDay(firstDate),
        titleText: formatAgendaDateTitle(firstDate, weekday.label),
        today: firstDate === today,
      }
    }),
  )
  const dailyTimelineRows = computed(() => [
    {
      value: 'daily',
      label: '每日',
      enabled: true,
      ranges: normalizedDailyRanges.value,
      dateText: dateSummary.value,
      today: false,
    },
  ])

  watch(
    () => form.weekdays,
    (weekdays) => {
      if (!weekdays.length) return
      if (!weekdays.includes(activeWeekday.value)) {
        activeWeekday.value = weekdays[0] ?? '1'
      }
    },
  )

  function buildDateRange() {
    const start = createLocalDate(form.startDate)
    const end = createLocalDate(form.endDate)
    if (!form.startDate || !form.endDate || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return []
    }

    const dates: string[] = []
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      dates.push(formatDateValue(cursor))
    }
    return dates
  }

  function buildPickedDates() {
    if (form.mode === 'custom') {
      return customSlots.value.map((slot) => slot.date)
    }

    const dateRange = buildDateRange()
    if (form.mode === 'daily') return dateRange

    return dateRange.filter((date) => form.weekdays.includes(String(createLocalDate(date).getDay())))
  }

  function getTodayMinBookableMinute() {
    return Math.max(timelineStartMinute, roundUpToBookableSlot(currentDayMinute()))
  }

  function isFutureRuleRange(date: string, range: LongReservationTimeRange) {
    if (date > today) return true
    if (date < today) return false
    return timeToMinutes(range.startTime) >= getTodayMinBookableMinute()
  }

  function expandRangeToTimeSlots(range: LongReservationTimeRange) {
    return timeSlots
      .filter((slot) => slot.startTime >= range.startTime && slot.endTime <= range.endTime)
      .map((slot) => ({ ...slot, name: range.name }))
  }

  function buildActualRuleSlots() {
    if (form.mode === 'custom') {
      return customSlots.value.flatMap((slot) =>
        slot.timeRanges.flatMap((range) =>
          expandRangeToTimeSlots(range)
            .filter((timeSlot) => isFutureRuleRange(slot.date, timeSlot))
            .map((timeSlot) => ({ date: slot.date, range: timeSlot })),
        ),
      )
    }

    return buildFixedRuleSlots().flatMap((slot) =>
      expandRangeToTimeSlots(slot.range)
        .filter((timeSlot) => isFutureRuleRange(slot.date, timeSlot))
        .map((timeSlot) => ({ date: slot.date, range: timeSlot })),
    )
  }

  function buildResolvedSlots() {
    const slots = buildActualRuleSlots()
    const slotMap = new Map<string, LongReservationTimeRange[]>()
    for (const slot of slots) {
      const ranges = slotMap.get(slot.date) ?? []
      ranges.push({ ...slot.range })
      slotMap.set(slot.date, ranges)
    }

    return [...slotMap.entries()].map(([date, timeRanges]) => ({
      date,
      timeRanges: normalizeRanges(timeRanges),
    }))
  }

  function createTimeRange(startTime: string, endTime: string, name = '预约时间'): LongReservationTimeRange {
    return {
      id: `${startTime}-${endTime}`,
      name,
      startTime,
      endTime,
    }
  }

  function weekdayLabel(weekday: string) {
    return weekdayOptions.find((option) => option.value === weekday)?.label ?? '周几'
  }

  function createLocalDate(date: string) {
    const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  function formatMonthDay(date: string) {
    if (!date) return '--/--'
    const [, month = '', day = ''] = date.split('-')
    return `${Number(month)}/${Number(day)}`
  }

  function getWeekdayLabelByDate(date: string) {
    if (!date) return ''
    const weekday = String(createLocalDate(date).getDay())
    return weekdayLabel(weekday)
  }

  // 纵向日程面板需要展示真实日期，方便用户确认当前正在编辑的是哪一天的规则。
  function getFirstDateForWeekday(weekday: string) {
    return buildDateRange().find((item) => String(createLocalDate(item).getDay()) === weekday) ?? ''
  }

  function formatAgendaDateTitle(date: string, fallbackLabel = '预约时间') {
    if (!date) return `${fallbackLabel}预约时间`
    return `${date} ${getWeekdayLabelByDate(date)}`
  }

  function normalizeRanges(ranges: LongReservationTimeRange[]) {
    const orderedRanges = [...ranges].sort((prev, next) => timeToMinutes(prev.startTime) - timeToMinutes(next.startTime))
    const normalizedRanges: LongReservationTimeRange[] = []

    for (const range of orderedRanges) {
      if (!isAlignedBookableRange(range.startTime, range.endTime)) continue
      const lastRange = normalizedRanges[normalizedRanges.length - 1]
      if (lastRange && lastRange.endTime === range.startTime) {
        lastRange.endTime = range.endTime
        lastRange.id = `${lastRange.startTime}-${lastRange.endTime}`
        continue
      }
      normalizedRanges.push(createTimeRange(range.startTime, range.endTime, range.name))
    }

    return normalizedRanges
  }

  function getWeekdayRanges(weekday: string) {
    // 用户没有为某个星期点选时段时保持为空，避免提交时夹带隐藏默认时段。
    if (Object.prototype.hasOwnProperty.call(form.weekdayTimeRanges, weekday)) {
      return normalizeRanges(form.weekdayTimeRanges[weekday] ?? [])
    }
    return []
  }

  function setWeekdayRanges(weekday: string, ranges: LongReservationTimeRange[]) {
    form.weekdayTimeRanges[weekday] = normalizeRanges(ranges).map((range) => ({ ...range, name: weekdayLabel(weekday) }))
  }

  function getRangeTimelineStyle(range: LongReservationTimeRange) {
    const startMinute = Math.max(timeToMinutes(range.startTime), timelineStartMinute)
    const endMinute = Math.min(timeToMinutes(range.endTime), timelineEndMinute)
    const totalMinutes = timelineEndMinute - timelineStartMinute
    const left = totalMinutes ? ((startMinute - timelineStartMinute) / totalMinutes) * 100 : 0
    const width = totalMinutes ? ((endMinute - startMinute) / totalMinutes) * 100 : 0

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.max(3, width)}%`,
    }
  }

  function toggleRangeSlot(slot: LongReservationTimeRange, ranges: LongReservationTimeRange[]) {
    const nextRanges = [...ranges]
    const containingIndex = nextRanges.findIndex((range) => slot.startTime >= range.startTime && slot.endTime <= range.endTime)

    if (containingIndex >= 0) {
      const currentRange = nextRanges[containingIndex]
      if (!currentRange) return normalizeRanges(nextRanges)
      nextRanges.splice(containingIndex, 1)
      if (currentRange.startTime < slot.startTime) {
        nextRanges.push(createTimeRange(currentRange.startTime, slot.startTime, currentRange.name))
      }
      if (slot.endTime < currentRange.endTime) {
        nextRanges.push(createTimeRange(slot.endTime, currentRange.endTime, currentRange.name))
      }
      return normalizeRanges(nextRanges)
    }

    nextRanges.push(createTimeRange(slot.startTime, slot.endTime, slot.name))
    return normalizeRanges(nextRanges)
  }

  function toggleDailyTimeSlot(slot: LongReservationTimeRange) {
    const nextRanges = toggleRangeSlot(slot, form.timeRanges)
    form.timeRanges = nextRanges.length ? nextRanges : []
  }

  function toggleWeekdayTimeSlot(weekday: string, slot: LongReservationTimeRange) {
    const nextRanges = toggleRangeSlot({ ...slot, name: weekdayLabel(weekday) }, getWeekdayRanges(weekday))
    setWeekdayRanges(weekday, nextRanges)
    if (nextRanges.length && !form.weekdays.includes(weekday)) {
      form.weekdays = [...form.weekdays, weekday].sort((prev, next) => Number(prev) - Number(next))
    }
    if (!nextRanges.length) {
      form.weekdays = form.weekdays.filter((item) => item !== weekday)
    }
  }

  function toggleCustomTimeSlot(slot: LongReservationTimeRange) {
    customPicker.selectedRanges = toggleRangeSlot(slot, customPicker.selectedRanges)
  }

  function removeExactRange(ranges: LongReservationTimeRange[], target: LongReservationTimeRange) {
    return normalizeRanges(
      ranges.filter((range) => !(range.startTime === target.startTime && range.endTime === target.endTime)),
    )
  }

  function removeWeekdayTimeRange(weekday: string, range: LongReservationTimeRange) {
    const nextRanges = removeExactRange(getWeekdayRanges(weekday), range)
    setWeekdayRanges(weekday, nextRanges)
    if (!nextRanges.length) {
      form.weekdays = form.weekdays.filter((item) => item !== weekday)
    }
  }

  function removeDailyTimeRange(range: LongReservationTimeRange) {
    form.timeRanges = removeExactRange(form.timeRanges, range)
  }

  function removeCustomTimeRange(range: LongReservationTimeRange) {
    customPicker.selectedRanges = removeExactRange(customPicker.selectedRanges, range)
  }

  function toggleTimelineRow(weekday: string) {
    activeWeekday.value = activeWeekday.value === weekday ? '' : weekday
  }

  function formatRangesText(ranges: LongReservationTimeRange[]) {
    const normalizedRanges = normalizeRanges(ranges)
    if (!normalizedRanges.length) return '未选择时间'
    return normalizedRanges.map((range) => `${range.startTime}-${range.endTime}`).join('、')
  }

  function buildFixedRuleSlots() {
    if (form.mode === 'custom') return []
    const dates = pickedDates.value
    if (form.mode === 'daily') {
      return dates.flatMap((date) => normalizedDailyRanges.value.map((range) => ({ date, range })))
    }
    return dates.flatMap((date) => {
      const weekday = String(createLocalDate(date).getDay())
      return getWeekdayRanges(weekday).map((range) => ({ date, range }))
    })
  }

  function toggleWeekday(weekday: string) {
    if (form.weekdays.includes(weekday)) {
      form.weekdays = form.weekdays.filter((item) => item !== weekday)
      if (activeWeekday.value === weekday) {
        activeWeekday.value = form.weekdays[0] ?? weekday
      }
    } else {
      form.weekdays = [...form.weekdays, weekday].sort((prev, next) => Number(prev) - Number(next))
      setWeekdayRanges(weekday, getWeekdayRanges(weekday))
      activeWeekday.value = weekday
    }
  }

  function ensureTimeRangeSelected() {
    if (form.mode === 'custom') {
      if (!customSlotCount.value) {
        showToast('请至少添加一个日期和时段')
        return false
      }
      return true
    }

    if (!normalizedTimeRanges.value.length) {
      showToast('请至少选择一个预约时间段')
      return false
    }
    if (form.mode === 'weekly') {
      const emptyWeekday = form.weekdays.find((weekday) => !getWeekdayRanges(weekday).length)
      if (emptyWeekday) {
        activeWeekday.value = emptyWeekday
        showToast(`请为${weekdayLabel(emptyWeekday)}选择预约时间`)
        return false
      }
    }
    return true
  }

  function formatRangeText(range: LongReservationTimeRange) {
    return `${range.name ?? '时段'} ${range.startTime}-${range.endTime}`
  }

  function openCustomCalendar() {
    customPicker.open = true
    customPicker.step = 'date'
  }

  function closeCustomCalendar() {
    customPicker.open = false
    customPicker.step = 'date'
  }

  function shiftCustomMonth(months: number) {
    const nextMonthDate = new Date(customPicker.monthDate)
    nextMonthDate.setMonth(nextMonthDate.getMonth() + months)
    customPicker.monthDate = nextMonthDate
  }

  function openCustomTimePicker(date: string) {
    if (date < today) return

    customPicker.selectedDate = date
    const existingSlot = form.customSlots.find((slot) => slot.date === date)
    customPicker.selectedRanges = existingSlot?.timeRanges.length
      ? normalizeRanges(existingSlot.timeRanges)
      : [createTimeRange('08:30', '09:00')]
    customPicker.step = 'time'
  }

  function confirmCustomSlot() {
    const nextRanges = normalizeRanges(customPicker.selectedRanges)
    if (!nextRanges.length) {
      showToast('请至少选择一个预约时间段')
      return
    }

    const nextSlot = {
      date: customPicker.selectedDate,
      timeRanges: nextRanges.map((range) => ({ ...range, name: '自定义时段' })),
    }
    const existingIndex = form.customSlots.findIndex((slot) => slot.date === nextSlot.date)
    if (existingIndex >= 0) {
      form.customSlots.splice(existingIndex, 1, nextSlot)
    } else {
      form.customSlots.push(nextSlot)
    }
    form.customSlots.sort((prev, next) => prev.date.localeCompare(next.date))
    // 确认添加后回到日期选择，方便继续点下一个日期。
    customPicker.step = 'date'
  }

  function removeCustomSlot(date: string) {
    form.customSlots = form.customSlots.filter((slot) => slot.date !== date)
  }

  function buildRuleDesc() {
    if (form.mode === 'custom') {
      const preview = customSlots.value
        .slice(0, 3)
        .map((slot) => `${slot.date} ${slot.timeRanges.map(formatRangeText).join('/')}`)
        .join('、')
      const suffix = customSlots.value.length > 3 ? ' 等' : ''
      return `${LONG_RESERVATION_MODE_LABELS[form.mode]} · ${customSlots.value.length} 日期 · ${customSlotCount.value} 场次${preview ? ` · ${preview}${suffix}` : ''}`
    }

    const timeText = normalizedTimeRanges.value.map(formatRangeText).join('、')
    if (form.mode === 'weekly') {
      const weekdays = form.weekdays
        .map((weekday) => weekdayOptions.find((option) => option.value === weekday)?.label ?? '')
        .filter(Boolean)
        .join('、')
      return `${LONG_RESERVATION_MODE_LABELS[form.mode]} · ${weekdays} · ${dateSummary.value} · ${timeText}`
    }
    return `${LONG_RESERVATION_MODE_LABELS[form.mode]} · ${dateSummary.value} · ${timeText}`
  }

  function goPickRoom() {
    const actualSlots = buildActualRuleSlots()
    const resolvedSlots = buildResolvedSlots()

    if (!pickedDates.value.length) {
      showToast('当前规则没有可预约日期')
      return
    }
    if (!ensureTimeRangeSelected()) return
    if (!actualSlots.length) {
      showToast('当前规则内没有可提交的未来时段')
      return
    }

    saveLongReservationRuleDraft({
      mode: form.mode,
      ruleType: LONG_RESERVATION_RULE_TYPES[form.mode],
      startDate: form.mode === 'custom' ? (pickedDates.value[0] ?? form.startDate) : form.startDate,
      endDate:
        form.mode === 'custom'
          ? (pickedDates.value[pickedDates.value.length - 1] ?? form.endDate)
          : form.endDate,
      weekdays: form.mode === 'weekly' ? form.weekdays : [],
      weekdayTimeRanges:
        form.mode === 'weekly'
          ? Object.fromEntries(
              form.weekdays.map((weekday) => [
                weekday,
                getWeekdayRanges(weekday).map((range) => ({ ...range, name: weekdayLabel(weekday) })),
              ]),
            )
          : {},
      customDates: form.mode === 'custom' ? pickedDates.value : [],
      customSlots:
        form.mode === 'custom'
          ? customSlots.value.map((slot) => ({
              ...slot,
              timeRanges: slot.timeRanges.map((range) => ({ ...range })),
            }))
          : [],
      resolvedSlots,
      timeRanges: normalizedTimeRanges.value.map((range) => ({ ...range })),
      dates: [...new Set(actualSlots.map((slot) => slot.date))],
      slotCount: actualSlots.length,
      ruleDesc: buildRuleDesc(),
    })
    router.push('/reservation/long/rooms')
  }

  // 供模板使用（部分仅用于内部计算，但一并暴露以保持行为不变）。
  void activeWeekdayRanges.value
  void formatRangesText
  void getWeekdayLabelByDate
  void toggleWeekday

  return {
    form,
    today,
    modeOptions,
    timeSlots,
    timelineMiddleText,
    weeklyTimelineRows,
    dailyTimelineRows,
    normalizedDailyRanges,
    activeWeekday,
    customSlots,
    customPicker,
    calendarMonthTitle,
    calendarDays,
    dateSummary,
    pickedDates,
    summaryTimeCount,
    totalSlotCount,
    canPickRoom,
    toggleTimelineRow,
    getRangeTimelineStyle,
    toggleWeekdayTimeSlot,
    removeWeekdayTimeRange,
    openCustomCalendar,
    removeCustomSlot,
    formatRangeText,
    toggleDailyTimeSlot,
    removeDailyTimeRange,
    goPickRoom,
    closeCustomCalendar,
    shiftCustomMonth,
    openCustomTimePicker,
    formatAgendaDateTitle,
    toggleCustomTimeSlot,
    removeCustomTimeRange,
    confirmCustomSlot,
  }
}
