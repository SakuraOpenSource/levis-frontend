import { expect, it, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '../src/locales'
import { http } from '../src/lib/api'
import ServicesView from '../src/views/dashboard/ServicesView.vue'
import ServiceDetailView from '../src/views/dashboard/ServiceDetailView.vue'
vi.mock('@novnc/novnc', () => ({ default: class {} }))
const service = { id: 4, name: 'Test service', status: 'active', auto_renew: false, billing_cycle: 'monthly', price_cents: 1000, upstream_plugin_id: 'virtualis', upstream_host_id: 'host-4', options: {} }
it('renders renewal controls in service list and renewal/change/provider controls on actual detail view', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/services/:id', component: ServiceDetailView }] })
  await router.push('/services/4')
  http.defaults.adapter = async config => ({ data: config.url === '/services' ? { items: [service], total: 1, page: 1, page_size: 20 } : config.url === '/wallet' ? { balance_cents: 4000 } : config.url?.endsWith('/upstream') ? { status: 'stopped', actions: [] } : config.url === '/services/4' ? service : config.url?.endsWith('/traffic') ? { unlimited: true, used_bytes: 0, percent: 0 } : config.url?.endsWith('/metrics') ? null : config.url?.endsWith('/vnc') ? { available: false, message: 'unsupported' } : { items: [] }, status: 200, statusText: 'OK', headers: {}, config })
  const global = { plugins: [createPinia(), i18n, router], renderStubDefaultSlot: true }
  const list = shallowMount(ServicesView, { global })
  await flushPromises()
  expect(list.findComponent({ name: 'AutoRenewControl' }).exists()).toBe(true)
  list.unmount()
  const detail = shallowMount(ServiceDetailView, { global })
  await flushPromises()
  for (const name of ['AutoRenewControl', 'ProductChangePanel', 'ProviderFeaturePanel']) expect(detail.findComponent({ name }).exists()).toBe(true)
  expect(detail.findComponent({ name: 'ProductChangePanel' }).props('balanceCents')).toBe(4000)
  detail.findComponent({ name: 'ProviderFeaturePanel' }).vm.$emit('busy', true)
  await flushPromises()
  const shutdown = detail.findAllComponents({ name: 'Button' }).find(button => button.text() === '关机')
  // Button 组件未把 disabled 声明为 prop，回落为透传 attribute；两种取法都算禁用。
  const disabled = shutdown ? shutdown.props('disabled') ?? shutdown.attributes('disabled') : undefined
  expect(disabled !== undefined && disabled !== false).toBe(true)
  expect(detail.findComponent({ name: 'ProductChangePanel' }).props('disabled')).toBe(true)
  detail.unmount()
})
