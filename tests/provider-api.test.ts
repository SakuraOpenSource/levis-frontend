import { expect, it } from 'vitest'
import { http } from '../src/lib/api'
import * as endpoints from '../src/lib/endpoints'
const api = (endpoints as unknown as { serviceFeatureApi?: Record<string, (...args: any[]) => any> }).serviceFeatureApi
it('uses fixed customer feature actions and authenticated download links', async () => {
  const calls: { url?: string; method?: string; body: any }[] = []
  http.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, body: config.data ? JSON.parse(config.data) : undefined })
    return { data: config.method === 'get' ? { items: null } : {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  expect(await api?.snapshots?.(4)).toEqual([])
  expect(await api?.backups?.(4)).toEqual([])
  expect(await api?.firewall?.(4)).toEqual([])
  await api?.createSnapshot?.(4, { name: 'snap-1', remark: '' })
  await api?.restoreSnapshot?.(4, 8)
  await api?.deleteBackup?.(4, 9)
  await api?.updateFirewall?.(4, 10, { direction: 'out', action: 'drop', protocol: 'any', enabled: false, port_start: 0, port_end: 0, priority: 5, cidr: '', remark: '' })
  expect(calls.map(c => c.url)).toEqual(['/services/4/features/snapshots', '/services/4/features/backups', '/services/4/features/firewall', '/services/4/features/snapshot_create', '/services/4/features/snapshot_restore', '/services/4/features/backup_delete', '/services/4/features/firewall_update'])
  expect(calls[4]?.body).toEqual({ snapshot_id: 8 })
  expect(calls[6]?.body).toMatchObject({ rule_id: 10, direction: 'out', enabled: false })
  expect(api?.backupDownloadUrl?.(4, 9)).toBe('/api/services/4/backups/9/download')
  expect(api?.purge).toBeUndefined()
  expect(api?.migrate).toBeUndefined()
})
