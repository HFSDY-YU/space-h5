<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import {
  Bell,
  ChevronRight,
  LockKeyhole,
  LogOut,
  Mail,
  Phone,
  UserRound,
} from '@lucide/vue'
import { getProfile } from '@/api/auth'
import { useSessionStore } from '@/stores/session'

type AccountAction = 'profile' | 'password' | 'phone' | 'email'

const router = useRouter()
const session = useSessionStore()

const profileQuery = useQuery({
  queryKey: ['h5-user-profile'],
  queryFn: getProfile,
  staleTime: 60_000,
})

const profile = computed(() => profileQuery.data.value?.data)
const profileUserName = computed(() => profile.value?.userName || session.user.userName || '')
const profileNickName = computed(() => profile.value?.nickName || session.user.nickName || session.userName)
const deptName = computed(() => profile.value?.dept?.deptName || session.user.deptName || '澳琴国际教育大学城')
const phoneText = computed(() => profile.value?.phonenumber || session.user.phone || '未绑定')
const emailText = computed(() => profile.value?.email || session.user.email || '未绑定')
const accountItems = computed(() => [
  { label: '个人信息', value: profileNickName.value || profileUserName.value || '-', icon: UserRound, action: 'profile' },
  { label: '修改密码', value: '建议定期更新', icon: LockKeyhole, action: 'password' },
  { label: '绑定手机', value: phoneText.value, icon: Phone, action: 'phone' },
  { label: '绑定邮箱', value: emailText.value, icon: Mail, action: 'email' },
])

function openAccountItem(action: AccountAction) {
  if (action === 'phone') {
    showToast('手机号绑定功能暂时保留')
    return
  }

  if (action === 'email') {
    showToast('邮箱绑定功能暂时保留')
    return
  }

  router.push(action === 'profile' ? '/mine/profile' : '/mine/password')
}

async function logout() {
  try {
    await showConfirmDialog({
      title: '退出登录',
      message: '确认退出当前账号吗？',
    })
  } catch {
    return
  }

  await session.logout()
  router.replace('/login')
}
</script>

<template>
  <main class="safe-page mine-page">
    <header class="mine-header">
      <div class="header-row">
        <h1>我的</h1>
        <button class="icon-button" type="button" aria-label="消息" @click="router.push('/messages')">
          <Bell :size="21" />
        </button>
      </div>
      <button class="profile-card" type="button" @click="router.push('/mine/profile')">
        <div class="avatar">
          <UserRound :size="30" />
        </div>
        <div>
          <h2>{{ session.userName }}</h2>
          <p>{{ session.roleLabel }} · {{ deptName }}</p>
          <span>{{ profileUserName || '账号加载中' }}</span>
        </div>
        <ChevronRight :size="20" />
      </button>
    </header>

    <section class="card menu-card">
      <h2 class="section-title">账号与安全</h2>
      <button
        v-for="item in accountItems"
        :key="item.label"
        type="button"
        @click="openAccountItem(item.action as AccountAction)"
      >
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
        <em>{{ item.value }}</em>
        <ChevronRight :size="18" />
      </button>
    </section>

    <button class="logout-button" type="button" @click="logout">
      <LogOut :size="18" />
      退出登录
    </button>
  </main>
</template>

<style scoped>
.mine-page {
  display: grid;
  align-content: start;
  gap: 12px;
}

.mine-header {
  margin: -14px -16px 4px;
  padding: calc(env(safe-area-inset-top) + 18px) 16px 24px;
  color: var(--space-text);
  background:
    linear-gradient(180deg, #dff0ff, #f5f8fe),
    #f5f8fe;
  border-bottom-right-radius: 28px;
  border-bottom-left-radius: 28px;
}

.mine-header h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.1;
}

.mine-header .icon-button {
  color: var(--space-blue);
  background: #fff;
}

.profile-card {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 98px;
  margin-top: 22px;
  padding: 16px;
  color: var(--space-text);
  text-align: left;
  background: #fff;
  border: 1px solid rgba(232, 238, 247, 0.85);
  border-radius: 22px;
  box-shadow: 0 14px 34px rgba(54, 89, 150, 0.1);
}

.avatar {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  color: #fff;
  background: linear-gradient(135deg, #1677ff, #12b76a);
  border-radius: 18px;
}

.profile-card h2,
.profile-card p,
.profile-card span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-card h2 {
  margin: 0 0 6px;
  font-size: 21px;
}

.profile-card p {
  margin: 0 0 5px;
  color: var(--space-subtext);
  font-size: 13px;
}

.profile-card span {
  display: block;
  color: var(--space-muted);
  font-size: 12px;
}

.profile-card > svg {
  color: var(--space-muted);
}

.menu-card button {
  display: grid;
  grid-template-columns: 28px minmax(72px, auto) minmax(0, 1fr) 20px;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 54px;
  padding: 0;
  color: var(--space-text);
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--space-line);
}

.menu-card button:last-child {
  border-bottom: 0;
}

.menu-card button svg:first-child {
  color: var(--space-blue);
}

.menu-card button svg:last-child {
  color: var(--space-muted);
}

.menu-card span {
  font-weight: 760;
}

.menu-card em {
  min-width: 0;
  overflow: hidden;
  color: var(--space-muted);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-style: normal;
}

.logout-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 50px;
  margin-top: 4px;
  color: var(--space-red);
  background: #fff;
  border: 1px solid #feecec;
  border-radius: 16px;
  font-weight: 800;
}

@media (max-width: 380px) {
  .menu-card button {
    grid-template-columns: 26px minmax(68px, auto) minmax(0, 1fr) 18px;
  }
}
</style>
