import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { http } from '../src/lib/api'
import { useAuthStore } from '../src/stores/auth'
import * as utils from '../src/lib/utils'

const capture = (utils as unknown as { captureReferral?: (search: string) => void }).captureReferral
const read = (utils as unknown as { readReferral?: () => string }).readReferral

beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })
describe('persistent registration attribution', () => {
  it('keeps a URL ref across later pages without a ref', () => {
    capture?.('?ref=Aff-29'); capture?.('?category=1')
    expect(read?.()).toBe('Aff-29')
  })
  it('sends referral_code and clears it only after successful registration', async () => {
    capture?.('?ref=Aff-29')
    let payload: Record<string, string> = {}
    http.defaults.adapter = async (config) => {
      payload = JSON.parse(config.data)
      return { data: { user: { id: 1, role: 'user' } }, status: 200, statusText: 'OK', headers: {}, config }
    }
    await useAuthStore().register({ username: 'test', email: 'test@example.com', password: 'test-only-placeholder' })
    expect(payload.referral_code).toBe('Aff-29')
    expect(read?.()).toBe('')
  })
  it('preserves referral when the registration request fails', async () => {
    capture?.('?ref=Aff-29')
    http.defaults.adapter = async () => { throw new Error('offline') }
    await expect(useAuthStore().register({ username: 'test', email: 'test@example.com', password: 'test-only-placeholder' })).rejects.toThrow()
    expect(read?.()).toBe('Aff-29')
  })
})
