import { expect, it } from 'vitest'
import { http } from '../src/lib/api'
import { serviceApi } from '../src/lib/endpoints'

const api = serviceApi as unknown as Record<string, (...args: any[]) => any>
it('quotes and changes eligible products with correlated retry and durable history', async () => {
  const calls: { url?: string; body: any }[] = []
  const result = { change: { id: 8, status: 'uncertain', operation_id: 'op-8', charge_cents: 29, credit_cents: 0 }, service: { id: 4 } }
  const quote = { product_id: 2, charge_cents: 29, credit_cents: 0, remaining_seconds: 15, total_seconds: 30, price_cents: 1000, options: { cpu: '2' } }
  http.defaults.adapter = async config => {
    calls.push({ url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
    const data = config.url?.endsWith('change-options') ? { items: null } : config.url?.endsWith('change-preview') ? quote : config.url?.endsWith('changes') ? { items: [result.change] } : result
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  expect(await api.changeOptions?.(4)).toEqual([])
  expect(await api.changePreview?.(4, { product_id: 2, options: { cpu: '2' } })).toEqual(quote)
  expect(await api.changeProduct?.(4, { product_id: 2, options: quote.options, idempotency_key: 'request-8' })).toEqual(result)
  expect(await api.retryChange?.(4, 8)).toEqual(result)
  expect(await api.changes?.(4)).toEqual([result.change])
  expect(calls.map(c => c.url)).toEqual(['/services/4/change-options', '/services/4/change-preview', '/services/4/change', '/services/4/change/8/retry', '/services/4/changes'])
  expect(calls[2]?.body).toEqual({ product_id: 2, options: { cpu: '2' }, idempotency_key: 'request-8' })
})
