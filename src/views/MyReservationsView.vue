<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { Bell, CalendarDays, Clock3, DoorOpen, Search } from '@lucide/vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { cancelReservation, getReservation, listMyReservations, type BackendReservation } from '@/api/space'
import { toUiReservation } from '@/services/spaceMapper'
import { useSessionStore } from '@/stores/session'
import type { ReservationStatus } from '@/types/space'

const router = useRouter()
const queryClient = useQueryClient()
const session = useSessionStore()
const activeStatus = ref<'all' | ReservationStatus>('all')
const cancellingId = ref('')
const keyword = ref('')
const pageEyebrow = computed(() => `${session.roleLabel}工作台`)

const statusTabs: Array<{ label: string; value: 'all' | ReservationStatus }> = [
  { label: '全部', value: 'all' },
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
  { label: '已取消', value: 'cancelled' },
  { label: '已结束', value: 'finished' },
  { label: '退回', value: 'returned' },
]

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
    // 详情接口异常时保留列表数据，避免单条失败导致整个“我的预约”不可用。
    return reservation
  }
}

const reservationsQuery = useQuery({
  queryKey: ['h5-my-reservations'],
  queryFn: async () => {
    const result = await listMyReservations()
    const detailRows = await Promise.all(result.rows.map(fillReservationDetail))
    return detailRows.map(toUiReservation)
  },
})

const reservations = computed(() => reservationsQuery.data.value ?? [])
const isLoading = computed(() => reservationsQuery.isLoading.value)
const statusCounts = computed(() => {
  return reservations.value.reduce(
    (counts, reservation) => {
      counts.all += 1
      counts[reservation.status] += 1
      return counts
    },
    {
      all: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      finished: 0,
      partial: 0,
      returned: 0,
    } as Record<'all' | ReservationStatus, number>,
  )
})
const filteredReservations = computed(() => {
  const statusFiltered =
    activeStatus.value === 'all'
      ? reservations.value
      : reservations.value.filter((reservation) => reservation.status === activeStatus.value)

  if (!keyword.value) return statusFiltered
  const lowerKeyword = keyword.value.toLowerCase()
  return statusFiltered.filter((reservation) => {
    const searchText = `${reservation.title}${reservation.roomName}${reservation.date}${reservation.time}`.toLowerCase()
    return searchText.includes(lowerKeyword)
  })
})

async function cancelItem(reservationId: string) {
  try {
    await showConfirmDialog({
      title: '取消申请',
      message: '确认取消这条预约申请吗？',
    })
  } catch {
    return
  }

  cancellingId.value = reservationId
  try {
    await cancelReservation(reservationId)
    await queryClient.invalidateQueries({ queryKey: ['h5-my-reservations'] })
    await queryClient.invalidateQueries({ queryKey: ['h5-reservation-detail', reservationId] })
    showToast('已提交取消')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '取消失败')
  } finally {
    cancellingId.value = ''
  }
}
</script>

<template>
  <main class="safe-page my-reservations-page">
    <header class="mine-header">
      <div class="header-row">
        <div>
          <p class="eyebrow">{{ pageEyebrow }}</p>
          <h1 class="title">我的预约</h1>
          <p class="sub-title">{{ statusCounts.pending }} 条待审核 · {{ statusCounts.approved }} 条已通过</p>
        </div>
        <button class="icon-button" type="button" @click="router.push('/messages')">
          <Bell :size="21" />
        </button>
      </div>
    </header>

    <label class="reservation-search">
      <Search :size="18" />
      <input v-model.trim="keyword" placeholder="搜索标题、房间或日期" />
    </label>

    <section class="filter-strip">
      <button
        v-for="tab in statusTabs"
        :key="tab.value"
        :class="{ active: activeStatus === tab.value }"
        type="button"
        @click="activeStatus = tab.value"
      >
        <span>{{ tab.label }}</span>
        <b>{{ statusCounts[tab.value] }}</b>
      </button>
    </section>

    <section class="reservation-list">
      <article v-for="reservation in filteredReservations" :key="reservation.id" class="reservation-card">
        <div class="reservation-card__head">
          <div>
            <p class="mini">{{ reservation.type === 'long' ? '长期预约' : '常规预约' }}</p>
            <h2>{{ reservation.title }}</h2>
          </div>
          <StatusBadge :status="reservation.status" />
        </div>

        <div class="reservation-meta">
          <span>
            <DoorOpen :size="16" />
            {{ reservation.roomName || '待选择房间' }}
          </span>
          <span>
            <CalendarDays :size="16" />
            {{ reservation.date || '未设置日期' }}
          </span>
          <span>
            <Clock3 :size="16" />
            {{ reservation.time || '未设置时段' }}
          </span>
        </div>

        <p class="submitted-at">申请时间：{{ reservation.submittedAt || '-' }}</p>

        <div class="card-actions">
          <button class="plain-button" type="button" @click="router.push(`/reservation/${reservation.id}?from=mine`)">
            查看详情
          </button>
          <button
            v-if="reservation.status === 'pending'"
            class="cancel-button"
            type="button"
            :disabled="cancellingId === reservation.id"
            @click="cancelItem(reservation.id)"
          >
            {{ cancellingId === reservation.id ? '取消中' : '取消申请' }}
          </button>
        </div>
      </article>

      <van-loading v-if="isLoading" type="spinner">加载预约中</van-loading>
      <van-empty v-else-if="filteredReservations.length === 0" description="暂无预约记录" />
    </section>
  </main>
</template>

<style scoped>
.my-reservations-page {
  display: grid;
  align-content: start;
  gap: 12px;
}

.mine-header {
  margin: -14px -16px 2px;
  padding: calc(env(safe-area-inset-top) + 16px) 16px 18px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.98), rgba(14, 91, 218, 0.94)),
    #1677ff;
  border-bottom-right-radius: 24px;
  border-bottom-left-radius: 24px;
}

.mine-header .title {
  font-size: 26px;
}

.reservation-search {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 14px;
  color: var(--space-muted);
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 16px;
  box-shadow: 0 8px 22px rgba(54, 89, 150, 0.07);
}

.reservation-search input {
  width: 100%;
  min-width: 0;
  color: var(--space-text);
  background: transparent;
  border: 0;
  outline: 0;
  font-size: 15px;
}

.filter-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.filter-strip button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  min-height: 42px;
  padding: 0 8px;
  color: var(--space-subtext);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  font-size: 14px;
  font-weight: 780;
}

.filter-strip button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-strip button b {
  flex: 0 0 auto;
  min-width: 20px;
  color: inherit;
  font-size: 12px;
}

.filter-strip .active {
  color: #fff;
  background: var(--space-blue);
  border-color: var(--space-blue);
}

.reservation-list {
  display: grid;
  gap: 12px;
}

.reservation-card {
  display: grid;
  gap: 12px;
  padding: 15px;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 18px;
  box-shadow: 0 10px 26px rgba(54, 89, 150, 0.08);
}

.reservation-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.reservation-card h2 {
  margin: 4px 0 0;
  font-size: 18px;
  line-height: 1.25;
}

.reservation-meta {
  display: grid;
  gap: 8px;
}

.reservation-meta span {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--space-subtext);
  font-size: 14px;
  line-height: 1.35;
}

.reservation-meta svg {
  flex: 0 0 auto;
  color: var(--space-blue);
}

.submitted-at {
  margin: 0;
  color: var(--space-muted);
  font-size: 12px;
}

.card-actions {
  display: flex;
  gap: 10px;
}

.cancel-button {
  min-height: 40px;
  padding: 0 14px;
  color: var(--space-red);
  background: #feecec;
  border: 0;
  border-radius: 999px;
  font-weight: 750;
}

.cancel-button:disabled {
  opacity: 0.68;
}

@media (max-width: 360px) {
  .filter-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .reservation-card__head {
    display: grid;
  }
}
</style>
