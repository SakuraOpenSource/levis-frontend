import { expect, it } from 'vitest'
import { http } from '../src/lib/api'
import * as endpoints from '../src/lib/endpoints'

const api = endpoints.serviceApi as unknown as Record<string, (...args: any[]) => any>
it('sets auto-renew explicitly and returns the authoritative raw Service', async () => {
  const calls: { url?: string; method?: string; body: any }[] = []
  http.defaults.adapter = async config => {
    const body = JSON.parse(config.data)
    calls.push({ url: config.url, method: config.method, body })
    return { data: { id: 4, auto_renew: body.auto_renew }, status: 200, statusText: 'OK', headers: {}, config }
  }
  expect(await api.setAutoRenew?.(4, false)).toEqual({ id: 4, auto_renew: false })
  expect(await api.setAutoRenew?.(4, true)).toEqual({ id: 4, auto_renew: true })
  expect(calls).toEqual([
    { url: '/services/4/auto-renew', method: 'patch', body: { auto_renew: false } },
    { url: '/services/4/auto-renew', method: 'patch', body: { auto_renew: true } },
  ])
})
