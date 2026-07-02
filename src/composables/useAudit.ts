import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { showConfirmDialog, showToast } from 'vant'
import {
  approveReservation,
  approveCancelReservation,
  batchApproveReservations,
  batchRejectReservations,
  getReservation,
  listCancelPendingReservations,
  listPendingReservations,
  listReservations,
  rejectCancelReservation,
  rejectReservation,
  returnReservation,
  type BackendReservation,
} from '@/api/space'
import { formatDateValue, toUiReservations } from '@/services/spaceMapper'
import { useSessionStore } from '@/stores/session'
import type { Reservation } from '@/types/space'

// 审核工作台的数据获取、筛选、选择与审核动作逻辑。
// 从 AuditView.vue 抽出，视图仅保留模板与导航（router）。
export function useAudit() {
  const queryClient = useQueryClient()
  const session = useSessionStore()

  const activeTab = ref<'pending' | 'cancel' | 'history'>('pending')
  const operatingId = ref('')
  const keyword = ref('')
  const showFilterPanel = ref(false)
  const showDateRangeCalendar = ref(false)
  const typeFilter = ref<'all' | Reservation['type']>('all')
  const peopleFilter = ref<'all' | 'small' | 'medium' | 'large'>('all')
  const dateRange = ref<Date[]>([])
  const selectedIds = ref<string[]>([])
  const showReturnPanel = ref(false)
  const returnSubmitting = ref(false)
  const returnTargetIds = ref<string[]>([])
  const returnReason = ref('')
  const calendarMinDate = new Date(new Date().getFullYear() - 1, 0, 1)
  const calendarMaxDate = new Date(new Date().getFullYear() + 1, 11, 31)

  const bookingDateStart = computed(() => (dateRange.value[0] ? formatDateValue(dateRange.value[0]) : ''))
  const bookingDateEnd = computed(() => (dateRange.value[1] ? formatDateValue(dateRange.value[1]) : ''))
  const dateRangeText = computed(() => {
    if (!bookingDateStart.value || !bookingDateEnd.value) return '全部日期'
    if (bookingDateStart.value === bookingDateEnd.value) return bookingDateStart.value
    return `${bookingDateStart.value} 至 ${bookingDateEnd.value}`
  })
  const workbenchTitle = computed(() => (session.isProperty ? '物业工作台' : session.isTeacher ? '老师工作台' : '审核工作台'))
  const workbenchSubtitle = computed(() =>
    session.isProperty ? '处理物业复审与取消审核' : '处理本部门及下级部门学生预约初审',
  )
  const activeFilterCount = computed(() => {
    return (
      Number(typeFilter.value !== 'all') +
      Number(peopleFilter.value !== 'all') +
      Number(Boolean(bookingDateStart.value && bookingDateEnd.value))
    )
  })
  const hasSearchOrFilters = computed(() => Boolean(keyword.value.trim()) || activeFilterCount.value > 0)

  function hasCompleteReservationSummary(reservation: BackendReservation) {
    const hasItems = Boolean(reservation.items && reservation.items.length > 0)
    // 审核列表接口有时只返回房间和时间摘要，缺少 items 会导致场次数和联系方式展示不完整。
    return Boolean(reservation.roomName && hasItems)
  }

  async function fillReservationDetail(reservation: BackendReservation) {
    if (hasCompleteReservationSummary(reservation)) return reservation
    if (!reservation.reservationId) return reservation

    try {
      const detail = await getReservation(String(reservation.reservationId))
      return detail ? { ...reservation, ...detail } : reservation
    } catch {
      // 审核记录列表不能因为单条详情异常整体不可用，失败时保留主列表信息。
      return reservation
    }
  }

  const pendingQuery = useQuery({
    queryKey: computed(() => ['h5-pending-reservations', bookingDateStart.value, bookingDateEnd.value]),
    queryFn: async () => {
      const result = await listPendingReservations({
        bookingDateStart: bookingDateStart.value || undefined,
        bookingDateEnd: bookingDateEnd.value || undefined,
      })
      const detailRows = await Promise.all(result.rows.map(fillReservationDetail))
      return toUiReservations(detailRows)
    },
  })

  const cancelPendingQuery = useQuery({
    queryKey: computed(() => ['h5-cancel-pending-reservations', bookingDateStart.value, bookingDateEnd.value]),
    queryFn: async () => {
      const result = await listCancelPendingReservations({
        bookingDateStart: bookingDateStart.value || undefined,
        bookingDateEnd: bookingDateEnd.value || undefined,
      })
      const detailRows = await Promise.all(result.rows.map(fillReservationDetail))
      return toUiReservations(detailRows)
    },
    enabled: computed(() => activeTab.value === 'cancel'),
  })

  const auditHistoryQuery = useQuery({
    queryKey: computed(() => ['h5-audit-history-reservations', bookingDateStart.value, bookingDateEnd.value]),
    queryFn: async () => {
      const result = await listReservations({
        bookingDateStart: bookingDateStart.value || undefined,
        bookingDateEnd: bookingDateEnd.value || undefined,
      })
      const historyRows = result.rows.filter((reservation) => reservation.status && reservation.status !== '1')
      const detailRows = await Promise.all(historyRows.map(fillReservationDetail))
      return toUiReservations(detailRows)
    },
    enabled: computed(() => activeTab.value === 'history'),
  })

  const visibleReservations = computed(() => {
    if (activeTab.value === 'cancel') return cancelPendingQuery.data.value ?? []
    if (activeTab.value === 'history') return auditHistoryQuery.data.value ?? []
    return pendingQuery.data.value ?? []
  })

  function getReservationDates(reservation: Reservation) {
    const sessionDates = reservation.sessions.map((item) => item.date).filter(Boolean)
    if (sessionDates.length > 0) return sessionDates

    return reservation.date.match(/\d{4}-\d{2}-\d{2}/g) ?? []
  }

  function formatAuditMeta(reservation: Reservation) {
    return [reservation.auditStageText, reservation.roomName || '待选择房间'].filter(Boolean).join(' · ')
  }

  function isDateMatched(reservation: Reservation) {
    if (!bookingDateStart.value || !bookingDateEnd.value) return true

    const dates = getReservationDates(reservation)
    if (dates.length === 0) return true

    const reservationStart = dates[0] ?? ''
    const reservationEnd = dates[dates.length - 1] ?? reservationStart
    return reservationStart <= bookingDateEnd.value && reservationEnd >= bookingDateStart.value
  }

  const filteredReservations = computed(() => {
    const lowerKeyword = keyword.value.trim().toLowerCase()

    return visibleReservations.value.filter((reservation) => {
      const searchText =
        `${reservation.title}${reservation.applicant}${reservation.roomName}${reservation.date}${reservation.time}`.toLowerCase()
      const keywordMatched = !lowerKeyword || searchText.includes(lowerKeyword)
      const typeMatched = typeFilter.value === 'all' || reservation.type === typeFilter.value
      const peopleMatched =
        peopleFilter.value === 'all' ||
        (peopleFilter.value === 'small' && reservation.people <= 30) ||
        (peopleFilter.value === 'medium' && reservation.people > 30 && reservation.people <= 80) ||
        (peopleFilter.value === 'large' && reservation.people > 80)
      const dateMatched = isDateMatched(reservation)

      return keywordMatched && typeMatched && peopleMatched && dateMatched
    })
  })
  const isLoading = computed(() => {
    if (activeTab.value === 'cancel') return cancelPendingQuery.isLoading.value
    if (activeTab.value === 'history') return auditHistoryQuery.isLoading.value
    return pendingQuery.isLoading.value
  })
  const emptyDescription = computed(() => {
    if (hasSearchOrFilters.value) return '没有匹配预约'
    if (activeTab.value === 'history') return '暂无审核记录'
    if (activeTab.value === 'cancel') return '暂无取消待审预约'
    return '暂无待处理预约'
  })
  const selectedCount = computed(() => selectedIds.value.length)
  const allFilteredSelected = computed(() => {
    return filteredReservations.value.length > 0 && filteredReservations.value.every((item) => selectedIds.value.includes(item.id))
  })
  const isReturnBatch = computed(() => returnTargetIds.value.length > 1)
  const returnPanelTitle = computed(() => (isReturnBatch.value ? '批量退回修改' : '退回修改'))
  const returnPanelDescription = computed(() =>
    isReturnBatch.value ? `将选中的 ${returnTargetIds.value.length} 条预约退回给申请人修改` : '将该预约退回给申请人修改',
  )

  async function refreshAuditList() {
    await queryClient.invalidateQueries({ queryKey: ['h5-pending-reservations'] })
    await queryClient.invalidateQueries({ queryKey: ['h5-cancel-pending-reservations'] })
    await queryClient.invalidateQueries({ queryKey: ['h5-audit-history-reservations'] })
    selectedIds.value = []
  }

  function resetFilters() {
    typeFilter.value = 'all'
    peopleFilter.value = 'all'
    dateRange.value = []
    selectedIds.value = []
  }

  function confirmDateRange(date: Date | Date[]) {
    const nextDates = Array.isArray(date) ? date : [date]
    if (nextDates.length < 2 || !nextDates[0] || !nextDates[1]) return
    dateRange.value = [nextDates[0], nextDates[1]]
    showDateRangeCalendar.value = false
  }

  function toggleSelected(reservationId: string) {
    selectedIds.value = selectedIds.value.includes(reservationId)
      ? selectedIds.value.filter((id) => id !== reservationId)
      : [...selectedIds.value, reservationId]
  }

  function toggleSelectAll() {
    selectedIds.value = allFilteredSelected.value ? [] : filteredReservations.value.map((item) => item.id)
  }

  async function approveItem(reservationId: string) {
    const isCancelAudit = activeTab.value === 'cancel'
    try {
      await showConfirmDialog({
        title: isCancelAudit ? '同意取消' : '通过预约',
        message: isCancelAudit ? '确认同意这条预约的取消申请吗？' : '确认审核通过这条预约吗？',
      })
    } catch {
      return
    }

    operatingId.value = reservationId
    try {
      if (isCancelAudit) {
        await approveCancelReservation(reservationId)
      } else {
        await approveReservation(reservationId)
      }
      await refreshAuditList()
      showToast(isCancelAudit ? '已同意取消' : '已通过')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '审核失败')
    } finally {
      operatingId.value = ''
    }
  }

  async function rejectItem(reservationId: string) {
    const isCancelAudit = activeTab.value === 'cancel'
    try {
      await showConfirmDialog({
        title: isCancelAudit ? '驳回取消' : '驳回预约',
        message: isCancelAudit ? '确认驳回这条预约的取消申请吗？' : '确认驳回这条预约吗？',
      })
    } catch {
      return
    }

    operatingId.value = reservationId
    try {
      if (isCancelAudit) {
        await rejectCancelReservation(reservationId)
      } else {
        await rejectReservation(reservationId)
      }
      await refreshAuditList()
      showToast(isCancelAudit ? '已驳回取消' : '已驳回')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '审核失败')
    } finally {
      operatingId.value = ''
    }
  }

  async function approveSelected() {
    if (selectedIds.value.length === 0) {
      showToast('请先选择预约')
      return
    }

    try {
      await showConfirmDialog({
        title: '批量通过',
        message: `确认通过选中的 ${selectedIds.value.length} 条预约吗？`,
      })
    } catch {
      return
    }

    operatingId.value = 'batch'
    try {
      const result = await batchApproveReservations(selectedIds.value)
      await refreshAuditList()
      showToast(result.msg || '批量通过完成')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量审核失败')
    } finally {
      operatingId.value = ''
    }
  }

  async function rejectSelected() {
    if (selectedIds.value.length === 0) {
      showToast('请先选择预约')
      return
    }

    try {
      await showConfirmDialog({
        title: '批量驳回',
        message: `确认驳回选中的 ${selectedIds.value.length} 条预约吗？`,
      })
    } catch {
      return
    }

    operatingId.value = 'batch'
    try {
      const result = await batchRejectReservations(selectedIds.value)
      await refreshAuditList()
      showToast(result.msg || '批量驳回完成')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量驳回失败')
    } finally {
      operatingId.value = ''
    }
  }

  function openReturnPanel(reservationId?: string) {
    const ids = reservationId ? [reservationId] : [...selectedIds.value]
    if (ids.length === 0) {
      showToast('请先选择预约')
      return
    }

    returnTargetIds.value = ids
    returnReason.value = ''
    showReturnPanel.value = true
  }

  async function submitReturnAudit() {
    const reason = returnReason.value.trim()
    if (!reason) {
      showToast('请填写退回修改原因')
      return
    }

    returnSubmitting.value = true
    operatingId.value = isReturnBatch.value ? 'batch' : returnTargetIds.value[0] || ''

    try {
      const results = await Promise.allSettled(returnTargetIds.value.map((id) => returnReservation(id, reason)))
      const successCount = results.filter((result) => result.status === 'fulfilled').length
      const failureMessages = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => (result.reason instanceof Error ? result.reason.message : '处理失败'))

      await refreshAuditList()
      showReturnPanel.value = false
      if (failureMessages.length) {
        showToast(`已退回 ${successCount} 条，失败 ${failureMessages.length} 条`)
      } else {
        showToast(isReturnBatch.value ? `批量退回完成，共 ${successCount} 条` : '已退回修改')
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '退回修改失败')
    } finally {
      returnSubmitting.value = false
      operatingId.value = ''
    }
  }

  return {
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
    visibleReservations,
    isLoading,
    emptyDescription,
    selectedCount,
    allFilteredSelected,
    returnPanelTitle,
    returnPanelDescription,
    formatAuditMeta,
    refreshAuditList,
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
  }
}
