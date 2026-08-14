import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'

/**
 * 路由元信息：
 * - requiresAuth 需登录
 * - requiresAdmin 需管理员（隐含 requiresAuth）
 * - guestOnly 已登录用户不应看到（登录、注册）
 * - public 不做任何登录态检查
 */
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    guestOnly?: boolean
    installPage?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/install',
    name: 'install',
    component: () => import('@/views/InstallView.vue'),
    meta: { installPage: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/SiteLayout.vue'),
    children: [
      { path: '', redirect: { name: 'shop' } },
      { path: 'shop', name: 'shop', component: () => import('@/views/ShopView.vue') },
      {
        path: 'cart',
        name: 'cart',
        component: () => import('@/views/CartView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'checkout/:id?',
        name: 'checkout',
        component: () => import('@/views/CheckoutView.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },
  {
    path: '/dashboard',
    component: () => import('@/layouts/DashboardLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/dashboard/HomeView.vue'),
      },
      {
        path: 'services',
        name: 'services',
        component: () => import('@/views/dashboard/ServicesView.vue'),
      },
      {
        path: 'services/:id',
        name: 'service-detail',
        component: () => import('@/views/dashboard/ServiceDetailView.vue'),
      },
      {
        path: 'wallet',
        name: 'wallet',
        component: () => import('@/views/dashboard/WalletView.vue'),
      },
      {
        path: 'invoices',
        name: 'invoices',
        component: () => import('@/views/dashboard/InvoicesView.vue'),
      },
      {
        path: 'invoices/:id',
        name: 'invoice-detail',
        component: () => import('@/views/dashboard/InvoiceDetailView.vue'),
      },
      {
        path: 'security',
        name: 'security',
        component: () => import('@/views/dashboard/SecurityView.vue'),
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      { path: '', name: 'admin', component: () => import('@/views/admin/OverviewView.vue') },
      { path: 'users', name: 'admin-users', component: () => import('@/views/admin/UsersView.vue') },
      {
        path: 'users/:id/services',
        name: 'admin-user-services',
        component: () => import('@/views/admin/UserServicesView.vue'),
      },
      {
        path: 'categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/CategoriesView.vue'),
      },
      {
        path: 'products',
        name: 'admin-products',
        component: () => import('@/views/admin/ProductsView.vue'),
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: () => import('@/views/admin/SettingsView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const site = useSiteStore()
  const auth = useAuthStore()

  // bootstrap 决定「是否已安装」，也是 CSRF 令牌的播种时机，必须先跑。
  // 拿不到（后端未启动）时放行，让页面自己显示网络错误，
  // 否则用户会被卡在一个同样打不开的安装页上。
  try {
    await site.load()
  } catch {
    return true
  }

  if (!site.installed) {
    return to.meta.installPage ? true : { name: 'install' }
  }
  // 已安装后安装页不应再可达，否则会误导用户重复安装。
  if (to.meta.installPage) {
    return { name: 'shop' }
  }

  const needsUser = to.meta.requiresAuth || to.meta.requiresAdmin || to.meta.guestOnly
  if (needsUser) {
    await auth.restore()
  }

  if (to.meta.guestOnly && auth.isLoggedIn) {
    return { name: auth.isAdmin ? 'admin' : 'dashboard' }
  }

  if ((to.meta.requiresAuth || to.meta.requiresAdmin) && !auth.isLoggedIn) {
    // 记下来源，登录后跳回去。
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
