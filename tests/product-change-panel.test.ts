import { expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { http } from '../src/lib/api'
import { i18n } from '../src/locales'

const views = import.meta.glob<{ default: any }>('../src/components/app/*.vue')
const module = await views['../src/components/app/ProductChangePanel.vue']?.() ?? { default: defineComponent({ template: '<div />' }) }
it('previews cents before confirmation and shows uncertain operations with a correlated retry', async () => {
  const calls: { url?: string; body: any }[] = []
  const service = { id: 4, name: 'Test', billing_cycle: 'monthly', price_cents: 1000, status: 'active', product_id: 1 }
  const change = { id: 8, service_id: 4, product_id: 2, status: 'uncertain', operation_id: 'op-8', charge_cents: 29, credit_cents: 0, error: 'provider timeout', options: {} }
  let changed = false
  http.defaults.adapter = async config => {
    calls.push({ url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
    const data = config.url?.endsWith('change-options') ? { items: [{ id: 2, name: 'Target', price_cents: 2000, provision_config: null, specs: [] }] } : config.url?.endsWith('change-preview') ? { product_id: 2, charge_cents: 29, credit_cents: 0, remaining_seconds: 15, total_seconds: 30, price_cents: 2000, options: {} } : config.url?.endsWith('changes') ? { items: changed ? [change] : [] } : config.url?.endsWith('/change') ? (changed = true, { change, service }) : service
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  const wrapper = mount(module.default, { props: { service, balanceCents: 1000 }, global: { plugins: [i18n], stubs: { ConfirmDialog: { props: ['open'], template: '<button v-if="open" data-testid="confirm" @click="$emit(\'confirm\')">确认</button>' } } } })
  await flushPromises()
  expect(wrapper.find('#target-product').exists()).toBe(true)
  await wrapper.get('#target-product').setValue('2')
  await new Promise(r => setTimeout(r, 400)); await flushPromises()
  expect(wrapper.text()).toContain('¥0.29')
  await wrapper.get('[data-testid="change-product"]').trigger('click'); await flushPromises()
  expect(calls.some(c => c.url?.endsWith('/change'))).toBe(false)
  await wrapper.get('[data-testid="confirm"]').trigger('click'); await flushPromises()
  expect(calls.find(c => c.url?.endsWith('/change'))?.body).toMatchObject({ product_id: 2 })
  expect(wrapper.text()).toContain('需要核对')
  expect(wrapper.find('[data-testid="retry-change-8"]').exists()).toBe(true)
  wrapper.unmount()
})
it('prevents a second new change when the first outcome and durable history cannot be verified', async () => {
  let submitted = false
  http.defaults.adapter = async config => {
    if (config.url?.endsWith('/change')) { submitted = true; throw new Error('lost reply') }
    if (submitted && config.url?.endsWith('/changes')) throw new Error('history unavailable')
    const data = config.url?.endsWith('change-options') ? { items: [{ id: 2, name: 'Target', price_cents: 2000, provision_config: null }] } : config.url?.endsWith('change-preview') ? { product_id: 2, charge_cents: 29, credit_cents: 0, remaining_seconds: 15, total_seconds: 30, price_cents: 2000, options: {} } : { items: [] }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  const wrapper = mount(module.default, { props: { service: { id: 4 }, balanceCents: 1000 }, global: { plugins: [i18n], stubs: { ConfirmDialog: { props: ['open'], template: '<button v-if="open" data-testid="confirm" @click="$emit(\'confirm\')">确认</button>' } } } })
  await flushPromises(); await wrapper.get('#target-product').setValue('2')
  await new Promise(r => setTimeout(r, 400)); await flushPromises()
  await wrapper.get('[data-testid="change-product"]').trigger('click'); await flushPromises()
  await wrapper.get('[data-testid="confirm"]').trigger('click'); await flushPromises()
  expect(wrapper.get('[data-testid="change-product"]').attributes('disabled')).toBeDefined()
  wrapper.unmount()
})
it('shows the backend quote clock without inventing time or replacing returned remaining seconds', async () => {
  http.defaults.adapter = async config => ({ data: config.url?.endsWith('change-options') ? { items: [{ id: 2, name: 'Target', price_cents: 2000, provision_config: null }] } : config.url?.endsWith('change-preview') ? { product_id: 2, now_s: 1700000000, charge_cents: 29, credit_cents: 0, remaining_seconds: 15, total_seconds: 30, price_cents: 2000, options: {} } : { items: [] }, status: 200, statusText: 'OK', headers: {}, config })
  const wrapper = mount(module.default, { props: { service: { id: 4 }, balanceCents: 1000 }, global: { plugins: [i18n], stubs: { ConfirmDialog: true } } })
  await flushPromises(); await wrapper.get('#target-product').setValue('2')
  await new Promise(r => setTimeout(r, 400)); await flushPromises()
  expect(wrapper.text()).toContain('1700000000')
  expect(wrapper.text()).toContain('剩余 15 秒')
  wrapper.unmount()
})
it('blocks unsafe fractional/negative quote time instead of allowing a misleading confirmation', async () => {
  http.defaults.adapter = async config => ({ data: config.url?.endsWith('change-options') ? { items: [{ id: 2, name: 'Target', price_cents: 2000, provision_config: null }] } : config.url?.endsWith('change-preview') ? { product_id: 2, now_s: 1700000000, charge_cents: 29, credit_cents: 0, remaining_seconds: -1, total_seconds: 30, price_cents: 2000, options: {} } : { items: [] }, status: 200, statusText: 'OK', headers: {}, config })
  const wrapper = mount(module.default, { props: { service: { id: 4 }, balanceCents: 1000 }, global: { plugins: [i18n], stubs: { ConfirmDialog: true } } })
  await flushPromises(); await wrapper.get('#target-product').setValue('2')
  await new Promise(r => setTimeout(r, 400)); await flushPromises()
  expect(wrapper.get('[data-testid="change-product"]').attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('报价')
  wrapper.unmount()
})
