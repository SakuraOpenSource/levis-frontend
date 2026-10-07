<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import type { ProductNetworkPreset } from '@/lib/product-network'
import type { ProviderSecurityGroup } from '@/lib/types'

const props = defineProps<{ modelValue: ProductNetworkPreset; interfaceId: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: ProductNetworkPreset] }>()
const groups = ref<ProviderSecurityGroup[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
let version = 0
function update<K extends keyof ProductNetworkPreset>(key: K, value: ProductNetworkPreset[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
const dns = computed({
  get: () => props.modelValue.network_dns.join(', '),
  set: (value: string) => update('network_dns', value.split(',').map(item => item.trim()).filter(Boolean)),
})
const missingIDs = computed(() => props.modelValue.security_group_ids.filter(id => !groups.value.some(group => group.id === id)))
function toggleGroup(id: number, selected: boolean) {
  const ids = props.modelValue.security_group_ids
  if (selected && (ids.includes(id) || ids.length >= 16)) return
  update('security_group_ids', selected ? [...ids, id] : ids.filter(value => value !== id))
}
async function loadGroups() {
  const request = ++version
  const id = props.interfaceId
  groups.value = []; error.value = null
  if (!id) { loading.value = false; return }
  loading.value = true
  try {
    const rows = await adminApi.interfaceSecurityGroups(id)
    if (request === version) groups.value = rows
  } catch (err) {
    if (request === version) error.value = errorMessage(err)
  } finally {
    if (request === version) loading.value = false
  }
}
watch(() => props.interfaceId, () => { void loadGroups() }, { immediate: true })
onBeforeUnmount(() => { version++ })
</script>

<template>
  <section class="space-y-3 rounded-md border p-3" aria-label="Virtualis 商品网络预设">
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label for="product-network-mode">商品网络类型</Label>
        <select id="product-network-mode" data-testid="product-network-mode" :value="modelValue.network_mode" class="w-full rounded-md border bg-background p-2 text-sm" @change="update('network_mode', ($event.target as HTMLSelectElement).value as ProductNetworkPreset['network_mode'])">
          <option value="nat">NAT（共享出口，按配额分配端口）</option>
          <option value="dedicated">独立 IPv4（地址池自动分配）</option>
        </select>
      </div>
      <div v-if="modelValue.network_mode === 'dedicated'" class="space-y-1.5">
        <Label for="product-dedicated-mode">独立 IP 连接方式</Label>
        <select id="product-dedicated-mode" :value="modelValue.dedicated_mode" class="w-full rounded-md border bg-background p-2 text-sm" @change="update('dedicated_mode', ($event.target as HTMLSelectElement).value as ProductNetworkPreset['dedicated_mode'])">
          <option value="auto">自动识别（物理口使用路由式）</option>
          <option value="routed">路由式（不搬动宿主公网地址）</option>
          <option value="bridge">现有 Linux 网桥</option>
        </select>
      </div>
      <div v-if="modelValue.network_mode === 'dedicated'" class="space-y-1.5">
        <Label for="product-network-uplink">宿主接口／网桥</Label>
        <Input id="product-network-uplink" :model-value="modelValue.network_bridge" maxlength="15" placeholder="留空使用地址池默认接口" @update:model-value="update('network_bridge', String($event))" />
      </div>
      <div class="space-y-1.5">
        <Label for="product-network-dns">DNS（可选，最多 4 个）</Label>
        <Input id="product-network-dns" v-model="dns" placeholder="1.1.1.1, 8.8.8.8" />
      </div>
    </div>
    <p v-if="modelValue.network_mode === 'dedicated'" class="text-xs text-muted-foreground">每次开通自动分配所选节点地址池中的空闲 IP；商品不绑定一次性地址。请先在 Virtualis 配置地址池与上游路由，池耗尽时开通会明确报错。路由式网关由被控自动配置，现有网桥使用地址池网关。</p>
    <p v-else class="text-xs text-muted-foreground">NAT 使用共享公网出口；端口转发数量由商品配额控制。网络预设由管理员固定，买家选配不会覆盖这些字段。</p>
    <div class="flex items-center justify-between gap-2"><Label>开通时绑定的安全组</Label><Button type="button" variant="ghost" size="sm" :disabled="loading" @click="loadGroups">{{ loading ? '正在读取…' : '刷新安全组' }}</Button></div>
    <ErrorAlert :message="error" />
    <p v-if="!loading && !error && !groups.length" class="text-xs text-muted-foreground">上游暂无安全组；可在 Virtualis 管理控制台创建后刷新。</p>
    <label v-for="group in groups" :key="group.id" class="flex items-start gap-2 rounded-md border p-2 text-sm">
      <input type="checkbox" class="mt-1" :data-testid="`product-group-${group.id}`" :checked="modelValue.security_group_ids.includes(group.id)" :disabled="loading || (!modelValue.security_group_ids.includes(group.id) && modelValue.security_group_ids.length >= 16)" @change="toggleGroup(group.id, ($event.target as HTMLInputElement).checked)" />
      <span>{{ group.name }} <span class="text-xs text-muted-foreground">#{{ group.id }} · 默认入站 {{ group.ingress_policy === 'drop' ? '丢弃' : '允许' }}／出站 {{ group.egress_policy === 'drop' ? '丢弃' : '允许' }}</span></span>
    </label>
    <div v-for="id in missingIDs" :key="id" class="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>已保存的安全组 #{{ id }} 未出现在当前清单中，请核对上游，不会自动丢弃。</span><Button type="button" size="sm" variant="ghost" @click="toggleGroup(id, false)">移除预设</Button></div>
    <p class="text-xs text-muted-foreground">最多 16 个安全组。组规则由上游统一管理、开通时绑定，服务页只读展示绑定和生效规则。</p>
  </section>
</template>
