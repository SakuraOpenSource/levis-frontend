import type { ProvisionConfig } from '@/lib/types'

/** 商品预设只有可重复使用的网络策略，不保存一次性的实例 IP 或地址池条目。 */
export interface ProductNetworkPreset {
  network_mode: 'nat' | 'dedicated'
  dedicated_mode: 'auto' | 'routed' | 'bridge'
  network_bridge: string
  network_dns: string[]
  security_group_ids: number[]
}

/** 历史商品未声明网络时继续使用 NAT；数组独立复制，取消编辑不会修改列表。 */
export function productNetworkFromConfig(config?: Partial<ProvisionConfig> | null): ProductNetworkPreset {
  return {
    network_mode: config?.network_mode ?? 'nat',
    dedicated_mode: config?.dedicated_mode ?? 'auto',
    network_bridge: config?.network_bridge ?? '',
    network_dns: [...(config?.network_dns ?? [])],
    security_group_ids: [...(config?.security_group_ids ?? [])],
  }
}

/** 显式白名单组装管理员网络配置，避免把买家字段或一次性地址混入商品。 */
export function productNetworkPayload(form: ProductNetworkPreset): ProductNetworkPreset {
  return {
    network_mode: form.network_mode,
    dedicated_mode: form.network_mode === 'dedicated' ? form.dedicated_mode : 'auto',
    network_bridge: form.network_mode === 'dedicated' ? form.network_bridge : '',
    network_dns: [...form.network_dns],
    security_group_ids: [...form.security_group_ids],
  }
}

/** 提前提示结构错误，地址与上游节点能力仍由后端最终校验。 */
export function validateProductNetwork(form: ProductNetworkPreset): string | null {
  const ids = form.security_group_ids
  if (ids.length > 16 || new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) return '安全组必须是最多 16 个不重复的有效 ID'
  if (form.network_mode !== 'nat' && form.network_mode !== 'dedicated') return '网络模式需为 NAT 或独立 IP'
  if (!['auto', 'routed', 'bridge'].includes(form.dedicated_mode)) return '独立 IP 连接方式无效'
  if (form.network_mode === 'dedicated') {
    if (form.network_bridge && !/^[a-zA-Z0-9_.-]{1,15}$/.test(form.network_bridge)) return '网络接口名称需为最多 15 位字母、数字、点、下划线或连字符'
    if (form.dedicated_mode === 'bridge' && !form.network_bridge) return '网桥模式必须指定已存在的 Linux 网桥'
  }
  if (form.network_dns.length > 4 || form.network_dns.some(value => !value || /[\s,]/.test(value))) return 'DNS 最多填写 4 个地址，使用逗号分隔'
  return null
}
