import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { shallowMount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import DashboardLayout from '../src/layouts/DashboardLayout.vue'
import AdminLayout from '../src/layouts/AdminLayout.vue'
import { http } from '../src/lib/api'
import { i18n } from '../src/locales'
it('provides a keyboard skip link and focusable main content in shared layouts', async () => {
  http.defaults.adapter = async config => ({ data: { items: [] }, status: 200, statusText: 'OK', headers: {}, config })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] }); await router.push('/')
  for (const layout of [DashboardLayout, AdminLayout]) {
    const wrapper = shallowMount(layout, { global: { plugins: [createPinia(), i18n, router], stubs: { RouterLink: true, RouterView: true } } })
    expect(wrapper.get('a[href="#main-content"]').text()).toContain('跳至')
    expect(wrapper.get('main#main-content').attributes('tabindex')).toBe('-1')
    wrapper.unmount()
  }
})
it('turns off every animation and transition, including dialogs and spinners, for reduced motion', () => {
  const css = readFileSync(`${process.cwd()}/src/style.css`, 'utf8')
  expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\*,\s*\*::before,\s*\*::after/)
  expect(css).toContain('animation: none !important')
  expect(css).toContain('transition: none !important')
})
