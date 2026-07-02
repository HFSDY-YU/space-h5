<script setup lang="ts">
import { computed, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, BellRing, CheckCheck, Megaphone } from '@lucide/vue'
import { getNotice, markNoticeRead, NOTICE_QUERY_KEY } from '@/api/notice'
import { toNoticeMessage } from '@/utils/noticeFormat'
import { patchNoticesReadCache } from '@/composables/useNotices'
import { messages as fallbackMessages } from '@/mock/spaceData'
import type { MessageItem } from '@/types/space'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const messageId = computed(() => String(route.params.messageId))
const autoMarkedIds = new Set<string>()

function findFallbackMessage() {
  const normalizedId = messageId.value.replace(/^mock-/, '')
  const message = fallbackMessages.find((item) => item.id === normalizedId || `mock-${item.id}` === messageId.value)
  return message ? { ...message, id: messageId.value } : undefined
}

const messageQuery = useQuery({
  queryKey: computed(() => ['h5-message-detail', messageId.value]),
  queryFn: async () => {
    if (messageId.value.startsWith('mock-')) {
      const fallback = findFallbackMessage()
      if (!fallback) throw new Error('消息不存在')
      return fallback
    }

    const notice = await getNotice(messageId.value)
    if (!notice) throw new Error('消息不存在')
    return toNoticeMessage(notice, { detail: true })
  },
  retry: 1,
})

const message = computed(
  () =>
    messageQuery.data.value ?? {
      id: messageId.value,
      title: '消息加载中',
      content: '',
      time: '',
      unread: false,
      type: 'system' as const,
    },
)
const typeText = computed(() => {
  if (message.value.type === 'audit') return '审核通知'
  if (message.value.type === 'reservation') return '预约通知'
  return '系统通知'
})

function patchNoticeRead(id: string) {
  // 详情页自身缓存置为已读，同时同步共享通知列表缓存（红点/未读数来源）。
  queryClient.setQueryData<MessageItem>(['h5-message-detail', id], (current) =>
    current ? { ...current, unread: false } : current,
  )
  patchNoticesReadCache(queryClient, [id])
}

async function markMessageRead(id: string, options: { silent?: boolean } = {}) {
  try {
    patchNoticeRead(id)
    await markNoticeRead(id)
    await queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY })
    if (!options.silent) showToast('已标记为已读')
  } catch (error) {
    await queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY })
    if (!options.silent) showToast(error instanceof Error ? error.message : '标记已读失败')
  }
}

async function markCurrentRead() {
  if (message.value.id.startsWith('mock-')) {
    showToast('示例消息无需标记')
    return
  }

  await markMessageRead(message.value.id)
}

watch(
  message,
  (current) => {
    if (!current.unread || current.id.startsWith('mock-') || autoMarkedIds.has(current.id)) return

    autoMarkedIds.add(current.id)
    void markMessageRead(current.id, { silent: true })
  },
  { immediate: true },
)
</script>

<template>
  <main class="safe-page message-detail-page">
    <header class="detail-nav">
      <button type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>消息详情</strong>
      <button type="button" aria-label="标记已读" @click="markCurrentRead">
        <CheckCheck :size="19" />
      </button>
    </header>

    <section class="detail-hero">
      <span class="message-icon" :class="`message-icon--${message.type}`">
        <Megaphone v-if="message.type === 'system'" :size="24" />
        <BellRing v-else :size="24" />
      </span>
      <div>
        <p>{{ typeText }}</p>
        <h1>{{ message.title }}</h1>
        <time>{{ message.time || '-' }}</time>
      </div>
    </section>

    <section class="card content-card">
      <h2 class="section-title">消息内容</h2>
      <p>{{ message.content || '暂无通知内容' }}</p>
    </section>

    <van-loading v-if="messageQuery.isLoading.value" type="spinner">加载消息中</van-loading>
    <van-empty v-else-if="messageQuery.isError.value" description="消息加载失败" />
  </main>
</template>

<style scoped>
.message-detail-page {
  display: grid;
  align-content: start;
  gap: 12px;
}

.detail-nav {
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: center;
}

.detail-nav button {
  display: grid;
  place-items: center;
  width: 48px;
  min-height: 48px;
  color: var(--space-text);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.detail-nav strong {
  text-align: center;
  font-size: 20px;
  font-weight: 850;
}

.detail-hero {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 18px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(12, 103, 209, 0.9)),
    #1677ff;
  border-radius: 20px;
}

.message-icon {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  color: var(--space-blue);
  background: rgba(255, 255, 255, 0.92);
  border-radius: 18px;
}

.message-icon--system {
  color: #0f766e;
}

.detail-hero p,
.detail-hero time {
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-hero p {
  margin: 0 0 6px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
}

.detail-hero h1 {
  display: -webkit-box;
  overflow: hidden;
  margin: 0 0 7px;
  font-size: 22px;
  line-height: 1.28;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.detail-hero time {
  display: block;
  color: rgba(255, 255, 255, 0.76);
  font-size: 12px;
  white-space: nowrap;
}

.content-card {
  display: grid;
  gap: 10px;
}

.content-card p {
  margin: 0;
  color: var(--space-subtext);
  white-space: pre-line;
  font-size: 15px;
  line-height: 1.75;
}
</style>
