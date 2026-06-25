import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import '@vant/touch-emulator'
// 组件按需引入由 unplugin-vue-components + VantResolver 自动处理（含样式）。
// 函数式组件（Toast / Dialog / ImagePreview）样式不会被自动注入，这里手动引入。
import 'vant/es/toast/style'
import 'vant/es/dialog/style'
import 'vant/es/image-preview/style'
import './styles/main.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(VueQueryPlugin)
app.use(router)

app.mount('#app')
