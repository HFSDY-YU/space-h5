<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, CalendarDays, Clock3, XCircle } from '@lucide/vue'
import { addDays, formatDateValue } from '@/services/spaceMapper'
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

const fixedTimeRanges: LongReservationTimeRange[] = [
  { id: 'morning', name: '上午', startTime: '08:30', endTime: '13:30' },
  { id: 'afternoon', name: '下午', startTime: '14:00', endTime: '18:00' },
  { id: 'evening', name: '晚间', startTime: '18:30', endTime: '22:30' },
]

const form = reactive({
  mode: 'weekly' as LongReservationMode,
  startDate: today,
  endDate: nextMonth,
  weekdays: ['1'],
  customSlots: [] as LongReservationCustomDateSlot[],
  selectedTimeRangeIds: ['morning'],
})

const customPicker = reactive({
  open: false,
  step: 'date' as 'date' | 'time',
  monthDate: new Date(today),
  selectedDate: today,
  selectedTimeRangeIds: [] as string[],
})

const normalizedTimeRanges = computed(() =>
  form.mode === 'custom' ? [] : fixedTimeRanges.filter((range) => form.selectedTimeRangeIds.includes(range.id)),
)
const customSlots = computed(() => [...form.customSlots].sort((prev, next) => prev.date.localeCompare(next.date)))
const customSlotCount = computed(() =>
  customSlots.value.reduce((total, slot) => total + slot.timeRanges.length, 0),
)
const pickedDates = computed(() => buildPickedDates())
const dateSummary = computed(() => {
  const dates = pickedDates.value
  if (!dates.length) return '暂无日期'
  if (form.mode === 'custom') return `${dates.length} 个日期`
  return `${dates[0]} 至 ${dates[dates.length - 1]}`
})
const summaryTimeCount = computed(() => (form.mode === 'custom' ? customSlotCount.value : normalizedTimeRanges.value.length))
const totalSlotCount = computed(() =>
  form.mode === 'custom' ? customSlotCount.value : pickedDates.value.length * normalizedTimeRanges.value.length,
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

function buildDateRange() {
  const start = new Date(form.startDate)
  const end = new Date(form.endDate)
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

  return dateRange.filter((date) => form.weekdays.includes(String(new Date(date).getDay())))
}

function toggleWeekday(weekday: string) {
  if (form.weekdays.includes(weekday)) {
    form.weekdays = form.weekdays.filter((item) => item !== weekday)
  } else {
    form.weekdays = [...form.weekdays, weekday].sort((prev, next) => Number(prev) - Number(next))
  }
}

function toggleTimeRange(id: string) {
  if (form.selectedTimeRangeIds.includes(id)) {
    form.selectedTimeRangeIds = form.selectedTimeRangeIds.filter((item) => item !== id)
    return
  }

  form.selectedTimeRangeIds = [...form.selectedTimeRangeIds, id].sort(
    (prev, next) =>
      fixedTimeRanges.findIndex((range) => range.id === prev) - fixedTimeRanges.findIndex((range) => range.id === next),
  )
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
    showToast('请选择至少一个预约时段')
    return false
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
  customPicker.selectedTimeRangeIds = existingSlot?.timeRanges.map((range) => range.id) ?? []
  customPicker.step = 'time'
}

function togglePickerTimeRange(id: string) {
  if (customPicker.selectedTimeRangeIds.includes(id)) {
    customPicker.selectedTimeRangeIds = customPicker.selectedTimeRangeIds.filter((item) => item !== id)
    return
  }

  customPicker.selectedTimeRangeIds = [...customPicker.selectedTimeRangeIds, id].sort(
    (prev, next) =>
      fixedTimeRanges.findIndex((range) => range.id === prev) - fixedTimeRanges.findIndex((range) => range.id === next),
  )
}

function confirmCustomSlot() {
  if (!customPicker.selectedTimeRangeIds.length) {
    showToast('请选择至少一个时段')
    return
  }

  const nextSlot = {
    date: customPicker.selectedDate,
    timeRanges: fixedTimeRanges
      .filter((range) => customPicker.selectedTimeRangeIds.includes(range.id))
      .map((range) => ({ ...range })),
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
  if (!pickedDates.value.length) {
    showToast('当前规则没有可预约日期')
    return
  }
  if (!ensureTimeRangeSelected()) return

  saveLongReservationRuleDraft({
    mode: form.mode,
    ruleType: LONG_RESERVATION_RULE_TYPES[form.mode],
    startDate: pickedDates.value[0] ?? form.startDate,
    endDate: pickedDates.value[pickedDates.value.length - 1] ?? form.endDate,
    weekdays: form.mode === 'weekly' ? form.weekdays : [],
    customDates: form.mode === 'custom' ? pickedDates.value : [],
    customSlots: form.mode === 'custom' ? customSlots.value.map((slot) => ({ ...slot })) : [],
    timeRanges: normalizedTimeRanges.value.map((range) => ({ ...range })),
    dates: pickedDates.value,
    slotCount: totalSlotCount.value,
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

      <div v-if="form.mode === 'weekly'" class="weekday-grid" aria-label="每周重复星期">
        <button
          v-for="day in weekdayOptions"
          :key="day.value"
          type="button"
          :class="{ active: form.weekdays.includes(day.value) }"
          @click="toggleWeekday(day.value)"
        >
          {{ day.label }}
        </button>
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

      <div v-if="form.mode !== 'custom'" class="time-section">
        <div class="section-row">
          <h2 class="section-title">预约时间</h2>
        </div>

        <div class="fixed-time-grid" aria-label="预约固定时段">
          <button
            v-for="range in fixedTimeRanges"
            :key="range.id"
            type="button"
            :class="{ active: form.selectedTimeRangeIds.includes(range.id) }"
            @click="toggleTimeRange(range.id)"
          >
            <Clock3 :size="18" />
            <strong>{{ range.name }}</strong>
            <span>{{ range.startTime }}-{{ range.endTime }}</span>
          </button>
        </div>
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
          <p class="mini">为该日期选择一个或多个预约时段</p>
          <div class="fixed-time-grid fixed-time-grid--popup" aria-label="自定义日期时段">
            <button
              v-for="range in fixedTimeRanges"
              :key="range.id"
              type="button"
              :class="{ active: customPicker.selectedTimeRangeIds.includes(range.id) }"
              @click="togglePickerTimeRange(range.id)"
            >
              <Clock3 :size="18" />
              <strong>{{ range.name }}</strong>
              <span>{{ range.startTime }}-{{ range.endTime }}</span>
            </button>
          </div>
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

.field-label input {
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  color: var(--space-text);
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  outline: 0;
}

.field-label svg {
  position: absolute;
  right: 12px;
  bottom: 16px;
  color: var(--space-muted);
  pointer-events: none;
}

.weekday-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.weekday-grid button,
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

.weekday-grid button.active {
  color: var(--space-blue-deep);
  background: #eaf2ff;
  border-color: rgba(22, 119, 255, 0.35);
}

.custom-dates,
.time-section {
  display: grid;
  gap: 10px;
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

.fixed-time-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.fixed-time-grid button {
  display: grid;
  min-height: 82px;
  place-items: center;
  gap: 4px;
  padding: 10px 6px;
  color: var(--space-subtext);
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.fixed-time-grid svg {
  color: var(--space-blue);
}

.fixed-time-grid strong {
  color: var(--space-text);
  font-size: 15px;
}

.fixed-time-grid span {
  color: var(--space-subtext);
  font-size: 12px;
}

.fixed-time-grid button.active {
  color: var(--space-blue-deep);
  background: #eaf2ff;
  border-color: rgba(22, 119, 255, 0.35);
  box-shadow: inset 0 0 0 1px rgba(22, 119, 255, 0.12);
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

.fixed-time-grid--popup {
  grid-template-columns: 1fr;
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

  .weekday-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .fixed-time-grid {
    grid-template-columns: 1fr;
  }
}
</style>
