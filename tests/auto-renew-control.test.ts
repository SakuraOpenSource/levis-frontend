import { expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { i18n } from '../src/locales'
import { http } from '../src/lib/api'

const views = import.meta.glob<{ default: any }>('../src/components/app/*.vue')
const module = await views['../src/components/app/AutoRenewControl.vue']?.() ?? { default: defineComponent({ template: '<div />' }) }
it('changes renewal only after confirmation and keeps the old value if the API fails', async () => {
  const calls: string[] = []
  http.defaults.adapter = async config => { calls.push(config.url!); throw new Error('offline') }
  const wrapper = mount(module.default, { props: { service: { id: 4, auto_renew: false, status: 'active', billing_cycle: 'monthly', price_cents: 1000 }, balanceCents: 29 }, global: { plugins: [i18n], stubs: { ConfirmDialog: { props: ['open'], template: '<button v-if="open" data-testid="confirm" @click="$emit(\'confirm\')">确认</button>' } } } })
  expect(wrapper.text()).toContain('余额')
  expect(wrapper.find('[role="switch"]').exists()).toBe(true)
  await wrapper.get('[role="switch"]').trigger('click')
  expect(calls).toHaveLength(0)
  await wrapper.get('[data-testid="confirm"]').trigger('click')
  await flushPromises()
  expect(calls).toContain('/services/4/auto-renew')
  expect(wrapper.emitted('updated')).toBeUndefined()
  expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('false')
  wrapper.unmount()
})
it('offers the grace-window rescue path on suspended(expired) services, mirroring the backend rule', async () => {
  // Backend auto_renew.go:12-18 allows enabling auto-renew while suspended with
  // suspend_reason "expired"; the UI must expose the same rescue path (audit F5).
  const calls: string[] = []
  http.defaults.adapter = async config => {
    calls.push(config.url!)
    if (config.url === '/services/4') return { data: { id: 4, auto_renew: true, status: 'suspended', suspend_reason: 'expired', billing_cycle: 'monthly', price_cents: 1000 }, status: 200, statusText: 'OK', headers: {}, config }
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  const service = { id: 4, auto_renew: false, status: 'suspended', suspend_reason: 'expired', billing_cycle: 'monthly', price_cents: 1000 }
  const wrapper = mount(module.default, { props: { service }, global: { plugins: [i18n], stubs: { ConfirmDialog: { props: ['open'], template: '<button v-if="open" data-testid="confirm" @click="$emit(\'confirm\')">确认</button>' } } } })
  expect(wrapper.get('[role="switch"]').attributes('disabled')).toBeUndefined()
  await wrapper.get('[role="switch"]').trigger('click')
  await wrapper.get('[data-testid="confirm"]').trigger('click')
  await flushPromises()
  expect(calls).toContain('/services/4/auto-renew')
  expect(wrapper.emitted('updated')).toHaveLength(1)
  wrapper.unmount()
})
it('keeps auto-renew unavailable for traffic-suspended and onetime services', async () => {
  http.defaults.adapter = async () => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} as any })
  const suspended = mount(module.default, { props: { service: { id: 5, auto_renew: false, status: 'suspended', suspend_reason: 'traffic', billing_cycle: 'monthly', price_cents: 1000 } }, global: { plugins: [i18n], stubs: { ConfirmDialog: { props: ['open'], template: '<div />' } } } })
  expect(suspended.get('[role="switch"]').attributes('disabled')).toBeDefined()
  suspended.unmount()
  const onetime = mount(module.default, { props: { service: { id: 6, auto_renew: false, status: 'active', suspend_reason: '', billing_cycle: 'onetime', price_cents: 1000 } }, global: { plugins: [i18n], stubs: { ConfirmDialog: { props: ['open'], template: '<div />' } } } })
  expect(onetime.get('[role="switch"]').attributes('disabled')).toBeDefined()
  onetime.unmount()
})
