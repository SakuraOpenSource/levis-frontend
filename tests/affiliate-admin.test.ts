import { expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { i18n } from '../src/locales'
import { http } from '../src/lib/api'

const views = import.meta.glob<{ default: any }>('../src/views/admin/*.vue')
const module = await views['../src/views/admin/AffiliateView.vue']?.() ?? { default: defineComponent({ template: '<div />' }) }
it('validates admin settings and requires a confirmation before final wallet review', async () => {
  const calls: { url?: string; body: any }[] = []
  const row = { id: 9, user_id: 4, amount_cents: 1029, account: 'Levis 钱包', status: 'pending', remark: '', review_remark: '', created_at: '' }
  http.defaults.adapter = async config => {
    calls.push({ url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
    return { data: config.url?.includes('settings') ? { enabled: true, rate_bps: 500, min_withdrawal_cents: 1000 } : config.method === 'post' ? { ...row, status: 'approved' } : { items: [row], total: 1, page: 1, page_size: 20 }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const wrapper = mount(module.default, { global: { plugins: [i18n], stubs: { ConfirmDialog: { props: ['open'], template: '<button v-if="open" data-testid="confirm" @click="$emit(\'confirm\')">确认</button>' } } } })
  await flushPromises()
  expect(wrapper.text()).toContain('Levis 钱包')
  const rate = wrapper.find('#affiliate-rate')
  expect(rate.exists()).toBe(true)
  await rate.setValue('100.01')
  expect(wrapper.get('[data-testid="save-settings"]').attributes('disabled')).toBeDefined()
  await rate.setValue('5.29')
  await wrapper.get('[data-testid="approve-9"]').trigger('click')
  expect(calls.filter(c => c.url?.includes('/review'))).toHaveLength(0)
  await wrapper.get('[data-testid="confirm"]').trigger('click')
  await flushPromises()
  expect(calls.find(c => c.url?.includes('/review'))?.body).toMatchObject({ action: 'approve' })
  wrapper.unmount()
})
