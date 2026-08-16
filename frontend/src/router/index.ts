import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppLayout from '@/components/layouts/AppLayout.vue'

/**
 * Todas as páginas são carregadas sob demanda: o Vite gera um chunk por rota
 * automaticamente (code splitting), mantendo o bundle inicial enxuto.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', redirect: { name: 'dashboard' } },
      {
        path: 'pages/dashboard',
        name: 'dashboard',
        component: () => import('@/pages/Dashboard.vue'),
        meta: { titulo: 'Dashboard', descricao: 'Visão geral das suas finanças' },
      },
      {
        path: 'pages/entradas',
        name: 'entradas',
        component: () => import('@/pages/Entradas.vue'),
        meta: { titulo: 'Entradas', descricao: 'Receitas registradas no período' },
      },
      {
        path: 'pages/saidas',
        name: 'saidas',
        component: () => import('@/pages/Saidas.vue'),
        meta: { titulo: 'Saídas', descricao: 'Despesas registradas no período' },
      },
      {
        path: 'pages/cartoes',
        name: 'cartoes',
        component: () => import('@/pages/Cartoes.vue'),
        meta: { titulo: 'Cartões de Crédito', descricao: 'Cartões, faturas e transações' },
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

router.afterEach((to) => {
  const titulo = to.meta.titulo as string | undefined
  document.title = titulo ? `${titulo} · Controle Financeiro` : 'Controle Financeiro'
})

export default router
