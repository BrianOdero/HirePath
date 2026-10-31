import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import TabsPage from '../views/TabsPage.vue'
import { useAuthStore } from '@/features/authentication/stores/useAuthStore';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/tab1'
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/features/authentication/views/LoginView.vue')
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/features/authentication/views/ForgotPasswordView.vue')
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/features/authentication/views/ResetPasswordView.vue')
  },
  {
    path: '/payments',
    name: 'payments',
    component: () => import('@/features/payments/views/PaymentsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/tabs/',
    component: TabsPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/tabs/tab1'
      },
      {
        path: 'tab1',
        component: () => import('@/features/interview/views/PracticeView.vue')
      },
      {
        path: 'tab2',
        component: () => import('@/features/interview/views/HistoryView.vue')
      },
      {
        path: 'tab3',
        component: () => import('@/features/settings/views/ProfileView.vue')
      },
      {
        path: 'session/:id',
        component: () => import('@/features/interview/views/SessionDetailView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to) => {
  console.log('Router navigation to:', to.path);

  try {
    const authStore = useAuthStore();
    await authStore.ensureSession();

    if (to.matched.some((record) => record.meta.requiresAuth) && !authStore.user) {
      console.log('Redirecting to login - no user');
      return { path: '/login' };
    }

    if (to.path === '/login' && authStore.user) {
      console.log('Redirecting to tabs - user already logged in');
      return { path: '/tabs/tab1' };
    }

    console.log('Navigation allowed to:', to.path);
    return true;
  } catch (error) {
    console.error('Router guard error:', error);
    // Allow navigation to continue even if auth check fails
    // This prevents getting stuck on white screen
    if (to.path !== '/login') {
      return { path: '/login' };
    }
    return true;
  }
});

export default router
