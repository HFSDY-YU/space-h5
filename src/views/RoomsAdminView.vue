<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { Bell, ChevronRight, Filter, MapPin, Search, Users } from '@lucide/vue'
import { listRooms } from '@/api/space'
import { toUiRoomBase } from '@/services/spaceMapper'

type AdminRoom = ReturnType<typeof toUiRoomBase> & {
  status: string
  bookable: string
}

interface AdminRoomFilters {
  keyword: string
  building: string
  floor: string
  type: string
  equipment: string[]
  status: string
}

const route = useRoute()
const router = useRouter()
const showFilterPanel = ref(false)
const filters = reactive<AdminRoomFilters>({
  keyword: typeof route.query.keyword === 'string' ? route.query.keyword : '',
  building: 'all',
  floor: 'all',
  type: 'all',
  equipment: [],
  status: 'all',
})

const roomsQuery = useQuery({
  queryKey: ['h5-admin-room-list'],
  queryFn: async () => {
    const result = await listRooms({ pageSize: 300 })
    return result.rows.map((room) => ({
      ...toUiRoomBase(room),
      status: room.status ?? '0',
      bookable: room.bookable ?? '0',
    }))
  },
})

const rooms = computed<AdminRoom[]>(() => roomsQuery.data.value ?? [])
const isLoading = computed(() => roomsQuery.isLoading.value)
const optionData = computed(() => {
  const buildings = new Set<string>()
  const floors = new Set<string>()
  const types = new Set<string>()
  const equipment = new Set<string>()

  rooms.value.forEach((room) => {
    if (room.building) buildings.add(room.building)
    if (room.floor) floors.add(room.floor)
    if (room.type) types.add(room.type)
    room.equipment.forEach((item) => {
      if (item) equipment.add(item)
    })
  })

  return {
    buildings: Array.from(buildings).sort(),
    floors: Array.from(floors).sort((prev, next) => prev.localeCompare(next, 'zh-CN', { numeric: true })),
    types: Array.from(types).sort(),
    equipment: Array.from(equipment).sort(),
  }
})
const activeFilterCount = computed(() => {
  return [
    filters.building !== 'all' ? filters.building : '',
    filters.floor !== 'all' ? filters.floor : '',
    filters.type !== 'all' ? filters.type : '',
    filters.status !== 'all' ? filters.status : '',
    ...filters.equipment,
  ].filter(Boolean).length
})
const hasSearchOrFilters = computed(() => Boolean(filters.keyword.trim()) || activeFilterCount.value > 0)
const filteredRooms = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()

  return rooms.value.filter((room) => {
    const text = `${room.code}${room.name}${room.type}${room.building}${room.floor}${room.location}`.toLowerCase()
    const equipmentText = room.equipment.join(' ').toLowerCase()
    const keywordMatched = !keyword || text.includes(keyword) || equipmentText.includes(keyword)
    const equipmentMatched =
      filters.equipment.length === 0 || filters.equipment.every((equipment) => room.equipment.includes(equipment))
    const buildingMatched = filters.building === 'all' || room.building === filters.building
    const floorMatched = filters.floor === 'all' || room.floor === filters.floor
    const typeMatched = filters.type === 'all' || room.type === filters.type
    const statusMatched = filters.status === 'all' || room.status === filters.status

    return keywordMatched && equipmentMatched && buildingMatched && floorMatched && typeMatched && statusMatched
  })
})

function openRoom(room: AdminRoom) {
  router.push(`/rooms/${room.id}`)
}

function resetFilters() {
  filters.keyword = ''
  filters.building = 'all'
  filters.floor = 'all'
  filters.type = 'all'
  filters.equipment = []
  filters.status = 'all'
}

function toggleEquipmentFilter(equipment: string) {
  if (filters.equipment.includes(equipment)) {
    filters.equipment = filters.equipment.filter((item) => item !== equipment)
    return
  }

  filters.equipment = [...filters.equipment, equipment]
}

watch(
  () => route.query.keyword,
  (keyword) => {
    if (typeof keyword === 'string') filters.keyword = keyword
  },
)
</script>

<template>
  <main class="safe-page rooms-admin-page">
    <header class="glass-header">
      <div class="header-row">
        <div>
          <p class="eyebrow">管理员工作台</p>
          <h1 class="title">房间管理</h1>
          <p class="sub-title">{{ filteredRooms.length }} / {{ rooms.length }} 间房间</p>
        </div>
        <button class="icon-button" type="button" @click="router.push('/messages')">
          <Bell :size="21" />
        </button>
      </div>
    </header>

    <section class="admin-toolbar">
      <label class="search-box">
        <Search :size="20" />
        <input v-model.trim="filters.keyword" placeholder="搜索房间编号、名称、位置" />
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

    <section class="room-list">
      <button
        v-for="room in filteredRooms"
        :key="room.id"
        class="room-info-card"
        type="button"
        :aria-label="`查看${room.code}房间详情`"
        @click="openRoom(room)"
      >
        <span class="room-main">
          <span class="room-title-row">
            <strong>{{ room.code }}</strong>
            <em :class="{ disabled: room.status === '1' }">{{ room.status === '1' ? '已停用' : '启用中' }}</em>
          </span>
          <span class="room-sub">{{ room.name }} · {{ room.type }}</span>
          <span class="room-meta">
            <MapPin :size="15" />
            {{ room.building }} · {{ room.floor }} · {{ room.location }}
          </span>
          <span class="room-meta">
            <Users :size="15" />
            {{ room.capacity }} 人
          </span>
          <span class="equipment-row">
            <small v-for="item in room.equipment" :key="item">{{ item }}</small>
          </span>
        </span>
        <ChevronRight :size="19" />
      </button>

      <van-loading v-if="isLoading" type="spinner">加载房间中</van-loading>
      <van-empty v-else-if="filteredRooms.length === 0" :description="hasSearchOrFilters ? '没有匹配房间' : '暂无房间'" />
    </section>
  </main>

  <van-popup v-model:show="showFilterPanel" position="bottom" round safe-area-inset-bottom>
    <section class="filter-panel">
      <header class="filter-panel__head">
        <div>
          <strong>筛选房间</strong>
          <span>按楼栋、楼层、类型、状态和设备缩小范围</span>
        </div>
        <button type="button" @click="resetFilters">重置</button>
      </header>

      <div v-if="optionData.buildings.length" class="filter-group">
        <h3>楼栋</h3>
        <div class="filter-options">
          <button :class="{ active: filters.building === 'all' }" type="button" @click="filters.building = 'all'">
            全部楼栋
          </button>
          <button
            v-for="item in optionData.buildings"
            :key="item"
            :class="{ active: filters.building === item }"
            type="button"
            @click="filters.building = item"
          >
            {{ item }}
          </button>
        </div>
      </div>

      <div v-if="optionData.floors.length" class="filter-group">
        <h3>楼层</h3>
        <div class="filter-options">
          <button :class="{ active: filters.floor === 'all' }" type="button" @click="filters.floor = 'all'">
            全部楼层
          </button>
          <button
            v-for="item in optionData.floors"
            :key="item"
            :class="{ active: filters.floor === item }"
            type="button"
            @click="filters.floor = item"
          >
            {{ item }}
          </button>
        </div>
      </div>

      <div v-if="optionData.types.length" class="filter-group">
        <h3>类型</h3>
        <div class="filter-options">
          <button :class="{ active: filters.type === 'all' }" type="button" @click="filters.type = 'all'">
            全部类型
          </button>
          <button
            v-for="item in optionData.types"
            :key="item"
            :class="{ active: filters.type === item }"
            type="button"
            @click="filters.type = item"
          >
            {{ item }}
          </button>
        </div>
      </div>

      <div class="filter-group">
        <h3>状态</h3>
        <div class="filter-options">
          <button :class="{ active: filters.status === 'all' }" type="button" @click="filters.status = 'all'">
            全部状态
          </button>
          <button :class="{ active: filters.status === '0' }" type="button" @click="filters.status = '0'">
            启用中
          </button>
          <button :class="{ active: filters.status === '1' }" type="button" @click="filters.status = '1'">
            已停用
          </button>
        </div>
      </div>

      <div v-if="optionData.equipment.length" class="filter-group">
        <h3>设备</h3>
        <div class="filter-options">
          <button :class="{ active: filters.equipment.length === 0 }" type="button" @click="filters.equipment = []">
            全部设备
          </button>
          <button
            v-for="item in optionData.equipment"
            :key="item"
            :class="{ active: filters.equipment.includes(item) }"
            type="button"
            @click="toggleEquipmentFilter(item)"
          >
            {{ item }}
          </button>
        </div>
      </div>

      <button class="filter-confirm" type="button" @click="showFilterPanel = false">
        查看 {{ filteredRooms.length }} 间房间
      </button>
    </section>
  </van-popup>
</template>

<style scoped>
.rooms-admin-page {
  display: grid;
  align-content: start;
  gap: 12px;
}

.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-box,
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

.search-box {
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
  padding: 0 14px;
  color: var(--space-muted);
  border: 1px solid var(--space-line);
}

.search-box input {
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

.room-list {
  display: grid;
  gap: 10px;
}

.room-info-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 138px;
  padding: 15px;
  color: var(--space-text);
  text-align: left;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(54, 89, 150, 0.07);
}

.room-main {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.room-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.room-title-row strong {
  overflow: hidden;
  font-size: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-title-row em {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 5px 10px;
  color: #078047;
  background: #eaf8f0;
  border-radius: 999px;
  font-size: 12px;
  font-style: normal;
  font-weight: 850;
}

.room-title-row em.disabled {
  color: var(--space-red);
  background: #feecec;
}

.room-sub,
.room-meta {
  min-width: 0;
  overflow: hidden;
  color: var(--space-subtext);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.room-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.room-meta svg {
  flex: 0 0 auto;
  color: var(--space-blue);
}

.equipment-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.equipment-row small {
  padding: 5px 9px;
  color: var(--space-subtext);
  background: #f2f6fc;
  border-radius: 999px;
}

.room-info-card > svg {
  color: var(--space-muted);
}

@media (max-width: 360px) {
  .admin-toolbar {
    gap: 7px;
  }

  .filter-button {
    width: 76px;
  }

  .search-box input,
  .filter-button {
    font-size: 14px;
  }
}
</style>
