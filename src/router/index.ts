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
          meta: { roles: ['teacher'] },
        },
        {
          path: 'reservation/long',
          name: 'reservation-long',
          component: () => import('@/views/LongReservationApplyView.vue'),
          meta: { roles: ['teacher'] },
        },
        {
          path: 'reservation/long/rooms',
          name: 'reservation-long-rooms',
          component: () => import('@/views/LongReservationRoomsView.vue'),
          meta: { roles: ['teacher'] },
        },
        {
          path: 'reservation/long/confirm',
          name: 'reservation-long-confirm',
          component: () => import('@/views/LongReservationConfirmView.vue'),
          meta: { roles: ['teacher'] },
        },
        {
          path: 'reservation/mine',
          name: 'reservation-mine',
          component: () => import('@/views/MyReservationsView.vue'),
          meta: { roles: ['teacher'] },
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
          meta: { roles: ['admin'] },
        },
        {
          path: 'rooms-admin',
          name: 'rooms-admin',
          component: () => import('@/views/RoomsAdminView.vue'),
          meta: { roles: ['admin'] },
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

  const allowedRoles = to.meta.roles as string[] | undefined
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return { name: 'home' }
  }

  return true
})

export default router
