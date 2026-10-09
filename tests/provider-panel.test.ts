import { expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { i18n } from '../src/locales'
import { http } from '../src/lib/api'
const modules = import.meta.glob<{ default: any }>('../src/components/app/*.vue')
const module = await modules['../src/components/app/ProviderFeaturePanel.vue']?.() ?? { default: defineComponent({ template: '<div />' }) }
const confirm = { props: ['open'], template: '<button v-if="open" data-testid="confirm" @click="$emit(\'confirm\')">确认</button>' }
it('loads customer recovery data, confirms restore, and keeps authenticated downloads native', async () => {
  const calls: { url?: string; body: any }[] = []
  let finish: (() => void) | undefined
  http.defaults.adapter = async config => {
    calls.push({ url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
    if (config.url?.endsWith('backup_restore')) await new Promise<void>(resolve => { finish = resolve })
    const data = config.url?.endsWith('snapshots') ? { items: [{ id: 8, name: 'snap-8', size_bytes: 0, status: 'available' }, { id: 7, name: 'snap-7', size_bytes: 4096, status: 'creating' }] } : config.url?.endsWith('backups') ? { items: [{ id: 9, name: 'backup-9', size_bytes: 1024, status: 'available' }] } : { items: [] }
    // "available" is the provider success state the Virtualis backend actually
    // persists; fixtures using the legacy alias "ready" hid the broken status
    // checks (audit PLG-F03), so this test pins the literal.
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  const wrapper = mount(module.default, { props: { serviceId: 4 }, global: { plugins: [i18n], stubs: { ConfirmDialog: confirm } } })
  await flushPromises()
  expect(wrapper.text()).toContain('大小未知')
  expect(wrapper.get('a[download]').attributes('href')).toBe('/api/services/4/backups/9/download')
  // Success-state rows expose an enabled restore control; in-progress rows stay locked.
  expect(wrapper.get('[data-testid="restore-backup-9"]').attributes('disabled')).toBeUndefined()
  expect(wrapper.get('[data-testid="restore-snapshot-8"]').attributes('disabled')).toBeUndefined()
  expect(wrapper.get('[data-testid="restore-snapshot-7"]').attributes('disabled')).toBeDefined()
  expect(wrapper.findAll('a[download]')).toHaveLength(1)
  await wrapper.get('[data-testid="restore-backup-9"]').trigger('click')
  expect(calls.some(c => c.url?.endsWith('backup_restore'))).toBe(false)
  await wrapper.get('[data-testid="confirm"]').trigger('click'); await flushPromises()
  expect(calls.find(c => c.url?.endsWith('backup_restore'))?.body).toEqual({ backup_id: 9 })
  expect(wrapper.get('[role="status"]').text()).toContain('不要重复')
  expect(wrapper.get('[data-testid="restore-backup-9"]').attributes('disabled')).toBeDefined()
  finish?.(); await flushPromises()
  wrapper.unmount()
})
it('surfaces unsupported/error states and sends complete false-preserving firewall updates', async () => {
  const calls: any[] = []
  const rule = { id: 10, direction: 'out', action: 'drop', protocol: 'any', port_start: 0, port_end: 0, cidr: '', priority: 5, enabled: true, remark: 'test' }
  http.defaults.adapter = async config => {
    calls.push({ url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
    if (config.url?.endsWith('snapshots')) throw { response: { status: 400, data: { code: 'BAD_REQUEST', message: 'plugin does not support recovery' } } }
    return { data: config.url?.endsWith('firewall') ? { items: [rule] } : { items: [] }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const wrapper = mount(module.default, { props: { serviceId: 4 }, global: { plugins: [i18n], stubs: { ConfirmDialog: confirm } } })
  await flushPromises()
  expect(wrapper.text()).toContain('plugin does not support recovery')
  await wrapper.get('[data-testid="firewall-tab"]').trigger('keydown', { key: 'Enter' }); await flushPromises()
  await wrapper.get('[data-testid="toggle-rule-10"]').trigger('click')
  await wrapper.get('[data-testid="confirm"]').trigger('click'); await flushPromises()
  expect(calls.find(c => c.url?.endsWith('firewall_update'))?.body).toEqual({ ...rule, enabled: false, rule_id: 10, id: undefined })
  wrapper.unmount()
})
it('displays inherited security group defaults and effective rules without global write controls', async () => {
  const calls: string[] = []
  http.defaults.adapter = async config => {
    calls.push(config.url ?? '')
    const data = config.url?.endsWith('security_groups') ? { security_group_ids: [3], groups: [{ id: 3, name: 'SSH only', description: '管理员网络模板', ingress_policy: 'drop', egress_policy: 'accept', rules: [] }], effective_rules: [{ id: 10, direction: 'in', protocol: 'tcp', action: 'accept', port_start: 22, port_end: 22, enabled: true, priority: 100, cidr: '', remark: '' }], firewall_policy: { ingress: 'drop', egress: 'accept' } } : { items: [] }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  const wrapper = mount(module.default, { props: { serviceId: 4 }, global: { plugins: [i18n], stubs: { ConfirmDialog: confirm } } })
  await flushPromises()
  await wrapper.get('[data-testid="firewall-tab"]').trigger('keydown', { key: 'Enter' }); await flushPromises()
  expect(calls).toContain('/services/4/features/security_groups')
  expect(wrapper.text()).toContain('SSH only')
  expect(wrapper.text()).toContain('默认入站：丢弃')
  expect(wrapper.text()).toContain('默认出站：允许')
  expect(wrapper.find('[data-testid="detach-security-group"]').exists()).toBe(false)
  wrapper.unmount()
})
