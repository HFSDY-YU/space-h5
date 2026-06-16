<script setup lang="ts">
import { MapPin, Users } from '@lucide/vue'
import { useRouter } from 'vue-router'
import StatusBadge from '@/components/StatusBadge.vue'
import type { Room } from '@/types/space'

const props = defineProps<{
  room: Room
  timePeriods?: Array<{
    id: string
    name: string
  }>
}>()

const router = useRouter()

function openRoom(periodId?: string) {
  router.push({
    name: 'room-detail',
    params: { roomId: props.room.id },
    query: periodId ? { period: periodId } : undefined,
  })
}

function getPeriodName(periodId: string) {
  return props.timePeriods?.find((period) => period.id === periodId)?.name ?? periodId
}
</script>

<template>
  <article class="room-card card" role="button" tabindex="0" @click="openRoom()">
    <div class="room-card__head">
      <div>
        <p class="mini">{{ room.code }} · {{ room.type }}</p>
        <h3>{{ room.name }}</h3>
      </div>
      <span class="room-card__capacity">
        <Users :size="14" />
        {{ room.capacity }}
      </span>
    </div>

    <div class="room-card__meta">
      <MapPin :size="14" />
      <span>{{ room.building }} · {{ room.floor }} · {{ room.location }}</span>
    </div>

    <div class="room-card__equipment">
      <span v-for="item in room.equipment" :key="item">{{ item }}</span>
    </div>

    <div class="slot-grid" @click.stop>
      <button
        v-for="slot in room.slots"
        :key="slot.periodId"
        class="slot-cell"
        type="button"
        @click="openRoom(slot.periodId)"
      >
        <span class="slot-cell__name">{{ getPeriodName(slot.periodId) }}</span>
        <StatusBadge :status="slot.status" type="room" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.room-card {
  display: grid;
  gap: 12px;
  cursor: pointer;
}

.room-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.room-card h3 {
  margin: 4px 0 0;
  font-size: 18px;
  line-height: 1.25;
}

.room-card__capacity,
.room-card__meta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--space-subtext);
  font-size: 13px;
}

.room-card__capacity {
  height: 28px;
  padding: 0 10px;
  color: var(--space-blue);
  background: #eaf2ff;
  border-radius: 999px;
  font-weight: 700;
}

.room-card__equipment {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.room-card__equipment span {
  padding: 5px 9px;
  color: var(--space-subtext);
  background: #f6f8fc;
  border-radius: 999px;
  font-size: 12px;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.slot-cell {
  display: grid;
  gap: 7px;
  justify-items: center;
  min-width: 0;
  min-height: 70px;
  padding: 9px 4px;
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.slot-cell__name {
  color: var(--space-text);
  font-size: 13px;
  font-weight: 750;
}
</style>
