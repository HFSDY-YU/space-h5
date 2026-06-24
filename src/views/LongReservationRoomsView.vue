<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Filter, Search, XCircle } from '@lucide/vue'
import {
  listPublicReservationItems,
  listPublicRooms,
  listReservationItems,
  type BackendReservationItem,
} from '@/api/space'
import { formatBackendTime, toRoomStatus, toUiRoomBase } from '@/services/spaceMapper'
import {
  loadLongReservationRuleDraft,
  saveLongReservationDraft,
  type LongReservationRuleDraft,
  type LongReservationTimeRange,
} from '@/services/longReservationDraft'
import type { Room } from '@/types/space'

type RoomAvailabilityState = 'free' | 'partial' | 'blocked'
type AvailabilityFilter = 'all' | RoomAvailabilityState
type CapacityFilter = 'all' | 'lt30' | '30-60' | 'gt60'

interface RoomConflictDetail {
  date: string
  requestRange: LongReservationTimeRange
  item: BackendReservationItem
}

interface RoomAvailability {
  room: Omit<Room, 'slots'>
  state: RoomAvailabilityState
  busySlotCount: number
  freeSlotCount: number
  totalSlotCount: number
  busyDates: string[]
  conflicts: RoomConflictDetail[]
  score: number
}

const router = useRouter()
const ruleDraft = ref<LongReservationRuleDraft | null>(null)
const pageSize = 6
const capacityOptions: Array<{ text: string; value: CapacityFilter }> = [
  { text: '全部容量', value: 'all' },
  { text: '30 人以下', value: 'lt30' },
  { text: '30-60 人', value: '30-60' },
  { text: '60 人以上', value: 'gt60' },
]
const showCapacityPicker = ref(false)
const conflictRoom = ref<RoomAvailability | null>(null)
const showConflictPanel = computed({
  get: () => Boolean(conflictRoom.value),
  set: (value) => {
    if (!value) conflictRoom.value = null
  },
})
const filters = reactive({
  keyword: '',
  buildingName: '',
  floorNo: '',
  capacity: 'all' as CapacityFilter,
  availability: 'all' as AvailabilityFilter,
  pageNum: 1,
})

const roomParams = computed(() => ({
  pageNum: filters.pageNum,
  pageSize,
  roomCode: filters.keyword || undefined,
  roomName: filters.keyword || undefined,
  buildingName: filters.buildingName || undefined,
  floorNo: filters.floorNo || undefined,
}))

const roomsQuery = useQuery({
  queryKey: computed(() => ['h5-long-room-page', roomParams.value]),
  queryFn: async () => {
    const result = await listPublicRooms(roomParams.value)
    return {
      total: result.total,
      rooms: result.rows.map(toUiRoomBase),
    }
  },
  enabled: computed(() => Boolean(ruleDraft.value)),
  staleTime: 30_000,
})

async function loadReservationItems(date: string) {
  try {
    const result = await listReservationItems({
      bookingDate: date,
      occupiedOnly: true,
    })
    return result.rows
  } catch {
    const result = await listPublicReservationItems({
      bookingDate: date,
    })
    return result.rows
  }
}

const itemsQuery = useQuery({
  queryKey: computed(() => ['h5-long-room-items', ruleDraft.value?.dates.join('|') ?? '']),
  queryFn: async () => {
    const dates = ruleDraft.value?.dates ?? []
    const dateItems = await Promise.all(dates.map((date) => loadReservationItems(date)))
    return dateItems.reduce<BackendReservationItem[]>((items, currentItems) => items.concat(currentItems), [])
  },
  enabled: computed(() => Boolean(ruleDraft.value?.dates.length)),
  staleTime: 20_000,
})

const rooms = computed(() => roomsQuery.data.value?.rooms ?? [])
const totalRooms = computed(() => roomsQuery.data.value?.total ?? 0)
const maxPage = computed(() => Math.max(1, Math.ceil(totalRooms.value / pageSize)))
const occupiedItems = computed(() => itemsQuery.data.value ?? [])
const availabilityList = computed(() => buildRoomAvailabilityList())
const filteredAvailabilityList = computed(() =>
  availabilityList.value.filter((item) => {
    if (filters.availability !== 'all' && item.state !== filters.availability) return false
    if (filters.capacity === 'lt30') return item.room.capacity < 30
    if (filters.capacity === '30-60') return item.room.capacity >= 30 && item.room.capacity <= 60
    if (filters.capacity === 'gt60') return item.room.capacity > 60
    return true
  }),
)
const availabilityStats = computed(() => ({
  free: availabilityList.value.filter((item) => item.state === 'free').length,
  partial: availabilityList.value.filter((item) => item.state === 'partial').length,
  blocked: availabilityList.value.filter((item) => item.state === 'blocked').length,
}))
const isLoading = computed(() => roomsQuery.isLoading.value || itemsQuery.isLoading.value)
const ruleTimeRangeCount = computed(() => {
  const draft = ruleDraft.value
  if (!draft) return 0
  if (draft.mode === 'custom') {
    return draft.customSlots?.reduce((total, slot) => total + slot.timeRanges.length, 0) ?? draft.slotCount
  }
  if (draft.mode === 'weekly' && draft.weekdayTimeRanges) {
    return draft.weekdays.reduce((total, weekday) => total + (draft.weekdayTimeRanges?.[weekday]?.length ?? 0), 0)
  }
  return draft.timeRanges.length
})
const capacityText = computed(
  () => capacityOptions.find((option) => option.value === filters.capacity)?.text ?? '全部容量',
)

onMounted(() => {
  ruleDraft.value = loadLongReservationRuleDraft()
  if (!ruleDraft.value) {
    showToast('请先选择长期预约规则')
    router.replace('/reservation/long')
  }
})

watch(
  () => [filters.keyword, filters.buildingName, filters.floorNo, filters.capacity, filters.availability],
  () => {
    filters.pageNum = 1
  },
)

function normalizeTime(time: string) {
  return formatBackendTime(time) || time.slice(0, 5)
}

function timeToMinutes(time: string) {
  const [hourText = '0', minuteText = '0'] = normalizeTime(time).split(':')
  return Number(hourText) * 60 + Number(minuteText)
}

function createLocalDate(date: string) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isOverlapping(item: BackendReservationItem, range: LongReservationTimeRange) {
  return (
    timeToMinutes(formatBackendTime(item.startTime)) < timeToMinutes(range.endTime) &&
    timeToMinutes(formatBackendTime(item.endTime)) > timeToMinutes(range.startTime)
  )
}

function buildRuleSlots(draft: LongReservationRuleDraft) {
  const slots: Array<{ date: string; range: LongReservationTimeRange }> = []
  if (draft.resolvedSlots?.length) {
    for (const slot of draft.resolvedSlots) {
      for (const range of slot.timeRanges) {
        slots.push({ date: slot.date, range })
      }
    }
    return slots
  }

  if (draft.mode === 'custom' && draft.customSlots?.length) {
    for (const slot of draft.customSlots) {
      for (const range of slot.timeRanges) {
        slots.push({ date: slot.date, range })
      }
    }
    return slots
  }

  for (const date of draft.dates) {
    const weekday = String(createLocalDate(date).getDay())
    const ranges = draft.mode === 'weekly' ? draft.weekdayTimeRanges?.[weekday] ?? draft.timeRanges : draft.timeRanges
    for (const range of ranges) {
      slots.push({ date, range })
    }
  }
  return slots
}

function buildRoomAvailabilityList(): RoomAvailability[] {
  const draft = ruleDraft.value
  if (!draft) return []
  const ruleSlots = buildRuleSlots(draft)
  const slotCount = ruleSlots.length
  if (!slotCount) {
    return rooms.value.map((room) => ({
      room,
      state: 'blocked',
      busySlotCount: 0,
      freeSlotCount: 0,
      totalSlotCount: 0,
      busyDates: [],
      conflicts: [],
      score: 3,
    }))
  }

  return rooms.value
    .map((room) => {
      const roomItems = occupiedItems.value.filter((item) => String(item.roomId ?? '') === room.id)
      const busyDates = new Set<string>()
      const conflicts: RoomConflictDetail[] = []
      let busySlotCount = 0

      for (const slot of ruleSlots) {
        const matchedItem = roomItems.find((item) => item.bookingDate === slot.date && toRoomStatus(item.itemStatus) && isOverlapping(item, slot.range))
        if (matchedItem) {
          busySlotCount += 1
          busyDates.add(slot.date)
          conflicts.push({
            date: slot.date,
            requestRange: slot.range,
            item: matchedItem,
          })
        }
      }

      const freeSlotCount = slotCount - busySlotCount
      const state: RoomAvailabilityState =
        busySlotCount === 0 ? 'free' : freeSlotCount > 0 ? 'partial' : 'blocked'
      const stateScore = state === 'free' ? 0 : state === 'partial' ? 1 : 2

      return {
        room,
        state,
        busySlotCount,
        freeSlotCount,
        totalSlotCount: slotCount,
        busyDates: [...busyDates].slice(0, 4),
        conflicts,
        score: stateScore * 10000 + busySlotCount * 100 - room.capacity,
      }
    })
    .sort((prev, next) => prev.score - next.score || prev.room.code.localeCompare(next.room.code, 'zh-Hans-CN'))
}

function stateLabel(state: RoomAvailabilityState) {
  if (state === 'free') return '全空闲'
  if (state === 'partial') return '部分冲突'
  return '不可预约'
}

function stateIcon(state: RoomAvailabilityState) {
  return state === 'free' ? CheckCircle2 : XCircle
}

function conflictStatusText(item: BackendReservationItem) {
  const status = toRoomStatus(item.itemStatus)
  if (status === 'reviewing') return '审核中'
  if (status === 'occupied') return '已占用'
  return '冲突'
}

function formatConflictTime(item: BackendReservationItem) {
  return `${formatBackendTime(item.startTime)}-${formatBackendTime(item.endTime)}`
}

function conflictApplicantText(item: BackendReservationItem) {
  return item.applicantName || item.orgName || '未提供'
}

function conflictContactText(item: BackendReservationItem) {
  return item.applicantPhone || '未提供'
}

function goPrevPage() {
  filters.pageNum = Math.max(1, filters.pageNum - 1)
}

function goNextPage() {
  filters.pageNum = Math.min(maxPage.value, filters.pageNum + 1)
}

function resetFilters() {
  filters.keyword = ''
  filters.buildingName = ''
  filters.floorNo = ''
  filters.capacity = 'all'
  filters.availability = 'all'
  filters.pageNum = 1
}

function getPickerValue(option: unknown) {
  if (option && typeof option === 'object' && 'selectedValues' in option) {
    return String((option as { selectedValues?: unknown[] }).selectedValues?.[0] ?? '')
  }

  if (option && typeof option === 'object' && 'value' in option) {
    return String((option as { value?: unknown }).value ?? '')
  }

  return String(option ?? '')
}

function confirmCapacityPicker(option: unknown) {
  const nextCapacity = getPickerValue(option) as CapacityFilter
  if (capacityOptions.some((item) => item.value === nextCapacity)) {
    filters.capacity = nextCapacity
  }
  showCapacityPicker.value = false
}

function selectRoom(item: RoomAvailability) {
  const draft = ruleDraft.value
  if (!draft) return
  if (item.state !== 'free') {
    conflictRoom.value = item
    return
  }

  saveLongReservationDraft({
    ...draft,
    room: {
      id: item.room.id,
      code: item.room.code,
      name: item.room.name,
      building: item.room.building,
      floor: item.room.floor,
      capacity: item.room.capacity,
    },
  })
  router.push('/reservation/long/confirm')
}
</script>

<template>
  <main class="safe-page long-rooms-page">
    <header class="detail-nav">
      <button type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>选择教室</strong>
      <button type="button" class="reset-button" @click="resetFilters">重置</button>
    </header>

    <section v-if="ruleDraft" class="rule-strip">
      <strong>{{ ruleDraft.ruleDesc }}</strong>
      <span>{{ ruleDraft.dates.length }} 日期 · {{ ruleTimeRangeCount }} 时段 · {{ ruleDraft.slotCount }} 场次</span>
    </section>

    <section class="filter-card">
      <label class="search-field">
        <Search :size="18" />
        <input v-model.trim="filters.keyword" placeholder="搜索教室号或名称" />
      </label>

      <div class="filter-grid">
        <label>
          <span>楼栋</span>
          <input v-model.trim="filters.buildingName" placeholder="如 6#楼" />
        </label>
        <label>
          <span>楼层</span>
          <input v-model.trim="filters.floorNo" placeholder="如 3F" />
        </label>
      </div>

      <div class="segmented" aria-label="可用性筛选">
        <button type="button" :class="{ active: filters.availability === 'all' }" @click="filters.availability = 'all'">
          全部
        </button>
        <button type="button" :class="{ active: filters.availability === 'free' }" @click="filters.availability = 'free'">
          全空闲
        </button>
        <button type="button" :class="{ active: filters.availability === 'partial' }" @click="filters.availability = 'partial'">
          部分冲突
        </button>
      </div>

      <label class="select-field">
        <Filter :size="17" />
        <span>容量</span>
        <button type="button" @click="showCapacityPicker = true">
          {{ capacityText }}
        </button>
        <ChevronDown :size="16" />
      </label>
    </section>

    <section class="result-card">
      <div class="section-row">
        <div>
          <p class="mini">当前页统计</p>
          <h2 class="section-title">{{ totalRooms }} 间教室</h2>
        </div>
        <div class="stats">
          <span>{{ availabilityStats.free }} 全空闲</span>
          <span>{{ availabilityStats.partial }} 部分冲突</span>
          <span>{{ availabilityStats.blocked }} 不可预约</span>
        </div>
      </div>

      <van-loading v-if="isLoading" class="loading-state" />
      <div v-else-if="!filteredAvailabilityList.length" class="empty-state">当前筛选无匹配教室</div>
      <div v-else class="room-page-list">
        <button
          v-for="item in filteredAvailabilityList"
          :key="item.room.id"
          type="button"
          class="room-option"
          :class="`room-option--${item.state}`"
          @click="selectRoom(item)"
        >
          <component :is="stateIcon(item.state)" :size="20" />
          <div class="room-main">
            <strong>{{ item.room.code }} · {{ item.room.name }}</strong>
            <span>{{ item.room.building }} {{ item.room.floor }} · {{ item.room.capacity }}人</span>
            <small v-if="item.busyDates.length">冲突：{{ item.busyDates.join('、') }}</small>
            <small v-else>所选日期和时间均可预约</small>
          </div>
          <div class="room-score">
            <b>{{ stateLabel(item.state) }}</b>
            <span>{{ item.freeSlotCount }}/{{ item.totalSlotCount }}</span>
            <em v-if="item.conflicts.length">查看冲突</em>
          </div>
        </button>
      </div>
    </section>

    <section class="pager-bar">
      <button type="button" :disabled="filters.pageNum <= 1" @click="goPrevPage">
        <ChevronLeft :size="18" />
        上一页
      </button>
      <span>第 {{ filters.pageNum }} / {{ maxPage }} 页</span>
      <button type="button" :disabled="filters.pageNum >= maxPage" @click="goNextPage">
        下一页
        <ChevronRight :size="18" />
      </button>
    </section>

    <van-popup v-model:show="showCapacityPicker" position="bottom" round safe-area-inset-bottom>
      <van-picker
        title="选择容量"
        :columns="capacityOptions"
        :model-value="[filters.capacity]"
        @confirm="confirmCapacityPicker"
        @cancel="showCapacityPicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showConflictPanel" position="bottom" round safe-area-inset-bottom @closed="conflictRoom = null">
      <section v-if="conflictRoom" class="conflict-panel">
        <header class="conflict-header">
          <div>
            <p class="mini">冲突明细</p>
            <strong>{{ conflictRoom.room.code }} · {{ conflictRoom.room.name }}</strong>
            <span>{{ conflictRoom.room.building }} {{ conflictRoom.room.floor }} · {{ conflictRoom.busySlotCount }} 个冲突</span>
          </div>
          <button type="button" @click="conflictRoom = null">关闭</button>
        </header>

        <div class="conflict-list">
          <article v-for="(conflict, index) in conflictRoom.conflicts" :key="`${conflict.date}-${conflict.requestRange.id}-${index}`">
            <div class="conflict-title">
              <strong>{{ conflict.date }}</strong>
              <span>{{ conflictStatusText(conflict.item) }}</span>
            </div>
            <dl>
              <div>
                <dt>申请时段</dt>
                <dd>{{ conflict.requestRange.startTime }}-{{ conflict.requestRange.endTime }}</dd>
              </div>
              <div>
                <dt>冲突时段</dt>
                <dd>{{ formatConflictTime(conflict.item) }}</dd>
              </div>
              <div>
                <dt>预约主题</dt>
                <dd>{{ conflict.item.title || '未填写' }}</dd>
              </div>
              <div>
                <dt>申请人</dt>
                <dd>{{ conflictApplicantText(conflict.item) }}</dd>
              </div>
              <div>
                <dt>联系方式</dt>
                <dd>{{ conflictContactText(conflict.item) }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>
    </van-popup>
  </main>
</template>

<style scoped>
.long-rooms-page {
  display: grid;
  gap: 12px;
}

.detail-nav {
  display: grid;
  grid-template-columns: 42px 1fr 54px;
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

.detail-nav .reset-button {
  width: 54px;
  color: var(--space-blue);
  font-size: 13px;
  font-weight: 750;
}

.rule-strip,
.filter-card,
.result-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 18px;
  box-shadow: 0 10px 28px rgba(54, 89, 150, 0.08);
}

.rule-strip strong {
  overflow: hidden;
  font-size: 15px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-strip span {
  color: var(--space-subtext);
  font-size: 12px;
}

.search-field,
.select-field {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 12px;
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.search-field svg,
.select-field svg {
  color: var(--space-muted);
}

.search-field input,
.filter-grid input,
.select-field button {
  width: 100%;
  min-height: 44px;
  color: var(--space-text);
  background: transparent;
  border: 0;
  outline: 0;
  text-align: left;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.filter-grid label {
  display: grid;
  gap: 6px;
}

.filter-grid span,
.select-field span {
  color: var(--space-subtext);
  font-size: 12px;
}

.filter-grid input {
  padding: 0 12px;
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.segmented button {
  min-height: 44px;
  color: var(--space-subtext);
  background: #f7faff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  font-weight: 750;
}

.segmented button.active {
  color: var(--space-blue-deep);
  background: #eaf2ff;
  border-color: rgba(22, 119, 255, 0.35);
}

.select-field {
  grid-template-columns: 22px auto minmax(0, 1fr) 16px;
}

.select-field > svg:last-child {
  color: var(--space-muted);
}

.section-title {
  margin: 0;
}

.stats {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.stats span {
  color: var(--space-subtext);
  font-size: 12px;
}

.loading-state,
.empty-state {
  display: grid;
  place-items: center;
  min-height: 220px;
  color: var(--space-subtext);
}

.room-page-list {
  display: grid;
  gap: 10px;
}

.room-option {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 78px;
  padding: 12px;
  color: var(--space-text);
  text-align: left;
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.room-option > svg {
  color: var(--space-muted);
}

.room-option--free > svg {
  color: var(--space-green);
}

.room-option--partial > svg,
.room-option--blocked > svg {
  color: var(--space-orange);
}

.room-main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.room-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-main span,
.room-main small {
  color: var(--space-subtext);
  font-size: 12px;
}

.room-score {
  display: grid;
  justify-items: end;
  gap: 4px;
  font-size: 12px;
}

.room-score b {
  color: var(--space-blue-deep);
}

.room-score span {
  color: var(--space-subtext);
}

.room-score em {
  color: var(--space-orange);
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.pager-bar {
  position: sticky;
  bottom: calc(var(--space-bottom-nav-height) + 10px);
  z-index: 8;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 96px;
  align-items: center;
  gap: 10px;
  padding: 10px 0 12px;
  background: linear-gradient(180deg, rgba(245, 248, 254, 0), var(--space-bg) 32%);
}

.pager-bar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 44px;
  color: var(--space-blue-deep);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  font-weight: 750;
}

.pager-bar button:disabled {
  color: var(--space-muted);
  background: #f2f4f7;
}

.pager-bar span {
  color: var(--space-subtext);
  text-align: center;
  font-size: 13px;
  font-weight: 750;
}

.conflict-panel {
  display: grid;
  gap: 14px;
  max-height: min(82vh, 720px);
  padding: 16px 16px calc(env(safe-area-inset-bottom) + 18px);
  background: var(--space-bg);
}

.conflict-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px;
  align-items: start;
  gap: 12px;
}

.conflict-header div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.conflict-header strong {
  overflow: hidden;
  color: var(--space-text);
  font-size: 19px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conflict-header span {
  color: var(--space-subtext);
  font-size: 12px;
}

.conflict-header button {
  min-height: 38px;
  color: var(--space-blue);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  font-weight: 800;
}

.conflict-list {
  display: grid;
  gap: 10px;
  max-height: min(62vh, 560px);
  overflow-y: auto;
  padding-right: 2px;
}

.conflict-list article {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 16px;
}

.conflict-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.conflict-title strong {
  color: var(--space-text);
  font-size: 15px;
}

.conflict-title span {
  flex: 0 0 auto;
  padding: 3px 8px;
  color: var(--space-orange);
  background: #fff6e6;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 850;
}

.conflict-list dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

.conflict-list dl div {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 10px;
}

.conflict-list dt {
  color: var(--space-subtext);
  font-size: 12px;
}

.conflict-list dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--space-text);
  font-size: 13px;
  font-weight: 750;
}

@media (max-width: 360px) {
  .filter-grid,
  .segmented {
    grid-template-columns: 1fr;
  }

  .room-option {
    grid-template-columns: 22px minmax(0, 1fr);
  }

  .room-score {
    grid-column: 2;
    justify-items: start;
  }
}
</style>
