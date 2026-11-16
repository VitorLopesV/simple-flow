import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import AppSidebar from '@/components/layouts/AppSidebar.vue'

const stub = { render: () => null }

async function mountSidebar(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['home', 'dashboard', 'incomes', 'expenses', 'cards', 'tasks', 'routine', 'sprint'].map((name) => ({
      path: `/${name}`,
      name,
      component: stub,
    })),
  })
  await router.push(initialPath)
  await router.isReady()
  return mount(AppSidebar, { props: { open: true }, global: { plugins: [router] } })
}

describe('AppSidebar', () => {
  it('agrupa os itens por módulo, com Início no topo', async () => {
    const wrapper = await mountSidebar('/home')

    const sections = wrapper.findAll('nav section')
    expect(sections[0]?.text()).toBe('Início')
    expect(sections[0]?.find('h2').exists()).toBe(false)
    expect(sections[1]?.find('h2').text()).toBe('Finanças')
    expect(sections[1]?.findAll('a').map((a) => a.text())).toEqual([
      'Dashboard',
      'Entradas',
      'Saídas',
      'Cartões',
    ])
  })

  it('associa o título do grupo à seção por aria-labelledby', async () => {
    const wrapper = await mountSidebar('/home')

    const section = wrapper.findAll('nav section')[1]!
    const heading = section.find('h2')
    expect(section.attributes('aria-labelledby')).toBe(heading.attributes('id'))
  })

  it('marca apenas o item da rota ativa com aria-current', async () => {
    const wrapper = await mountSidebar('/incomes')

    const current = wrapper.findAll('a[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]?.text()).toBe('Entradas')
  })

  it('a logo leva para a Home', async () => {
    const wrapper = await mountSidebar('/cards')

    expect(wrapper.find('aside a').attributes('href')).toBe('/home')
  })
})
