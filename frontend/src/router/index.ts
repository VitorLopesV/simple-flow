import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppLayout from '@/components/layouts/AppLayout.vue'
import AuthLayout from '@/components/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/authStore'

/**
 * Todas as páginas são carregadas sob demanda: o Vite gera um chunk por rota
 * automaticamente (code splitting), mantendo o bundle inicial enxuto.
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
        meta: { titulo: 'Dashboard', descricao: 'Visão geral das suas finanças' },
      },
      {
        path: 'entradas',
        name: 'entradas',
        component: () => import('@/pages/Entradas.vue'),
        meta: { titulo: 'Entradas', descricao: 'Receitas registradas no período' },
      },
      {
        path: 'saidas',
        name: 'saidas',
        component: () => import('@/pages/Saidas.vue'),
        meta: { titulo: 'Saídas', descricao: 'Despesas registradas no período' },
      },
      {
        path: 'cartoes',
        name: 'cartoes',
        component: () => import('@/pages/Cartoes.vue'),
        meta: { titulo: 'Cartões de Crédito', descricao: 'Cartões, faturas e transações' },
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
        meta: { titulo: 'Login', descricao: 'Faça login na sua conta' },
      },
      {
        path: 'registro',
        name: 'registro',
        component: () => import('@/pages/Register.vue'),
        meta: { titulo: 'Registro', descricao: 'Crie uma nova conta' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'nao-encontrado',
    component: () => import('@/pages/NotFound.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
})

router.beforeEach((to) => {
  const { autenticado } = useAuthStore()
  const exigeAuth = to.path.startsWith('/app')
  const ehRotaDeAuth = to.path.startsWith('/auth')

  if (exigeAuth && !autenticado) return { name: 'login' }
  if (ehRotaDeAuth && autenticado) return { name: 'dashboard' }
})

router.afterEach((to) => {
  const titulo = to.meta.titulo as string | undefined
  document.title = titulo ? `SimpleFlow · ${titulo}` : 'SimpleFlow'
})

export default router
