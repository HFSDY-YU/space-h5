<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, BadgeCheck, LockKeyhole, Mail, RotateCcw, ShieldCheck, UserRound } from '@lucide/vue'
import {
  getCaptchaImage,
  getPasswordResetConfig,
  resetLoginPassword,
  sendPasswordResetCode,
} from '@/api/auth'

const STRONG_PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[~!@#$%^&*()\-=_+])[A-Za-z\d~!@#$%^&*()\-=_+]{8,20}$/

const router = useRouter()
const step = ref<1 | 2>(1)
const sending = ref(false)
const submitting = ref(false)
const captchaLoading = ref(false)
const captchaEnabled = ref(true)
const captchaImage = ref('')
const passwordMinLength = ref(8)
const passwordMaxLength = ref(20)
const resendIntervalSeconds = ref(60)
const countdown = ref(0)
let countdownTimer: number | undefined

const form = reactive({
  username: '',
  contact: '',
  captcha: '',
  uuid: '',
  verifyCode: '',
  newPassword: '',
  confirmPassword: '',
})

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact))
const canSendCode = computed(() => {
  return Boolean(form.username && emailValid.value && (!captchaEnabled.value || form.captcha) && countdown.value === 0)
})
const canResetPassword = computed(() => {
  return Boolean(form.verifyCode && form.newPassword && form.confirmPassword)
})

function clearCountdown() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
    countdownTimer = undefined
  }
}

function startCountdown() {
  clearCountdown()
  countdown.value = resendIntervalSeconds.value
  countdownTimer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      countdown.value = 0
      clearCountdown()
    }
  }, 1000)
}

async function loadResetConfig() {
  try {
    const result = await getPasswordResetConfig()
    const config = result.data
    passwordMinLength.value = config?.passwordMinLength || passwordMinLength.value
    passwordMaxLength.value = config?.passwordMaxLength || passwordMaxLength.value
    resendIntervalSeconds.value = config?.resendIntervalSeconds || resendIntervalSeconds.value
  } catch {
    // 配置读取失败时使用前端默认强密码规则，不阻塞用户进入找回流程。
  }
}

async function refreshCaptcha() {
  captchaLoading.value = true

  try {
    const result = await getCaptchaImage()
    captchaEnabled.value = result.captchaEnabled !== false
    captchaImage.value = result.img ? `data:image/gif;base64,${result.img}` : ''
    form.uuid = result.uuid || ''
    form.captcha = ''
  } catch (error) {
    showToast(error instanceof Error ? error.message : '验证码加载失败')
  } finally {
    captchaLoading.value = false
  }
}

async function sendCode() {
  if (!form.username) {
    showToast('请输入登录账号')
    return
  }

  if (!emailValid.value) {
    showToast('请输入正确的绑定邮箱')
    return
  }

  if (captchaEnabled.value && !form.captcha) {
    showToast('请输入图形验证码')
    return
  }

  if (countdown.value > 0) return

  sending.value = true
  try {
    const result = await sendPasswordResetCode({
      username: form.username,
      contactType: 'email',
      contact: form.contact,
      code: form.captcha,
      uuid: form.uuid,
    })
    showToast(result.msg || result.data || '验证码已发送')
    step.value = 2
    form.verifyCode = ''
    form.captcha = ''
    startCountdown()
    if (captchaEnabled.value) await refreshCaptcha()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '验证码发送失败')
    if (captchaEnabled.value) await refreshCaptcha()
  } finally {
    sending.value = false
  }
}

function validatePassword() {
  if (form.newPassword.length < passwordMinLength.value || form.newPassword.length > passwordMaxLength.value) {
    showToast(`密码长度需为 ${passwordMinLength.value}-${passwordMaxLength.value} 位`)
    return false
  }

  if (!STRONG_PASSWORD_PATTERN.test(form.newPassword)) {
    showToast('密码需包含大小写字母、数字和特殊字符')
    return false
  }

  if (form.newPassword !== form.confirmPassword) {
    showToast('两次输入的新密码不一致')
    return false
  }

  return true
}

async function submitReset() {
  if (!form.verifyCode) {
    showToast('请输入邮箱验证码')
    return
  }

  if (!validatePassword()) return

  submitting.value = true
  try {
    const result = await resetLoginPassword({
      username: form.username,
      contactType: 'email',
      contact: form.contact,
      verifyCode: form.verifyCode,
      newPassword: form.newPassword,
    })
    showToast(result.msg || result.data || '密码重置成功')
    router.replace('/login')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '密码重置失败')
  } finally {
    submitting.value = false
  }
}

function backToVerify() {
  step.value = 1
  form.verifyCode = ''
  if (captchaEnabled.value) void refreshCaptcha()
}

onMounted(() => {
  void loadResetConfig()
  void refreshCaptcha()
})

onBeforeUnmount(clearCountdown)
</script>

<template>
  <main class="forgot-page">
    <header class="forgot-nav">
      <button type="button" aria-label="返回登录" @click="router.replace('/login')">
        <ArrowLeft :size="20" />
      </button>
      <strong>找回密码</strong>
      <span></span>
    </header>

    <section class="forgot-hero">
      <div class="hero-icon">
        <LockKeyhole :size="30" />
      </div>
      <div>
        <h1>{{ step === 1 ? '验证账号' : '设置新密码' }}</h1>
        <p>{{ step === 1 ? '通过绑定邮箱接收验证码。' : '填写邮箱验证码并设置新密码。' }}</p>
      </div>
    </section>

    <section class="card reset-card">
      <div class="step-row">
        <span :class="{ active: step === 1, done: step === 2 }">1</span>
        <i></i>
        <span :class="{ active: step === 2 }">2</span>
      </div>

      <div class="reset-form">
        <label>
          <span>登录账号</span>
          <div class="field-shell">
            <UserRound :size="18" />
            <input v-model.trim="form.username" :disabled="step === 2" autocomplete="username" placeholder="请输入账号" />
          </div>
        </label>

        <label>
          <span>绑定邮箱</span>
          <div class="field-shell">
            <Mail :size="18" />
            <input
              v-model.trim="form.contact"
              :disabled="step === 2"
              autocomplete="email"
              inputmode="email"
              placeholder="请输入绑定邮箱"
            />
          </div>
        </label>

        <template v-if="step === 1">
          <label v-if="captchaEnabled">
            <span>图形验证码</span>
            <div class="captcha-row">
              <div class="field-shell">
                <input v-model.trim="form.captcha" placeholder="验证码" />
              </div>
              <button class="captcha-code" type="button" :disabled="captchaLoading" @click="refreshCaptcha">
                <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
                <span v-else>{{ captchaLoading ? '加载中' : '刷新' }}</span>
              </button>
            </div>
          </label>

          <van-button block round type="primary" :disabled="!canSendCode" :loading="sending" @click="sendCode">
            {{ countdown > 0 ? `${countdown}秒后重试` : '发送邮箱验证码' }}
          </van-button>
        </template>

        <template v-else>
          <label>
            <span>邮箱验证码</span>
            <div class="verify-row">
              <div class="field-shell">
                <BadgeCheck :size="18" />
                <input v-model.trim="form.verifyCode" inputmode="numeric" placeholder="请输入验证码" />
              </div>
              <button type="button" :disabled="countdown > 0" @click="backToVerify">
                <RotateCcw :size="16" />
                {{ countdown > 0 ? `${countdown}秒` : '重发' }}
              </button>
            </div>
          </label>

          <label>
            <span>新密码</span>
            <div class="field-shell">
              <LockKeyhole :size="18" />
              <input v-model.trim="form.newPassword" autocomplete="new-password" placeholder="8-20位强密码" type="password" />
            </div>
          </label>

          <label>
            <span>确认新密码</span>
            <div class="field-shell">
              <ShieldCheck :size="18" />
              <input v-model.trim="form.confirmPassword" autocomplete="new-password" placeholder="请再次输入" type="password" />
            </div>
          </label>

          <van-button block round type="primary" :disabled="!canResetPassword" :loading="submitting" @click="submitReset">
            重置密码
          </van-button>
        </template>
      </div>
    </section>

    <button class="back-login" type="button" @click="router.replace('/login')">返回登录</button>
  </main>
</template>

<style scoped>
.forgot-page {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 14px) 16px 28px;
  background:
    linear-gradient(180deg, #eaf5ff 0%, #f5f8fe 48%, #f5f8fe 100%),
    #f5f8fe;
}

.forgot-nav {
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: center;
  margin-bottom: 14px;
}

.forgot-nav button {
  display: grid;
  place-items: center;
  width: 48px;
  min-height: 48px;
  color: var(--space-text);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.forgot-nav strong {
  text-align: center;
  font-size: 20px;
  font-weight: 850;
}

.forgot-hero {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
  padding: 18px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(15, 87, 214, 0.92)),
    #1677ff;
  border-radius: 20px;
}

.hero-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  color: var(--space-blue);
  background: rgba(255, 255, 255, 0.92);
  border-radius: 18px;
}

.forgot-hero h1 {
  margin: 0 0 6px;
  font-size: 23px;
}

.forgot-hero p {
  margin: 0;
  color: rgba(255, 255, 255, 0.84);
  font-size: 14px;
  line-height: 1.45;
}

.reset-card {
  display: grid;
  gap: 18px;
}

.step-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 10px;
}

.step-row span {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  color: var(--space-muted);
  background: #f2f6fc;
  border: 1px solid var(--space-line);
  border-radius: 999px;
  font-size: 14px;
  font-weight: 850;
}

.step-row span.active,
.step-row span.done {
  color: #fff;
  background: var(--space-blue);
  border-color: var(--space-blue);
}

.step-row i {
  height: 2px;
  background: var(--space-line);
}

.reset-form {
  display: grid;
  gap: 14px;
}

.reset-form label {
  display: grid;
  gap: 7px;
}

.reset-form label > span {
  color: var(--space-subtext);
  font-size: 13px;
  font-weight: 760;
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

.field-shell input:disabled {
  color: var(--space-subtext);
}

.captcha-row {
  display: grid;
  grid-template-columns: 1fr 104px;
  gap: 10px;
}

.captcha-code {
  min-height: 50px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 1px solid #d4e5ff;
  border-radius: 15px;
  overflow: hidden;
}

.captcha-code img {
  display: block;
  width: 100%;
  height: 50px;
  object-fit: cover;
}

.verify-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 94px;
  gap: 10px;
}

.verify-row button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 50px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 15px;
  font-size: 14px;
  font-weight: 800;
}

.verify-row button:disabled {
  color: var(--space-muted);
  background: #f2f6fc;
}

.back-login {
  display: block;
  min-height: 48px;
  margin: 14px auto 0;
  padding: 0 18px;
  color: var(--space-blue);
  background: transparent;
  border: 0;
  font-weight: 800;
}

@media (min-width: 560px) {
  .forgot-page {
    max-width: 430px;
    margin: 0 auto;
    border-right: 1px solid var(--space-line);
    border-left: 1px solid var(--space-line);
  }
}
</style>
