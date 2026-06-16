<script setup lang="ts">
import { computed } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { ArrowLeft } from '@lucide/vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { approveReservation, cancelReservation, getReservation, rejectReservation } from '@/api/space'
import { toUiReservation } from '@/services/spaceMapper'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const session = useSessionStore()
const reservationId = computed(() => String(route.params.reservationId))

const reservationQuery = useQuery({
  queryKey: computed(() => ['h5-reservation-detail', reservationId.value]),
  queryFn: async () => {
    const result = await getReservation(reservationId.value)
    if (!result) throw new Error('预约不存在')
    return toUiReservation(result)
  },
})

const reservation = computed(
  () =>
    reservationQuery.data.value ?? {
      id: reservationId.value,
      title: '预约加载中',
      applicant: '',
      applicantRole: '',
      roomId: '',
      roomName: '',
      date: '',
      time: '',
      type: 'single' as const,
      status: 'pending' as const,
      people: 0,
      purpose: '',
      remark: '',
      submittedAt: '',
      sessions: [],
    },
)
const isLoading = computed(() => reservationQuery.isLoading.value)
const isError = computed(() => reservationQuery.isError.value)

async function refreshRelated() {
  await queryClient.invalidateQueries({ queryKey: ['h5-reservation-detail', reservationId.value] })
  await queryClient.invalidateQueries({ queryKey: ['h5-my-reservations'] })
  await queryClient.invalidateQueries({ queryKey: ['h5-pending-reservations'] })
}

async function cancelCurrent() {
  try {
    await showConfirmDialog({ title: '取消申请', message: '确认取消这条预约申请吗？' })
    await cancelReservation(reservationId.value)
    await refreshRelated()
    showToast('已提交取消')
  } catch (error) {
    if (error instanceof Error) showToast(error.message)
  }
}

async function approveCurrent() {
  try {
    await showConfirmDialog({ title: '通过预约', message: '确认审核通过这条预约吗？' })
    await approveReservation(reservationId.value)
    await refreshRelated()
    showToast('已通过')
  } catch (error) {
    if (error instanceof Error) showToast(error.message)
  }
}

async function rejectCurrent() {
  try {
    await showConfirmDialog({ title: '驳回预约', message: '确认驳回这条预约吗？' })
    await rejectReservation(reservationId.value)
    await refreshRelated()
    showToast('已驳回')
  } catch (error) {
    if (error instanceof Error) showToast(error.message)
  }
}
</script>

<template>
  <main class="safe-page">
    <header class="detail-nav">
      <button type="button" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>预约详情</strong>
      <span></span>
    </header>

    <section class="card status-card">
      <div class="list-row">
        <div>
          <p class="mini">预约编号 {{ reservation.id }}</p>
          <h1>{{ reservation.title }}</h1>
        </div>
        <StatusBadge :status="reservation.status" />
      </div>
      <p class="muted">提交时间：{{ reservation.submittedAt }}</p>
    </section>

    <section class="card info-card">
      <h2 class="section-title">主信息</h2>
      <dl>
        <div>
          <dt>申请人</dt>
          <dd>{{ reservation.applicant }} · {{ reservation.applicantRole }}</dd>
        </div>
        <div>
          <dt>房间</dt>
          <dd>{{ reservation.roomName }}</dd>
        </div>
        <div>
          <dt>用途</dt>
          <dd>{{ reservation.purpose }}</dd>
        </div>
        <div>
          <dt>人数</dt>
          <dd>{{ reservation.people }} 人</dd>
        </div>
        <div>
          <dt>备注</dt>
          <dd>{{ reservation.remark }}</dd>
        </div>
      </dl>
    </section>

    <section class="card sessions-card">
      <h2 class="section-title">场次明细</h2>
      <div v-for="sessionItem in reservation.sessions" :key="sessionItem.id" class="session-row">
        <div>
          <strong>{{ sessionItem.roomName }}</strong>
          <span>{{ sessionItem.date }} · {{ sessionItem.time }}</span>
        </div>
        <StatusBadge :status="sessionItem.status" />
      </div>
    </section>

    <section class="card">
      <h2 class="section-title">审核记录</h2>
      <p class="muted">{{ reservation.auditOpinion ?? '暂无审核意见' }}</p>
    </section>

    <van-loading v-if="isLoading" type="spinner">加载详情中</van-loading>
    <van-empty v-else-if="isError" description="预约详情加载失败" />

    <section v-if="session.isTeacher || session.isAdmin" class="fixed-actions">
      <van-button v-if="session.isTeacher && reservation.status === 'pending'" block round plain type="danger" @click="cancelCurrent">
        取消申请
      </van-button>
      <template v-if="session.isAdmin && reservation.status === 'pending'">
        <van-button block round type="primary" @click="approveCurrent">通过</van-button>
        <van-button block round plain type="danger" @click="rejectCurrent">驳回</van-button>
      </template>
    </section>
  </main>
</template>

<style scoped>
.detail-nav {
  display: grid;
  grid-template-columns: 42px 1fr 42px;
  align-items: center;
  margin-bottom: 14px;
}

.detail-nav strong {
  text-align: center;
}

.detail-nav button {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.status-card,
.info-card,
.sessions-card {
  margin-bottom: 12px;
}

.status-card h1 {
  margin: 4px 0 0;
  font-size: 21px;
}

dl {
  display: grid;
  gap: 12px;
  margin: 0;
}

dl div,
.session-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--space-line);
}

dl div:last-child,
.session-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

dt {
  color: var(--space-muted);
  font-size: 13px;
}

dd {
  margin: 0;
  color: var(--space-text);
  text-align: right;
}

.session-row {
  align-items: center;
}

.session-row span {
  display: block;
  margin-top: 5px;
  color: var(--space-subtext);
  font-size: 13px;
}
</style>
