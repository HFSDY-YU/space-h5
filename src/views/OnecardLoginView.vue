<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, type LocationQueryValue, type RouteLocationRaw } from 'vue-router'
import { AlertTriangle, CheckCircle2, ShieldCheck } from '@lucide/vue'
import { showToast } from 'vant'
import { useSessionStore } from '@/stores/session'

type LoginState = 'waiting' | 'loading' | 'success' | 'error'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const state = ref<LoginState>('waiting')
const errorMessage = ref('')

function readQueryText(value?: LocationQueryValue | LocationQueryValue[]) {
  const firstValue = Array.isArray(value) ? value[0] : value
  return typeof firstValue === 'string' ? firstValue.trim() : ''
}

function normalizeRedirect(value: string) {
  if (!value) return '/home'

  // redirect 只允许站内路径，避免一卡通回调被构造成外部跳转入口。
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) {
    return '/home'
  }

  return value.startsWith('/') ? value : `/${value}`
}

const onecardParam = computed(() => readQueryText(route.query.p))
const redirectPath = computed(() => normalizeRedirect(readQueryText(route.query.redirect)))
const isLoading = computed(() => state.value === 'loading')
const isReplayError = computed(() => errorMessage.value.includes('一卡通登录链接已被使用'))

const statusTitle = computed(() => {
  if (state.value === 'success') return '登录成功'
  if (state.value === 'error') return '登录失败'
  if (state.value === 'loading') return '正在校验一卡通身份'
  return '等待一卡通参数'
})

const statusDescription = computed(() => {
  if (state.value === 'success') return '身份已通过，正在进入系统。'
  if (state.value === 'error') return errorMessage.value || '一卡通登录未完成，请返回普通登录。'
  if (state.value === 'loading') return '请稍候，系统正在换取登录凭证。'
  return '请从一卡通入口重新进入空间预约系统。'
})

async function startOnecardLogin() {
  const p = onecardParam.value
  if (!p) {
    state.value = 'error'
    errorMessage.value = '未获取到一卡通参数 p'
    return
  }

  state.value = 'loading'
  errorMessage.value = ''

  try {
    await session.onecardLogin(p)
    state.value = 'success'

    const target: RouteLocationRaw = session.mustChangePassword || session.initialPasswordUnset
      ? { name: 'mine-password', query: { force: '1' } }
      : redirectPath.value
    await router.replace(target)
  } catch (error) {
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '一卡通登录失败'
    showToast(errorMessage.value)
  }
}

function goLogin() {
  router.replace('/login')
}

onMounted(startOnecardLogin)
</script>

<template>
  <main class="onecard-page">
    <section class="onecard-panel" aria-live="polite">
      <div class="brand-mark" aria-hidden="true">
        <ShieldCheck :size="34" />
      </div>

      <div class="onecard-heading">
        <p>澳琴空间预约系统</p>
        <h1>一卡通登录</h1>
      </div>

      <div class="status-card" :class="`status-card--${state}`">
        <van-loading v-if="isLoading" class="status-icon" type="spinner" color="#1677ff" />
        <CheckCircle2 v-else-if="state === 'success'" class="status-icon" :size="30" />
        <AlertTriangle v-else-if="state === 'error'" class="status-icon" :size="30" />
        <ShieldCheck v-else class="status-icon" :size="30" />

        <div>
          <strong>{{ statusTitle }}</strong>
          <p>{{ statusDescription }}</p>
        </div>
      </div>

      <div v-if="state === 'error'" class="onecard-actions">
        <van-button block round type="primary" @click="goLogin">返回普通登录</van-button>
        <van-button
          v-if="!isReplayError"
          block
          round
          plain
          type="primary"
          :disabled="!onecardParam"
          @click="startOnecardLogin"
        >
          重新校验
        </van-button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.onecard-page {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 42px) 18px 32px;
  background:
    linear-gradient(180deg, #eaf5ff 0%, #f5f8fe 48%, #f5f8fe 100%),
    #f5f8fe;
}

.onecard-panel {
  display: grid;
  gap: 18px;
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  margin: 22px auto 2px;
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #0f57d6);
  border-radius: 22px;
  box-shadow: 0 18px 38px rgba(22, 119, 255, 0.22);
}

.onecard-heading {
  text-align: center;
}

.onecard-heading p {
  margin: 0 0 8px;
  color: var(--space-blue);
  font-size: 14px;
  font-weight: 760;
}

.onecard-heading h1 {
  margin: 0;
  color: var(--space-text);
  font-size: 30px;
  font-weight: 850;
  line-height: 1.2;
}

.status-card {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 14px;
  align-items: center;
  min-height: 108px;
  padding: 18px;
  color: var(--space-text);
  background: #ffffff;
  border: 1px solid rgba(232, 238, 247, 0.9);
  border-radius: 22px;
  box-shadow: 0 18px 44px rgba(54, 89, 150, 0.12);
}

.status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: var(--space-blue);
  background: #eaf2ff;
  border-radius: 16px;
}

.status-card--success .status-icon {
  color: #078047;
  background: #eaf8f0;
}

.status-card--error .status-icon {
  color: #b42318;
  background: #feecec;
}

.status-card strong {
  display: block;
  margin-bottom: 6px;
  font-size: 17px;
  font-weight: 780;
}

.status-card p {
  margin: 0;
  color: var(--space-subtext);
  font-size: 14px;
  line-height: 1.55;
}

.onecard-actions {
  display: grid;
  gap: 12px;
}

.onecard-actions :deep(.van-button) {
  min-height: 48px;
  font-weight: 750;
}
</style>
