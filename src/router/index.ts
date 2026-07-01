import { createRouter, createWebHistory } from 'vue-router'
import MobileLayout from '@/layouts/MobileLayout.vue'
import { useSessionStore } from '@/stores/session'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPasswordView.vue'),
      meta: { public: true },
    },
    {
      path: '/onecard-login',
      alias: ['/onecard/login'],
      name: 'onecard-login',
      component: () => import('@/views/OnecardLoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: MobileLayout,
      redirect: '/home',
      children: [
        {
          path: 'home',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'rooms/:roomId',
          name: 'room-detail',
          component: () => import('@/views/RoomDetailView.vue'),
        },
        {
          path: 'rooms/:roomId/slot',
          name: 'room-slot-detail',
          component: () => import('@/views/RoomSlotDetailView.vue'),
        },
        {
          path: 'reservation/apply',
          name: 'reservation-apply',
          component: () => import('@/views/ReservationApplyView.vue'),
          meta: { requiresReserve: true },
        },
        {
          path: 'reservation/long',
          name: 'reservation-long',
          component: () => import('@/views/LongReservationApplyView.vue'),
          meta: { requiresReserve: true },
        },
        {
          path: 'reservation/long/rooms',
          name: 'reservation-long-rooms',
          component: () => import('@/views/LongReservationRoomsView.vue'),
          meta: { requiresReserve: true },
        },
        {
          path: 'reservation/long/confirm',
          name: 'reservation-long-confirm',
          component: () => import('@/views/LongReservationConfirmView.vue'),
          meta: { requiresReserve: true },
        },
        {
          path: 'reservation/mine',
          name: 'reservation-mine',
          component: () => import('@/views/MyReservationsView.vue'),
          meta: { requiresMyReservations: true },
        },
        {
          path: 'reservation/:reservationId',
          name: 'reservation-detail',
          component: () => import('@/views/ReservationDetailView.vue'),
        },
        {
          path: 'audit',
          name: 'audit',
          component: () => import('@/views/AuditView.vue'),
          meta: { requiresAudit: true },
        },
        {
          path: 'rooms-admin',
          name: 'rooms-admin',
          component: () => import('@/views/RoomsAdminView.vue'),
          meta: { requiresRoomManage: true },
        },
        {
          path: 'messages',
          name: 'messages',
          component: () => import('@/views/MessagesView.vue'),
        },
        {
          path: 'messages/:messageId',
          name: 'message-detail',
          component: () => import('@/views/MessageDetailView.vue'),
        },
        {
          path: 'mine',
          name: 'mine',
          component: () => import('@/views/MineView.vue'),
        },
        {
          path: 'mine/profile',
          name: 'mine-profile',
          component: () => import('@/views/MineProfileView.vue'),
        },
        {
          path: 'mine/password',
          name: 'mine-password',
          component: () => import('@/views/MinePasswordView.vue'),
        },
        {
          path: 'mine/agreement',
          name: 'mine-agreement',
          component: () => import('@/views/MineAgreementView.vue'),
        },
        {
          path: 'mine/privacy',
          name: 'mine-privacy',
          component: () => import('@/views/MinePrivacyView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const session = useSessionStore()
  if (to.meta.public) return true
  if (!session.isLoggedIn) return { name: 'login' }
  if ((session.mustChangePassword || session.initialPasswordUnset) && to.name !== 'mine-password') {
    return { name: 'mine-password', query: { force: '1' }, replace: true }
  }

  if (to.meta.requiresReserve && !session.canReserve) {
    return { name: 'home' }
  }

  if (to.meta.requiresMyReservations && !session.canViewMyReservations) {
    return { name: 'home' }
  }

  if (to.meta.requiresAudit && !session.canAudit) {
    return { name: 'home' }
  }

  if (to.meta.requiresRoomManage && !session.canManageRooms) {
    return { name: 'home' }
  }

  return true
})

export default router
