<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview } from 'vant'
import { Bell, Building2, ChevronLeft, ChevronRight, Filter, Layers3, MapPin, Search, Users } from '@lucide/vue'
import { listFloors, listRooms } from '@/api/space'
import { resolveSpaceAssetUrl, toUiRoomBase } from '@/services/spaceMapper'
import FilterChipGroup from '@/components/FilterChipGroup.vue'

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

interface AdminFloorGroup {
  name: string
  roomCount: number
  rooms: AdminRoom[]
  imageUrl?: string
}

interface AdminBuildingGroup {
  name: string
  floorCount: number
  roomCount: number
  floors: AdminFloorGroup[]
}

const route = useRoute()
const router = useRouter()
const showFilterPanel = ref(false)

function firstQueryValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return typeof value === 'string' ? value : ''
}

function queryText(value: unknown, fallback = '') {
  return firstQueryValue(value) || fallback
}

function queryList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
  const text = firstQueryValue(value)
  return text ? [text] : []
}

const filters = reactive<AdminRoomFilters>({
  keyword: queryText(route.query.keyword),
  building: queryText(route.query.building, 'all'),
  floor: queryText(route.query.floor, 'all'),
  type: queryText(route.query.type, 'all'),
  equipment: queryList(route.query.equipment),
  status: queryText(route.query.status, 'all'),
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
const floorsQuery = useQuery({
  queryKey: ['h5-admin-space-floors'],
  queryFn: async () => {
    try {
      const result = await listFloors({ pageSize: 999 })
      return result.rows
    } catch {
      // 楼层图片只影响识别效率；接口暂不可用时继续展示图标，避免阻塞房间管理主流程。
      return []
    }
  },
  staleTime: 5 * 60_000,
})

const rooms = computed<AdminRoom[]>(() => roomsQuery.data.value ?? [])
const floors = computed(() => floorsQuery.data.value ?? [])
const isLoading = computed(() => roomsQuery.isLoading.value)
const optionData = computed(() => {
  const buildings = new Set<string>()
  const floors = new Set<string>()
  const types = new Set<string>()
  const equipment = new Set<string>()

  const floorSourceRooms = filters.building === 'all' ? rooms.value : rooms.value.filter((room) => room.building === filters.building)

  rooms.value.forEach((room) => {
    if (room.building) buildings.add(room.building)
    if (room.type) types.add(room.type)
    room.equipment.forEach((item) => {
      if (item) equipment.add(item)
    })
  })
  floorSourceRooms.forEach((room) => {
    if (room.floor) floors.add(room.floor)
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
const buildingGroups = computed<AdminBuildingGroup[]>(() => {
  const buildingMap = new Map<string, AdminBuildingGroup>()

  filteredRooms.value.forEach((room) => {
    const buildingName = room.building || '未设置楼栋'
    const floorName = room.floor || '未设置楼层'
    let buildingGroup = buildingMap.get(buildingName)
    if (!buildingGroup) {
      buildingGroup = {
        name: buildingName,
        floorCount: 0,
        roomCount: 0,
        floors: [],
      }
      buildingMap.set(buildingName, buildingGroup)
    }

    let floorGroup = buildingGroup.floors.find((floor) => floor.name === floorName)
    if (!floorGroup) {
      const floorInfo = floors.value.find((floor) => {
        const sameBuilding = floor.buildingName === buildingName
        const sameFloor = floor.floorNo === floorName || floor.floorName === floorName
        return sameBuilding && sameFloor
      })
      floorGroup = {
        name: floorName,
        roomCount: 0,
        rooms: [],
        imageUrl: resolveSpaceAssetUrl(floorInfo?.imageUrl),
      }
      buildingGroup.floors.push(floorGroup)
    }

    floorGroup.rooms.push(room)
    floorGroup.roomCount += 1
    buildingGroup.roomCount += 1
  })

  return Array.from(buildingMap.values())
    .map((buildingGroup) => {
      buildingGroup.floors.sort((prev, next) => next.name.localeCompare(prev.name, 'zh-CN', { numeric: true }))
      buildingGroup.floorCount = buildingGroup.floors.length
      return buildingGroup
    })
    .sort((prev, next) => prev.name.localeCompare(next.name, 'zh-CN', { numeric: true }))
})
const selectedBuilding = computed(() => (filters.building === 'all' ? '' : filters.building))
const selectedFloor = computed(() => (filters.floor === 'all' ? '' : filters.floor))
const selectedBuildingGroup = computed(() => buildingGroups.value.find((group) => group.name === selectedBuilding.value))
const floorGroups = computed(() => selectedBuildingGroup.value?.floors ?? [])
const selectedFloorGroup = computed(() => floorGroups.value.find((group) => group.name === selectedFloor.value))
const currentFloorRooms = computed(() => selectedFloorGroup.value?.rooms ?? [])
const hierarchyLevel = computed<'building' | 'floor' | 'room'>(() => {
  if (!selectedBuilding.value) return 'building'
  return selectedFloor.value ? 'room' : 'floor'
})
const hierarchyIsEmpty = computed(() => {
  if (hierarchyLevel.value === 'building') return buildingGroups.value.length === 0
  if (hierarchyLevel.value === 'floor') return floorGroups.value.length === 0
  return currentFloorRooms.value.length === 0
})
const hierarchyEmptyDescription = computed(() => {
  if (hierarchyLevel.value === 'building') return hasSearchOrFilters.value ? '没有匹配楼栋' : '暂无楼栋'
  if (hierarchyLevel.value === 'floor') return '没有匹配楼层'
  return '没有匹配房间'
})

function openRoom(room: AdminRoom) {
  router.push({
    name: 'room-detail',
    params: { roomId: room.id },
    query: {
      from: 'rooms-admin',
      keyword: filters.keyword || undefined,
      building: selectedBuilding.value || room.building || undefined,
      floor: selectedFloor.value || room.floor || undefined,
      type: filters.type !== 'all' ? filters.type : undefined,
      status: filters.status !== 'all' ? filters.status : undefined,
      equipment: filters.equipment.length ? filters.equipment : undefined,
    },
  })
}

function resetFilters() {
  filters.keyword = ''
  filters.building = 'all'
  filters.floor = 'all'
  filters.type = 'all'
  filters.equipment = []
  filters.status = 'all'
}

function hasFloorInBuilding(building: string, floor: string) {
  if (floor === 'all') return true
  return rooms.value.some((room) => (building === 'all' || room.building === building) && room.floor === floor)
}

function changeBuildingFilter(building: string, options: { preserveFloor?: boolean } = {}) {
  filters.building = building
  if (!options.preserveFloor || !hasFloorInBuilding(building, filters.floor)) {
    filters.floor = 'all'
  }
}

function changeFloorFilter(floor: string) {
  filters.floor = floor
}

function selectBuilding(group: AdminBuildingGroup) {
  changeBuildingFilter(group.name, { preserveFloor: true })
}

function selectFloor(group: AdminFloorGroup) {
  changeFloorFilter(group.name)
}

function previewFloorImage(group: AdminFloorGroup) {
  if (!group.imageUrl) return

  showImagePreview({
    images: [group.imageUrl],
    closeable: true,
    showIndex: false,
  })
}

function backToBuildings() {
  changeBuildingFilter('all')
}

function backToFloors() {
  changeFloorFilter('all')
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

watch(
  () => [route.query.building, route.query.floor, route.query.type, route.query.status, route.query.equipment],
  ([building, floor, type, status, equipment]) => {
    filters.building = queryText(building, 'all')
    filters.floor = queryText(floor, 'all')
    filters.type = queryText(type, 'all')
    filters.status = queryText(status, 'all')
    filters.equipment = queryList(equipment)
  },
)

watch(
  () => optionData.value.buildings,
  (buildings) => {
    if (filters.building !== 'all' && !buildings.includes(filters.building)) {
      changeBuildingFilter('all')
    }
  },
)

watch(
  () => optionData.value.floors,
  (floors) => {
    if (filters.floor !== 'all' && !floors.includes(filters.floor)) {
      changeFloorFilter('all')
    }
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
      <div v-if="hierarchyLevel !== 'building'" class="hierarchy-nav">
        <button type="button" @click="hierarchyLevel === 'room' ? backToFloors() : backToBuildings()">
          <ChevronLeft :size="18" />
          <span>{{ hierarchyLevel === 'room' ? selectedFloor : selectedBuilding }}</span>
        </button>
        <p>{{ hierarchyLevel === 'room' ? `${selectedBuilding} / ${selectedFloor}` : '选择楼层' }}</p>
      </div>

      <template v-if="hierarchyLevel === 'building'">
        <button
          v-for="group in buildingGroups"
          :key="group.name"
          class="hierarchy-card"
          type="button"
          :aria-label="`查看${group.name}楼层`"
          @click="selectBuilding(group)"
        >
          <span class="hierarchy-card__icon">
            <Building2 :size="25" />
          </span>
          <span class="hierarchy-card__content">
            <strong>{{ group.name }}</strong>
            <small>{{ group.floorCount }} 个楼层 · {{ group.roomCount }} 间房</small>
          </span>
          <ChevronRight :size="20" />
        </button>
      </template>

      <template v-else-if="hierarchyLevel === 'floor'">
        <article
          v-for="group in floorGroups"
          :key="group.name"
          class="hierarchy-card hierarchy-card--floor"
        >
          <button
            v-if="group.imageUrl"
            class="hierarchy-card__icon hierarchy-card__image-button"
            type="button"
            :aria-label="`放大查看${selectedBuilding}${group.name}楼层图`"
            @click="previewFloorImage(group)"
          >
            <img v-if="group.imageUrl" :src="group.imageUrl" :alt="`${selectedBuilding}${group.name}楼层图`" />
          </button>
          <span v-else class="hierarchy-card__icon">
            <Layers3 :size="25" />
          </span>
          <button
            class="hierarchy-card__entry"
            type="button"
            :aria-label="`查看${selectedBuilding}${group.name}房间`"
            @click="selectFloor(group)"
          >
            <span class="hierarchy-card__content">
              <strong>{{ group.name }}</strong>
              <small>{{ group.roomCount }} 间房</small>
            </span>
            <ChevronRight :size="20" />
          </button>
        </article>
      </template>

      <template v-else>
        <button
          v-for="room in currentFloorRooms"
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
      </template>

      <van-loading v-if="isLoading" type="spinner">加载房间中</van-loading>
      <van-empty v-else-if="hierarchyIsEmpty" :description="hierarchyEmptyDescription" />
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

      <FilterChipGroup
        v-if="optionData.buildings.length"
        title="楼栋"
        all-label="全部楼栋"
        :options="optionData.buildings"
        :selected="filters.building"
        @select-all="changeBuildingFilter('all')"
        @select="changeBuildingFilter"
      />

      <FilterChipGroup
        v-if="optionData.floors.length"
        title="楼层"
        all-label="全部楼层"
        :options="optionData.floors"
        :selected="filters.floor"
        @select-all="changeFloorFilter('all')"
        @select="changeFloorFilter"
      />

      <FilterChipGroup
        v-if="optionData.types.length"
        title="类型"
        all-label="全部类型"
        :options="optionData.types"
        :selected="filters.type"
        @select-all="filters.type = 'all'"
        @select="(value: string) => (filters.type = value)"
      />

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

      <FilterChipGroup
        v-if="optionData.equipment.length"
        title="设备"
        all-label="全部设备"
        multiple
        :options="optionData.equipment"
        :selected="filters.equipment"
        @select-all="filters.equipment = []"
        @select="toggleEquipmentFilter"
      />

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
  align-content: start;
  gap: 10px;
}

.hierarchy-nav {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 4px 0;
  background: var(--space-bg);
}

.hierarchy-nav button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px 0 9px;
  color: var(--space-blue);
  background: #fff;
  border: 1px solid rgba(22, 119, 255, 0.2);
  border-radius: 12px;
  font-size: 15px;
  font-weight: 850;
}

.hierarchy-nav button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-nav p {
  margin: 0;
  overflow: hidden;
  color: var(--space-subtext);
  font-size: 13px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-card {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 88px;
  padding: 14px 12px;
  color: var(--space-text);
  text-align: left;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 8px;
  box-shadow: 0 8px 22px rgba(54, 89, 150, 0.08);
}

.hierarchy-card__icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  min-height: 64px;
  overflow: hidden;
  color: #0f7a57;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
}

.hierarchy-card--floor .hierarchy-card__icon {
  color: var(--space-blue);
  background: #edf5ff;
  border-color: rgba(22, 119, 255, 0.22);
}

.hierarchy-card__image-button {
  padding: 0;
}

.hierarchy-card__icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.hierarchy-card__entry {
  grid-column: 2 / 4;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  padding: 0;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
}

.hierarchy-card__content {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.hierarchy-card__content strong {
  overflow: hidden;
  font-size: 19px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-card__content small {
  overflow: hidden;
  color: var(--space-subtext);
  font-size: 13px;
  font-weight: 760;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-card > svg,
.hierarchy-card__entry > svg {
  color: var(--space-muted);
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
