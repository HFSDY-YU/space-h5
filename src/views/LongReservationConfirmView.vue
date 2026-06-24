<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, CalendarDays, Clock3, DoorOpen, SendHorizontal } from '@lucide/vue'
import { createReservation } from '@/api/space'
import { formatWeekdayValue } from '@/services/spaceMapper'
import {
  clearLongReservationDraft,
  clearLongReservationRuleDraft,
  loadLongReservationDraft,
  LONG_RESERVATION_MODE_LABELS,
  type LongReservationDraft,
  type LongReservationTimeRange,
} from '@/services/longReservationDraft'

const router = useRouter()
const queryClient = useQueryClient()
const draft = ref<LongReservationDraft | null>(null)
const submitting = ref(false)
const form = reactive({
  title: '',
  purpose: '课程教学',
  people: 20,
  remark: '',
})

const canSubmit = computed(
  () => Boolean(draft.value?.room && buildDraftSlots(draft.value).length) && form.title && form.purpose && form.people > 0,
)
const dateText = computed(() => {
  if (!draft.value) return ''
  if (draft.value.mode === 'custom') return `${draft.value.dates.length} 个日期`
  return `${draft.value.startDate} 至 ${draft.value.endDate}`
})
const timeText = computed(
  () =>
    buildDraftSlots(draft.value)
      .slice(0, 3)
      .map((slot) => `${slot.date} ${slot.range.name ? `${slot.range.name} ` : ''}${slot.range.startTime}-${slot.range.endTime}`)
      .join('、') ?? '',
)
const modeText = computed(() => (draft.value ? LONG_RESERVATION_MODE_LABELS[draft.value.mode] : '长期预约'))
const draftSlots = computed(() => buildDraftSlots(draft.value))

onMounted(() => {
  draft.value = loadLongReservationDraft()
  if (!draft.value) {
    showToast('请先选择长期预约规则')
    router.replace('/reservation/long')
  }
})

function createLocalDate(date: string) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function buildDraftSlots(currentDraft: LongReservationDraft | null) {
  const slots: Array<{ date: string; range: LongReservationTimeRange }> = []
  if (!currentDraft) return slots

  if (currentDraft.resolvedSlots?.length) {
    for (const slot of currentDraft.resolvedSlots) {
      for (const range of slot.timeRanges) {
        slots.push({ date: slot.date, range })
      }
    }
    return slots
  }

  if (currentDraft.mode === 'custom' && currentDraft.customSlots?.length) {
    for (const slot of currentDraft.customSlots) {
      for (const range of slot.timeRanges) {
        slots.push({ date: slot.date, range })
      }
    }
    return slots
  }

  for (const date of currentDraft.dates) {
    const weekday = String(createLocalDate(date).getDay())
    const ranges =
      currentDraft.mode === 'weekly'
        ? currentDraft.weekdayTimeRanges?.[weekday] ?? currentDraft.timeRanges
        : currentDraft.timeRanges
    for (const range of ranges) {
      slots.push({ date, range })
    }
  }
  return slots
}

function buildItems(currentDraft: LongReservationDraft) {
  const items = []
  for (const slot of buildDraftSlots(currentDraft)) {
    items.push({
      roomId: Number(currentDraft.room.id),
      bookingDate: slot.date,
      weekday: formatWeekdayValue(createLocalDate(slot.date)),
      startTime: slot.range.startTime,
      endTime: slot.range.endTime,
    })
  }
  return items
}

async function submitReservation() {
  const currentDraft = draft.value
  if (!currentDraft || !canSubmit.value) {
    showToast('请完整填写申请信息')
    return
  }

  submitting.value = true

  try {
    await createReservation({
      reservationType: '1',
      title: form.title,
      purpose: form.purpose,
      peopleCount: form.people,
      detailRemark: form.remark,
      items: buildItems(currentDraft),
      rule: {
        ruleType: currentDraft.ruleType,
        startDate: currentDraft.startDate,
        endDate: currentDraft.endDate,
        weekdays: currentDraft.weekdays.join(','),
        customDatesText: currentDraft.customDates.join(','),
        startTime: draftSlots.value[0]?.range.startTime ?? '',
        endTime: draftSlots.value[draftSlots.value.length - 1]?.range.endTime ?? '',
        ruleDesc: currentDraft.ruleDesc,
      },
    })

    clearLongReservationDraft()
    clearLongReservationRuleDraft()
    await queryClient.invalidateQueries({ queryKey: ['h5-my-reservations'] })
    await queryClient.invalidateQueries({ queryKey: ['h5-home-schedule'] })
    showToast('长期预约已提交审核')
    router.push('/reservation/mine')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="safe-page long-confirm-page">
    <header class="detail-nav">
      <button type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>申请信息</strong>
      <span></span>
    </header>

    <section v-if="draft" class="summary-card">
      <p class="mini">{{ modeText }}</p>
      <h1>{{ draft.room.code }} · {{ draft.room.name }}</h1>
      <div class="summary-list">
        <div>
          <DoorOpen :size="18" />
          <span>{{ draft.room.building }} {{ draft.room.floor }} · {{ draft.room.capacity }}人</span>
        </div>
        <div>
          <CalendarDays :size="18" />
          <span>{{ dateText }} · {{ draft.dates.length }} 日期</span>
        </div>
        <div>
          <Clock3 :size="18" />
          <span>{{ timeText }} · {{ draftSlots.length }} 场次</span>
        </div>
      </div>
    </section>

    <section class="form-card">
      <div class="section-row">
        <div>
          <p class="mini">3 申请信息</p>
          <h2 class="section-title">填写提交内容</h2>
        </div>
      </div>

      <label class="field-label">
        <span>主题 *</span>
        <input v-model.trim="form.title" placeholder="例如：2026 秋季课程排课" />
      </label>
      <label class="field-label">
        <span>用途 *</span>
        <input v-model.trim="form.purpose" placeholder="例如：课程教学、固定训练" />
      </label>
      <label class="field-label">
        <span>人数 *</span>
        <input v-model.number="form.people" min="1" type="number" />
      </label>
      <label class="field-label field-label--textarea">
        <span>备注</span>
        <textarea v-model.trim="form.remark" rows="4" placeholder="补充设备、布置、审批说明等需求"></textarea>
      </label>
    </section>

    <section class="confirm-submit">
      <van-button block round type="primary" :disabled="!canSubmit" :loading="submitting" @click="submitReservation">
        <SendHorizontal :size="18" />
        提交长期预约
      </van-button>
    </section>
  </main>
</template>

<style scoped>
.long-confirm-page {
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

.summary-card,
.form-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  background: var(--space-card);
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 18px;
  box-shadow: 0 10px 28px rgba(54, 89, 150, 0.08);
}

.summary-card {
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(15, 87, 214, 0.92)),
    var(--space-blue);
}

.summary-card .mini {
  color: rgba(255, 255, 255, 0.76);
}

.summary-card h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.25;
}

.summary-list {
  display: grid;
  gap: 8px;
}

.summary-list div {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 14px;
}

.summary-list span {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-title {
  margin: 0;
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
.field-label textarea {
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  color: var(--space-text);
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  outline: 0;
}

.field-label textarea {
  min-height: 104px;
  padding-top: 12px;
  resize: none;
}

.confirm-submit {
  position: sticky;
  bottom: calc(var(--space-bottom-nav-height) + 10px);
  z-index: 8;
  display: grid;
  padding: 10px 0 12px;
  background: linear-gradient(180deg, rgba(245, 248, 254, 0), var(--space-bg) 32%);
}

.confirm-submit :deep(.van-button__content) {
  gap: 8px;
}
</style>
