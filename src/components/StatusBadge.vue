<script setup lang="ts">
import { computed } from 'vue'
import type { ReservationStatus, RoomStatus } from '@/types/space'

const props = defineProps<{
  status: RoomStatus | ReservationStatus
  type?: 'room' | 'reservation'
}>()

const roomStatusText: Record<RoomStatus, string> = {
  free: '空闲',
  reviewing: '审核中',
  occupied: '占用',
}

const reservationStatusText: Record<ReservationStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已取消',
  finished: '已结束',
  partial: '部分通过',
}

const label = computed(() =>
  props.type === 'room'
    ? roomStatusText[props.status as RoomStatus]
    : reservationStatusText[props.status as ReservationStatus],
)
</script>

<template>
  <span class="status-pill" :class="`status-${status}`">{{ label }}</span>
</template>
