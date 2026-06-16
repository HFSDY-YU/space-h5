<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Clock3,
  DoorOpen,
  FileText,
  UserRound,
  Users,
} from '@lucide/vue'
import {
  getPublicRoom,
  listPublicReservationItems,
  listPublicTimePeriods,
  type BackendReservationItem,
} from '@/api/space'
import {
  formatBackendTime,
  formatWeekday,
  sortBackendTimePeriods,
  toItemReservationStatus,
  toRoomStatus,
  toUiRoomBase,
  toUiTimePeriod,
} from '@/services/spaceMapper'
import type { RoomStatus, TimePeriod } from '@/types/space'

const route = useRoute()
const router = useRouter()

function firstQueryValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return typeof value === 'string' ? value : ''
}

function parseDateValue(dateText: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return new Date()
  const [year = 0, month = 1, day = 1] = dateText.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isOverlapping(item: BackendReservationItem, period: TimePeriod) {
  const itemStart = formatBackendTime(item.startTime)
  const itemEnd = formatBackendTime(item.endTime)
  const periodStart = formatBackendTime(period.startTime)
  const periodEnd = formatBackendTime(period.endTime)
  return itemStart < periodEnd && itemEnd > periodStart
}

function statusText(status: RoomStatus) {
  if (status === 'free') return '空闲'
  if (status === 'reviewing') return '审核中'
  return '占用'
}

function itemStatusText(item: BackendReservationItem) {
  const status = toItemReservationStatus(item.itemStatus)
  if (status === 'pending') return '待审核'
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已驳回'
  if (status === 'cancelled') return '已取消'
  if (status === 'finished') return '已结束'
  return '部分通过'
}

function statusClass(status: RoomStatus) {
  if (status === 'reviewing') return 'reviewing'
  if (status === 'occupied') return 'occupied'
  return 'free'
}

const roomId = computed(() => String(route.params.roomId))
const bookingDate = computed(() => firstQueryValue(route.query.date) || new Date().toISOString().slice(0, 10))
const periodId = computed(() => firstQueryValue(route.query.period))
const dateText = computed(() => `${bookingDate.value} ${formatWeekday(parseDateValue(bookingDate.value))}`)

const slotQuery = useQuery({
  queryKey: computed(() => ['h5-room-slot-detail', roomId.value, bookingDate.value, periodId.value]),
  queryFn: async () => {
    const [room, periodsResult] = await Promise.all([getPublicRoom(roomId.value), listPublicTimePeriods()])
    const periods = sortBackendTimePeriods(periodsResult.rows).map(toUiTimePeriod)
    const period = periods.find((item) => item.id === periodId.value) ?? periods[0]

    const itemResult = await listPublicReservationItems({
      roomId: Number(roomId.value),
      bookingDate: bookingDate.value,
      periodStartTime: period?.startTime,
      periodEndTime: period?.endTime,
    })

    const items = period ? itemResult.rows.filter((item) => isOverlapping(item, period)) : itemResult.rows
    const primaryItem =
      items.find((item) => toRoomStatus(item.itemStatus) === 'reviewing') ??
      items.find((item) => toRoomStatus(item.itemStatus) === 'occupied') ??
      items[0]

    return {
      room: room ? toUiRoomBase(room) : undefined,
      period,
      items,
      primaryItem,
    }
  },
  staleTime: 30_000,
})

const room = computed(() => slotQuery.data.value?.room)
const period = computed(() => slotQuery.data.value?.period)
const items = computed(() => slotQuery.data.value?.items ?? [])
const primaryItem = computed(() => slotQuery.data.value?.primaryItem)
const currentStatus = computed<RoomStatus>(() => toRoomStatus(primaryItem.value?.itemStatus) ?? 'free')
const periodText = computed(() => (period.value ? `${period.value.name} ${period.value.time}` : '当前时段'))
const isLoading = computed(() => slotQuery.isLoading.value)
const isError = computed(() => slotQuery.isError.value)

function goRoomWeek() {
  router.replace({
    name: 'room-detail',
    params: { roomId: roomId.value },
    query: { date: bookingDate.value, period: periodId.value },
  })
}
</script>

<template>
  <main class="safe-page slot-detail-page">
    <header class="slot-nav">
      <button type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>时段占用</strong>
      <button type="button" aria-label="消息" @click="router.push('/messages')">
        <Bell :size="20" />
      </button>
    </header>

    <section class="slot-hero" :class="`slot-hero--${statusClass(currentStatus)}`">
      <div>
        <p>{{ room?.code || roomId }} · {{ room?.type || '房间' }}</p>
        <h1>{{ statusText(currentStatus) }}</h1>
        <span>{{ dateText }} · {{ periodText }}</span>
      </div>
      <DoorOpen :size="34" />
    </section>

    <section class="info-card">
      <h2>房间信息</h2>
      <div class="info-grid">
        <span>
          <DoorOpen :size="16" />
          {{ room?.name || '-' }}
        </span>
        <span>
          <Users :size="16" />
          {{ room?.capacity || 0 }} 人
        </span>
        <span>
          <CalendarDays :size="16" />
          {{ dateText }}
        </span>
        <span>
          <Clock3 :size="16" />
          {{ periodText }}
        </span>
      </div>
    </section>

    <section class="info-card">
      <div class="section-head">
        <h2>占用信息</h2>
        <button class="plain-button" type="button" @click="goRoomWeek">本周占用图</button>
      </div>

      <div v-if="primaryItem" class="reservation-main">
        <div class="reservation-title">
          <p>{{ primaryItem.reservationType === '1' ? '长期预约' : '常规预约' }}</p>
          <strong>{{ primaryItem.title || '未命名预约' }}</strong>
          <span :class="`status-pill status-pill--${statusClass(currentStatus)}`">
            {{ itemStatusText(primaryItem) }}
          </span>
        </div>

        <dl>
          <div>
            <dt><UserRound :size="15" />预约人</dt>
            <dd>{{ primaryItem.applicantName || '-' }}</dd>
          </div>
          <div>
            <dt><Users :size="15" />人数</dt>
            <dd>{{ primaryItem.peopleCount ?? '-' }}</dd>
          </div>
          <div>
            <dt><Clock3 :size="15" />时间</dt>
            <dd>
              {{ primaryItem.bookingDate || bookingDate }}
              {{ formatBackendTime(primaryItem.startTime) }}-{{ formatBackendTime(primaryItem.endTime) }}
            </dd>
          </div>
          <div>
            <dt><FileText :size="15" />备注</dt>
            <dd>{{ primaryItem.detailRemark || primaryItem.orgName || '暂无' }}</dd>
          </div>
        </dl>
      </div>

      <van-empty v-else-if="!isLoading && !isError" description="当前时段暂无占用信息" />
      <van-loading v-if="isLoading" class="state-box">加载占用信息中</van-loading>
      <van-empty v-else-if="isError" description="占用信息加载失败" />
    </section>

    <section v-if="items.length > 1" class="info-card">
      <h2>相关场次</h2>
      <div class="item-list">
        <article v-for="item in items" :key="item.itemId" class="item-row">
          <div>
            <strong>{{ item.title || '未命名预约' }}</strong>
            <span>{{ item.applicantName || '-' }} · {{ formatBackendTime(item.startTime) }}-{{ formatBackendTime(item.endTime) }}</span>
          </div>
          <b>{{ itemStatusText(item) }}</b>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.slot-detail-page {
  display: grid;
  align-content: start;
  gap: 12px;
}

.slot-nav {
  display: grid;
  grid-template-columns: 46px 1fr 46px;
  align-items: center;
  gap: 8px;
}

.slot-nav strong {
  text-align: center;
  font-size: 18px;
}

.slot-nav button {
  display: grid;
  place-items: center;
  width: 46px;
  min-height: 46px;
  color: var(--space-text);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 15px;
}

.slot-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 18px;
  color: #fff;
  border-radius: 20px;
}

.slot-hero--reviewing {
  background:
    linear-gradient(135deg, rgba(196, 115, 0, 0.96), rgba(151, 88, 0, 0.9)),
    #a15d00;
}

.slot-hero--occupied {
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(16, 91, 212, 0.92)),
    #1677ff;
}

.slot-hero--free {
  background:
    linear-gradient(135deg, rgba(5, 150, 90, 0.96), rgba(4, 120, 87, 0.9)),
    #05965a;
}

.slot-hero p,
.slot-hero span {
  margin: 0;
  color: rgba(255, 255, 255, 0.84);
  font-size: 13px;
}

.slot-hero h1 {
  margin: 6px 0;
  font-size: 30px;
  line-height: 1.1;
}

.info-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(54, 89, 150, 0.07);
}

.info-card h2 {
  margin: 0;
  color: var(--space-text);
  font-size: 17px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.info-grid {
  display: grid;
  gap: 9px;
}

.info-grid span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 28px;
  color: var(--space-subtext);
  font-size: 14px;
}

.info-grid svg,
dt svg {
  flex: 0 0 auto;
  color: var(--space-blue);
}

.reservation-main {
  display: grid;
  gap: 14px;
}

.reservation-title {
  position: relative;
  display: grid;
  gap: 5px;
  padding-right: 76px;
}

.reservation-title p {
  margin: 0;
  color: var(--space-muted);
  font-size: 12px;
}

.reservation-title strong {
  color: var(--space-text);
  font-size: 21px;
  line-height: 1.25;
}

.status-pill {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 850;
}

.status-pill--reviewing {
  color: #9a5b00;
  background: #fff7e6;
}

.status-pill--occupied {
  color: #0f65e8;
  background: #eaf2ff;
}

.status-pill--free {
  color: #078047;
  background: #eaf8f0;
}

dl {
  display: grid;
  gap: 10px;
  margin: 0;
}

dl div {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding-top: 10px;
  border-top: 1px solid var(--space-line);
}

dt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--space-muted);
  font-size: 13px;
}

dd {
  min-width: 0;
  margin: 0;
  color: var(--space-text);
  text-align: right;
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
}

.item-list {
  display: grid;
  gap: 10px;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.item-row div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.item-row strong,
.item-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-row strong {
  color: var(--space-text);
  font-size: 14px;
}

.item-row span {
  color: var(--space-subtext);
  font-size: 12px;
}

.item-row b {
  flex: 0 0 auto;
  color: var(--space-blue);
  font-size: 12px;
}

.state-box {
  padding: 18px 0;
}
</style>
