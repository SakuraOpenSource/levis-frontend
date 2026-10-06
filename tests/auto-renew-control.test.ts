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
