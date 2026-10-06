<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowRightLeft, Loader2, RefreshCcw } from 'lucide-vue-next'
import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { serviceApi } from '@/lib/endpoints'
import type { Product, ProductChange, ProductChangeInput, ProductChangeQuote, Service } from '@/lib/types'
import { formatCents, formatDateTime } from '@/lib/utils'

const props = withDefaults(defineProps<{ service: Service; balanceCents?: number | null; disabled?: boolean }>(), { balanceCents: null, disabled: false })
const emit = defineEmits<{ updated: [service: Service]; busy: [value: boolean] }>()
const toast = useToast()
const products = ref<Product[]>([])
const records = ref<ProductChange[]>([])
const historyVerified = ref(false)
const selectedId = ref('')
const inputs = ref<Record<string, string>>({})
const loading = ref(false)
const quoting = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const quoteError = ref<string | null>(null)
const quote = ref<ProductChangeQuote | null>(null)
const confirmOpen = ref(false)
const retryTarget = ref<ProductChange | null>(null)
const confirmedInput = ref<ProductChangeInput | null>(null)
const confirmedQuote = ref<ProductChangeQuote | null>(null)
let quoteVersion = 0
let loadVersion = 0
let debounce: ReturnType<typeof setTimeout> | null = null
let requestKey = ''
const target = computed(() => products.value.find(p => p.id === Number(selectedId.value)))
const fields = [
  { key: 'cpu', label: 'CPU（核）' }, { key: 'memory_mb', label: '内存（MB）' },
  { key: 'disk_gb', label: '磁盘（GB）' }, { key: 'bandwidth_mbps', label: '带宽（Mbps）' },
  { key: 'traffic_gb', label: '周期流量（GB）' },
] as const
const elasticFields = computed(() => target.value?.provision_config?.mode === 'elastic' ? fields.map(f => ({ ...f, range: target.value!.provision_config![f.key] })) : [])
const validInputs = computed(() => !!target.value && elasticFields.value.every(f => {
  const text = inputs.value[f.key] ?? ''
  if (!/^\d+(?:\.\d+)?$/.test(text)) return false
  const value = Number(text)
  const step = f.range.step || 1
  const n = (value - f.range.min) / step
  return Number.isFinite(value) && value >= f.range.min && value <= f.range.max && Math.abs(n - Math.round(n)) < 1e-7
}))
const unsettled = computed(() => records.value.some(r => ['reserved', 'applying', 'uncertain'].includes(r.status)))
const canChange = computed(() => !props.disabled && !busy.value && !quoting.value && historyVerified.value && !unsettled.value && validInputs.value && !!quote.value &&
  (props.balanceCents === null || props.balanceCents >= quote.value.charge_cents))
const labels = { reserved: '已预留 · 等待执行', applying: '上游处理中 · 请核对', uncertain: '需要核对 · 可重试', applied: '已完成', failed: '已失败 · 费用已补偿' }
const description = computed(() => {
  if (retryTarget.value) return `核对并重试操作 #${retryTarget.value.id}（${retryTarget.value.operation_id}）。沿用同一持久化操作，不创建新的重复扣款。若上游已完成，会先核对实际资源。`
  const q = confirmedQuote.value
  return q ? `确认切换到 ${target.value?.name ?? `商品 #${q.product_id}`}。本次预估扣款 ${formatCents(q.charge_cents)}，成功后返还钱包 ${formatCents(q.credit_cents)}；剩余周期 ${q.remaining_seconds} 秒。最终金额以提交时后端重算及操作记录为准。请先关机；磁盘不允许缩小，不重装系统。` : ''
})
function payload(): ProductChangeInput {
  return { product_id: Number(selectedId.value), ...(elasticFields.value.length ? { options: { ...inputs.value } } : {}) }
}
function validQuote(q: ProductChangeQuote) {
  return q.product_id === Number(selectedId.value) &&
    [q.charge_cents, q.credit_cents, q.price_cents, q.remaining_seconds, q.total_seconds].every(n => Number.isSafeInteger(n) && n >= 0) &&
    q.total_seconds > 0 && q.remaining_seconds <= q.total_seconds &&
    (q.now_s === undefined || (Number.isSafeInteger(q.now_s) && q.now_s >= 0))
}
async function refreshHistory() {
  const id = props.service.id
  historyVerified.value = false
  const rows = await serviceApi.changes(id)
  if (id !== props.service.id) return
  records.value = rows
  historyVerified.value = true
}
async function load() {
  const version = ++loadVersion
  loading.value = true
  historyVerified.value = false
  error.value = null
  try {
    const [options, history] = await Promise.all([serviceApi.changeOptions(props.service.id), serviceApi.changes(props.service.id)])
    if (version !== loadVersion) return
    products.value = options
    records.value = history
    historyVerified.value = true
  } catch (err) { if (version === loadVersion) error.value = errorMessage(err) }
  finally { if (version === loadVersion) loading.value = false }
}
async function preview(version = ++quoteVersion) {
  if (!validInputs.value) return
  quoting.value = true
  quoteError.value = null
  try {
    const q = await serviceApi.changePreview(props.service.id, payload())
    if (version !== quoteVersion) return
    if (!validQuote(q)) throw new Error('后端报价金额无效，已阻止提交')
    quote.value = q
    return q
  } catch (err) { if (version === quoteVersion) quoteError.value = errorMessage(err) }
  finally { if (version === quoteVersion) quoting.value = false }
}
watch(selectedId, () => {
  inputs.value = Object.fromEntries(elasticFields.value.map(f => [f.key, String(f.range.min)]))
  requestKey = ''
})
watch(() => JSON.stringify(payload()), () => {
  const version = ++quoteVersion
  if (historyVerified.value && !unsettled.value && !busy.value) requestKey = ''
  quote.value = null
  confirmedInput.value = null
  quoteError.value = null
  if (debounce) clearTimeout(debounce)
  if (!validInputs.value) { quoting.value = false; return }
  quoting.value = true
  debounce = setTimeout(() => { debounce = null; void preview(version) }, 250)
})
async function askChange() {
  if (!canChange.value) return
  // 确认前重读报价，防止从旧商品/旧配置的报价提交。请求版本隔离乱序响应。
  quote.value = null
  const refreshedQuote = await preview()
  if (!canChange.value || !refreshedQuote) return
  retryTarget.value = null
  confirmedQuote.value = { ...refreshedQuote }
  confirmedInput.value = { ...payload(), options: { ...(refreshedQuote.options ?? {}) } }
  confirmOpen.value = true
}
function askRetry(row: ProductChange) {
  if (busy.value || props.disabled || !['reserved', 'applying', 'uncertain'].includes(row.status)) return
  retryTarget.value = row
  confirmedInput.value = null
  confirmOpen.value = true
}
async function confirm() {
  if (busy.value || props.disabled || !confirmOpen.value) return
  const id = props.service.id
  const input = confirmedInput.value
  const retry = retryTarget.value
  if (!retry && !input) return
  busy.value = true
  historyVerified.value = false
  emit('busy', true)
  error.value = null
  try {
    if (!requestKey) requestKey = crypto.randomUUID()
    const result = retry ? await serviceApi.retryChange(id, retry.id) : await serviceApi.changeProduct(id, { ...input!, idempotency_key: requestKey })
    confirmOpen.value = false
    await refreshHistory()
    emit('updated', await serviceApi.get(id))
    if (result.change.status === 'applied') { toast.success('规格变更已完成'); selectedId.value = ''; requestKey = '' }
    else if (result.change.status === 'failed') error.value = result.change.error || '上游拒绝变更，预留费用已补偿。请核查操作记录。'
    else error.value = result.change.error || '操作需要核对，请使用同一操作记录重试，不要重复申请。'
  } catch (err) {
    error.value = `${errorMessage(err)}。请刷新操作记录核对结果，再使用原操作重试。`
    // 超时也可能已扣款/已落库，不能无记录地再次发起新操作。
    try { await refreshHistory() } catch { error.value += ' 操作记录暂不可读，请勿重复提交。' }
  } finally { busy.value = false; emit('busy', false) }
}
watch(() => props.service.id, () => { selectedId.value = ''; quoteVersion++; requestKey = ''; void load() }, { immediate: true })
onBeforeUnmount(() => { quoteVersion++; loadVersion++; if (debounce) clearTimeout(debounce) })
</script>

<template>
  <Card><CardContent class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-sm font-semibold">产品升降级</h2><p class="mt-1 text-xs text-muted-foreground">只显示后端确认可变更的同接口 / 驱动 / 周期产品。请先关机，不允许磁盘缩小。</p></div><Button variant="outline" size="sm" :disabled="busy || loading" @click="load"><RefreshCcw />刷新选项与记录</Button></div>
    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="2" />
    <template v-else>
      <p v-if="!products.length" class="rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">当前没有可用的升级 / 降级方案，或上游暂不支持 resize。没有本地展示性改配。</p>
      <template v-else>
        <div class="space-y-2"><Label for="target-product">目标产品</Label><select id="target-product" v-model="selectedId" class="w-full rounded-md border bg-background px-3 py-2 text-sm" :disabled="busy || unsettled"><option value="">选择可变更产品</option><option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} · {{ formatCents(p.price_cents) }} / 周期</option></select></div>
        <div v-if="target" class="grid gap-2 sm:grid-cols-2"><p v-for="spec in target.specs ?? []" :key="spec.label" class="text-xs text-muted-foreground">{{ spec.label }}：{{ spec.value }}</p></div>
        <div v-if="elasticFields.length" class="grid gap-3 sm:grid-cols-2"><div v-for="field in elasticFields" :key="field.key" class="space-y-1.5"><Label :for="`change-${field.key}`">{{ field.label }}</Label><Input :id="`change-${field.key}`" v-model="inputs[field.key]" type="number" :min="field.range.min" :max="field.range.max" :step="field.range.step || 1" :disabled="busy || unsettled" /><p class="text-xs text-muted-foreground">{{ field.range.min }}–{{ field.range.max }} · 步长 {{ field.range.step || 1 }}</p></div></div>
        <ErrorAlert :message="quoteError" />
        <div v-if="quoting" role="status" class="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 class="animate-spin size-4" />正在获取实时差价报价</div>
        <div v-else-if="quote" class="grid gap-4 rounded-lg border bg-muted/25 p-4 sm:grid-cols-2">
          <div><p class="text-xs text-muted-foreground">本次扣除钱包余额</p><p class="mt-1 text-lg font-semibold"><Money :cents="quote.charge_cents" /></p></div>
          <div><p class="text-xs text-muted-foreground">成功后返还钱包余额（非外部退款）</p><p class="mt-1 text-lg font-semibold"><Money :cents="quote.credit_cents" /></p></div>
          <p class="text-xs text-muted-foreground sm:col-span-2">剩余 {{ quote.remaining_seconds }} 秒 / 周期 {{ quote.total_seconds }} 秒（约 {{ (quote.remaining_seconds / 86400).toFixed(2) }} 天）；新周期价格 <Money :cents="quote.price_cents" />。金额仅由后端以整数分试算。<span v-if="quote.now_s !== undefined"> 报价基准 now_s：{{ quote.now_s }}（Unix 秒）。</span><span v-else> 后端未返回报价基准时间，提交前会重新报价。</span></p>
        </div>
        <p v-if="quote && balanceCents !== null && balanceCents < quote.charge_cents" class="text-xs text-destructive">钱包余额不足，请先充值后再确认。</p>
        <Button data-testid="change-product" :disabled="!canChange" @click="askChange"><ArrowRightLeft />查看确认并变更</Button>
      </template>
      <div v-if="busy" role="status" aria-live="polite" class="flex items-center gap-2 rounded-md bg-muted p-3 text-sm"><Loader2 class="size-4 animate-spin" />正在核对上游资源与结算。此操作可能较久，请不要重复提交；不显示估算百分比。</div>
      <div class="space-y-3 border-t pt-4"><h3 class="text-sm font-semibold">持久化操作记录</h3><p v-if="!historyVerified" class="text-xs text-destructive">尚未核对权威操作记录，已阻止新申请。请刷新记录后使用原 change ID 重试。</p><p v-if="!records.length" class="text-sm text-muted-foreground">暂无规格变更记录</p>
        <div v-for="row in records" :key="row.id" class="space-y-2 rounded-lg border p-3"><div class="flex flex-wrap items-center justify-between gap-2"><p class="text-sm">操作 #{{ row.id }} · 商品 #{{ row.product_id }}</p><Badge variant="outline">{{ labels[row.status] ?? row.status }}</Badge></div><p class="break-all font-mono text-xs text-muted-foreground">{{ row.operation_id }} · {{ formatDateTime(row.created_at) }}</p><p class="text-xs">扣款 <Money :cents="row.charge_cents" /> / 成功后返还 <Money :cents="row.credit_cents" /></p><p v-if="row.error" class="whitespace-pre-wrap break-all text-xs text-destructive">{{ row.error }}</p><Button v-if="['reserved', 'applying', 'uncertain'].includes(row.status)" :data-testid="`retry-change-${row.id}`" variant="outline" size="sm" :disabled="busy" @click="askRetry(row)">核对并重试此操作</Button></div>
      </div>
    </template>
    <ConfirmDialog v-model:open="confirmOpen" :title="retryTarget ? '确认核对并重试' : '确认规格与差价'" :description="description" :confirming="busy" @confirm="confirm" />
  </CardContent></Card>
</template>
