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
    const data = config.url?.endsWith('snapshots') ? { items: [{ id: 8, name: 'snap-8', size_bytes: 0, status: 'ready' }] } : config.url?.endsWith('backups') ? { items: [{ id: 9, name: 'backup-9', size_bytes: 1024, status: 'ready' }] } : { items: [] }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  const wrapper = mount(module.default, { props: { serviceId: 4 }, global: { plugins: [i18n], stubs: { ConfirmDialog: confirm } } })
  await flushPromises()
  expect(wrapper.text()).toContain('大小未知')
  expect(wrapper.get('a[download]').attributes('href')).toBe('/api/services/4/backups/9/download')
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
