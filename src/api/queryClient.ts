import { QueryClient } from '@tanstack/vue-query'

// 全局唯一 QueryClient，集中管理缓存策略，供 main.ts 注入、以及登出/登录失效时清理缓存。
// 单独成文件避免与 http.ts / stores 形成循环依赖。
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 保持默认 staleTime=0：不改变各页面重新挂载即刷新的既有行为（含通知红点的即时刷新），
      // 避免引入“回到列表看到旧数据”的回归；需要缓存的页面已各自显式设置 staleTime。
      staleTime: 0,
      gcTime: 5 * 60_000,
      // 网络抖动时最多重试 1 次，避免长时间卡在 loading。
      retry: 1,
      // 移动端关闭窗口聚焦自动重拉，避免频繁切前后台造成的请求风暴；刷新由页面挂载/手动 invalidate 驱动。
      refetchOnWindowFocus: false,
    },
  },
})

// 登出或登录态失效时调用，清空所有缓存，防止换账号后看到上一个用户的数据。
export function clearQueryCache() {
  queryClient.clear()
}
