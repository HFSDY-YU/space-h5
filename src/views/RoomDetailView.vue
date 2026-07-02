<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft, Bell, CalendarDays } from '@lucide/vue'
import { useSessionStore } from '@/stores/session'
import RoomHeroCard from '@/components/RoomHeroCard.vue'
import RoomStatusPanel from '@/components/RoomStatusPanel.vue'
import { segmentStatusText, weekCellStatusText } from '@/services/roomSchedule'
import { useRoomSchedule } from '@/composables/useRoomSchedule'

const router = useRouter()
const session = useSessionStore()

const {
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
} = useRoomSchedule()


</script>

<template>
  <main class="safe-page room-detail-page">
    <header class="detail-nav">
      <button type="button" @click="goBack">
        <ArrowLeft :size="20" />
      </button>
      <strong>{{ room.code }}</strong>
      <button type="button" @click="router.push('/messages')">
        <Bell :size="20" />
      </button>
    </header>

    <RoomHeroCard :room="room" :image-url="roomImageUrl" @preview-image="previewRoomImage" />

    <section class="card week-card">
      <div class="section-row">
        <div>
          <h2 class="section-title">本周占用图</h2>
          <p class="week-range">{{ weekRangeText }}</p>
          <div class="timeline-legend" aria-label="占用状态说明">
            <span class="legend-dot legend-dot--reviewing">审核中</span>
            <span class="legend-dot legend-dot--occupied">占用</span>
          </div>
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
        <template v-for="day in weekDayPanels" :key="day.value">
          <article
            class="timeline-day-row"
            :class="{ 'timeline-day-row--today': day.isToday, 'timeline-day-row--active': isSelectedDay(day) }"
          >
            <button class="timeline-day-label" type="button" @click="expandDay(day)">
              <strong>{{ day.weekday }}</strong>
              <span>{{ day.monthDay }}</span>
              <small v-if="day.isToday">今天</small>
            </button>

            <div
              class="timeline-track-wrap"
              role="button"
              tabindex="0"
              :aria-label="`${day.weekday}${day.monthDay}，点击展开或收回时段选择`"
              @click="expandDay(day)"
              @keydown.enter.prevent="expandDay(day)"
              @keydown.space.prevent="expandDay(day)"
            >
              <div class="timeline-track">
                <span
                  v-for="cell in day.cells"
                  :key="`${cell.date}-${cell.period.id}`"
                  class="timeline-free-slot"
                  :class="{ active: isCellInSelectedRange(cell), disabled: cell.status !== 'free' }"
                  :style="getCellTimelineStyle(cell)"
                ></span>
                <button
                  v-for="segment in day.segments.filter((item) => item.status !== 'expired')"
                  :key="segment.id"
                  type="button"
                  class="timeline-segment"
                  :class="[
                    `timeline-segment--${segment.status}`,
                    { active: isSelectedSegment(segment), 'timeline-segment--source-reviewing': segment.sourceStatus === 'reviewing' },
                  ]"
                  :style="getSegmentStyle(segment)"
                  :aria-label="`${day.weekday}${segment.startTime}-${segment.endTime}${segmentStatusText(segment.status)}${segment.applicantName || segment.title}`"
                  @click.stop="openSegment(segment)"
                >
                  <span>{{ segment.applicantName || segment.label }}</span>
                </button>
              </div>
              <div class="timeline-row-foot">
                <span>{{ BOOKABLE_START_TIME }}</span>
                <span>{{ timelineMiddleText }}</span>
                <span>{{ BOOKABLE_END_TIME }}</span>
              </div>
            </div>
          </article>

          <Transition name="day-detail">
            <section v-if="isSelectedDay(day)" class="day-detail-panel" aria-label="时段选择">
              <div class="day-detail-head">
                <div>
                  <strong>{{ expandedDateText }}</strong>
                  <span>点击时段添加，再次点击取消</span>
                </div>
                <span v-if="selectedSlotCount" class="range-count">{{ selectedSlotCount }} 段</span>
              </div>

              <div class="day-agenda">
                <div class="agenda-times" :style="{ height: `${getVisibleAgendaHeight(day)}px` }" aria-hidden="true">
                  <span v-for="tick in getAgendaTicks(day)" :key="tick.key" :style="{ top: `${tick.top}px` }">
                    {{ tick.time }}
                  </span>
                </div>

                <div
                  class="agenda-board"
                  :style="{
                    height: `${getVisibleAgendaHeight(day)}px`,
                    '--agenda-slot-height': `${detailSlotHeight}px`,
                    '--agenda-minor-height': `${detailMinorTickHeight}px`,
                  }"
                >
                  <template v-for="cell in getUnselectedSelectableCells(day)" :key="`${cell.date}-${cell.period.id}-hit`">
                    <button
                      v-if="cell.status === 'free'"
                      type="button"
                      :data-slot-index="cell.slotIndex"
                      class="agenda-hit-slot"
                      :style="getAgendaCellStyle(day, cell)"
                      :aria-pressed="isCellInSelectedRange(cell)"
                      :aria-label="`${cell.startTime}-${cell.endTime}可预约，点击${isCellInSelectedRange(cell) ? '取消' : '添加'}`"
                      @click="clickDetailCell(day, cell)"
                    >
                      <span>{{ cell.startTime }}-{{ cell.endTime }}</span>
                    </button>
                  </template>

                  <button
                    v-for="range in selectedTimeRanges"
                    :key="range.key"
                    type="button"
                    class="agenda-selected-range"
                    :style="getAgendaRangeButtonStyle(day, range)"
                    :aria-label="`${range.startTime}-${range.endTime}已选择，点击取消`"
                    @click="cancelSelectedRange(range)"
                  >
                    <span>{{ range.startTime }}-{{ range.endTime }}</span>
                  </button>

                  <button
                    v-for="segment in day.segments.filter((item) => item.status !== 'expired')"
                    :key="`${segment.id}-agenda`"
                    type="button"
                    class="agenda-block"
                    :class="[
                      `agenda-block--${segment.status}`,
                      { 'agenda-block--source-reviewing': segment.sourceStatus === 'reviewing' },
                    ]"
                    :style="getAgendaSegmentStyle(day, segment)"
                    :aria-label="`${segment.startTime}-${segment.endTime}${segmentStatusText(segment.status)}${segment.applicantName || segment.title}${segment.contactText ? `，${segment.contactText}` : ''}`"
                    @click.stop="openSegment(segment)"
                  >
                    <strong>{{ segment.applicantName || segment.title || segment.label }}</strong>
                    <span>{{ segment.startTime }}-{{ segment.endTime }} {{ durationText(segment.startTime, segment.endTime) }}</span>
                    <span v-if="segment.contactText" class="agenda-block__contact">{{ segment.contactText }}</span>
                  </button>
                </div>
              </div>
            </section>
          </Transition>
        </template>
      </div>

      <div class="sr-only">
        <div v-for="day in weekDayPanels" :key="`sr-${day.value}`">
          <p>{{ day.weekday }} {{ day.monthDay }}</p>
          <p v-for="cell in day.cells" :key="`${cell.date}-${cell.period.id}`">
            {{ cell.startTime }}-{{ cell.endTime }} {{ weekCellStatusText(cell.status) }}
          </p>
        </div>
      </div>

      <van-loading v-if="isLoading" class="state-box">加载房间占用中</van-loading>
      <van-empty v-else-if="isError" description="房间数据加载失败" />
    </section>

    <section class="card selected-card">
      <div>
        <p class="mini">当前选择</p>
        <strong>{{ selectedCell ? selectedDateText : expandedDateText }}</strong>
        <span>{{ selectedCell ? selectedRangeText : '请在展开的时段表中选择' }}</span>
      </div>
      <span v-if="selectedCell" class="selected-status" :class="`selected-status--${selectedCell.status}`">
        {{ selectedSlotCount ? `${selectedSlotCount} 段` : weekCellStatusText(selectedCell.status) }}
      </span>
    </section>

    <section v-if="session.canReserve || session.canManageRooms" class="fixed-actions">
      <van-button
        v-if="session.canReserve"
        block
        round
        type="primary"
        :disabled="!canReserveSelectedSlot"
        @click="reserveSelectedSlot"
      >
        {{ reserveButtonText }}
      </van-button>
      <van-button v-if="session.canManageRooms" block round plain type="primary" @click="openRoomStatusPanel">
        启用 / 停用管理
      </van-button>
    </section>
  </main>

  <RoomStatusPanel
    v-model:show="showRoomStatusPanel"
    :room-code="room.code"
    :room-type="room.type"
    :loading="adminRoomLoading"
    :status-text="roomStatusText"
    :is-disabled="adminRoomStatus === '1'"
    :can-enable="roomStatusCanEnable"
    :can-disable="roomStatusCanDisable"
    :submitting="roomStatusSubmitting"
    @change-status="changeRoomStatus"
  />
</template>

<style scoped>
.room-detail-page {
  position: relative;
  z-index: 0;
  padding-bottom: calc(var(--space-bottom-nav-height) + 220px);
}

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
  overflow: hidden;
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

.timeline-day-row {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;
  padding: 10px;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 8px;
  box-shadow: 0 8px 22px rgba(54, 89, 150, 0.08);
}

.timeline-day-row--active {
  border-color: rgba(22, 119, 255, 0.42);
  box-shadow:
    0 8px 22px rgba(54, 89, 150, 0.08),
    0 0 0 3px rgba(22, 119, 255, 0.08);
}

.timeline-day-label {
  display: grid;
  place-items: center;
  min-height: 60px;
  padding: 6px 4px;
  color: var(--space-text);
  background: #fbfdff;
  border: 1px solid var(--space-line);
  border-radius: 8px;
}

.timeline-day-label strong,
.timeline-day-label span,
.timeline-day-label small {
  display: block;
  line-height: 1.15;
}

.timeline-day-label strong {
  font-size: 14px;
  font-weight: 850;
}

.timeline-day-label span {
  color: var(--space-subtext);
  font-size: 12px;
}

.timeline-day-label small {
  color: var(--space-blue);
  font-size: 11px;
  font-weight: 800;
}

.timeline-day-row--today .timeline-day-label {
  color: var(--space-blue-deep);
  border-color: rgba(22, 119, 255, 0.28);
}

.timeline-track-wrap {
  display: grid;
  align-content: center;
  gap: 8px;
  min-width: 0;
  min-height: 60px;
  padding: 7px 0 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  outline: none;
}

.timeline-track-wrap:focus-visible {
  border-radius: 8px;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
}

.timeline-track {
  position: relative;
  height: 24px;
  overflow: hidden;
  background: transparent;
  border-radius: 999px;
}

.timeline-track::before {
  position: absolute;
  inset: 9px 0 auto;
  height: 6px;
  background: #eef2f7;
  border-radius: 999px;
  content: '';
}

.timeline-free-slot {
  position: absolute;
  top: 9px;
  height: 6px;
  z-index: 2;
  border-radius: 999px;
  pointer-events: none;
}

.timeline-free-slot.active {
  background: rgba(22, 119, 255, 0.2);
  outline: 2px solid rgba(22, 119, 255, 0.76);
  outline-offset: -2px;
}

.timeline-free-slot.disabled {
  display: none;
}

.timeline-segment {
  position: absolute;
  top: 8px;
  height: 8px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 0 5px;
  overflow: hidden;
  color: #fff;
  border: 0;
  border-radius: 999px;
  box-shadow: 0 5px 10px rgba(15, 31, 61, 0.12);
}

.timeline-segment span {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.timeline-segment--reviewing {
  background: #d97706;
}

.timeline-segment--occupied {
  background: #1677ff;
}

.timeline-segment--expired {
  color: #566174;
  background: #cfd8e6;
  box-shadow: none;
}

.timeline-segment--source-reviewing.timeline-segment--expired {
  border: 1px solid rgba(217, 119, 6, 0.42);
}

.timeline-segment.active {
  outline: 2px solid #0f1f3d;
  outline-offset: 1px;
}

.timeline-row-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  color: var(--space-text);
  font-size: 13px;
  line-height: 1.2;
}

.timeline-row-foot span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 8px;
}

.legend-dot {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  color: var(--space-subtext);
  font-size: 12px;
  font-weight: 750;
}

.legend-dot::before {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  content: '';
}

.legend-dot--reviewing::before {
  background: #d97706;
}

.legend-dot--occupied::before {
  background: #1677ff;
}

.legend-dot--expired::before {
  background: #cfd8e6;
}

.day-detail-panel {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(22, 119, 255, 0.2);
  border-radius: 16px;
  box-shadow: 0 10px 24px rgba(54, 89, 150, 0.07);
}

.day-detail-enter-active,
.day-detail-leave-active {
  max-height: 1600px;
  overflow: hidden;
  transition:
    max-height 260ms ease,
    opacity 220ms ease,
    transform 220ms ease,
    margin 220ms ease;
}

.day-detail-enter-from,
.day-detail-leave-to {
  max-height: 0;
  margin-top: -8px;
  opacity: 0;
  transform: translateY(-8px);
}

.day-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.day-detail-head div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.day-detail-head strong {
  color: var(--space-text);
  font-size: 15px;
  line-height: 1.25;
}

.day-detail-head span {
  color: var(--space-subtext);
  font-size: 12px;
  line-height: 1.35;
}

.range-count {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  min-height: 28px;
  padding: 0 10px;
  color: var(--space-blue);
  background: #eef6ff;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 850;
}

.day-agenda {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  user-select: none;
}

.agenda-times {
  position: relative;
  min-width: 0;
  color: #8a94a8;
  font-size: 12px;
  font-weight: 700;
}

.agenda-times span {
  position: absolute;
  right: 4px;
  line-height: 1;
  transform: translateY(-50%);
  white-space: nowrap;
}

.agenda-times span:first-child {
  transform: translateY(0);
}

.agenda-times span:last-child {
  transform: translateY(-100%);
}

.agenda-board {
  position: relative;
  min-width: 0;
  overflow: hidden;
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(var(--agenda-minor-height) - 1px),
      rgba(15, 31, 61, 0.07) calc(var(--agenda-minor-height) - 1px),
      rgba(15, 31, 61, 0.07) var(--agenda-minor-height)
    ),
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(var(--agenda-slot-height) - 1px),
      rgba(22, 119, 255, 0.15) calc(var(--agenda-slot-height) - 1px),
      rgba(22, 119, 255, 0.15) var(--agenda-slot-height)
    ),
    #fbfdff;
  border: 1px solid rgba(221, 229, 242, 0.95);
  border-radius: 14px;
  touch-action: pan-y;
}

.room-detail-page .fixed-actions {
  position: fixed;
  right: 16px;
  bottom: calc(var(--space-bottom-nav-height) + 10px);
  left: 16px;
  z-index: 30;
  margin-top: 0;
  padding: 10px;
  background: rgba(245, 248, 254, 0.92);
  border: 1px solid rgba(232, 238, 247, 0.9);
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(38, 62, 106, 0.16);
  backdrop-filter: blur(14px);
}

.agenda-hit-slot {
  position: absolute;
  right: 8px;
  left: 8px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 48px;
  padding: 0 12px;
  color: #078047;
  background: rgba(234, 248, 240, 0.94);
  border: 1px solid rgba(8, 128, 71, 0.16);
  border-radius: 8px;
  box-shadow: 0 5px 12px rgba(8, 128, 71, 0.06);
  touch-action: manipulation;
}

.agenda-hit-slot span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agenda-hit-slot span {
  font-size: 13px;
  font-weight: 800;
}

.agenda-hit-slot:focus-visible {
  outline: 3px solid rgba(22, 119, 255, 0.18);
  outline-offset: 2px;
}

.agenda-selected-range {
  position: absolute;
  right: 8px;
  left: 8px;
  z-index: 3;
  display: flex;
  align-items: flex-start;
  min-height: 48px;
  padding: 12px;
  color: #fff;
  background: rgba(22, 119, 255, 0.92);
  border: 1px solid rgba(15, 87, 214, 0.72);
  border-radius: 8px;
  box-shadow: 0 9px 18px rgba(22, 119, 255, 0.2);
  text-align: left;
}

.agenda-selected-range span {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 850;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agenda-selected-range:focus-visible {
  outline: 3px solid rgba(22, 119, 255, 0.2);
  outline-offset: 2px;
}

.agenda-block {
  position: absolute;
  right: 8px;
  left: 8px;
  display: grid;
  align-content: start;
  gap: 5px;
  min-height: 48px;
  padding: 12px 14px;
  overflow: hidden;
  border-radius: 8px;
  text-align: left;
  z-index: 4;
  border: 1px solid transparent;
  box-shadow: 0 8px 18px rgba(38, 62, 106, 0.1);
}

.agenda-block strong,
.agenda-block span {
  min-width: 0;
  overflow: hidden;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agenda-block strong {
  font-size: 14px;
  font-weight: 850;
}

.agenda-block span {
  font-size: 12px;
  font-weight: 750;
}

.agenda-block__contact {
  opacity: 0.86;
}

.agenda-block--reviewing {
  color: #a85a00;
  background: #fff3e7;
  border-color: #f0a24b;
}

.agenda-block--occupied {
  color: #0f5fcb;
  background: #edf5ff;
  border-color: rgba(22, 119, 255, 0.42);
}

.agenda-block--expired {
  color: #6a7589;
  background: rgba(238, 242, 247, 0.92);
  border-color: rgba(106, 118, 140, 0.22);
  box-shadow: none;
}

.agenda-block--source-reviewing.agenda-block--expired {
  border-color: rgba(217, 119, 6, 0.28);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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

@media (max-width: 360px) {
  .timeline-day-row {
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 6px;
    padding: 7px;
  }

  .timeline-day-label {
    min-height: 62px;
  }

  .timeline-track-wrap {
    min-height: 62px;
    padding: 7px 8px;
  }

  .timeline-day-label span,
  .timeline-row-foot {
    font-size: 11px;
  }

  .timeline-segment span {
    font-size: 9px;
  }

  .day-agenda {
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 6px;
  }

  .agenda-times {
    font-size: 11px;
  }

  .agenda-hit-slot,
  .agenda-block {
    right: 6px;
    left: 6px;
    padding: 10px 11px;
  }
}

@media (min-width: 560px) {
  .room-detail-page .fixed-actions {
    right: calc((100vw - 430px) / 2 + 16px);
    left: calc((100vw - 430px) / 2 + 16px);
  }
}
</style>
