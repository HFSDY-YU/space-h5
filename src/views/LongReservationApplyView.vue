<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, CalendarDays, XCircle } from '@lucide/vue'
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
import AgendaSelectBoard from '@/components/AgendaSelectBoard.vue'
import {
  LONG_RESERVATION_MODE_LABELS,
  LONG_RESERVATION_RULE_TYPES,
  saveLongReservationRuleDraft,
  type LongReservationCustomDateSlot,
  type LongReservationMode,
  type LongReservationTimeRange,
} from '@/services/longReservationDraft'

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
</script>

<template>
  <main class="safe-page long-apply-page">
    <header class="detail-nav">
      <button type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>长期预约</strong>
      <span></span>
    </header>

    <section class="flow-card rule-card">
      <div class="section-row">
        <div>
          <p class="mini">1 排课规则</p>
          <h1>日期与时间</h1>
        </div>
      </div>

      <div class="mode-tabs" role="tablist" aria-label="长期预约模式">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          type="button"
          :class="{ active: form.mode === option.value }"
          @click="form.mode = option.value"
        >
          <strong>{{ option.label }}</strong>
          <span>{{ option.tip }}</span>
        </button>
      </div>

      <div v-if="form.mode !== 'custom'" class="date-grid">
        <label class="field-label">
          <span>开始日期 *</span>
          <input v-model="form.startDate" type="date" :min="today" />
          <CalendarDays :size="16" />
        </label>
        <label class="field-label">
          <span>结束日期 *</span>
          <input v-model="form.endDate" type="date" :min="form.startDate || today" />
          <CalendarDays :size="16" />
        </label>
      </div>

      <div v-if="form.mode === 'weekly'" class="week-timeline-list" aria-label="每周预约时间轴">
        <article
          v-for="day in weeklyTimelineRows"
          :key="day.value"
          class="week-timeline-row"
          :class="{ active: activeWeekday === day.value, selected: day.enabled }"
        >
          <button class="week-timeline-main" type="button" @click="toggleTimelineRow(day.value)">
            <span class="week-date-card" :class="{ today: day.today }">
              <strong>{{ day.label }}</strong>
              <small v-if="day.today">今天</small>
            </span>
            <span class="week-track-wrap">
              <span class="week-track">
                <span
                  v-for="range in day.enabled ? day.ranges : []"
                  :key="range.id"
                  class="week-track-segment"
                  :style="getRangeTimelineStyle(range)"
                ></span>
              </span>
              <span class="week-track-labels">
                <span>08:30</span>
                <span>{{ timelineMiddleText }}</span>
                <span>22:30</span>
              </span>
            </span>
          </button>

          <Transition name="timeline-edit">
            <div v-if="activeWeekday === day.value" class="timeline-edit-panel">
              <AgendaSelectBoard
                :time-slots="timeSlots"
                :ranges="day.ranges"
                :label="`${day.label}半小时预约时间选择`"
                :key-prefix="`weekday-${day.value}`"
                @toggle-slot="(slot) => toggleWeekdayTimeSlot(day.value, slot)"
                @remove-range="(range) => removeWeekdayTimeRange(day.value, range)"
              />
            </div>
          </Transition>
        </article>
      </div>

      <div v-if="form.mode === 'custom'" class="custom-dates">
        <button type="button" class="calendar-entry" @click="openCustomCalendar">
          <CalendarDays :size="18" />
          <span>打开日历选择日期和时段</span>
          <strong>{{ customSlots.length }} 日期</strong>
        </button>

        <div v-if="customSlots.length" class="custom-slot-list">
          <button v-for="slot in customSlots" :key="slot.date" type="button" @click="removeCustomSlot(slot.date)">
            <span>
              <strong>{{ slot.date }}</strong>
              <small>{{ slot.timeRanges.map(formatRangeText).join('、') }}</small>
            </span>
            <XCircle :size="16" />
          </button>
        </div>
      </div>

      <div v-if="form.mode === 'daily'" class="week-timeline-list" aria-label="每日预约时间轴">
        <article v-for="day in dailyTimelineRows" :key="day.value" class="week-timeline-row active selected">
          <div class="week-timeline-main">
            <span class="week-date-card today">
              <strong>{{ day.label }}</strong>
              <span>固定</span>
            </span>
            <span class="week-track-wrap">
              <span class="week-track">
                <span
                  v-for="range in day.ranges"
                  :key="range.id"
                  class="week-track-segment"
                  :style="getRangeTimelineStyle(range)"
                ></span>
              </span>
              <span class="week-track-labels">
                <span>08:30</span>
                <span>{{ timelineMiddleText }}</span>
                <span>22:30</span>
              </span>
            </span>
          </div>

          <div class="timeline-edit-panel">
            <div class="time-card-head">
              <div>
                <h2 class="section-title">每日预约时间</h2>
                <p>点击时段添加，再次点击取消</p>
              </div>
            </div>

            <AgendaSelectBoard
              :time-slots="timeSlots"
              :ranges="normalizedDailyRanges"
              label="每日半小时预约时间选择"
              key-prefix="daily"
              @toggle-slot="toggleDailyTimeSlot"
              @remove-range="removeDailyTimeRange"
            />
          </div>
        </article>
      </div>

      <div class="rule-summary">
        <span>{{ dateSummary }}</span>
        <span>{{ pickedDates.length }} 日期</span>
        <span>{{ summaryTimeCount }} 时段</span>
        <span>{{ totalSlotCount }} 场次</span>
      </div>
    </section>

    <section class="next-panel">
      <div>
        <p class="mini">2 教室选择</p>
        <strong>按当前规则查询可用教室</strong>
        <span>支持搜索、筛选和分页，不在本页滚动长列表。</span>
      </div>
      <van-button block round type="primary" :disabled="!canPickRoom" @click="goPickRoom">选择教室</van-button>
    </section>

    <van-popup v-model:show="customPicker.open" position="bottom" round safe-area-inset-bottom>
      <section class="custom-popup">
        <header class="popup-header">
          <button v-if="customPicker.step === 'time'" type="button" @click="customPicker.step = 'date'">返回</button>
          <span v-else></span>
          <strong>{{ customPicker.step === 'date' ? '选择日期' : customPicker.selectedDate }}</strong>
          <button type="button" @click="closeCustomCalendar">关闭</button>
        </header>

        <div v-if="customPicker.step === 'date'" class="calendar-panel">
          <div class="calendar-toolbar">
            <button type="button" @click="shiftCustomMonth(-1)">上月</button>
            <strong>{{ calendarMonthTitle }}</strong>
            <button type="button" @click="shiftCustomMonth(1)">下月</button>
          </div>
          <div class="calendar-weekdays">
            <span>日</span>
            <span>一</span>
            <span>二</span>
            <span>三</span>
            <span>四</span>
            <span>五</span>
            <span>六</span>
          </div>
          <div class="calendar-grid" aria-label="自定义日期日历">
            <button
              v-for="day in calendarDays"
              :key="day.date"
              type="button"
              :disabled="day.disabled"
              :class="{ outside: day.outside, selected: day.selected, marked: day.hasSlots }"
              @click="openCustomTimePicker(day.date)"
            >
              <span>{{ day.day }}</span>
            </button>
          </div>
        </div>

        <div v-else class="time-picker-panel">
          <article class="week-timeline-row active selected">
            <div class="week-timeline-main">
              <span class="week-date-card today">
                <strong>{{ customPicker.selectedDate.slice(5, 7) }}/{{ customPicker.selectedDate.slice(8, 10) }}</strong>
                <span>自定义</span>
              </span>
              <span class="week-track-wrap">
                <span class="week-track">
                  <span
                    v-for="range in customPicker.selectedRanges"
                    :key="range.id"
                    class="week-track-segment"
                    :style="getRangeTimelineStyle(range)"
                  ></span>
                </span>
                <span class="week-track-labels">
                  <span>08:30</span>
                  <span>{{ timelineMiddleText }}</span>
                  <span>22:30</span>
                </span>
              </span>
            </div>
          </article>

          <div class="time-card-head">
            <div>
              <h2 class="section-title">{{ formatAgendaDateTitle(customPicker.selectedDate) }}</h2>
              <p>点击时段添加，再次点击取消</p>
            </div>
          </div>
          <AgendaSelectBoard
            :time-slots="timeSlots"
            :ranges="customPicker.selectedRanges"
            label="自定义半小时预约时间选择"
            key-prefix="custom"
            @toggle-slot="toggleCustomTimeSlot"
            @remove-range="removeCustomTimeRange"
          />
          <van-button block round type="primary" @click="confirmCustomSlot">确认添加</van-button>
        </div>
      </section>
    </van-popup>
  </main>
</template>

<style scoped>
.long-apply-page {
  display: grid;
  gap: 12px;
}

.detail-nav {
  display: grid;
  grid-template-columns: 42px 1fr 42px;
  align-items: center;
}

.detail-nav strong {
  text-align: center;
}

.detail-nav button {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  color: var(--space-text);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.flow-card,
.next-panel {
  display: grid;
  gap: 14px;
  padding: 16px;
  background: var(--space-card);
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 18px;
  box-shadow: 0 10px 28px rgba(54, 89, 150, 0.08);
}

.rule-card h1 {
  margin: 2px 0 0;
  font-size: 22px;
  line-height: 1.25;
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.mode-tabs button {
  display: grid;
  gap: 3px;
  min-height: 60px;
  padding: 9px 6px;
  color: var(--space-subtext);
  text-align: center;
  background: #f7faff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.mode-tabs button strong {
  color: var(--space-text);
  font-size: 14px;
}

.mode-tabs button span {
  font-size: 11px;
}

.mode-tabs button.active {
  background: #eaf2ff;
  border-color: rgba(22, 119, 255, 0.36);
  box-shadow: inset 0 0 0 1px rgba(22, 119, 255, 0.14);
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field-label {
  position: relative;
  display: grid;
  gap: 8px;
}

.field-label span {
  color: var(--space-subtext);
  font-size: 13px;
}

.field-label input,
.picker-field {
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  color: var(--space-text);
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  outline: 0;
}

.picker-field {
  display: flex;
  align-items: center;
  padding-right: 36px;
  text-align: left;
}

.field-label svg {
  position: absolute;
  right: 12px;
  bottom: 16px;
  color: var(--space-muted);
  pointer-events: none;
}

.calendar-entry,
.custom-slot-list button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  color: var(--space-text);
  background: #f7faff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  font-weight: 700;
}

.custom-dates,
.time-section,
.week-timeline-list,
.timeline-edit-panel {
  display: grid;
  gap: 10px;
}

.week-timeline-row {
  display: grid;
  gap: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(54, 89, 150, 0.06);
}

.week-timeline-row.active {
  border-color: rgba(22, 119, 255, 0.28);
}

.week-timeline-main {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 94px;
  padding: 10px;
  color: var(--space-text);
  text-align: left;
  background: transparent;
  border: 0;
}

.week-date-card {
  display: grid;
  place-items: center;
  min-height: 72px;
  padding: 9px 8px;
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 10px;
}

.week-date-card strong {
  color: var(--space-text);
  font-size: 18px;
  line-height: 1.1;
}

.week-date-card span {
  margin-top: 6px;
  color: var(--space-subtext);
  font-size: 14px;
}

.week-date-card small {
  margin-top: 2px;
  color: var(--space-blue);
  font-size: 12px;
  font-weight: 850;
}

.week-date-card.today {
  background: #f4f9ff;
  border-color: rgba(22, 119, 255, 0.36);
}

.week-date-card.today strong,
.week-date-card.today span {
  color: var(--space-blue);
}

.week-track-wrap {
  display: grid;
  gap: 13px;
  min-width: 0;
}

.week-track {
  position: relative;
  display: block;
  height: 8px;
  overflow: hidden;
  background: #edf2f7;
  border-radius: 999px;
}

.week-track-segment {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--space-blue);
  border-radius: 999px;
  box-shadow: 0 2px 6px rgba(22, 119, 255, 0.2);
}

.week-track-segment:nth-child(2n) {
  background: #e38400;
  box-shadow: 0 2px 6px rgba(227, 132, 0, 0.18);
}

.week-track-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--space-text);
  font-size: 15px;
}

.timeline-edit-panel {
  padding: 0 12px 12px;
}

.timeline-edit-enter-active,
.timeline-edit-leave-active {
  overflow: hidden;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    max-height 0.22s ease;
}

.timeline-edit-enter-from,
.timeline-edit-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.timeline-edit-enter-to,
.timeline-edit-leave-from {
  max-height: 2200px;
  opacity: 1;
  transform: translateY(0);
}

.time-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.time-card-head div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.time-card-head p {
  margin: 0;
  color: var(--space-subtext);
  font-size: 12px;
  line-height: 1.4;
}

.time-card-head button {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 12px;
  color: var(--space-blue);
  background: #fff;
  border: 1px solid rgba(22, 119, 255, 0.2);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 800;
}

.calendar-entry {
  justify-content: space-between;
  width: 100%;
  min-height: 52px;
  padding: 0 12px;
}

.calendar-entry svg {
  color: var(--space-blue-deep);
}

.calendar-entry span {
  flex: 1;
  text-align: left;
}

.calendar-entry strong {
  color: var(--space-blue-deep);
  font-size: 13px;
}

.custom-slot-list {
  display: grid;
  gap: 8px;
}

.custom-slot-list button {
  justify-content: space-between;
  min-height: 56px;
  padding: 8px 10px 8px 12px;
  text-align: left;
}

.custom-slot-list button > span {
  display: grid;
  gap: 3px;
}

.custom-slot-list strong {
  color: var(--space-text);
}

.custom-slot-list small {
  color: var(--space-subtext);
  font-size: 12px;
}

.custom-slot-list svg {
  color: var(--space-red);
}

.section-title {
  margin: 0;
}

.time-tip {
  margin: -2px 0 0;
  color: var(--space-subtext);
  font-size: 12px;
  line-height: 1.45;
}

.custom-popup {
  display: grid;
  gap: 14px;
  max-height: min(86vh, 720px);
  padding: 16px 16px calc(env(safe-area-inset-bottom) + 18px);
  background: var(--space-bg);
}

.popup-header,
.calendar-toolbar {
  display: grid;
  grid-template-columns: 64px 1fr 64px;
  align-items: center;
  gap: 8px;
}

.popup-header strong,
.calendar-toolbar strong {
  text-align: center;
}

.popup-header button,
.calendar-toolbar button {
  min-height: 40px;
  color: var(--space-blue);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  font-weight: 750;
}

.calendar-panel,
.time-picker-panel {
  display: grid;
  gap: 12px;
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.calendar-weekdays span {
  color: var(--space-subtext);
  text-align: center;
  font-size: 12px;
  font-weight: 750;
}

.calendar-grid button {
  position: relative;
  display: grid;
  min-height: 44px;
  place-items: center;
  color: var(--space-text);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  font-weight: 750;
}

.calendar-grid button.outside {
  color: var(--space-muted);
  background: #f7faff;
}

.calendar-grid button:disabled {
  color: #c0c6d0;
  background: #f2f4f7;
}

.calendar-grid button.selected {
  color: var(--space-blue-deep);
  border-color: rgba(22, 119, 255, 0.4);
  box-shadow: inset 0 0 0 1px rgba(22, 119, 255, 0.12);
}

.calendar-grid button.marked::after {
  position: absolute;
  bottom: 5px;
  width: 5px;
  height: 5px;
  content: '';
  background: var(--space-blue);
  border-radius: 999px;
}

.rule-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rule-summary span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  color: var(--space-subtext);
  background: #f4f7fc;
  border-radius: 999px;
  font-size: 12px;
}

.next-panel {
  position: sticky;
  bottom: calc(var(--space-bottom-nav-height) + 10px);
  z-index: 8;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.94)) border-box;
}

.next-panel div {
  display: grid;
  gap: 4px;
}

.next-panel strong {
  font-size: 17px;
}

.next-panel span {
  color: var(--space-subtext);
  font-size: 13px;
}

@media (max-width: 360px) {
  .mode-tabs {
    grid-template-columns: 1fr;
  }

  .date-grid {
    grid-template-columns: 1fr;
  }

  .week-timeline-main {
    grid-template-columns: 74px minmax(0, 1fr);
    gap: 10px;
    padding: 8px;
  }

  .week-date-card {
    min-height: 68px;
  }

  .timeline-edit-panel {
    padding-right: 8px;
    padding-left: 8px;
  }
}
</style>
