<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const tabs = computed(() => {
  if (session.isStudent) {
    return [
      { path: '/home', label: '首页', icon: 'home-o' },
      { path: '/mine', label: '我的', icon: 'manager-o' },
    ]
  }

  if (session.isAdmin) {
    return [
      { path: '/home', label: '首页', icon: 'home-o' },
      { path: '/audit', label: '审核', icon: 'todo-list-o' },
      { path: '/rooms-admin', label: '房间', icon: 'wap-home-o' },
      { path: '/mine', label: '我的', icon: 'manager-o' },
    ]
  }

  return [
    { path: '/home', label: '首页', icon: 'home-o' },
    { path: '/reservation/long', label: '长期预约', icon: 'calendar-o' },
    { path: '/reservation/mine', label: '我的预约', icon: 'records-o' },
    { path: '/mine', label: '我的', icon: 'manager-o' },
  ]
})

const activeTab = computed(() => {
  const matched = tabs.value.find((tab) => route.path === tab.path || route.path.startsWith(`${tab.path}/`))
  if (!matched && route.path.startsWith('/mine/')) return '/mine'
  return matched?.path ?? ''
})

function handleTabChange(path: string) {
  router.push(path)
}
</script>

<template>
  <router-view />
  <van-tabbar :model-value="activeTab" safe-area-inset-bottom @change="handleTabChange">
    <van-tabbar-item v-for="tab in tabs" :key="tab.path" :name="tab.path" :icon="tab.icon">
      {{ tab.label }}
    </van-tabbar-item>
  </van-tabbar>
</template>
