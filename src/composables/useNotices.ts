import { computed } from 'vue'
import { useQuery, type QueryClient } from '@tanstack/vue-query'
import {
  isNoticeUnread,
  listTopNotices,
  NOTICE_QUERY_KEY,
  type NoticeListData,
} from '@/api/notice'

// 首页消息红点：复用与消息页相同的 NOTICE_QUERY_KEY，红点仅由后端 unreadCount 驱动。
export function useNoticeBadge() {
  const noticesQuery = useQuery({
    queryKey: NOTICE_QUERY_KEY,
    queryFn: listTopNotices,
  })
  const hasUnread = computed(() => (noticesQuery.data.value?.unreadCount ?? 0) > 0)
  return { noticesQuery, hasUnread }
}

// 标记已读的乐观更新：把共享通知缓存里指定 id 置为已读并同步递减 unreadCount。
// 由消息列表与消息详情共用，随后仍会 invalidate 以后端结果为准。
export function patchNoticesReadCache(queryClient: QueryClient, ids: string[]) {
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
