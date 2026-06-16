import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import Vant from 'vant'
import '@vant/touch-emulator'
import 'vant/lib/index.css'
import './styles/main.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(VueQueryPlugin)
app.use(Vant)
app.use(router)

app.mount('#app')
