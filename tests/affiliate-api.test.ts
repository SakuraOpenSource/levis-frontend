import { beforeEach, describe, expect, it } from 'vitest'
import { http } from '../src/lib/api'
import * as endpoints from '../src/lib/endpoints'

// Fixtures follow FEATURE_API.md. This is transport testing, not provider integration.
const summary = { code: 'AFF29', referral_count: 2, balance_cents: 2345, pending_cents: 1000, total_earned_cents: 3345, settings: { enabled: true, rate_bps: 500, min_withdrawal_cents: 1000 } }
const row = { id: 1, user_id: 2, amount_cents: 1001, account: 'Levis wallet', status: 'pending', remark: '', review_remark: '', reviewed_by: 0, created_at: '' }
const calls: { url?: string; method?: string; body: unknown }[] = []
const api = (endpoints as unknown as { affiliateApi?: Record<string, (...args: any[]) => any> }).affiliateApi
beforeEach(() => {
  calls.length = 0
  document.cookie = 'levis_csrf=csrf-test'
  http.defaults.adapter = async (config) => {
    calls.push({ url: config.url, method: config.method, body: config.data ? JSON.parse(config.data) : undefined })
    expect(config.withCredentials).toBe(true)
    if (config.method !== 'get') expect(config.headers.get('X-CSRF-Token')).toBe('csrf-test')
    const data = config.url?.includes('withdrawals') ? (config.method === 'get' ? { items: [row], total: 1, page: 1, page_size: 20 } : row) : config.url?.includes('commissions') ? { items: null, total: 0, page: 1, page_size: 20 } : config.url?.includes('settings') ? summary.settings : summary
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
describe('affiliate transport', () => {
  it('returns raw summary, join, paginated ledgers and withdrawal results', async () => {
    expect(await api?.summary?.()).toEqual(summary)
    expect(await api?.join?.()).toEqual(summary)
    expect((await api?.commissions?.({ page: 1 }))?.items).toBeNull()
    expect((await api?.withdrawals?.({ page: 1 }))?.items).toEqual([row])
    expect(await api?.requestWithdrawal?.({ amount_cents: 1001, account: 'Levis wallet' })).toEqual(row)
    expect(calls.map(c => c.url)).toEqual(['/affiliate', '/affiliate/join', '/affiliate/commissions', '/affiliate/withdrawals', '/affiliate/withdrawals'])
    expect(calls.at(-1)?.body).toEqual({ amount_cents: 1001, account: 'Levis wallet' })
  })
  it('uses the admin settings and final-review endpoints without float rates', async () => {
    expect(await api?.settings?.()).toEqual(summary.settings)
    expect(await api?.saveSettings?.(summary.settings)).toEqual(summary.settings)
    expect((await api?.adminWithdrawals?.({ status: 'pending' }))?.items).toEqual([row])
    expect(await api?.review?.(1, { action: 'reject', remark: 'reason' })).toEqual(row)
    expect(calls.at(-1)).toEqual({ url: '/admin/affiliate/withdrawals/1/review', method: 'post', body: { action: 'reject', remark: 'reason' } })
  })
})
