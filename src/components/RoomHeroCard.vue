<script setup lang="ts">
import { DoorOpen, MapPin, Users } from '@lucide/vue'
import type { Room } from '@/types/space'

// 房间详情顶部的信息卡：房间名、位置、容量、设备标签与可预览的房间图片。纯展示，
// 图片点击通过 preview-image 事件交给父组件（统一用 vant 的 showImagePreview）。
defineProps<{
  room: Room
  imageUrl: string
}>()

defineEmits<{
  'preview-image': []
}>()
</script>

<template>
  <section class="card room-hero">
    <div class="room-hero__main">
      <div class="room-hero__content">
        <p class="mini">{{ room.type }} · {{ room.building }}</p>
        <h1>{{ room.name }}</h1>
        <div class="room-meta">
          <span><MapPin :size="15" />{{ room.location }}</span>
          <span><Users :size="15" />{{ room.capacity }} 人</span>
        </div>
      </div>

      <button
        v-if="imageUrl"
        class="room-hero__image"
        type="button"
        :aria-label="`查看${room.code}房间图片`"
        @click="$emit('preview-image')"
      >
        <img :src="imageUrl" :alt="`${room.code}房间图片`" />
      </button>
      <div v-else class="room-hero__image room-hero__image--empty" aria-label="房间图片占位">
        <DoorOpen :size="24" />
      </div>
    </div>
    <div class="equipment-row">
      <span v-for="item in room.equipment" :key="item">{{ item }}</span>
    </div>
  </section>
</template>

<style scoped>
.room-hero {
  margin-bottom: 12px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(15, 87, 214, 0.92)),
    #1677ff;
}

.room-hero__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  align-items: center;
  gap: 16px;
}

.room-hero__content {
  min-width: 0;
}

.room-hero .mini,
.room-hero .muted {
  color: rgba(255, 255, 255, 0.76);
}

.room-hero h1 {
  overflow: hidden;
  margin: 8px 0 12px;
  font-size: 27px;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-hero__image {
  display: grid;
  place-items: center;
  width: 112px;
  height: 112px;
  padding: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.86);
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 8px;
}

.room-hero__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-hero__image--empty {
  border-style: dashed;
}

.room-meta {
  display: grid;
  gap: 8px;
  color: rgba(255, 255, 255, 0.86);
}

.room-meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equipment-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.equipment-row span {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  font-size: 12px;
}

@media (max-width: 360px) {
  .room-hero__main {
    grid-template-columns: minmax(0, 1fr) 92px;
    gap: 12px;
  }

  .room-hero__image {
    width: 92px;
    height: 92px;
  }
}
</style>
