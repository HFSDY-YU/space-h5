<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { ArrowLeft, Building2, Mail, Phone, Shield, UserRound } from '@lucide/vue'
import { getProfile } from '@/api/auth'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()

const profileQuery = useQuery({
  queryKey: ['h5-user-profile'],
  queryFn: getProfile,
  staleTime: 60_000,
})

const profile = computed(() => profileQuery.data.value?.data)
const roleGroup = computed(() => profileQuery.data.value?.roleGroup || session.roleLabel)
const profileUserName = computed(() => profile.value?.userName || session.user.userName || '')
const profileNickName = computed(() => profile.value?.nickName || session.user.nickName || session.userName)
const deptName = computed(() => profile.value?.dept?.deptName || session.user.deptName || '澳琴国际教育大学城')
const phoneText = computed(() => profile.value?.phonenumber || session.user.phone || '未绑定')
const emailText = computed(() => profile.value?.email || session.user.email || '未绑定')
const sexText = computed(() => {
  if (profile.value?.sex === '0') return '男'
  if (profile.value?.sex === '1') return '女'
  return '未设置'
})

const profileItems = computed(() => [
  { label: '姓名', value: profileNickName.value || '-' },
  { label: '账号', value: profileUserName.value || '-' },
  { label: '角色', value: roleGroup.value || '-' },
  { label: '部门', value: deptName.value || '-' },
  { label: '性别', value: sexText.value },
  { label: '手机号', value: phoneText.value },
  { label: '邮箱', value: emailText.value },
])
</script>

<template>
  <main class="safe-page profile-page">
    <header class="detail-nav">
      <button type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>个人信息</strong>
      <span></span>
    </header>

    <section class="profile-hero">
      <div class="avatar">
        <UserRound :size="34" />
      </div>
      <div>
        <h1>{{ profileNickName }}</h1>
        <p>{{ roleGroup }} · {{ deptName }}</p>
        <span>{{ profileUserName || '账号加载中' }}</span>
      </div>
    </section>

    <section class="info-grid" aria-label="账号摘要">
      <article>
        <Shield :size="18" />
        <strong>{{ roleGroup }}</strong>
        <span>角色权限</span>
      </article>
      <article>
        <Phone :size="18" />
        <strong>{{ phoneText }}</strong>
        <span>手机号</span>
      </article>
      <article>
        <Mail :size="18" />
        <strong>{{ emailText }}</strong>
        <span>邮箱</span>
      </article>
    </section>

    <section class="card info-card">
      <div class="section-row">
        <h2 class="section-title">基础资料</h2>
        <Building2 :size="19" />
      </div>
      <dl>
        <div v-for="item in profileItems" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>
    <van-loading v-if="profileQuery.isLoading.value" type="spinner">加载个人信息中</van-loading>
    <van-empty v-else-if="profileQuery.isError.value" description="个人信息加载失败" />
  </main>
</template>

<style scoped>
.profile-page {
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

.profile-hero {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 18px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(18, 183, 106, 0.9)),
    #1677ff;
  border-radius: 20px;
}

.avatar {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  color: var(--space-blue);
  background: rgba(255, 255, 255, 0.92);
  border-radius: 20px;
}

.profile-hero h1,
.profile-hero p,
.profile-hero span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-hero h1 {
  margin: 0 0 6px;
  font-size: 24px;
}

.profile-hero p {
  margin: 0 0 5px;
  color: rgba(255, 255, 255, 0.84);
  font-size: 14px;
}

.profile-hero span {
  display: block;
  color: rgba(255, 255, 255, 0.76);
  font-size: 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.info-grid article {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 12px 10px;
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.info-grid svg {
  color: var(--space-blue);
}

.info-grid strong,
.info-grid span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-grid strong {
  font-size: 14px;
}

.info-grid span {
  color: var(--space-muted);
  font-size: 12px;
}

.info-card .section-row {
  color: var(--space-blue);
}

.info-card dl {
  display: grid;
  margin: 0;
}

.info-card dl div {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 12px;
  min-height: 50px;
  padding: 12px 0;
  border-bottom: 1px solid var(--space-line);
}

.info-card dl div:last-child {
  border-bottom: 0;
}

.info-card dt {
  color: var(--space-muted);
  font-size: 14px;
}

.info-card dd {
  min-width: 0;
  margin: 0;
  color: var(--space-text);
  text-align: right;
  word-break: break-word;
}

@media (max-width: 380px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
