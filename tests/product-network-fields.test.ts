import { expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { http } from '../src/lib/api'
import { i18n } from '../src/locales'
import { productNetworkFromConfig } from '../src/lib/product-network'
const modules = import.meta.glob<{ default: any }>('../src/components/app/*.vue')
const component = await modules['../src/components/app/VirtualisProductNetworkFields.vue']?.() ?? { default: defineComponent({ template: '<div />' }) }

it('edits reusable dedicated presets and chooses upstream groups instead of a one-time IP', async () => {
  const calls: string[] = []
  http.defaults.adapter = async config => {
    calls.push(config.url ?? '')
    return { data: { items: [{ id: 3, name: 'SSH only', ingress_policy: 'drop', egress_policy: 'accept', rules: [] }] }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const wrapper = mount(component.default, { props: { modelValue: productNetworkFromConfig(), interfaceId: 2 }, global: { plugins: [i18n] } })
  await flushPromises()
  expect(calls).toEqual(['/admin/interfaces/2/security-groups'])
  await wrapper.get('[data-testid="product-network-mode"]').setValue('dedicated')
  const value = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as any
  expect(value.network_mode).toBe('dedicated')
  await wrapper.setProps({ modelValue: value })
  expect(wrapper.text()).toContain('每次开通自动分配')
  expect(wrapper.find('[name="network_ipv4"]').exists()).toBe(false)
  await wrapper.get('[data-testid="product-group-3"]').setValue(true)
  expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ security_group_ids: [3] })
  wrapper.unmount()
})
