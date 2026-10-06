import { expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import router from '../src/router'
import DashboardLayout from '../src/layouts/DashboardLayout.vue'
import AdminLayout from '../src/layouts/AdminLayout.vue'
import SidebarNav from '../src/components/app/SidebarNav.vue'
import { i18n } from '../src/locales'
import { http } from '../src/lib/api'

it('registers authenticated AFF routes and links in both shared navigation layouts', () => {
  setActivePinia(createPinia())
  expect(router.hasRoute('affiliate')).toBe(true)
  expect(router.resolve('/dashboard/affiliate').meta.requiresAuth).toBe(true)
  expect(router.hasRoute('admin-affiliate')).toBe(true)
  expect(router.resolve('/admin/affiliate').meta.requiresAdmin).toBe(true)
  http.defaults.adapter = async config => ({ data: { items: [] }, status: 200, statusText: 'OK', headers: {}, config })
  for (const [layout, routeName] of [[DashboardLayout, 'affiliate'], [AdminLayout, 'admin-affiliate']] as const) {
    const wrapper = shallowMount(layout, { global: { plugins: [createPinia(), i18n, router], mocks: { $route: { fullPath: '' } }, stubs: { RouterLink: true, RouterView: true } } })
    const nav = wrapper.findComponent(SidebarNav)
    const items = nav.props('items').flatMap((item: any) => item.children ?? [item])
    expect(items.some((item: any) => item.to?.name === routeName)).toBe(true)
    wrapper.unmount()
  }
})
