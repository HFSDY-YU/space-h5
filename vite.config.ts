import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'

// devtools 仅在非生产构建加载，避免混入生产产物（vite build 时 NODE_ENV=production）。
const isProduction = process.env.NODE_ENV === 'production'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Vant 组件按需引入，自动注入对应样式，避免全量打包。
    Components({
      resolvers: [VantResolver()],
      dts: false,
    }),
    ...(isProduction ? [] : [vueDevTools()]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 框架与第三方库拆分为独立 vendor chunk，业务代码更新时可复用缓存。
        // rolldown 仅支持函数形式的 manualChunks。
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/@lucide/')) return 'icons'
          if (id.includes('/vant/') || id.includes('/@vant/')) return 'vant'
          if (id.includes('/@tanstack/')) return 'query'
          if (
            id.includes('/vue-router/') ||
            id.includes('/pinia/') ||
            id.includes('/@vue/') ||
            /\/vue\//.test(id)
          ) {
            return 'vue'
          }
          return undefined
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/dev-api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dev-api/, ''),
      },
    },
  },
})
