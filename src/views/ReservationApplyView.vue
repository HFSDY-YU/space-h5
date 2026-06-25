<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, CalendarDays, ChevronDown } from '@lucide/vue'
import { createReservation, listPublicRooms, listPublicTimePeriods } from '@/api/space'
import {
  buildBookableTimePoints,
  formatDateValue,
  formatWeekdayValue,
  isAlignedBookableRange,
  sortBackendTimePeriods,
  toUiRoomBase,
  toUiTimePeriod,
} from '@/services/spaceMapper'
import { resolveCapacityOverride } from '@/services/capacityConfirm'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const submitting = ref(false)
const showRoomPicker = ref(false)
const showStartTimePicker = ref(false)
const showEndTimePicker = ref(false)

function parseSlotQuery(value: unknown) {
  const rawText = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
  return rawText
    .split(',')
    .map((item) => {
      const [startTime = '', endTime = ''] = item.split('-')
      return {
        startTime: startTime.slice(0, 5),
        endTime: endTime.slice(0, 5),
      }
    })
    .filter((item) => isAlignedBookableRange(item.startTime, item.endTime))
}

const form = reactive({
  roomId: String(route.query.roomId ?? ''),
  periodId: String(route.query.period ?? ''),
  date: String(route.query.date ?? formatDateValue(new Date())),
  startTime: String(route.query.startTime ?? ''),
  endTime: String(route.query.endTime ?? ''),
  title: '',
  purpose: '',
  people: 20,
  remark: '',
})
const timePoints = buildBookableTimePoints()
const presetSlots = computed(() => parseSlotQuery(route.query.slots))

const roomsQuery = useQuery({
  queryKey: ['h5-normal-apply-rooms'],
  queryFn: async () => {
    const result = await listPublicRooms()
    return result.rows.map((room) => toUiRoomBase(room))
  },
  staleTime: 60_000,
})

const periodsQuery = useQuery({
  queryKey: ['h5-normal-apply-periods'],
  queryFn: async () => {
    const result = await listPublicTimePeriods()
    return sortBackendTimePeriods(result.rows).map(toUiTimePeriod)
  },
  staleTime: 60_000,
})

const rooms = computed(() => roomsQuery.data.value ?? [])
const timePeriods = computed(() => periodsQuery.data.value ?? [])
const selectedRoom = computed(() => rooms.value.find((room) => room.id === form.roomId) ?? rooms.value[0])
const selectedPeriod = computed(() => timePeriods.value.find((period) => period.id === form.periodId))
const endTimeOptions = computed(() => timePoints.filter((point) => point > form.startTime))
const roomPickerColumns = computed(() =>
  rooms.value.map((room) => ({
    text: `${room.code} · ${room.name}`,
    value: room.id,
  })),
)
const startTimePickerColumns = computed(() =>
  timePoints.slice(0, -1).map((point) => ({
    text: point,
    value: point,
  })),
)
const endTimePickerColumns = computed(() =>
  endTimeOptions.value.map((point) => ({
    text: point,
    value: point,
  })),
)
const selectedRoomText = computed(() => {
  const room = selectedRoom.value
  return room ? `${room.code} · ${room.name}` : '请选择房间'
})
const selectedTimeItems = computed(() => {
  if (presetSlots.value.length) return presetSlots.value
  if (!isAlignedBookableRange(form.startTime, form.endTime)) return []
  return [
    {
      startTime: form.startTime,
      endTime: form.endTime,
    },
  ]
})
const selectedTimeText = computed(() => selectedTimeItems.value.map((item) => `${item.startTime}-${item.endTime}`).join('、'))
const canSubmit = computed(() =>
  Boolean(selectedRoom.value && form.date && form.title && form.purpose && selectedTimeItems.value.length),
)

watch(
  rooms,
  (nextRooms) => {
    if (!form.roomId && nextRooms[0]) {
      form.roomId = nextRooms[0].id
    }
  },
  { immediate: true },
)

watch(
  timePeriods,
  () => {
    if (selectedPeriod.value && !route.query.startTime && !route.query.endTime) {
      form.startTime = selectedPeriod.value.startTime?.slice(0, 5) || selectedPeriod.value.time.split('-')[0] || ''
      form.endTime = selectedPeriod.value.endTime?.slice(0, 5) || selectedPeriod.value.time.split('-')[1] || ''
      return
    }

    ensureDefaultTimeRange()
  },
  { immediate: true },
)

watch(
  () => form.startTime,
  () => {
    if (!endTimeOptions.value.includes(form.endTime)) {
      form.endTime = endTimeOptions.value[0] ?? ''
    }
  },
)

function ensureDefaultTimeRange() {
  if (!form.startTime || !timePoints.includes(form.startTime)) {
    form.startTime = timePoints[0] ?? ''
  }
  if (!form.endTime || !endTimeOptions.value.includes(form.endTime)) {
    form.endTime = endTimeOptions.value[0] ?? ''
  }
}

function getPickerValue(option: unknown) {
  if (option && typeof option === 'object' && 'selectedValues' in option) {
    const values = (option as { selectedValues?: unknown[] }).selectedValues
    return String(values?.[0] ?? '')
  }

  if (option && typeof option === 'object' && 'value' in option) {
    return String((option as { value?: unknown }).value ?? '')
  }

  return String(option ?? '')
}

function confirmRoomPicker(option: unknown) {
  const nextRoomId = getPickerValue(option)
  if (nextRoomId) {
    form.roomId = nextRoomId
  }
  showRoomPicker.value = false
}

function confirmStartTimePicker(option: unknown) {
  const nextStartTime = getPickerValue(option)
  if (nextStartTime) {
    form.startTime = nextStartTime
  }
  showStartTimePicker.value = false
}

function confirmEndTimePicker(option: unknown) {
  const nextEndTime = getPickerValue(option)
  if (nextEndTime) {
    form.endTime = nextEndTime
  }
  showEndTimePicker.value = false
}

async function submitReservation() {
  const room = selectedRoom.value

  if (!canSubmit.value || !room) {
    showToast('请完整填写预约信息')
    return
  }

  const capacityOverrideConfirmed = await resolveCapacityOverride(form.people, room)
  if (capacityOverrideConfirmed === null) {
    return
  }

  submitting.value = true

  try {
    await createReservation({
      reservationType: '0',
      title: form.title,
      purpose: form.purpose,
      peopleCount: form.people,
      detailRemark: form.remark,
      capacityOverrideConfirmed,
      items: selectedTimeItems.value.map((item) => ({
          roomId: Number(room.id),
          bookingDate: form.date,
          weekday: formatWeekdayValue(new Date(form.date)),
          startTime: item.startTime,
          endTime: item.endTime,
        })),
    })

    await queryClient.invalidateQueries({ queryKey: ['h5-my-reservations'] })
    await queryClient.invalidateQueries({ queryKey: ['h5-home-schedule'] })
    showToast('常规预约已提交审核')
    router.push('/reservation/mine')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="safe-page normal-apply-page">
    <header class="detail-nav">
      <button type="button" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>常规预约</strong>
      <span></span>
    </header>

    <section class="card room-panel">
      <p class="mini">单日单时段预约</p>
      <h1>{{ selectedRoom?.name ?? '选择房间' }}</h1>
      <div v-if="selectedRoom" class="room-meta">
        <span>{{ selectedRoom.code }}</span>
        <span>{{ selectedRoom.building }} · {{ selectedRoom.floor }}</span>
        <span>{{ selectedRoom.capacity }}人</span>
      </div>
    </section>

    <section class="card stack">
      <h2 class="section-title">预约时间</h2>
      <label class="field-label">
        <span>房间</span>
        <button class="picker-field" type="button" @click="showRoomPicker = true">
          {{ selectedRoomText }}
        </button>
        <ChevronDown :size="16" />
      </label>

      <label class="field-label">
        <span>日期</span>
        <input v-model="form.date" type="date" />
        <CalendarDays :size="16" />
      </label>

      <div v-if="presetSlots.length" class="selected-slots" aria-label="已选择时段">
        <span v-for="item in selectedTimeItems" :key="`${item.startTime}-${item.endTime}`">
          {{ item.startTime }}-{{ item.endTime }}
        </span>
      </div>

      <div v-else class="time-range-grid">
        <label class="field-label">
          <span>开始时间</span>
          <button class="picker-field" type="button" @click="showStartTimePicker = true">
            {{ form.startTime || '请选择' }}
          </button>
          <ChevronDown :size="16" />
        </label>

        <label class="field-label">
          <span>结束时间</span>
          <button class="picker-field" type="button" @click="showEndTimePicker = true">
            {{ form.endTime || '请选择' }}
          </button>
          <ChevronDown :size="16" />
        </label>
      </div>
      <p class="time-tip">
        {{ presetSlots.length ? `已选择 ${selectedTimeItems.length} 个 30 分钟时段：${selectedTimeText}` : '可预约时间 08:30-22:30，按 30 分钟粒度选择。' }}
      </p>
    </section>

    <section class="card stack">
      <h2 class="section-title">申请信息</h2>
      <label class="field-label">
        <span>主题</span>
        <input v-model.trim="form.title" placeholder="例如：课程研讨" />
      </label>
      <label class="field-label">
        <span>用途</span>
        <input v-model.trim="form.purpose" placeholder="例如：教学、会议、活动" />
      </label>
      <label class="field-label">
        <span>人数</span>
        <input v-model.number="form.people" min="1" type="number" />
      </label>
      <label class="field-label field-label--textarea">
        <span>备注</span>
        <textarea v-model.trim="form.remark" rows="4" placeholder="补充设备、布置等需求"></textarea>
      </label>
    </section>

    <section class="normal-submit">
      <van-button block round type="primary" :disabled="!canSubmit" :loading="submitting" @click="submitReservation">
        提交常规预约
      </van-button>
    </section>
  </main>

  <van-popup v-model:show="showRoomPicker" position="bottom" round safe-area-inset-bottom>
    <van-picker
      title="选择房间"
      :columns="roomPickerColumns"
      :model-value="[form.roomId]"
      @confirm="confirmRoomPicker"
      @cancel="showRoomPicker = false"
    />
  </van-popup>

  <van-popup v-model:show="showStartTimePicker" position="bottom" round safe-area-inset-bottom>
    <van-picker
      title="选择开始时间"
      :columns="startTimePickerColumns"
      :model-value="[form.startTime]"
      @confirm="confirmStartTimePicker"
      @cancel="showStartTimePicker = false"
    />
  </van-popup>

  <van-popup v-model:show="showEndTimePicker" position="bottom" round safe-area-inset-bottom>
    <van-picker
      title="选择结束时间"
      :columns="endTimePickerColumns"
      :model-value="[form.endTime]"
      @confirm="confirmEndTimePicker"
      @cancel="showEndTimePicker = false"
    />
  </van-popup>
</template>

<style scoped>
.normal-apply-page {
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

.room-panel {
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(15, 87, 214, 0.92)),
    var(--space-blue);
}

.room-panel .mini {
  color: rgba(255, 255, 255, 0.76);
}

.room-panel h1 {
  margin: 8px 0 12px;
  font-size: 26px;
}

.room-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.room-meta span {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  font-size: 12px;
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
.picker-field,
.field-label textarea {
  width: 100%;
  min-height: 46px;
  padding: 0 12px;
  color: var(--space-text);
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  outline: 0;
}

.picker-field {
  display: flex;
  align-items: center;
  padding-right: 34px;
  text-align: left;
}

.field-label svg {
  position: absolute;
  right: 12px;
  bottom: 15px;
  color: var(--space-muted);
  pointer-events: none;
}

.field-label textarea {
  padding-top: 12px;
  resize: none;
}

.time-range-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.selected-slots {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-slots span {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 10px;
  color: #0f65e8;
  background: #eef6ff;
  border: 1px solid rgba(22, 119, 255, 0.14);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
}

.time-tip {
  margin: -2px 0 0;
  color: var(--space-subtext);
  font-size: 12px;
  line-height: 1.45;
}

.normal-submit {
  position: sticky;
  bottom: calc(var(--space-bottom-nav-height) + 10px);
  z-index: 8;
  display: grid;
  /* 提交按钮需要始终停在底部导航上方，避免窄屏滚动时被 Tabbar 遮挡。 */
  padding: 8px 0 12px;
  background: linear-gradient(180deg, rgba(245, 248, 254, 0), var(--space-bg) 32%);
}

@media (max-width: 360px) {
  .time-range-grid {
    grid-template-columns: 1fr;
  }
}
</style>
