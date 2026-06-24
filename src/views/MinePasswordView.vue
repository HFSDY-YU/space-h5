<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { ArrowLeft, KeyRound, LockKeyhole, LogOut, ShieldAlert, ShieldCheck } from '@lucide/vue'
import { updatePassword } from '@/api/auth'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const route = useRoute()
const session = useSessionStore()
const passwordLoading = ref(false)
const logoutLoading = ref(false)
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const strongPasswordRule =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[~!@#$%^&*()\-=_+])[A-Za-z\d~!@#$%^&*()\-=_+]{8,20}$/
const isForceChange = computed(() => session.mustChangePassword || route.query.force === '1')
const canSubmit = computed(() => {
  return Boolean(passwordForm.oldPassword && passwordForm.newPassword && passwordForm.confirmPassword)
})

function resetPasswordForm() {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
}

async function submitPassword() {
  if (!canSubmit.value) {
    showToast('请完整填写密码信息')
    return
  }

  if (!strongPasswordRule.test(passwordForm.newPassword)) {
    showToast('新密码需 8-20 位，含大小写字母、数字和特殊字符')
    return
  }

  if (passwordForm.oldPassword === passwordForm.newPassword) {
    showToast('新密码不能与旧密码相同')
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showToast('两次输入的新密码不一致')
    return
  }

  passwordLoading.value = true
  try {
    await updatePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    })
    resetPasswordForm()
    session.setPasswordSecurityState({ mustChange: false, expired: false })

    if (isForceChange.value) {
      showToast('密码已修改')
      await session.refreshProfile()
      router.replace('/home')
      return
    }

    showToast('密码已修改，请重新登录')
    await session.logout()
    router.replace('/login')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '修改密码失败')
  } finally {
    passwordLoading.value = false
  }
}

async function handleLogout() {
  logoutLoading.value = true
  try {
    await session.logout()
    router.replace('/login')
  } finally {
    logoutLoading.value = false
  }
}
</script>

<template>
  <main class="safe-page password-page">
    <header class="detail-nav">
      <button v-if="!isForceChange" type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <span v-else></span>
      <strong>修改密码</strong>
      <span></span>
    </header>

    <section class="password-hero" :class="{ 'password-hero--force': isForceChange }">
      <div class="hero-icon">
        <ShieldAlert v-if="isForceChange" :size="30" />
        <LockKeyhole v-else :size="30" />
      </div>
      <div>
        <h1>{{ isForceChange ? '请先修改初始密码' : '账号安全' }}</h1>
        <p>{{ isForceChange ? '当前密码为初始或临时密码，修改后才可继续使用系统。' : '修改后需要使用新密码重新登录。' }}</p>
      </div>
    </section>

    <section class="card password-card">
      <h2 class="section-title">密码信息</h2>
      <div class="password-form">
        <label>
          <span>旧密码</span>
          <input v-model.trim="passwordForm.oldPassword" autocomplete="current-password" type="password" />
        </label>
        <label>
          <span>新密码</span>
          <input v-model.trim="passwordForm.newPassword" autocomplete="new-password" type="password" />
        </label>
        <label>
          <span>确认新密码</span>
          <input v-model.trim="passwordForm.confirmPassword" autocomplete="new-password" type="password" />
        </label>
      </div>
    </section>

    <section class="tips-card">
      <article>
        <KeyRound :size="18" />
        <span>新密码需 8-20 位，并同时包含大写字母、小写字母、数字和特殊字符。</span>
      </article>
      <article>
        <ShieldCheck :size="18" />
        <span>{{ isForceChange ? '保存成功后即可继续使用系统。' : '提交成功后系统会清理当前登录状态。' }}</span>
      </article>
    </section>

    <section class="fixed-actions password-actions" :class="{ 'password-actions--force': isForceChange }">
      <van-button v-if="isForceChange" block round plain type="primary" :loading="logoutLoading" @click="handleLogout">
        <LogOut :size="16" />
        退出登录
      </van-button>
      <van-button block round type="primary" :loading="passwordLoading" :disabled="!canSubmit" @click="submitPassword">
        保存新密码
      </van-button>
    </section>
  </main>
</template>

<style scoped>
.password-page {
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

.password-hero {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 18px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(15, 87, 214, 0.92)),
    #1677ff;
  border-radius: 20px;
}

.password-hero--force {
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.98), rgba(217, 119, 6, 0.94)),
    #f59e0b;
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

.password-hero h1 {
  margin: 0 0 6px;
  font-size: 23px;
}

.password-hero p {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  line-height: 1.45;
}

.password-form {
  display: grid;
  gap: 13px;
}

.password-form label {
  display: grid;
  gap: 7px;
}

.password-form span {
  color: var(--space-subtext);
  font-size: 13px;
  font-weight: 760;
}

.password-form input {
  width: 100%;
  min-height: 50px;
  padding: 0 14px;
  color: var(--space-text);
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  outline: 0;
}

.password-form input:focus {
  border-color: rgba(22, 119, 255, 0.62);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.1);
}

.tips-card {
  display: grid;
  gap: 8px;
}

.tips-card article {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  padding: 12px;
  color: var(--space-subtext);
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.5;
}

.tips-card svg {
  color: var(--space-blue);
}

.password-actions {
  grid-template-columns: 1fr;
}

.password-actions--force {
  grid-template-columns: 0.9fr 1.1fr;
}

.password-actions :deep(.van-button__content) {
  gap: 6px;
}

@media (max-width: 360px) {
  .password-actions--force {
    grid-template-columns: 1fr;
  }
}
</style>
