<script setup lang="ts">
import { computed } from 'vue'

// 筛选弹层里「标题 + 一排可选 chip」的纯展示组件，被首页和房间管理共用。
// 点击行为（直接赋值或楼栋/楼层级联）仍由父组件在 select / select-all 事件里处理。
const props = defineProps<{
  title: string
  options: string[]
  // 单选时为当前值（'all' 表示全部）；多选时为已选项数组（空数组表示全部）。
  selected: string | string[]
  allLabel: string
  multiple?: boolean
}>()

defineEmits<{
  select: [value: string]
  selectAll: []
}>()

const isAllActive = computed(() =>
  Array.isArray(props.selected) ? props.selected.length === 0 : props.selected === 'all',
)

function isOptionActive(option: string) {
  return Array.isArray(props.selected) ? props.selected.includes(option) : props.selected === option
}
</script>

<template>
  <div class="filter-group">
    <h3>{{ title }}</h3>
    <div class="filter-options">
      <button :class="{ active: isAllActive }" type="button" @click="$emit('selectAll')">
        {{ allLabel }}
      </button>
      <button
        v-for="option in options"
        :key="option"
        :class="{ active: isOptionActive(option) }"
        type="button"
        @click="$emit('select', option)"
      >
        {{ option }}
      </button>
    </div>
  </div>
</template>

<style scoped>
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
</style>
