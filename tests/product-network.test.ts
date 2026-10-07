import { describe, expect, it } from 'vitest'
const modules = import.meta.glob<Record<string, (...args: any[]) => any>>('../src/lib/product-network.ts')
const network = await modules['../src/lib/product-network.ts']?.()

describe('Virtualis product network presets', () => {
  it('round trips dedicated auto-allocation settings without a fixed address or buyer fields', () => {
    const saved = { network_mode: 'dedicated', dedicated_mode: 'routed', network_bridge: 'eno1', network_dns: ['1.1.1.1'], security_group_ids: [3, 5] }
    const form = network?.productNetworkFromConfig?.(saved)
    expect(form).toEqual(saved)
    expect(network?.productNetworkPayload?.(form)).toEqual(saved)
    expect(network?.productNetworkPayload?.(form)).not.toHaveProperty('ip_pool_entry_id')
    expect(network?.productNetworkPayload?.(form)).not.toHaveProperty('network_ipv4')
  })
  it('rejects duplicate, invalid and oversized group selections before saving a product', () => {
    const form = { network_mode: 'dedicated', dedicated_mode: 'routed', network_bridge: 'eno1', network_dns: ['1.1.1.1'], security_group_ids: [3] }
    expect(network?.validateProductNetwork?.(form)).toBeNull()
    for (const ids of [[3, 3], [0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1], Array.from({ length: 17 }, (_, i) => i + 1)]) {
      expect(network?.validateProductNetwork?.({ ...form, security_group_ids: ids })).toMatch(/安全组/)
    }
    expect(network?.validateProductNetwork?.({ ...form, dedicated_mode: 'bridge', network_bridge: '' })).toMatch(/网桥/)
    expect(network?.validateProductNetwork?.({ ...form, network_bridge: 'eno1;reboot' })).toMatch(/接口/)
    expect(network?.validateProductNetwork?.({ ...form, network_dns: ['1.1.1.1', '8.8.8.8', '9.9.9.9', '8.8.4.4', '1.0.0.1'] })).toMatch(/DNS/)
  })
})
