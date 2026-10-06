import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '../src/locales'
import ConfirmDialog from '../src/components/app/ConfirmDialog.vue'
it('does not dismiss a long-running confirmation through the dialog close event', async () => {
  const wrapper = mount(ConfirmDialog, { props: { open: true, title: 'Operation', description: 'Long running', confirming: true }, global: { plugins: [i18n], stubs: { Dialog: { name: 'Dialog', template: '<div><slot /></div>' }, DialogContent: { template: '<div><slot /></div>' }, DialogTitle: { template: '<h2><slot /></h2>' }, DialogDescription: { template: '<p><slot /></p>' } } } })
  wrapper.findComponent({ name: 'Dialog' }).vm.$emit('update:open', false)
  expect(wrapper.emitted('update:open')).toBeUndefined()
  expect(wrapper.get('[role="status"]').text()).toContain('正在执行')
  wrapper.unmount()
})
