<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, CalendarDays, ChevronDown } from '@lucide/vue'
import { createReservation, listPublicRooms, listPublicTimePeriods } from '@/api/space'
import { formatDateValue, formatWeekdayValue, sortBackendTimePeriods, toUiRoomBase, toUiTimePeriod } from '@/services/spaceMapper'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const submitting = ref(false)

const form = reactive({
  roomId: String(route.query.roomId ?? ''),
  periodId: String(route.query.period ?? ''),
  date: String(route.query.date ?? formatDateValue(new Date())),
  title: '',
  purpose: '',
  people: 20,
  remark: '',
})

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
const selectedPeriod = computed(() => timePeriods.value.find((period) => period.id === form.periodId) ?? timePeriods.value[0])
const canSubmit = computed(() => Boolean(selectedRoom.value && selectedPeriod.value && form.date && form.title && form.purpose))

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
  (nextPeriods) => {
    if (!form.periodId && nextPeriods[0]) {
      form.periodId = nextPeriods[0].id
    }
  },
  { immediate: true },
)

async function submitReservation() {
  const room = selectedRoom.value
  const period = selectedPeriod.value

  if (!canSubmit.value || !room || !period) {
    showToast('请完整填写预约信息')
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
      items: [
        {
          roomId: Number(room.id),
          bookingDate: form.date,
          weekday: formatWeekdayValue(new Date(form.date)),
          startTime: period.startTime || period.time.split('-')[0] || '',
          endTime: period.endTime || period.time.split('-')[1] || '',
        },
      ],
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
      <h2 class="section-title">预约时段</h2>
      <label class="field-label">
        <span>房间</span>
        <select v-model="form.roomId">
          <option v-for="room in rooms" :key="room.id" :value="room.id">
            {{ room.code }} · {{ room.name }}
          </option>
        </select>
        <ChevronDown :size="16" />
      </label>

      <label class="field-label">
        <span>日期</span>
        <input v-model="form.date" type="date" />
        <CalendarDays :size="16" />
      </label>

      <label class="field-label">
        <span>时段</span>
        <select v-model="form.periodId">
          <option v-for="period in timePeriods" :key="period.id" :value="period.id">
            {{ period.name }} {{ period.time }}
          </option>
        </select>
        <ChevronDown :size="16" />
      </label>
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
.field-label select,
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

.field-label select {
  appearance: none;
  padding-right: 34px;
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

.normal-submit {
  position: sticky;
  bottom: calc(var(--space-bottom-nav-height) + 10px);
  z-index: 8;
  display: grid;
  /* 提交按钮需要始终停在底部导航上方，避免窄屏滚动时被 Tabbar 遮挡。 */
  padding: 8px 0 12px;
  background: linear-gradient(180deg, rgba(245, 248, 254, 0), var(--space-bg) 32%);
}
</style>
