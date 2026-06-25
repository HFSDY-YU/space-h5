<script setup lang="ts">
import { BOOKABLE_SLOT_MINUTES, timeToMinutes } from '@/services/spaceMapper'
import type { LongReservationTimeRange } from '@/services/longReservationDraft'

// 长期预约的「半小时时段选择面板」。每周/每日/自定义三种模式共用同一套纵向日程板：
// 左列时间刻度，右列每个半小时格点是一个可点选按钮，已选区间用绝对定位的蓝条覆盖。
// 选中数据与增删逻辑由父组件持有，这里只渲染并把点选/取消通过事件透传。

// 与 CSS 中槽位高度 64px、间距 8px 保持一致，用于计算已选区间蓝条的 top/height。
const SLOT_HEIGHT = 64
const SLOT_GAP = 8

const props = defineProps<{
  timeSlots: LongReservationTimeRange[]
  ranges: LongReservationTimeRange[]
  label: string
  keyPrefix: string
}>()

defineEmits<{
  'toggle-slot': [slot: LongReservationTimeRange]
  'remove-range': [range: LongReservationTimeRange]
}>()

function isSlotSelected(slot: LongReservationTimeRange) {
  return props.ranges.some((range) => slot.startTime >= range.startTime && slot.endTime <= range.endTime)
}

function getRangeStyle(range: LongReservationTimeRange) {
  const startIndex = props.timeSlots.findIndex((slot) => slot.startTime === range.startTime)
  const normalizedStartIndex = Math.max(0, startIndex)
  const durationMinutes = Math.max(BOOKABLE_SLOT_MINUTES, timeToMinutes(range.endTime) - timeToMinutes(range.startTime))
  const slotCount = Math.max(1, Math.round(durationMinutes / BOOKABLE_SLOT_MINUTES))
  const top = normalizedStartIndex * (SLOT_HEIGHT + SLOT_GAP)
  const height = slotCount * SLOT_HEIGHT + Math.max(0, slotCount - 1) * SLOT_GAP

  return {
    top: `${top}px`,
    height: `${height}px`,
  }
}
</script>

<template>
  <div class="agenda-select-board" role="group" :aria-label="label">
    <div class="agenda-time-column" aria-hidden="true">
      <span v-for="slot in timeSlots" :key="`${keyPrefix}-${slot.id}-time`">{{ slot.startTime }}</span>
    </div>
    <div class="agenda-slot-column">
      <button
        v-for="slot in timeSlots"
        :key="`${keyPrefix}-${slot.id}`"
        type="button"
        class="agenda-select-slot"
        :class="{ active: isSlotSelected(slot) }"
        :aria-label="`${slot.startTime}-${slot.endTime}${isSlotSelected(slot) ? '已选择，点击取消' : '可选择，点击添加'}`"
        :aria-pressed="isSlotSelected(slot)"
        @click="$emit('toggle-slot', slot)"
      ></button>
      <button
        v-for="range in ranges"
        :key="`${keyPrefix}-range-${range.id}`"
        type="button"
        class="agenda-selected-range"
        :style="getRangeStyle(range)"
        :aria-label="`${range.startTime}-${range.endTime} 已选择，点击取消`"
        @click="$emit('remove-range', range)"
      >
        <strong>{{ range.startTime }}-{{ range.endTime }}</strong>
      </button>
    </div>
  </div>
</template>

<style scoped>
.agenda-select-board {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding-top: 2px;
}

.agenda-time-column,
.agenda-slot-column {
  display: grid;
  gap: 8px;
}

.agenda-time-column span {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  min-height: 64px;
  padding-top: 2px;
  color: #8490a5;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.2;
}

.agenda-slot-column {
  position: relative;
  padding-left: 10px;
}

.agenda-slot-column::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 1px;
  content: '';
  background: #d8e2ef;
}

.agenda-select-slot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  min-height: 64px;
  padding: 0 16px;
  color: transparent;
  text-align: left;
  background: linear-gradient(180deg, #f6fbff 0%, #edf6ff 100%);
  border: 1px solid #d8e9fb;
  border-radius: 12px;
  box-shadow: none;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.agenda-select-slot::before {
  position: absolute;
  top: 50%;
  left: -14px;
  width: 8px;
  height: 8px;
  content: '';
  background: #d8e2ef;
  border: 2px solid #fff;
  border-radius: 999px;
  transform: translateY(-50%);
}

.agenda-select-slot.active {
  background: #f0f7ff;
  border-color: #b9d8ff;
}

.agenda-select-slot.active::before {
  background: var(--space-blue);
}

.agenda-select-slot:active {
  transform: scale(0.992);
}

.agenda-select-slot:focus-visible {
  outline: 3px solid rgba(22, 119, 255, 0.22);
  outline-offset: 2px;
}

.agenda-selected-range {
  position: absolute;
  right: 0;
  left: 10px;
  z-index: 3;
  display: flex;
  align-items: center;
  min-height: 64px;
  padding: 0 16px;
  color: #fff;
  text-align: left;
  background: linear-gradient(180deg, #1c8aff 0%, #0f70dd 100%);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  box-shadow: 0 12px 24px rgba(22, 119, 255, 0.24);
}

.agenda-selected-range strong {
  min-width: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agenda-selected-range:active {
  transform: scale(0.992);
}

.agenda-selected-range:focus-visible {
  outline: 3px solid rgba(22, 119, 255, 0.24);
  outline-offset: 2px;
}
</style>
