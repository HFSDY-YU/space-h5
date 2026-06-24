<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { LockKeyhole, UserRound } from '@lucide/vue'
import { getCaptchaImage } from '@/api/auth'
import { ApiError } from '@/api/http'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()
const loading = ref(false)
const captchaLoading = ref(false)
const captchaEnabled = ref(true)
const captchaImage = ref('')
const captchaUuid = ref('')

const form = reactive({
  username: '',
  password: '',
  captcha: '',
  remember: true,
})

const canSubmit = computed(() => form.username && form.password && (!captchaEnabled.value || form.captcha))

async function refreshCaptcha() {
  captchaLoading.value = true

  try {
    const result = await getCaptchaImage()
    captchaEnabled.value = result.captchaEnabled !== false
    captchaImage.value = result.img ? `data:image/gif;base64,${result.img}` : ''
    captchaUuid.value = result.uuid || ''
    form.captcha = ''
  } catch (error) {
    const message = error instanceof Error ? error.message : '验证码加载失败'
    showToast(message)
  } finally {
    captchaLoading.value = false
  }
}

async function submitLogin() {
  if (!canSubmit.value) {
    showToast('请填写账号、密码和验证码')
    return
  }

  loading.value = true

  try {
    await session.login({
      username: form.username,
      password: form.password,
      code: form.captcha,
      uuid: captchaUuid.value,
    })
    router.replace(session.mustChangePassword ? { name: 'mine-password', query: { force: '1' } } : '/home')
  } catch (error) {
    showToast(error instanceof ApiError || error instanceof Error ? error.message : '登录失败')
    if (captchaEnabled.value) {
      await refreshCaptcha()
    }
  } finally {
    loading.value = false
  }
}

onMounted(refreshCaptcha)
</script>

<template>
  <main class="login-page">
    <section class="login-hero">
      <div class="campus-scene" aria-hidden="true">
        <span class="scene-block scene-block--one"></span>
        <span class="scene-block scene-block--two"></span>
        <span class="scene-block scene-block--three"></span>
      </div>
      <p class="login-eyebrow">澳琴国际教育大学城</p>
      <h1>澳琴空间预约系统</h1>
      <p>空间预约 · 审核管理 · 占用查询</p>
    </section>

    <section class="login-panel">
      <div class="field-shell">
        <UserRound :size="18" />
        <input v-model.trim="form.username" autocomplete="username" placeholder="请输入账号" />
      </div>

      <div class="field-shell">
        <LockKeyhole :size="18" />
        <input
          v-model.trim="form.password"
          autocomplete="current-password"
          placeholder="请输入密码"
          type="password"
        />
      </div>

      <div class="captcha-row">
        <div v-if="captchaEnabled" class="field-shell">
          <input v-model.trim="form.captcha" placeholder="验证码" />
        </div>
        <button
          v-if="captchaEnabled"
          class="captcha-code"
          type="button"
          :disabled="captchaLoading"
          @click="refreshCaptcha"
        >
          <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
          <span v-else>{{ captchaLoading ? '加载中' : '刷新' }}</span>
        </button>
      </div>

      <div class="login-options">
        <van-checkbox v-model="form.remember" icon-size="16px">记住登录状态</van-checkbox>
        <RouterLink to="/forgot-password">忘记密码</RouterLink>
      </div>

      <van-button block round type="primary" :disabled="!canSubmit" :loading="loading" @click="submitLogin">
        登录
      </van-button>

    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 34px) 18px 28px;
  background:
    linear-gradient(180deg, #eaf5ff 0%, #f5f8fe 46%, #f5f8fe 100%),
    #f5f8fe;
}

.login-hero {
  position: relative;
  min-height: 260px;
  padding-top: 16px;
  text-align: center;
}

.login-hero h1 {
  margin: 14px 0 10px;
  color: var(--space-text);
  font-size: 31px;
  font-weight: 850;
  line-height: 1.15;
}

.login-hero p {
  margin: 0;
  color: var(--space-subtext);
  font-size: 14px;
}

.login-eyebrow {
  color: var(--space-blue) !important;
  font-weight: 750;
}

.campus-scene {
  position: relative;
  width: min(260px, 78vw);
  height: 138px;
  margin: 0 auto;
}

.scene-block {
  position: absolute;
  bottom: 0;
  display: block;
  background: linear-gradient(180deg, #7ec4ff, #1677ff);
  border-radius: 18px 18px 8px 8px;
  box-shadow: 0 16px 36px rgba(22, 119, 255, 0.18);
}

.scene-block--one {
  left: 16px;
  width: 72px;
  height: 92px;
}

.scene-block--two {
  left: 94px;
  width: 88px;
  height: 122px;
  background: linear-gradient(180deg, #9ed5ff, #2a83ff);
}

.scene-block--three {
  right: 12px;
  width: 62px;
  height: 78px;
}

.login-panel {
  display: grid;
  gap: 14px;
  padding: 22px 18px;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.9);
  border-radius: 26px;
  box-shadow: 0 18px 44px rgba(54, 89, 150, 0.12);
}

.field-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 0 14px;
  color: var(--space-muted);
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 15px;
}

.field-shell input {
  width: 100%;
  min-width: 0;
  color: var(--space-text);
  background: transparent;
  border: 0;
  outline: 0;
}

.captcha-row {
  display: grid;
  grid-template-columns: 1fr 104px;
  gap: 10px;
}

.captcha-code {
  color: var(--space-blue);
  background: #eaf2ff;
  border: 1px solid #d4e5ff;
  border-radius: 15px;
  font-size: 20px;
  font-weight: 850;
  overflow: hidden;
}

.captcha-code img {
  display: block;
  width: 100%;
  height: 50px;
  object-fit: cover;
}

.captcha-code:disabled {
  opacity: 0.68;
}

.login-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--space-subtext);
  font-size: 13px;
}

.login-options a {
  color: var(--space-blue);
  font-weight: 500;
}

</style>
