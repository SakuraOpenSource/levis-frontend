<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Download, Loader2, RefreshCcw, Shield, Archive } from 'lucide-vue-next'
import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { serviceFeatureApi as api } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import type { ProviderSnapshot, ProviderBackup, ProviderFirewallRule, ProviderFirewallInput, ProviderSecurityGroupBinding } from '@/lib/types'
import { formatBytes, formatDateTime } from '@/lib/utils'

const props = withDefaults(defineProps<{ serviceId: number; disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ updated: []; busy: [value: boolean] }>()
const tab = ref('recovery')
const snapshots = ref<ProviderSnapshot[]>([])
const backups = ref<ProviderBackup[]>([])
const rules = ref<ProviderFirewallRule[]>([])
const securityGroups = ref<ProviderSecurityGroupBinding | null>(null)
const loading = ref(false)
const busy = ref(false)
const locked = computed(() => busy.value || props.disabled)
const errors = reactive({ snapshots: '', backups: '', firewall: '', securityGroups: '' })
const error = ref<string | null>(null)
const notice = ref('')
const name = ref('')
const remark = ref('')
const editingId = ref<number | null>(null)
const defaults = (): ProviderFirewallInput => ({ direction: 'in', action: 'accept', protocol: 'tcp', port_start: 22, port_end: 22, cidr: '', priority: 100, enabled: true, remark: '' })
const form = reactive<ProviderFirewallInput>(defaults())
const validName = computed(() => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name.value))
const validRule = computed(() => Number.isSafeInteger(form.priority) && form.priority >= 0 && (['any', 'icmp'].includes(form.protocol) || (Number.isInteger(form.port_start) && Number.isInteger(form.port_end) && form.port_start >= 1 && form.port_start <= form.port_end && form.port_end <= 65535)))
const pending = ref<{ title: string; description: string; danger: boolean; run: () => Promise<unknown> } | null>(null)
const confirmOpen = ref(false)
let version = 0
function ruleInput(row: ProviderFirewallInput): ProviderFirewallInput {
  return { direction: row.direction, action: row.action, protocol: row.protocol, port_start: row.port_start, port_end: row.port_end, cidr: row.cidr, priority: row.priority, enabled: row.enabled, remark: row.remark }
}
async function load() {
  const request = ++version
  const id = props.serviceId
  loading.value = true
  await Promise.all([
    api.snapshots(id).then(rows => { if (request === version) { snapshots.value = rows; errors.snapshots = '' } }).catch(err => { if (request === version) errors.snapshots = errorMessage(err) }),
    api.backups(id).then(rows => { if (request === version) { backups.value = rows; errors.backups = '' } }).catch(err => { if (request === version) errors.backups = errorMessage(err) }),
    api.firewall(id).then(rows => { if (request === version) { rules.value = rows; errors.firewall = '' } }).catch(err => { if (request === version) errors.firewall = errorMessage(err) }),
    api.securityGroups(id).then(binding => { if (request === version) { securityGroups.value = binding; errors.securityGroups = '' } }).catch(err => { if (request === version) { securityGroups.value = null; errors.securityGroups = errorMessage(err) } }),
  ])
  if (request === version) loading.value = false
}
function ask(title: string, description: string, run: () => Promise<unknown>, danger = false) {
  if (locked.value) return
  pending.value = { title, description, run, danger }
  confirmOpen.value = true
}
function askCreate(kind: 'snapshot' | 'backup') {
  if (!validName.value) return
  const id = props.serviceId
  const input = { name: name.value, remark: remark.value }
  ask(kind === 'snapshot' ? '创建快照' : '创建备份', `${input.name}：QEMU 快照及所有备份导出必须先关机；Incus 快照可在线创建。后端会检查真实电源状态。归档可能需要较长时间，不提供估算百分比。`, () => kind === 'snapshot' ? api.createSnapshot(id, input) : api.createBackup(id, input))
}
function askRestore(kind: 'snapshot' | 'backup', row: ProviderSnapshot) {
  const id = props.serviceId
  ask(`恢复${kind === 'snapshot' ? '快照' : '备份'} ${row.name}`, '必须先关机。恢复会覆盖当前磁盘数据，之后的修改将丢失；不会重装系统或重置密码。操作可能较久，请勿同时执行电源或改配操作。', () => kind === 'snapshot' ? api.restoreSnapshot(id, row.id) : api.restoreBackup(id, row.id), true)
}
function askDelete(kind: 'snapshot' | 'backup', row: ProviderSnapshot) {
  const id = props.serviceId
  ask(`删除 ${row.name}`, '仅删除此恢复点，操作不可撤销；不会删除当前服务。', () => kind === 'snapshot' ? api.deleteSnapshot(id, row.id) : api.deleteBackup(id, row.id), true)
}
function edit(row: ProviderFirewallRule) { editingId.value = row.id; Object.assign(form, ruleInput(row)) }
function resetRule() { editingId.value = null; Object.assign(form, defaults()) }
function saveRule() {
  if (!validRule.value) return
  const id = props.serviceId
  const ruleId = editingId.value
  const input = ruleInput(form)
  if (['any', 'icmp'].includes(input.protocol)) { input.port_start = 0; input.port_end = 0 }
  ask(ruleId ? '更新防火墙规则' : '创建防火墙规则', '规则可能阻断 SSH / VNC / 网络访问，请检查方向、网段和优先级。停止时保存，运行时尝试同步；同步失败必须核对规则列表。', () => ruleId ? api.updateFirewall(id, ruleId, input) : api.createFirewall(id, input))
}
function toggle(row: ProviderFirewallRule) {
  const id = props.serviceId
  const input = { ...ruleInput(row), enabled: !row.enabled }
  ask(input.enabled ? '启用规则' : '禁用规则', '将提交完整规则（保留方向、端口、优先级）。变更可能影响远程连接。', () => api.updateFirewall(id, row.id, input))
}
function deleteRule(row: ProviderFirewallRule) {
  const id = props.serviceId
  ask('删除防火墙规则', '删除后无法撤销，可能影响网络安全与连接。', () => api.deleteFirewall(id, row.id), true)
}
async function confirm() {
  if (locked.value || !pending.value || !confirmOpen.value) return
  const id = props.serviceId
  const operation = pending.value
  busy.value = true; emit('busy', true)
  error.value = null; notice.value = ''
  try {
    await operation.run()
    if (id !== props.serviceId) return
    notice.value = `${operation.title}请求完成，已重新读取上游列表。`
    confirmOpen.value = false
    name.value = ''; remark.value = ''; resetRule()
    emit('updated')
  } catch (err) {
    if (id === props.serviceId) error.value = `${errorMessage(err)}。超时或断连不代表操作未执行，请刷新列表核对后再操作。`
  } finally {
    if (id === props.serviceId) await load()
    busy.value = false; emit('busy', false)
  }
}
watch(() => props.serviceId, () => {
  snapshots.value = []; backups.value = []; rules.value = []
  securityGroups.value = null
  error.value = null; notice.value = ''; confirmOpen.value = false; pending.value = null
  name.value = ''; remark.value = ''; resetRule()
  void load()
}, { immediate: true })
onBeforeUnmount(() => { version++ })
</script>

<template>
  <Card :aria-busy="busy || loading"><CardContent class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div><h2 class="text-sm font-semibold">上游恢复与防火墙</h2><p class="mt-1 text-xs text-muted-foreground">所有请求经已登录的 Levis 服务归属校验；不提供迁移、全局批量、永久删除等管理员操作。</p></div>
      <Button variant="outline" size="sm" :disabled="locked || loading" @click="load"><RefreshCcw />刷新上游列表</Button>
    </div>
    <ErrorAlert :message="error" />
    <p v-if="notice" aria-live="polite" class="rounded-md bg-muted p-3 text-sm">{{ notice }}</p>
    <div v-if="busy" role="status" aria-live="polite" class="flex items-center gap-2 rounded-md border p-3 text-sm"><Loader2 class="size-4 animate-spin" />上游正在执行操作，请不要重复提交或操作电源。可能耗时较长；不显示虚假进度。</div>
    <Tabs v-model="tab">
      <TabsList aria-label="上游服务功能"><TabsTrigger value="recovery"><Archive />快照与备份</TabsTrigger><TabsTrigger value="firewall" data-testid="firewall-tab"><Shield />防火墙</TabsTrigger></TabsList>
      <TabsContent value="recovery" class="space-y-5">
        <p class="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">QEMU 快照、所有备份导出和所有恢复需要先关机。Incus 快照大小为 0 表示未知。下载由浏览器直接接收经过会话鉴权的流，不缓存在页面内存。</p>
        <LoadingBlock v-if="loading && !busy" :rows="2" />
        <fieldset :disabled="locked" class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5"><Label for="recovery-name">恢复点名称</Label><Input id="recovery-name" v-model="name" maxlength="64" /><p class="text-xs text-muted-foreground">1–64 位字母、数字、下划线或连字符；首字符须为字母或数字。</p></div>
          <div class="space-y-1.5"><Label for="recovery-remark">备注</Label><Input id="recovery-remark" v-model="remark" maxlength="500" /></div>
          <div class="flex gap-2 sm:col-span-2"><Button :disabled="!validName || !!errors.snapshots || loading || locked" @click="askCreate('snapshot')">创建快照</Button><Button variant="outline" :disabled="!validName || !!errors.backups || loading || locked" @click="askCreate('backup')">创建备份</Button></div>
        </fieldset>
        <section class="space-y-3" aria-label="快照列表"><h3 class="text-sm font-semibold">快照</h3><ErrorAlert :message="errors.snapshots" /><p v-if="!loading && !errors.snapshots && !snapshots.length" class="text-sm text-muted-foreground">暂无快照</p>
          <div v-for="row in snapshots" :key="row.id" class="space-y-2 rounded-lg border p-3"><p class="text-sm font-medium">{{ row.name }} · {{ row.status }}</p><p class="text-xs text-muted-foreground">{{ row.size_bytes > 0 ? formatBytes(row.size_bytes) : '大小未知' }} · {{ formatDateTime(row.created_at) }}</p><p v-if="row.remark" class="break-all text-xs">{{ row.remark }}</p><div class="flex gap-2"><Button size="sm" variant="outline" :disabled="locked || row.status !== 'ready'" :data-testid="`restore-snapshot-${row.id}`" @click="askRestore('snapshot', row)">恢复快照</Button><Button size="sm" variant="ghost" :disabled="locked" @click="askDelete('snapshot', row)">删除</Button></div></div>
        </section>
        <section class="space-y-3" aria-label="备份列表"><h3 class="text-sm font-semibold">备份</h3><ErrorAlert :message="errors.backups" /><p v-if="!loading && !errors.backups && !backups.length" class="text-sm text-muted-foreground">暂无备份</p>
          <div v-for="row in backups" :key="row.id" class="space-y-2 rounded-lg border p-3"><p class="text-sm font-medium">{{ row.name }} · {{ row.status }}</p><p class="text-xs text-muted-foreground">{{ row.size_bytes > 0 ? formatBytes(row.size_bytes) : '大小未知' }} · {{ row.driver }} · {{ formatDateTime(row.created_at) }}</p><p v-if="row.remark" class="break-all text-xs">{{ row.remark }}</p><p v-if="row.checksum" class="break-all font-mono text-xs text-muted-foreground">SHA-256：{{ row.checksum }}</p><div class="flex flex-wrap items-center gap-2"><a v-if="row.status === 'ready'" :href="api.backupDownloadUrl(serviceId, row.id)" download class="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm underline underline-offset-4 focus-visible:ring-2"><Download class="size-4" />下载归档</a><Button size="sm" variant="outline" :disabled="locked || row.status !== 'ready'" :data-testid="`restore-backup-${row.id}`" @click="askRestore('backup', row)">恢复备份</Button><Button size="sm" variant="ghost" :disabled="locked" @click="askDelete('backup', row)">删除</Button></div></div>
        </section>
      </TabsContent>
      <TabsContent value="firewall" class="space-y-4">
        <section class="space-y-3 rounded-md border p-3" aria-label="安全组与生效网络策略">
          <h3 class="text-sm font-semibold">安全组与生效网络策略</h3>
          <ErrorAlert :message="errors.securityGroups" />
          <template v-if="securityGroups && !loading">
            <p v-if="securityGroups.firewall_policy" class="text-xs text-muted-foreground">默认入站：{{ securityGroups.firewall_policy.ingress === 'drop' ? '丢弃' : '允许' }} · 默认出站：{{ securityGroups.firewall_policy.egress === 'drop' ? '丢弃' : '允许' }}</p>
            <p v-if="!securityGroups.groups.length" class="text-xs text-muted-foreground">未绑定安全组；下方为实例自定义防火墙规则。</p>
            <div v-for="group in securityGroups.groups" :key="group.id" class="rounded-md bg-muted/40 p-2 text-sm"><span class="font-medium">{{ group.name }}</span><span class="ml-2 text-xs text-muted-foreground">#{{ group.id }}</span><p v-if="group.description" class="mt-1 text-xs text-muted-foreground">{{ group.description }}</p></div>
            <p v-if="securityGroups.groups.length" class="text-xs text-muted-foreground">安全组由管理员绑定并在上游统一管理；此处只读展示。组与实例规则按上游优先级合并。</p>
            <div v-if="securityGroups.effective_rules.length" class="space-y-2"><h4 class="text-xs font-medium">合并后的生效规则</h4><p v-for="(row, index) in securityGroups.effective_rules" :key="`${row.id}-${index}`" data-testid="effective-firewall-rule" class="rounded-md border p-2 text-xs">{{ row.direction === 'in' ? '入站' : '出站' }} · {{ row.action === 'accept' ? '允许' : '丢弃' }} · {{ row.protocol }} · 端口 {{ row.port_start || '全部' }}{{ row.port_end > row.port_start ? `–${row.port_end}` : '' }} · {{ row.cidr || '所有网段' }} · 优先级 {{ row.priority }}{{ row.enabled ? '' : '（禁用）' }}</p></div>
          </template>
        </section>
        <ErrorAlert :message="errors.firewall" />
        <p class="text-xs text-muted-foreground">防火墙变更可能阻断远程连接。停机保存，运行中尝试同步；若同步失败，请刷新核对，不能将错误当成功。</p>
        <form @submit.prevent="saveRule"><fieldset :disabled="locked || !!errors.firewall || loading" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div class="space-y-1.5"><Label for="fw-direction">方向</Label><select id="fw-direction" v-model="form.direction" class="w-full rounded-md border bg-background p-2 text-sm"><option value="in">入站</option><option value="out">出站</option></select></div>
          <div class="space-y-1.5"><Label for="fw-action">动作</Label><select id="fw-action" v-model="form.action" class="w-full rounded-md border bg-background p-2 text-sm"><option value="accept">允许</option><option value="drop">丢弃</option></select></div>
          <div class="space-y-1.5"><Label for="fw-protocol">协议</Label><select id="fw-protocol" v-model="form.protocol" class="w-full rounded-md border bg-background p-2 text-sm"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="icmp">ICMP</option><option value="any">全部</option></select></div>
          <div v-if="form.protocol === 'tcp' || form.protocol === 'udp'" class="space-y-1.5"><Label for="fw-start">起始端口</Label><Input id="fw-start" v-model.number="form.port_start" type="number" min="1" max="65535" required /></div>
          <div v-if="form.protocol === 'tcp' || form.protocol === 'udp'" class="space-y-1.5"><Label for="fw-end">结束端口</Label><Input id="fw-end" v-model.number="form.port_end" type="number" min="1" max="65535" required /></div>
          <div class="space-y-1.5"><Label for="fw-cidr">对端 IPv4 CIDR（留空为全部）</Label><Input id="fw-cidr" v-model="form.cidr" placeholder="192.0.2.0/24" /></div>
          <div class="space-y-1.5"><Label for="fw-priority">优先级（小值优先）</Label><Input id="fw-priority" v-model.number="form.priority" type="number" min="0" required /></div>
          <div class="space-y-1.5"><Label for="fw-remark">备注</Label><Input id="fw-remark" v-model="form.remark" maxlength="500" /></div>
          <label class="flex items-center gap-2 text-sm"><input v-model="form.enabled" type="checkbox" />启用规则</label>
          <div class="flex gap-2 sm:col-span-2 lg:col-span-3"><Button type="submit" :disabled="!validRule || locked || !!errors.firewall || loading">{{ editingId ? '保存规则修改' : '创建规则' }}</Button><Button v-if="editingId" type="button" variant="outline" @click="resetRule">取消编辑</Button></div>
        </fieldset></form>
        <p v-if="!loading && !errors.firewall && !rules.length" class="text-sm text-muted-foreground">暂无自定义防火墙规则</p>
        <div v-for="row in rules" :key="row.id" class="space-y-2 rounded-lg border p-3"><p class="text-sm">#{{ row.id }} · {{ row.direction === 'in' ? '入站' : '出站' }} · {{ row.action === 'accept' ? '允许' : '丢弃' }} · {{ row.protocol }} · {{ row.enabled ? '已启用' : '已禁用' }}</p><p class="text-xs text-muted-foreground">端口 {{ row.port_start || '全部' }}{{ row.port_end > row.port_start ? `–${row.port_end}` : '' }} · {{ row.cidr || '所有网段' }} · 优先级 {{ row.priority }}</p><p v-if="row.remark" class="break-all text-xs">{{ row.remark }}</p><div class="flex gap-2"><Button size="sm" variant="outline" :disabled="locked" @click="edit(row)">编辑</Button><Button size="sm" variant="outline" :disabled="locked" :data-testid="`toggle-rule-${row.id}`" @click="toggle(row)">{{ row.enabled ? '禁用' : '启用' }}</Button><Button size="sm" variant="ghost" :disabled="locked" @click="deleteRule(row)">删除</Button></div></div>
      </TabsContent>
    </Tabs>
    <ConfirmDialog v-model:open="confirmOpen" :title="pending?.title ?? ''" :description="pending?.description ?? ''" :danger="pending?.danger" :confirming="busy" @confirm="confirm" />
  </CardContent></Card>
</template>
