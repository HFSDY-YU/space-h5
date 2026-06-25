<script setup lang="ts">
// 房间「启用/停用管理」底部弹窗（管理员）。纯展示：状态数据与切换逻辑都由父组件持有，
// 这里只负责呈现并把启用/停用动作通过 change-status 透传出去。
defineProps<{
  show: boolean
  roomCode: string
  roomType: string
  loading: boolean
  statusText: string
  isDisabled: boolean
  canEnable: boolean
  canDisable: boolean
  // '' 表示无提交中；'0'/'1' 表示正在提交启用/停用。
  submitting: string
}>()

defineEmits<{
  'update:show': [value: boolean]
  'change-status': [status: '0' | '1']
}>()
</script>

<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    safe-area-inset-bottom
    @update:show="$emit('update:show', $event)"
  >
    <section class="room-status-panel" aria-label="启用停用管理弹窗">
      <header class="panel-head">
        <div>
          <strong>启用 / 停用管理</strong>
          <span>{{ roomCode }} · {{ roomType }}</span>
        </div>
        <button type="button" @click="$emit('update:show', false)">关闭</button>
      </header>

      <van-loading v-if="loading" class="panel-loading">加载房间状态</van-loading>
      <template v-else>
        <div class="status-summary">
          <span>当前状态</span>
          <strong :class="{ 'is-disabled': isDisabled }">{{ statusText }}</strong>
        </div>
        <p class="status-note">停用后该房间不可继续发起预约；如存在未结束或待审核预约，后端会自动阻止停用。</p>

        <div class="status-actions">
          <van-button
            block
            round
            type="primary"
            :disabled="!canEnable"
            :loading="submitting === '0'"
            @click="$emit('change-status', '0')"
          >
            启用房间
          </van-button>
          <van-button
            block
            round
            plain
            type="danger"
            :disabled="!canDisable"
            :loading="submitting === '1'"
            @click="$emit('change-status', '1')"
          >
            停用房间
          </van-button>
        </div>
      </template>
    </section>
  </van-popup>
</template>

<style scoped>
.room-status-panel {
  display: grid;
  gap: 16px;
  padding: 20px 16px calc(env(safe-area-inset-bottom) + 18px);
  background: #fff;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-head div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.panel-head strong {
  color: var(--space-text);
  font-size: 18px;
  line-height: 1.25;
}

.panel-head span {
  overflow: hidden;
  color: var(--space-subtext);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-head button {
  flex: 0 0 auto;
  min-width: 54px;
  min-height: 36px;
  color: var(--space-subtext);
  background: #f3f6fb;
  border: 0;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
}

.panel-loading {
  min-height: 126px;
  padding: 28px 0;
}

.status-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  padding: 0 14px;
  background: #f8fbff;
  border: 1px solid var(--space-line);
  border-radius: 16px;
}

.status-summary span {
  color: var(--space-subtext);
  font-size: 14px;
}

.status-summary strong {
  color: #078047;
  font-size: 16px;
}

.status-summary strong.is-disabled {
  color: var(--space-red);
}

.status-note {
  margin: 0;
  color: var(--space-subtext);
  font-size: 13px;
  line-height: 1.55;
}

.status-actions {
  display: grid;
  gap: 10px;
}
</style>
