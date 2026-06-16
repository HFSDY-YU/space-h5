<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { Bell, CalendarDays, CheckSquare, Filter, Search, Square } from '@lucide/vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  approveReservation,
  batchApproveReservations,
  batchRejectReservations,
  getReservation,
  listCancelPendingReservations,
  listPendingReservations,
  listReservations,
  rejectReservation,
  type BackendReservation,
} from '@/api/space'
import { formatDateValue, toUiReservations } from '@/services/spaceMapper'
import type { Reservation } from '@/types/space'

const router = useRouter()
const queryClient = useQueryClient()
const activeTab = ref<'pending' | 'cancel' | 'history'>('pending')
const operatingId = ref('')
const keyword = ref('')
const showFilterPanel = ref(false)
const showDateRangeCalendar = ref(false)
const typeFilter = ref<'all' | Reservation['type']>('all')
const peopleFilter = ref<'all' | 'small' | 'medium' | 'large'>('all')
const dateRange = ref<Date[]>([])
const selectedIds = ref<string[]>([])
const calendarMinDate = new Date(new Date().getFullYear() - 1, 0, 1)
const calendarMaxDate = new Date(new Date().getFullYear() + 1, 11, 31)
const bookingDateStart = computed(() => (dateRange.value[0] ? formatDateValue(dateRange.value[0]) : ''))
const bookingDateEnd = computed(() => (dateRange.value[1] ? formatDateValue(dateRange.value[1]) : ''))
const dateRangeText = computed(() => {
  if (!bookingDateStart.value || !bookingDateEnd.value) return '全部日期'
  if (bookingDateStart.value === bookingDateEnd.value) return bookingDateStart.value
  return `${bookingDateStart.value} 至 ${bookingDateEnd.value}`
})
const activeFilterCount = computed(() => {
  return (
    Number(typeFilter.value !== 'all') +
    Number(peopleFilter.value !== 'all') +
    Number(Boolean(bookingDateStart.value && bookingDateEnd.value))
  )
})
const hasSearchOrFilters = computed(() => Boolean(keyword.value.trim()) || activeFilterCount.value > 0)

function hasCompleteReservationSummary(reservation: BackendReservation) {
  const hasItems = Boolean(reservation.items && reservation.items.length > 0)
  return Boolean(reservation.roomName && (reservation.timeRangeText || hasItems))
}

async function fillReservationDetail(reservation: BackendReservation) {
  if (hasCompleteReservationSummary(reservation)) return reservation
  if (!reservation.reservationId) return reservation

  try {
    const detail = await getReservation(String(reservation.reservationId))
    return detail ? { ...reservation, ...detail } : reservation
  } catch {
    // 审核记录列表不能因为单条详情异常整体不可用，失败时保留主列表信息。
    return reservation
  }
}

const pendingQuery = useQuery({
  queryKey: computed(() => ['h5-pending-reservations', bookingDateStart.value, bookingDateEnd.value]),
  queryFn: async () => {
    const result = await listPendingReservations({
      bookingDateStart: bookingDateStart.value || undefined,
      bookingDateEnd: bookingDateEnd.value || undefined,
    })
    return toUiReservations(result.rows)
  },
})

const cancelPendingQuery = useQuery({
  queryKey: computed(() => ['h5-cancel-pending-reservations', bookingDateStart.value, bookingDateEnd.value]),
  queryFn: async () => {
    const result = await listCancelPendingReservations({
      bookingDateStart: bookingDateStart.value || undefined,
      bookingDateEnd: bookingDateEnd.value || undefined,
    })
    return toUiReservations(result.rows)
  },
  enabled: computed(() => activeTab.value === 'cancel'),
})

const auditHistoryQuery = useQuery({
  queryKey: computed(() => ['h5-audit-history-reservations', bookingDateStart.value, bookingDateEnd.value]),
  queryFn: async () => {
    const result = await listReservations({
      bookingDateStart: bookingDateStart.value || undefined,
      bookingDateEnd: bookingDateEnd.value || undefined,
    })
    const historyRows = result.rows.filter((reservation) => reservation.status && reservation.status !== '1')
    const detailRows = await Promise.all(historyRows.map(fillReservationDetail))
    return toUiReservations(detailRows)
  },
  enabled: computed(() => activeTab.value === 'history'),
})

const visibleReservations = computed(() => {
  if (activeTab.value === 'cancel') return cancelPendingQuery.data.value ?? []
  if (activeTab.value === 'history') return auditHistoryQuery.data.value ?? []
  return pendingQuery.data.value ?? []
})

function getReservationDates(reservation: Reservation) {
  const sessionDates = reservation.sessions.map((session) => session.date).filter(Boolean)
  if (sessionDates.length > 0) return sessionDates

  return reservation.date.match(/\d{4}-\d{2}-\d{2}/g) ?? []
}

function isDateMatched(reservation: Reservation) {
  if (!bookingDateStart.value || !bookingDateEnd.value) return true

  const dates = getReservationDates(reservation)
  if (dates.length === 0) return true

  const reservationStart = dates[0] ?? ''
  const reservationEnd = dates[dates.length - 1] ?? reservationStart
  return reservationStart <= bookingDateEnd.value && reservationEnd >= bookingDateStart.value
}

const filteredReservations = computed(() => {
  const lowerKeyword = keyword.value.trim().toLowerCase()

  return visibleReservations.value.filter((reservation) => {
    const searchText =
      `${reservation.title}${reservation.applicant}${reservation.roomName}${reservation.date}${reservation.time}`.toLowerCase()
    const keywordMatched = !lowerKeyword || searchText.includes(lowerKeyword)
    const typeMatched = typeFilter.value === 'all' || reservation.type === typeFilter.value
    const peopleMatched =
      peopleFilter.value === 'all' ||
      (peopleFilter.value === 'small' && reservation.people <= 30) ||
      (peopleFilter.value === 'medium' && reservation.people > 30 && reservation.people <= 80) ||
      (peopleFilter.value === 'large' && reservation.people > 80)
    const dateMatched = isDateMatched(reservation)

    return keywordMatched && typeMatched && peopleMatched && dateMatched
  })
})
const isLoading = computed(() => {
  if (activeTab.value === 'cancel') return cancelPendingQuery.isLoading.value
  if (activeTab.value === 'history') return auditHistoryQuery.isLoading.value
  return pendingQuery.isLoading.value
})
const emptyDescription = computed(() => {
  if (hasSearchOrFilters.value) return '没有匹配预约'
  if (activeTab.value === 'history') return '暂无审核记录'
  if (activeTab.value === 'cancel') return '暂无取消待审预约'
  return '暂无待处理预约'
})
const selectedCount = computed(() => selectedIds.value.length)
const allFilteredSelected = computed(() => {
  return filteredReservations.value.length > 0 && filteredReservations.value.every((item) => selectedIds.value.includes(item.id))
})

async function refreshAuditList() {
  await queryClient.invalidateQueries({ queryKey: ['h5-pending-reservations'] })
  await queryClient.invalidateQueries({ queryKey: ['h5-cancel-pending-reservations'] })
  await queryClient.invalidateQueries({ queryKey: ['h5-audit-history-reservations'] })
  selectedIds.value = []
}

function resetFilters() {
  typeFilter.value = 'all'
  peopleFilter.value = 'all'
  dateRange.value = []
  selectedIds.value = []
}

function confirmDateRange(date: Date | Date[]) {
  const nextDates = Array.isArray(date) ? date : [date]
  if (nextDates.length < 2 || !nextDates[0] || !nextDates[1]) return
  dateRange.value = [nextDates[0], nextDates[1]]
  showDateRangeCalendar.value = false
}

function toggleSelected(reservationId: string) {
  selectedIds.value = selectedIds.value.includes(reservationId)
    ? selectedIds.value.filter((id) => id !== reservationId)
    : [...selectedIds.value, reservationId]
}

function toggleSelectAll() {
  selectedIds.value = allFilteredSelected.value ? [] : filteredReservations.value.map((item) => item.id)
}

async function approveItem(reservationId: string) {
  try {
    await showConfirmDialog({ title: '通过预约', message: '确认审核通过这条预约吗？' })
  } catch {
    return
  }

  operatingId.value = reservationId
  try {
    await approveReservation(reservationId)
    await refreshAuditList()
    showToast('已通过')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '审核失败')
  } finally {
    operatingId.value = ''
  }
}

async function rejectItem(reservationId: string) {
  try {
    await showConfirmDialog({ title: '驳回预约', message: '确认驳回这条预约吗？' })
  } catch {
    return
  }

  operatingId.value = reservationId
  try {
    await rejectReservation(reservationId)
    await refreshAuditList()
    showToast('已驳回')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '审核失败')
  } finally {
    operatingId.value = ''
  }
}

async function approveSelected() {
  if (selectedIds.value.length === 0) {
    showToast('请先选择预约')
    return
  }

  try {
    await showConfirmDialog({
      title: '批量通过',
      message: `确认通过选中的 ${selectedIds.value.length} 条预约吗？`,
    })
  } catch {
    return
  }

  operatingId.value = 'batch'
  try {
    const result = await batchApproveReservations(selectedIds.value)
    await refreshAuditList()
    showToast(result.msg || '批量通过完成')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '批量审核失败')
  } finally {
    operatingId.value = ''
  }
}

async function rejectSelected() {
  if (selectedIds.value.length === 0) {
    showToast('请先选择预约')
    return
  }

  try {
    await showConfirmDialog({
      title: '批量驳回',
      message: `确认驳回选中的 ${selectedIds.value.length} 条预约吗？`,
    })
  } catch {
    return
  }

  operatingId.value = 'batch'
  try {
    const result = await batchRejectReservations(selectedIds.value)
    await refreshAuditList()
    showToast(result.msg || '批量驳回完成')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '批量驳回失败')
  } finally {
    operatingId.value = ''
  }
}
</script>

<template>
  <main class="safe-page">
    <header class="glass-header">
      <div class="header-row">
        <div>
          <p class="eyebrow">管理员工作台</p>
          <h1 class="title">预约审核</h1>
          <p class="sub-title">快速处理待审核与取消申请</p>
        </div>
        <button class="icon-button" type="button" @click="router.push('/messages')">
          <Bell :size="21" />
        </button>
      </div>
    </header>

    <section class="audit-tabs">
      <button :class="{ active: activeTab === 'pending' }" type="button" @click="activeTab = 'pending'">待审核</button>
      <button :class="{ active: activeTab === 'cancel' }" type="button" @click="activeTab = 'cancel'">取消待审</button>
      <button :class="{ active: activeTab === 'history' }" type="button" @click="activeTab = 'history'">审核记录</button>
    </section>

    <section class="audit-toolbar">
      <label class="audit-search">
        <Search :size="20" />
        <input v-model.trim="keyword" placeholder="搜索标题、申请人、房间或日期" />
      </label>
      <button
        class="filter-button"
        :class="{ active: activeFilterCount > 0 }"
        type="button"
        @click="showFilterPanel = true"
      >
        <Filter :size="20" />
        筛选
        <span v-if="activeFilterCount">{{ activeFilterCount }}</span>
      </button>
    </section>

    <section v-if="activeTab === 'pending'" class="batch-bar">
      <button type="button" @click="toggleSelectAll">
        <CheckSquare v-if="allFilteredSelected" :size="18" />
        <Square v-else :size="18" />
        {{ allFilteredSelected ? '取消全选' : '全选' }}
      </button>
      <span>已选 {{ selectedCount }} 条</span>
      <button type="button" :disabled="selectedCount === 0 || operatingId === 'batch'" @click="approveSelected">批量通过</button>
      <button type="button" :disabled="selectedCount === 0 || operatingId === 'batch'" @click="rejectSelected">批量驳回</button>
    </section>

    <section class="stack">
      <article v-for="reservation in filteredReservations" :key="reservation.id" class="card audit-card">
        <div class="list-row">
          <button
            v-if="activeTab === 'pending'"
            class="select-button"
            type="button"
            :aria-label="`${selectedIds.includes(reservation.id) ? '取消选择' : '选择'}${reservation.title}`"
            @click="toggleSelected(reservation.id)"
          >
            <CheckSquare v-if="selectedIds.includes(reservation.id)" :size="19" />
            <Square v-else :size="19" />
          </button>
          <div>
            <p class="mini">{{ reservation.applicant }} · {{ reservation.applicantRole }}</p>
            <h2>{{ reservation.title }}</h2>
          </div>
          <StatusBadge :status="reservation.status" />
        </div>
        <p class="muted">{{ reservation.roomName }} · {{ reservation.date }} · {{ reservation.time }}</p>
        <p>共 {{ reservation.sessions.length }} 个场次 · {{ reservation.people }} 人</p>
        <div class="audit-actions">
          <button class="plain-button" type="button" @click="router.push(`/reservation/${reservation.id}`)">
            详情
          </button>
          <button
            v-if="activeTab === 'pending'"
            class="approve"
            type="button"
            :disabled="operatingId === reservation.id"
            @click="approveItem(reservation.id)"
          >
            通过
          </button>
          <button
            v-if="activeTab === 'pending'"
            class="reject"
            type="button"
            :disabled="operatingId === reservation.id"
            @click="rejectItem(reservation.id)"
          >
            驳回
          </button>
        </div>
      </article>

      <van-loading v-if="isLoading" type="spinner">加载审核数据中</van-loading>
      <van-empty
        v-else-if="filteredReservations.length === 0"
        :description="emptyDescription"
      />
    </section>
  </main>

  <van-popup v-model:show="showFilterPanel" position="bottom" round safe-area-inset-bottom>
    <section class="filter-panel">
      <header class="filter-panel__head">
        <div>
          <strong>筛选预约</strong>
          <span>按预约类型、人数和日期范围缩小范围</span>
        </div>
        <button type="button" @click="resetFilters">重置</button>
      </header>

      <div class="filter-group">
        <h3>预约类型</h3>
        <div class="filter-options">
          <button :class="{ active: typeFilter === 'all' }" type="button" @click="typeFilter = 'all'">
            全部类型
          </button>
          <button :class="{ active: typeFilter === 'single' }" type="button" @click="typeFilter = 'single'">
            常规预约
          </button>
          <button :class="{ active: typeFilter === 'long' }" type="button" @click="typeFilter = 'long'">
            长期预约
          </button>
        </div>
      </div>

      <div class="filter-group">
        <h3>人数</h3>
        <div class="filter-options">
          <button :class="{ active: peopleFilter === 'all' }" type="button" @click="peopleFilter = 'all'">
            全部人数
          </button>
          <button :class="{ active: peopleFilter === 'small' }" type="button" @click="peopleFilter = 'small'">
            30 人以内
          </button>
          <button :class="{ active: peopleFilter === 'medium' }" type="button" @click="peopleFilter = 'medium'">
            31-80 人
          </button>
          <button :class="{ active: peopleFilter === 'large' }" type="button" @click="peopleFilter = 'large'">
            80 人以上
          </button>
        </div>
      </div>

      <div class="filter-group">
        <h3>日期范围</h3>
        <button class="date-range-button" type="button" @click="showDateRangeCalendar = true">
          <CalendarDays :size="18" />
          <span>{{ dateRangeText }}</span>
        </button>
      </div>

      <button class="filter-confirm" type="button" @click="showFilterPanel = false">
        查看 {{ filteredReservations.length }} 条预约
      </button>
    </section>
  </van-popup>

  <van-calendar
    v-model:show="showDateRangeCalendar"
    type="range"
    color="#1677ff"
    :default-date="dateRange.length === 2 ? dateRange : undefined"
    :min-date="calendarMinDate"
    :max-date="calendarMaxDate"
    @confirm="confirmDateRange"
  />
</template>

<style scoped>
.audit-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 5px;
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.audit-tabs button {
  min-height: 38px;
  color: var(--space-subtext);
  background: transparent;
  border: 0;
  border-radius: 12px;
  font-weight: 750;
}

.audit-tabs .active {
  color: #fff;
  background: var(--space-blue);
}

.audit-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
}

.audit-search,
.filter-button {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 48px;
  background: #fff;
  border: 0;
  border-radius: 16px;
  box-shadow: 0 10px 22px rgba(54, 89, 150, 0.08);
}

.audit-search {
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
  padding: 0 14px;
  color: var(--space-muted);
  border: 1px solid var(--space-line);
}

.audit-search input {
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
  color: var(--space-text);
  width: 82px;
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

.batch-bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px;
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.batch-bar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 38px;
  padding: 0 10px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 12px;
  font-weight: 780;
}

.batch-bar button:last-child {
  color: var(--space-red);
  background: #feecec;
}

.batch-bar button:disabled {
  opacity: 0.56;
}

.batch-bar span {
  overflow: hidden;
  color: var(--space-subtext);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.audit-card h2 {
  margin: 4px 0 0;
  font-size: 17px;
}

.audit-card p {
  margin: 10px 0 0;
}

.audit-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.select-button {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 38px;
  min-height: 38px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 12px;
}

.approve,
.reject {
  min-height: 36px;
  padding: 0 13px;
  border: 0;
  border-radius: 999px;
  font-weight: 750;
}

.approve {
  color: #fff;
  background: var(--space-blue);
}

.reject {
  color: var(--space-red);
  background: #feecec;
}

.approve:disabled,
.reject:disabled {
  opacity: 0.68;
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

.date-range-button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  color: var(--space-text);
  text-align: left;
  background: #f6f9fe;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  font-size: 15px;
  font-weight: 800;
}

.date-range-button svg {
  flex: 0 0 auto;
  color: var(--space-blue);
}

.date-range-button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  .audit-toolbar {
    gap: 7px;
  }

  .filter-button {
    width: 76px;
  }

  .audit-search input,
  .filter-button {
    font-size: 14px;
  }

  .batch-bar {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
