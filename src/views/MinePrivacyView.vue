<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft, Database, ShieldCheck } from '@lucide/vue'

const router = useRouter()

const privacyItems = [
  '系统会使用账号、角色、部门、手机号、邮箱等基础信息用于身份识别与预约审核。',
  '预约记录、审核状态和空间占用信息用于空间管理、冲突判断和使用统计。',
  '手机号与邮箱绑定入口暂时保留，后续开放时会明确告知用途与验证方式。',
  '账号资料仅用于本系统业务场景，管理端按权限查看和处理相关数据。',
]
</script>

<template>
  <main class="safe-page doc-page">
    <header class="detail-nav">
      <button type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>隐私政策</strong>
      <span></span>
    </header>

    <section class="doc-hero">
      <Database :size="30" />
      <div>
        <h1>账号与预约数据说明</h1>
        <p>说明移动端展示和使用的数据范围。</p>
      </div>
    </section>

    <section class="card doc-card">
      <h2 class="section-title">数据使用</h2>
      <article v-for="item in privacyItems" :key="item">
        <ShieldCheck :size="18" />
        <p>{{ item }}</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.doc-page {
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

.doc-hero {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 18px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(18, 183, 106, 0.96), rgba(22, 119, 255, 0.9)),
    #12b76a;
  border-radius: 20px;
}

.doc-hero > svg {
  padding: 12px;
  width: 56px;
  height: 56px;
  color: #0f766e;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 18px;
}

.doc-hero h1 {
  margin: 0 0 6px;
  font-size: 22px;
  line-height: 1.25;
}

.doc-hero p {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  line-height: 1.45;
}

.doc-card {
  display: grid;
  gap: 10px;
}

.doc-card article {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: start;
  gap: 9px;
  padding: 13px;
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 14px;
}

.doc-card svg {
  color: var(--space-green);
}

.doc-card p {
  margin: 0;
  color: var(--space-subtext);
  font-size: 14px;
  line-height: 1.65;
}
</style>
