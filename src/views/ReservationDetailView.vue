<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { ArrowLeft, CheckSquare, RotateCcw, Square } from '@lucide/vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  approveReservation,
  cancelReservation,
  getReservation,
  rejectReservation,
  rejectReservationItem,
  returnReservationItem,
} from '@/api/space'
import { toUiReservation } from '@/services/spaceMapper'
import { useSessionStore } from '@/stores/session'
import type { ReservationSession } from '@/types/space'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const session = useSessionStore()
const reservationId = computed(() => String(route.params.reservationId))
const detailSource = computed(() => String(route.query.from || ''))
const isAuditContext = computed(() => detailSource.value === 'audit' || (!detailSource.value && session.canAudit))
type SessionAuditAction = 'reject' | 'return'

const selectedSessionIds = ref<string[]>([])
const operatingSessionId = ref('')
const showSessionReasonPanel = ref(false)
const sessionReason = ref('')
const sessionReasonAction = ref<SessionAuditAction>('reject')
const sessionReasonTargetIds = ref<string[]>([])
const sessionReasonSubmitting = ref(false)

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
      applicantPhone: '',
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
const canCancelCurrent = computed(
  () => session.canViewMyReservations && reservation.value.status === 'pending' && !isAuditContext.value,
)
const auditableSessions = computed(() => reservation.value.sessions.filter(canAuditSession))
const canAuditCurrent = computed(
  () => session.canAudit && detailSource.value !== 'mine' && auditableSessions.value.length > 0,
)
const selectedAuditableSessionIds = computed(() =>
  selectedSessionIds.value.filter((id) => auditableSessions.value.some((sessionItem) => sessionItem.id === id)),
)
const allAuditableSessionsSelected = computed(
  () =>
    auditableSessions.value.length > 0 &&
    auditableSessions.value.every((sessionItem) => selectedAuditableSessionIds.value.includes(sessionItem.id)),
)
const isSessionReasonBatch = computed(() => sessionReasonTargetIds.value.length > 1)
const sessionReasonPanelTitle = computed(() => {
  const prefix = isSessionReasonBatch.value ? '批量' : ''
  return sessionReasonAction.value === 'return' ? `${prefix}退回修改` : `${prefix}直接驳回`
})
const sessionReasonPanelDescription = computed(() => {
  const countText = isSessionReasonBatch.value ? `选中的 ${sessionReasonTargetIds.value.length} 个场次` : '该场次'
  return sessionReasonAction.value === 'return'
    ? `将${countText}退回给申请人修改`
    : `将${countText}直接驳回并释放空间`
})
const sessionReasonPlaceholder = computed(() =>
  sessionReasonAction.value === 'return' ? '请说明需要申请人修改的内容' : '请填写直接驳回原因',
)

async function refreshRelated() {
  await queryClient.invalidateQueries({ queryKey: ['h5-reservation-detail', reservationId.value] })
  await queryClient.invalidateQueries({ queryKey: ['h5-my-reservations'] })
  await queryClient.invalidateQueries({ queryKey: ['h5-pending-reservations'] })
  await queryClient.invalidateQueries({ queryKey: ['h5-cancel-pending-reservations'] })
  await queryClient.invalidateQueries({ queryKey: ['h5-audit-history-reservations'] })
  await queryClient.invalidateQueries({ queryKey: ['h5-home-schedule'] })
  await queryClient.invalidateQueries({ queryKey: ['h5-room-detail-week'] })
  selectedSessionIds.value = []
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

function resolveSessionAuditStage(sessionItem: ReservationSession) {
  const stage = sessionItem.effectiveAuditStage || sessionItem.auditStage || ''
  return !stage || stage === '0' ? '1' : stage
}

function isTeacherAuditBlockingSession(sessionItem: ReservationSession) {
  return ['1', '4', '7'].includes(String(sessionItem.itemStatus || '')) && resolveSessionAuditStage(sessionItem) === '1'
}

function hasTeacherAuditBlockingSession(targetSession: ReservationSession) {
  if (session.isAdmin || session.hasAllPermissions || session.isTeacher) return false
  if (resolveSessionAuditStage(targetSession) !== '2') return false
  return reservation.value.sessions.some(isTeacherAuditBlockingSession)
}

function canAuditSession(sessionItem: ReservationSession) {
  if (!session.canAudit || !sessionItem.id) return false
  if (sessionItem.itemStatus !== '1' && sessionItem.itemStatus !== '4') return false
  if (session.isAdmin || session.hasAllPermissions) return true

  const auditStage = resolveSessionAuditStage(sessionItem)
  if (session.isProperty) return auditStage === '2' && !hasTeacherAuditBlockingSession(sessionItem)
  if (session.isTeacher) return auditStage === '1'
  return false
}

function toggleSessionSelected(sessionItem: ReservationSession) {
  if (!canAuditSession(sessionItem)) return
  selectedSessionIds.value = selectedSessionIds.value.includes(sessionItem.id)
    ? selectedSessionIds.value.filter((id) => id !== sessionItem.id)
    : [...selectedSessionIds.value, sessionItem.id]
}

function toggleAllAuditableSessions() {
  selectedSessionIds.value = allAuditableSessionsSelected.value ? [] : auditableSessions.value.map((item) => item.id)
}

function openSessionReasonPanel(action: SessionAuditAction, sessionItem?: ReservationSession) {
  const targetIds = sessionItem ? [sessionItem.id] : selectedAuditableSessionIds.value
  if (targetIds.length === 0) {
    showToast('请先选择可处理场次')
    return
  }

  sessionReasonAction.value = action
  sessionReasonTargetIds.value = targetIds
  sessionReason.value = ''
  showSessionReasonPanel.value = true
}

async function submitSessionReasonAudit() {
  const reason = sessionReason.value.trim()
  if (!reason) {
    showToast(sessionReasonAction.value === 'return' ? '请填写退回修改原因' : '请填写直接驳回原因')
    return
  }

  sessionReasonSubmitting.value = true
  operatingSessionId.value = isSessionReasonBatch.value ? 'batch' : sessionReasonTargetIds.value[0] || ''

  try {
    const request = sessionReasonAction.value === 'return' ? returnReservationItem : rejectReservationItem
    // 后端目前提供单场次处理接口，没有独立的批量场次接口；批量操作按 PC 端逻辑逐条提交，并汇总结果。
    const results = await Promise.allSettled(sessionReasonTargetIds.value.map((id) => request(id, reason)))
    const successCount = results.filter((result) => result.status === 'fulfilled').length
    const failureCount = results.length - successCount

    await refreshRelated()
    showSessionReasonPanel.value = false
    if (failureCount > 0) {
      showToast(`已处理 ${successCount} 个，失败 ${failureCount} 个`)
    } else {
      showToast(isSessionReasonBatch.value ? `批量处理完成，共 ${successCount} 个场次` : '场次已处理')
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '场次处理失败')
  } finally {
    sessionReasonSubmitting.value = false
    operatingSessionId.value = ''
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
          <dt>联系方式</dt>
          <dd>{{ reservation.applicantPhone || '-' }}</dd>
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
      <div class="section-row sessions-card__head">
        <h2 class="section-title">场次明细</h2>
        <span v-if="auditableSessions.length > 0">{{ auditableSessions.length }} 个待处理</span>
      </div>

      <div v-if="auditableSessions.length > 1" class="session-batch-bar">
        <button type="button" @click="toggleAllAuditableSessions">
          <CheckSquare v-if="allAuditableSessionsSelected" :size="18" />
          <Square v-else :size="18" />
          {{ allAuditableSessionsSelected ? '取消全选' : '全选' }}
        </button>
        <em>已选 {{ selectedAuditableSessionIds.length }} 个</em>
        <button
          class="session-action session-action--reject"
          type="button"
          :disabled="selectedAuditableSessionIds.length === 0 || operatingSessionId === 'batch'"
          @click="openSessionReasonPanel('reject')"
        >
          批量驳回
        </button>
        <button
          class="session-action session-action--return"
          type="button"
          :disabled="selectedAuditableSessionIds.length === 0 || operatingSessionId === 'batch'"
          @click="openSessionReasonPanel('return')"
        >
          批量退回
        </button>
      </div>

      <div v-for="sessionItem in reservation.sessions" :key="sessionItem.id" class="session-row">
        <button
          v-if="canAuditSession(sessionItem)"
          class="session-select"
          type="button"
          :aria-label="`${selectedSessionIds.includes(sessionItem.id) ? '取消选择' : '选择'}${sessionItem.roomName}${sessionItem.date}${sessionItem.time}`"
          @click="toggleSessionSelected(sessionItem)"
        >
          <CheckSquare v-if="selectedSessionIds.includes(sessionItem.id)" :size="19" />
          <Square v-else :size="19" />
        </button>
        <div class="session-main">
          <div>
            <strong>{{ sessionItem.roomName }}</strong>
            <span>{{ sessionItem.date }} · {{ sessionItem.time }}</span>
            <small v-if="sessionItem.rejectReason">原因：{{ sessionItem.rejectReason }}</small>
          </div>
          <StatusBadge :status="sessionItem.status" />
        </div>
        <div v-if="canAuditSession(sessionItem)" class="session-actions">
          <button
            class="session-action session-action--reject"
            type="button"
            :disabled="operatingSessionId === sessionItem.id || operatingSessionId === 'batch'"
            @click="openSessionReasonPanel('reject', sessionItem)"
          >
            驳回
          </button>
          <button
            class="session-action session-action--return"
            type="button"
            :disabled="operatingSessionId === sessionItem.id || operatingSessionId === 'batch'"
            @click="openSessionReasonPanel('return', sessionItem)"
          >
            <RotateCcw :size="15" />
            退回修改
          </button>
        </div>
      </div>
    </section>

    <section class="card">
      <h2 class="section-title">审核进度</h2>
      <p class="muted">{{ reservation.auditStageText || '暂无审核阶段' }}</p>
      <p class="muted">{{ reservation.auditOpinion ?? '暂无审核意见' }}</p>
    </section>

    <van-loading v-if="isLoading" type="spinner">加载详情中</van-loading>
    <van-empty v-else-if="isError" description="预约详情加载失败" />

    <section v-if="canCancelCurrent || canAuditCurrent" class="fixed-actions">
      <van-button v-if="canCancelCurrent" block round plain type="danger" @click="cancelCurrent">
        取消申请
      </van-button>
      <template v-if="canAuditCurrent">
        <van-button block round type="primary" @click="approveCurrent">通过</van-button>
        <van-button block round plain type="danger" @click="rejectCurrent">驳回</van-button>
      </template>
    </section>
  </main>

  <van-popup v-model:show="showSessionReasonPanel" position="bottom" round safe-area-inset-bottom>
    <section class="session-reason-panel">
      <header class="session-reason-panel__head">
        <div>
          <strong>{{ sessionReasonPanelTitle }}</strong>
          <span>{{ sessionReasonPanelDescription }}</span>
        </div>
        <button type="button" :disabled="sessionReasonSubmitting" @click="showSessionReasonPanel = false">关闭</button>
      </header>

      <label class="session-reason-field">
        <span>{{ sessionReasonAction === 'return' ? '退回原因 *' : '驳回原因 *' }}</span>
        <textarea
          v-model.trim="sessionReason"
          rows="4"
          maxlength="200"
          :placeholder="sessionReasonPlaceholder"
          :disabled="sessionReasonSubmitting"
        ></textarea>
      </label>

      <button
        class="session-reason-submit"
        type="button"
        :disabled="sessionReasonSubmitting"
        @click="submitSessionReasonAudit"
      >
        {{ sessionReasonSubmitting ? '提交中' : `确认${sessionReasonAction === 'return' ? '退回修改' : '直接驳回'}` }}
      </button>
    </section>
  </van-popup>
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

dl div {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--space-line);
}

dl div:last-child {
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

.sessions-card__head {
  align-items: flex-start;
  margin-bottom: 12px;
}

.sessions-card__head .section-title {
  margin-bottom: 0;
}

.sessions-card__head > span {
  flex: 0 0 auto;
  padding: 4px 9px;
  color: #9a5b00;
  background: #fff7e6;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 750;
}

.session-batch-bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px;
  background: #f6f9fe;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.session-batch-bar button:first-child {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 40px;
  padding: 0 10px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 780;
}

.session-batch-bar em {
  overflow: hidden;
  color: var(--space-subtext);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-style: normal;
}

.session-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--space-line);
}

.session-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.session-select {
  display: grid;
  place-items: center;
  width: 42px;
  min-height: 42px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 14px;
}

.session-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.session-main > div {
  min-width: 0;
}

.session-main strong,
.session-main span,
.session-main small {
  overflow-wrap: anywhere;
}

.session-main span {
  display: block;
  margin-top: 5px;
  color: var(--space-subtext);
  font-size: 13px;
}

.session-main small {
  display: block;
  margin-top: 6px;
  color: var(--space-muted);
  font-size: 12px;
  line-height: 1.35;
}

.session-actions {
  grid-column: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.session-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
}

.session-action--reject {
  color: var(--space-red);
  background: #feecec;
}

.session-action--return {
  color: #9a5b00;
  background: #fff7e6;
}

.session-action:disabled {
  opacity: 0.58;
}

.session-reason-panel {
  padding: 18px 18px calc(env(safe-area-inset-bottom) + 18px);
  background: #fff;
}

.session-reason-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.session-reason-panel__head div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.session-reason-panel__head strong {
  font-size: 19px;
  font-weight: 850;
}

.session-reason-panel__head span {
  color: var(--space-subtext);
  font-size: 13px;
  line-height: 1.4;
}

.session-reason-panel__head button {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 12px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 800;
}

.session-reason-field {
  display: grid;
  gap: 9px;
}

.session-reason-field span {
  color: var(--space-text);
  font-size: 15px;
  font-weight: 850;
}

.session-reason-field textarea {
  width: 100%;
  min-height: 112px;
  padding: 12px;
  color: var(--space-text);
  background: #f6f9fe;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  outline: 0;
  resize: none;
  font-size: 15px;
  line-height: 1.45;
}

.session-reason-field textarea:focus {
  border-color: rgba(22, 119, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.08);
}

.session-reason-submit {
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

.session-reason-panel__head button:disabled,
.session-reason-field textarea:disabled,
.session-reason-submit:disabled {
  opacity: 0.64;
}

@media (max-width: 380px) {
  .session-batch-bar {
    grid-template-columns: 1fr 1fr;
  }

  .session-batch-bar em {
    text-align: right;
  }

  .session-action {
    min-height: 42px;
  }
}
</style>
