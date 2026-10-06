import { beforeEach, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import { http } from '../src/lib/api'
import { i18n } from '../src/locales'

const requests: { url?: string; body: any }[] = []
const summary = { code: 'AFF29', referral_count: 2, balance_cents: 2345, pending_cents: 0, total_earned_cents: 2345, settings: { enabled: true, rate_bps: 500, min_withdrawal_cents: 1000 } }
const views = import.meta.glob<{ default: any }>('../src/views/dashboard/*.vue')
const module = await views['../src/views/dashboard/AffiliateView.vue']?.() ?? { default: defineComponent({ template: '<div />' }) }
beforeEach(() => {
  requests.length = 0
  http.defaults.adapter = async config => {
    requests.push({ url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
    return { data: config.url === '/affiliate' ? summary : config.method === 'post' ? { id: 1, status: 'pending' } : { items: [], total: 0, page: 1, page_size: 20 }, status: 200, statusText: 'OK', headers: {}, config }
  }
})
it('shows referral stats and validates exact cents before withdrawal confirmation', async () => {
  const wrapper = mount(module.default, { global: { plugins: [createPinia(), i18n], stubs: { ConfirmDialog: { props: ['open'], template: '<button v-if="open" data-testid="confirm" @click="$emit(\'confirm\')">确认</button>' } } } })
  await flushPromises()
  expect(wrapper.text()).toContain('AFF29')
  expect(wrapper.text()).toContain('Levis 钱包')
  const amount = wrapper.find('#withdrawal-amount')
  expect(amount.exists()).toBe(true)
  await amount.setValue('10.001')
  expect(wrapper.get('[data-testid="request-withdrawal"]').attributes('disabled')).toBeDefined()
  await amount.setValue('10.29')
  await wrapper.get('[data-testid="request-withdrawal"]').trigger('click')
  expect(requests.filter(r => r.url === '/affiliate/withdrawals' && r.body)).toHaveLength(0)
  await wrapper.get('[data-testid="confirm"]').trigger('click')
  await flushPromises()
  expect(requests.find(r => r.url === '/affiliate/withdrawals' && r.body)?.body).toMatchObject({ amount_cents: 1029, account: 'Levis 钱包' })
  wrapper.unmount()
})
