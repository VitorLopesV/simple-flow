import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppLayout from '@/components/layouts/AppLayout.vue'
import AuthLayout from '@/components/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/authStore'

/**
 * Todas as páginas são carregadas sob demanda: o Vite gera um chunk por rota
 * automaticamente (code splitting), mantendo o bundle inicial enxuto.
 *
 * Os `path` continuam em português porque aparecem na barra de endereço do
 * usuário (e em links e favoritos já salvos); os `name` são código e ficam em inglês.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: 'login' },
  },
  {
    path: '/app',
    component: AppLayout,
    children: [
      { path: '', redirect: { name: 'dashboard' } },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/pages/Dashboard.vue'),
        meta: { title: 'Dashboard', description: 'Visão geral das suas finanças', noScroll: true },
      },
      {
        path: 'entradas',
        name: 'incomes',
        component: () => import('@/pages/Incomes.vue'),
        meta: { title: 'Entradas', description: 'Receitas registradas no período' },
      },
      {
        path: 'saidas',
        name: 'expenses',
        component: () => import('@/pages/Expenses.vue'),
        meta: { title: 'Saídas', description: 'Despesas registradas no período' },
      },
      {
        path: 'cartoes',
        name: 'cards',
        component: () => import('@/pages/CreditCards.vue'),
        meta: { title: 'Cartões de Crédito', description: 'Cartões, faturas e transações' },
      },
    ],
  },
  {
    path: '/auth',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        name: 'login',
        component: () => import('@/pages/Login.vue'),
        meta: { title: 'Login', description: 'Faça login na sua conta' },
      },
      {
        path: 'registro',
        name: 'register',
        component: () => import('@/pages/Register.vue'),
        meta: { title: 'Registro', description: 'Crie uma nova conta' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFound.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
})

router.beforeEach((to) => {
  const { isAuthenticated } = useAuthStore()
  const requiresAuth = to.path.startsWith('/app')
  const isAuthRoute = to.path.startsWith('/auth')

  if (requiresAuth && !isAuthenticated) return { name: 'login' }
  if (isAuthRoute && isAuthenticated) return { name: 'dashboard' }
})

router.afterEach(() => {
  document.title = 'SimpleFlow'
})

export default router
