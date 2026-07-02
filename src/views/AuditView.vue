<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Bell, CalendarDays, CheckSquare, Filter, RotateCcw, Search, Square } from '@lucide/vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAudit } from '@/composables/useAudit'

const router = useRouter()

const {
  activeTab,
  operatingId,
  keyword,
  showFilterPanel,
  showDateRangeCalendar,
  typeFilter,
  peopleFilter,
  dateRange,
  selectedIds,
  showReturnPanel,
  returnSubmitting,
  returnReason,
  calendarMinDate,
  calendarMaxDate,
  dateRangeText,
  workbenchTitle,
  workbenchSubtitle,
  activeFilterCount,
  filteredReservations,
  isLoading,
  emptyDescription,
  selectedCount,
  allFilteredSelected,
  returnPanelTitle,
  returnPanelDescription,
  formatAuditMeta,
  resetFilters,
  confirmDateRange,
  toggleSelected,
  toggleSelectAll,
  approveItem,
  rejectItem,
  approveSelected,
  rejectSelected,
  openReturnPanel,
  submitReturnAudit,
} = useAudit()
</script>

<template>
  <main class="safe-page">
    <header class="glass-header">
      <div class="header-row">
        <div>
          <p class="eyebrow">{{ workbenchTitle }}</p>
          <h1 class="title">预约审核</h1>
          <p class="sub-title">{{ workbenchSubtitle }}</p>
        </div>
        <button class="icon-button" type="button" @click="router.push('/messages')">
          <Bell :size="21" />
        </button>
      </div>
    </header>

    <section class="audit-tabs">
      <button :class="{ active: activeTab === 'pending' }" type="button" @click="activeTab = 'pending'">待审核</button>
      <button :class="{ active: activeTab === 'cancel' }" type="button" @click="activeTab = 'cancel'">取消待审</button>
      <button :class="{ active: activeTab === 'history' }" type="button" @click="activeTab = 'history'">审核记录</button>
    </section>

    <section class="audit-toolbar">
      <label class="audit-search">
        <Search :size="20" />
        <input v-model.trim="keyword" placeholder="搜索标题、申请人、房间或日期" />
      </label>
      <button
        class="filter-button"
        :class="{ active: activeFilterCount > 0 }"
        type="button"
        @click="showFilterPanel = true"
      >
        <Filter :size="20" />
        筛选
        <span v-if="activeFilterCount">{{ activeFilterCount }}</span>
      </button>
    </section>

    <section v-if="activeTab === 'pending'" class="batch-bar">
      <button type="button" @click="toggleSelectAll">
        <CheckSquare v-if="allFilteredSelected" :size="18" />
        <Square v-else :size="18" />
        {{ allFilteredSelected ? '取消全选' : '全选' }}
      </button>
      <span>已选 {{ selectedCount }} 条</span>
      <button type="button" :disabled="selectedCount === 0 || operatingId === 'batch'" @click="approveSelected">批量通过</button>
      <button type="button" :disabled="selectedCount === 0 || operatingId === 'batch'" @click="rejectSelected">批量驳回</button>
      <button type="button" :disabled="selectedCount === 0 || operatingId === 'batch'" @click="openReturnPanel()">
        批量退回
      </button>
    </section>

    <section class="stack">
      <article v-for="reservation in filteredReservations" :key="reservation.id" class="card audit-card">
        <div class="list-row">
          <button
            v-if="activeTab === 'pending'"
            class="select-button"
            type="button"
            :aria-label="`${selectedIds.includes(reservation.id) ? '取消选择' : '选择'}${reservation.title}`"
            @click="toggleSelected(reservation.id)"
          >
            <CheckSquare v-if="selectedIds.includes(reservation.id)" :size="19" />
            <Square v-else :size="19" />
          </button>
          <div>
            <p class="mini">{{ reservation.applicant }} · {{ reservation.applicantRole }}</p>
            <h2>{{ reservation.title }}</h2>
          </div>
          <StatusBadge :status="reservation.status" />
        </div>
        <p class="muted">{{ formatAuditMeta(reservation) }}</p>
        <p class="muted">联系方式：{{ reservation.applicantPhone || '-' }}</p>
        <p class="muted">{{ reservation.date }} · {{ reservation.time }}</p>
        <p>共 {{ reservation.sessions.length }} 个场次 · {{ reservation.people }} 人</p>
        <div class="audit-actions">
          <button class="plain-button" type="button" @click="router.push(`/reservation/${reservation.id}?from=audit`)">
            详情
          </button>
          <button
            v-if="activeTab === 'pending' || activeTab === 'cancel'"
            class="approve"
            type="button"
            :disabled="operatingId === reservation.id"
            @click="approveItem(reservation.id)"
          >
            {{ activeTab === 'cancel' ? '同意取消' : '通过' }}
          </button>
          <button
            v-if="activeTab === 'pending' || activeTab === 'cancel'"
            class="reject"
            type="button"
            :disabled="operatingId === reservation.id"
            @click="rejectItem(reservation.id)"
          >
            {{ activeTab === 'cancel' ? '驳回取消' : '驳回' }}
          </button>
          <button
            v-if="activeTab === 'pending'"
            class="return"
            type="button"
            :disabled="operatingId === reservation.id || operatingId === 'batch'"
            @click="openReturnPanel(reservation.id)"
          >
            <RotateCcw :size="15" />
            退回修改
          </button>
        </div>
      </article>

      <van-loading v-if="isLoading" type="spinner">加载审核数据中</van-loading>
      <van-empty
        v-else-if="filteredReservations.length === 0"
        :description="emptyDescription"
      />
    </section>
  </main>

  <van-popup v-model:show="showFilterPanel" position="bottom" round safe-area-inset-bottom>
    <section class="filter-panel">
      <header class="filter-panel__head">
        <div>
          <strong>筛选预约</strong>
          <span>按预约类型、人数和日期范围缩小范围</span>
        </div>
        <button type="button" @click="resetFilters">重置</button>
      </header>

      <div class="filter-group">
        <h3>预约类型</h3>
        <div class="filter-options">
          <button :class="{ active: typeFilter === 'all' }" type="button" @click="typeFilter = 'all'">
            全部类型
          </button>
          <button :class="{ active: typeFilter === 'single' }" type="button" @click="typeFilter = 'single'">
            常规预约
          </button>
          <button :class="{ active: typeFilter === 'long' }" type="button" @click="typeFilter = 'long'">
            长期预约
          </button>
        </div>
      </div>

      <div class="filter-group">
        <h3>人数</h3>
        <div class="filter-options">
          <button :class="{ active: peopleFilter === 'all' }" type="button" @click="peopleFilter = 'all'">
            全部人数
          </button>
          <button :class="{ active: peopleFilter === 'small' }" type="button" @click="peopleFilter = 'small'">
            30 人以内
          </button>
          <button :class="{ active: peopleFilter === 'medium' }" type="button" @click="peopleFilter = 'medium'">
            31-80 人
          </button>
          <button :class="{ active: peopleFilter === 'large' }" type="button" @click="peopleFilter = 'large'">
            80 人以上
          </button>
        </div>
      </div>

      <div class="filter-group">
        <h3>日期范围</h3>
        <button class="date-range-button" type="button" @click="showDateRangeCalendar = true">
          <CalendarDays :size="18" />
          <span>{{ dateRangeText }}</span>
        </button>
      </div>

      <button class="filter-confirm" type="button" @click="showFilterPanel = false">
        查看 {{ filteredReservations.length }} 条预约
      </button>
    </section>
  </van-popup>

  <van-calendar
    v-model:show="showDateRangeCalendar"
    type="range"
    color="#1677ff"
    :default-date="dateRange.length === 2 ? dateRange : undefined"
    :min-date="calendarMinDate"
    :max-date="calendarMaxDate"
    @confirm="confirmDateRange"
  />

  <van-popup v-model:show="showReturnPanel" position="bottom" round safe-area-inset-bottom>
    <section class="return-panel">
      <header class="filter-panel__head">
        <div>
          <strong>{{ returnPanelTitle }}</strong>
          <span>{{ returnPanelDescription }}</span>
        </div>
        <button type="button" :disabled="returnSubmitting" @click="showReturnPanel = false">关闭</button>
      </header>

      <label class="return-reason">
        <span>退回原因 *</span>
        <textarea
          v-model.trim="returnReason"
          rows="4"
          maxlength="200"
          placeholder="请说明需要申请人修改的内容"
          :disabled="returnSubmitting"
        ></textarea>
      </label>

      <button class="filter-confirm" type="button" :disabled="returnSubmitting" @click="submitReturnAudit">
        {{ returnSubmitting ? '提交中' : '确认退回修改' }}
      </button>
    </section>
  </van-popup>
</template>

<style scoped>
.audit-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 5px;
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.audit-tabs button {
  min-height: 38px;
  color: var(--space-subtext);
  background: transparent;
  border: 0;
  border-radius: 12px;
  font-weight: 750;
}

.audit-tabs .active {
  color: #fff;
  background: var(--space-blue);
}

.audit-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
}

.audit-search,
.filter-button {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 48px;
  background: #fff;
  border: 0;
  border-radius: 16px;
  box-shadow: 0 10px 22px rgba(54, 89, 150, 0.08);
}

.audit-search {
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
  padding: 0 14px;
  color: var(--space-muted);
  border: 1px solid var(--space-line);
}

.audit-search input {
  width: 100%;
  height: 100%;
  min-width: 0;
  color: var(--space-text);
  background: transparent;
  border: 0;
  outline: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.25;
}

.audit-search input::placeholder {
  color: var(--space-muted);
  font-weight: 500;
}

.filter-button {
  position: relative;
  justify-content: center;
  gap: 6px;
  color: var(--space-text);
  width: 82px;
  font-size: 15px;
  font-weight: 800;
}

.filter-button.active {
  color: var(--space-blue);
}

.filter-button span {
  position: absolute;
  top: 6px;
  right: 8px;
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  color: #fff;
  background: var(--space-blue);
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
}

.batch-bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px 10px;
  margin-bottom: 12px;
  padding: 10px;
  background: #fff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

/* 第一行：全选按钮 + 已选计数；第二行：三个批量操作按钮等分铺满，避免窄屏挤成一行。 */
.batch-bar button:first-child {
  grid-column: 1;
  grid-row: 1;
}

.batch-bar span {
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
  overflow: hidden;
  color: var(--space-subtext);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.batch-bar button:nth-child(3) {
  grid-column: 1 / 2;
  grid-row: 2;
}

.batch-bar button:nth-child(4) {
  grid-column: 2 / 3;
  grid-row: 2;
}

.batch-bar button:nth-child(5) {
  grid-column: 1 / 3;
  grid-row: 3;
}

.batch-bar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 40px;
  padding: 0 10px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 12px;
  font-weight: 780;
}

.batch-bar button:last-child {
  color: #9a5b00;
  background: #fff7e6;
}

.batch-bar button:nth-last-child(2) {
  color: var(--space-red);
  background: #feecec;
}

.batch-bar button:disabled {
  opacity: 0.56;
}

.audit-card h2 {
  margin: 4px 0 0;
  font-size: 17px;
}

.audit-card p {
  margin: 10px 0 0;
}

.audit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

/* 详情按钮宽度自适应内容；通过/驳回/退回均分剩余空间，按钮过多时自动换行不溢出。 */
.audit-actions .plain-button {
  flex: 0 0 auto;
  min-height: 40px;
}

.audit-actions .approve,
.audit-actions .reject,
.audit-actions .return {
  flex: 1 1 auto;
}

.select-button {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 38px;
  min-height: 38px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 12px;
}

.approve,
.reject,
.return {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 72px;
  min-height: 40px;
  padding: 0 13px;
  border: 0;
  border-radius: 999px;
  font-weight: 750;
}

.approve {
  color: #fff;
  background: var(--space-blue);
}

.reject {
  color: var(--space-red);
  background: #feecec;
}

.return {
  color: #9a5b00;
  background: #fff7e6;
}

.approve:disabled,
.reject:disabled,
.return:disabled {
  opacity: 0.68;
}

.filter-panel {
  padding: 18px 18px calc(env(safe-area-inset-bottom) + 18px);
  background: #fff;
}

.filter-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.filter-panel__head div {
  display: grid;
  gap: 4px;
}

.filter-panel__head strong {
  font-size: 19px;
  font-weight: 850;
}

.filter-panel__head span {
  color: var(--space-subtext);
  font-size: 13px;
}

.filter-panel__head button {
  min-height: 34px;
  padding: 0 12px;
  color: var(--space-blue);
  background: #eaf2ff;
  border: 0;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 800;
}

.filter-group {
  margin-top: 16px;
}

.filter-group h3 {
  margin: 0 0 10px;
  color: var(--space-text);
  font-size: 15px;
  font-weight: 850;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.filter-options button {
  min-height: 44px;
  padding: 0 14px;
  color: var(--space-text);
  background: #f6f9fe;
  border: 1px solid var(--space-line);
  border-radius: 13px;
  font-size: 14px;
  font-weight: 780;
}

.filter-options button.active {
  color: #fff;
  background: var(--space-blue);
  border-color: var(--space-blue);
}

.date-range-button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  color: var(--space-text);
  text-align: left;
  background: #f6f9fe;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  font-size: 15px;
  font-weight: 800;
}

.date-range-button svg {
  flex: 0 0 auto;
  color: var(--space-blue);
}

.date-range-button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-confirm {
  width: 100%;
  min-height: 46px;
  margin-top: 22px;
  color: #fff;
  background: var(--space-blue);
  border: 0;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 850;
}

.return-panel {
  padding: 18px 18px calc(env(safe-area-inset-bottom) + 18px);
  background: #fff;
}

.return-reason {
  display: grid;
  gap: 9px;
}

.return-reason span {
  color: var(--space-text);
  font-size: 15px;
  font-weight: 850;
}

.return-reason textarea {
  width: 100%;
  min-height: 112px;
  padding: 12px;
  color: var(--space-text);
  background: #f6f9fe;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  outline: 0;
  resize: none;
  font-size: 15px;
  line-height: 1.45;
}

.return-reason textarea:focus {
  border-color: rgba(22, 119, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.08);
}

.return-reason textarea:disabled,
.filter-confirm:disabled {
  opacity: 0.64;
}

@media (max-width: 380px) {
  .audit-toolbar {
    gap: 7px;
  }

  .filter-button {
    width: 76px;
  }

  .audit-search input,
  .filter-button {
    font-size: 14px;
  }
}
</style>
