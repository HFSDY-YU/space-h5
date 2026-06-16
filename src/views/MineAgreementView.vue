<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft, CheckCircle2, FileText } from '@lucide/vue'

const router = useRouter()

const rules = [
  '用户应按真实教学、会议或活动需求提交预约申请，并对预约主题、人数、用途等信息负责。',
  '预约通过后请按时使用空间。若计划变更，应及时取消申请，避免影响其他用户使用。',
  '管理员可根据空间管理规则对预约进行审核、调整、驳回或取消。',
  '使用空间时应遵守学校与场地管理要求，保持设备、环境和公共秩序良好。',
]
</script>

<template>
  <main class="safe-page doc-page">
    <header class="detail-nav">
      <button type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <strong>使用协议</strong>
      <span></span>
    </header>

    <section class="doc-hero">
      <FileText :size="30" />
      <div>
        <h1>空间预约使用协议</h1>
        <p>适用于移动端预约、审核与空间使用流程。</p>
      </div>
    </section>

    <section class="card doc-card">
      <h2 class="section-title">预约规则</h2>
      <article v-for="rule in rules" :key="rule">
        <CheckCircle2 :size="18" />
        <p>{{ rule }}</p>
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
    linear-gradient(135deg, rgba(22, 119, 255, 0.96), rgba(15, 87, 214, 0.92)),
    #1677ff;
  border-radius: 20px;
}

.doc-hero > svg {
  padding: 12px;
  width: 56px;
  height: 56px;
  color: var(--space-blue);
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
