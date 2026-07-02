<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, BellRing, CheckCheck, ChevronRight, Megaphone, RefreshCw } from '@lucide/vue'
import {
  getNotice,
  isNoticeUnread,
  listTopNotices,
  markNoticeRead,
  markNoticesReadAll,
  NOTICE_QUERY_KEY,
  type BackendNotice,
  type NoticeListData,
} from '@/api/notice'
import { messages as fallbackMessages } from '@/mock/spaceData'
import type { MessageItem } from '@/types/space'

const router = useRouter()
const queryClient = useQueryClient()
const onlyUnread = ref(false)
const markingId = ref('')
const markingAll = ref(false)

function stripHtml(value?: string) {
  return (value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function formatNoticeTime(value?: string) {
  if (!value) return ''
  const date = new Date(value.replace(/-/g, '/'))
  if (Number.isNaN(date.getTime())) return value

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isYesterday) return '昨天'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function toNoticeMessage(notice: BackendNotice): MessageItem {
  return {
    id: String(notice.noticeId ?? ''),
    title: notice.noticeTitle || '通知',
    content: stripHtml(notice.noticeContent) || '点击查看通知详情',
    time: formatNoticeTime(notice.createTime),
    unread: isNoticeUnread(notice),
    type: notice.noticeType === '2' ? 'system' : 'reservation',
  }
}

function toFallbackMessages() {
  return fallbackMessages.map((message) => ({
    ...message,
    id: `mock-${message.id}`,
  }))
}

async function fillNoticeContent(notice: BackendNotice) {
  if (notice.noticeContent || !notice.noticeId) return notice

  try {
    const detail = await getNotice(notice.noticeId)
    // 详情接口 /system/notice/{id} 不返回 isRead（后端 boolean 原始类型恒序列化为 false），
    // 若整体展开 detail 会把列表接口带来的真实已读状态覆盖成未读，导致红点/未读数错乱。
    // 这里只补充列表接口缺失的正文内容，其余字段（尤其 isRead）保持列表结果。
    return detail ? { ...notice, noticeContent: detail.noticeContent } : notice
  } catch {
    return notice
  }
}

const noticesQuery = useQuery({
  queryKey: NOTICE_QUERY_KEY,
  queryFn: async () => {
    const result = await listTopNotices()
    const detailRows = await Promise.all(result.rows.map(fillNoticeContent))
    return {
      ...result,
      rows: detailRows,
    }
  },
  retry: 1,
})

const noticeMessages = computed(() => {
  if (!noticesQuery.data.value) return toFallbackMessages()
  return noticesQuery.data.value.rows.map(toNoticeMessage)
})
const unreadMessages = computed(() => noticeMessages.value.filter((message) => message.unread))
const unreadCount = computed(() => noticesQuery.data.value?.unreadCount ?? unreadMessages.value.length)
const visibleMessages = computed(() =>
  onlyUnread.value ? unreadMessages.value : noticeMessages.value,
)
const isLoading = computed(() => noticesQuery.isLoading.value)
const isError = computed(() => noticesQuery.isError.value && !noticesQuery.data.value)

async function refreshNotices() {
  try {
    await queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY })
  } catch (error) {
    showToast(error instanceof Error ? error.message : '刷新失败')
  }
}

function patchReadCache(ids: string[]) {
  const idSet = new Set(ids)
  queryClient.setQueryData<NoticeListData>(NOTICE_QUERY_KEY, (current) => {
    if (!current) return current

    let changedCount = 0
    const rows = current.rows.map((notice) => {
      const id = String(notice.noticeId ?? '')
      if (!idSet.has(id) || !isNoticeUnread(notice)) return notice

      changedCount += 1
      return { ...notice, isRead: true }
    })

    return {
      ...current,
      rows,
      unreadCount: Math.max(0, current.unreadCount - changedCount),
    }
  })
}

async function openMessage(message: MessageItem) {
  void router.push(`/messages/${message.id}`)

  if (!message.unread || message.id.startsWith('mock-')) return

  markingId.value = message.id
  patchReadCache([message.id])
  try {
    await markNoticeRead(message.id)
    await queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY })
  } catch (error) {
    await queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY })
    showToast(error instanceof Error ? error.message : '标记已读失败')
  } finally {
    markingId.value = ''
  }
}

async function markAllRead() {
  const ids = unreadMessages.value.filter((message) => !message.id.startsWith('mock-')).map((message) => message.id)
  if (ids.length === 0) {
    showToast('暂无未读通知')
    return
  }

  markingAll.value = true
  patchReadCache(ids)
  try {
    await markNoticesReadAll(ids)
    await queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY })
    showToast('已全部标记为已读')
  } catch (error) {
    await queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY })
    showToast(error instanceof Error ? error.message : '操作失败')
  } finally {
    markingAll.value = false
  }
}
</script>

<template>
  <main class="safe-page messages-page">
    <header class="messages-nav">
      <button type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <div>
        <strong>消息</strong>
        <span>{{ unreadCount }} 条未读</span>
      </div>
      <button type="button" aria-label="刷新通知" @click="refreshNotices">
        <RefreshCw :size="19" />
      </button>
    </header>

    <section class="message-summary">
      <div>
        <p>通知中心</p>
        <strong>{{ noticeMessages.length }}</strong>
        <span>全部消息</span>
      </div>
      <button type="button" :disabled="markingAll || unreadCount === 0" @click="markAllRead">
        <CheckCheck :size="17" />
        全部已读
      </button>
    </section>

    <section class="message-switch" aria-label="消息筛选">
      <button :class="{ active: !onlyUnread }" type="button" @click="onlyUnread = false">
        全部
        <b>{{ noticeMessages.length }}</b>
      </button>
      <button :class="{ active: onlyUnread }" type="button" @click="onlyUnread = true">
        未读
        <b>{{ unreadCount }}</b>
      </button>
    </section>

    <section class="message-list">
      <article
        v-for="message in visibleMessages"
        :key="message.id"
        class="message-card"
        :class="{ 'message-card--read': !message.unread }"
      >
        <button
          class="message-card__button"
          type="button"
          :aria-label="`${message.title}${message.unread ? '未读' : '已读'}`"
          @click="openMessage(message)"
        >
          <span class="message-icon" :class="`message-icon--${message.type}`">
            <Megaphone v-if="message.type === 'system'" :size="20" />
            <BellRing v-else :size="20" />
          </span>
          <span class="message-main">
            <span class="message-title-row">
              <i v-if="message.unread" class="unread-dot" aria-hidden="true"></i>
              <strong>{{ message.title }}</strong>
              <time>{{ message.time || '-' }}</time>
            </span>
            <span class="message-content">
              {{ message.content }}
            </span>
          </span>
          <span class="message-aside">
            <van-loading v-if="markingId === message.id" size="16" />
            <ChevronRight v-else class="message-more" :size="18" />
          </span>
        </button>
      </article>

      <van-loading v-if="isLoading" class="state-box" type="spinner">加载通知中</van-loading>
      <van-empty v-else-if="visibleMessages.length === 0" description="暂无消息" />
      <p v-if="isError" class="fallback-tip">通知接口暂不可用，已显示本地示例消息</p>
    </section>
  </main>
</template>

<style scoped>
.messages-page {
  display: grid;
  align-content: start;
  gap: 12px;
}

.messages-nav {
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: center;
  gap: 10px;
}

.messages-nav button {
  display: grid;
  place-items: center;
  width: 48px;
  min-height: 48px;
  color: var(--space-text);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.messages-nav div {
  display: grid;
  gap: 2px;
  text-align: center;
}

.messages-nav strong {
  color: var(--space-text);
  font-size: 20px;
  font-weight: 850;
}

.messages-nav span {
  color: var(--space-subtext);
  font-size: 12px;
}

.message-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(12, 103, 209, 0.9)),
    #1677ff;
  border-radius: 18px;
}

.message-summary div {
  display: grid;
  gap: 3px;
}

.message-summary p,
.message-summary span {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
}

.message-summary strong {
  font-size: 28px;
  line-height: 1;
}

.message-summary button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  color: var(--space-blue);
  background: #fff;
  border: 0;
  border-radius: 14px;
  font-weight: 850;
}

.message-summary button:disabled {
  color: rgba(15, 31, 61, 0.5);
  background: rgba(255, 255, 255, 0.72);
}

.message-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 5px;
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.message-switch button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  color: var(--space-subtext);
  background: transparent;
  border: 0;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 800;
}

.message-switch b {
  font-size: 12px;
}

.message-switch .active {
  color: #fff;
  background: var(--space-blue);
}

.message-list {
  display: grid;
  gap: 10px;
}

.message-card {
  position: relative;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.92);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(54, 89, 150, 0.07);
}

.message-card--read {
  box-shadow: none;
}

.message-card__button {
  position: relative;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 20px;
  gap: 12px;
  width: 100%;
  min-height: 88px;
  padding: 14px 16px;
  text-align: left;
  background: transparent;
  border: 0;
}

.message-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  color: var(--space-blue);
  background: #eaf2ff;
  border-radius: 15px;
}

.message-icon--system {
  color: #0f766e;
  background: #e8f7f4;
}

.message-main {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.message-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unread-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  background: var(--space-red);
  border-radius: 999px;
}

.message-title-row strong {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--space-text);
  font-size: 16px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-title-row time {
  flex: 0 0 auto;
  color: var(--space-muted);
  font-size: 12px;
}

.message-content {
  display: -webkit-box;
  overflow: hidden;
  color: var(--space-subtext);
  font-size: 13px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.message-aside {
  display: grid;
  place-items: center;
  align-self: center;
}

.message-more {
  color: var(--space-muted);
}

.state-box {
  margin-top: 12px;
}

.fallback-tip {
  margin: 2px 0 0;
  color: var(--space-muted);
  text-align: center;
  font-size: 12px;
}
</style>
