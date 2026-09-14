<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, ExternalLink, HardDriveDownload, Loader2, Power, PowerOff, RefreshCcw, RotateCcw, Zap, ZapOff } from 'lucide-vue-next'

import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
 import StateBadge from '@/components/app/StateBadge.vue'
 import { Alert, AlertDescription } from '@/components/ui/alert'
 import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { serviceApi, paymentApi } from '@/lib/endpoints'
import { formatBytes, formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { ExternalPayment, HostMetrics, OSImage, PaymentMethod, PowerAction, Service, UpstreamHost } from '@/lib/types'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { cycleLabel, priceLabel } = useCycleLabel()

const item = ref<Service | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const renewing = ref(false)
const methods = ref<PaymentMethod[]>([])
const selectedMethod = ref('')
const payment = ref<ExternalPayment | null>(null)
const querying = ref(false)

const canRenew = computed(
  () => item.value?.status === 'active' && item.value.billing_cycle !== 'onetime',
)

const isFree = computed(() => item.value?.price_cents === 0)

const balanceRenewing = ref(false)

async function load() {
  try {
    const [service, availableMethods] = await Promise.all([
      serviceApi.get(Number(route.params.id)),
      paymentApi.methods().catch(() => [] as PaymentMethod[]),
    ])
    item.value = service
    methods.value = availableMethods
    selectedMethod.value = availableMethods[0]?.id ?? ''
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

const renewOpen = ref(false)
const renewMode = ref<'balance' | 'external'>('balance')
const renewMessage = ref('')

/** 续费先弹确认框：余额与在线支付共用，确认后再按模式执行。 */
function askRenew(mode: 'balance' | 'external') {
  if (!item.value) return
  renewMode.value = mode
  renewMessage.value = t('services.renewConfirm', {
    price: priceLabel(item.value.price_cents, item.value.billing_cycle),
  })
  renewOpen.value = true
}

async function confirmRenew() {
  renewOpen.value = false
  if (renewMode.value === 'balance') await renewWithBalance()
  else await renew()
}

async function renewWithBalance() {
  if (!item.value) return
  balanceRenewing.value = true
  try {
    await serviceApi.renew(item.value.id)
    item.value = await serviceApi.get(Number(route.params.id))
    toast.success(t('services.renewed'))
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    balanceRenewing.value = false
  }
}

async function renew() {
  if (!item.value) return
  if (!selectedMethod.value) {
    toast.error(t('payment.methodRequired'))
    return
  }
  renewing.value = true
  try {
    payment.value = await paymentApi.create('renewal', item.value.id, selectedMethod.value)
    if (payment.value.pay_url) window.open(payment.value.pay_url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    renewing.value = false
  }
}

function openPayment() {
  if (payment.value?.pay_url) window.open(payment.value.pay_url, '_blank', 'noopener,noreferrer')
}

async function queryPayment() {
  if (!payment.value) return
  querying.value = true
  try {
    payment.value = await paymentApi.query(payment.value.id)
    if (payment.value.status === 'paid') {
      item.value = await serviceApi.get(Number(route.params.id))
      toast.success(t('services.renewed'))
    }
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    querying.value = false
  }
}

const canPower = computed(
  () => !!item.value?.upstream_plugin_id && !!item.value?.upstream_host_id,
)

const upstream = ref<UpstreamHost | null>(null)
const upstreamLoading = ref(false)

async function loadUpstream() {
  if (!item.value || !canPower.value) return
  upstreamLoading.value = true
  try {
    upstream.value = await serviceApi.upstream(item.value.id)
  } catch {
    upstream.value = null
  } finally {
    upstreamLoading.value = false
  }
}

const metrics = ref<HostMetrics | null>(null)
const metricsLoading = ref(false)
const metricsError = ref(false)

/** 实时占用：上游不支持或查询失败时静默降级，只显示静态规格。 */
async function loadMetrics() {
  if (!item.value || !canPower.value) return
  metricsLoading.value = true
  metricsError.value = false
  try {
    metrics.value = await serviceApi.metrics(item.value.id)
  } catch {
    metrics.value = null
    metricsError.value = true
  } finally {
    metricsLoading.value = false
  }
}

const memPercent = computed(() => {
  if (!metrics.value || metrics.value.memory_total_mb <= 0) return 0
  return Math.min(100, Math.max(0, (metrics.value.memory_used_mb / metrics.value.memory_total_mb) * 100))
})

function formatRate(bps: number) {
  if (!bps || bps <= 0) return '0 B/s'
  return `${formatBytes(bps)}/s`
}

const poweringAction = ref<PowerAction | null>(null)
const showUpstreamSSH = ref(false)

/** NAT 机器的真实连接地址是被控公网 IP + 映射端口，不是内网 IPv4。 */
const sshCommand = computed(() => {
  const u = upstream.value
  if (!u?.ssh_host || !u.ssh_port) return ''
  return `ssh -p ${u.ssh_port} ${u.ssh_username || 'root'}@${u.ssh_host}`
})

const sshAddress = computed(() => {
  const u = upstream.value
  if (!u?.ssh_host || !u.ssh_port) return ''
  return `${u.ssh_host}:${u.ssh_port}`
})

async function copyText(value: string) {
  try { await navigator.clipboard.writeText(value); toast.success('已复制') } catch { toast.error('复制失败，请手动复制') }
}

const powerActions: { action: PowerAction; label: string; icon: 'power' | 'powerOff' | 'reboot' | 'reinstall' | 'zap' | 'zapOff'; danger?: boolean }[] = [
  { action: 'boot', label: '开机', icon: 'power' },
  { action: 'shutdown', label: '关机', icon: 'powerOff', danger: true },
  { action: 'reboot', label: '重启', icon: 'reboot' },
  { action: 'hard_boot', label: '强制开机', icon: 'zap' },
  { action: 'hard_stop', label: '强制关机', icon: 'zapOff', danger: true },
  { action: 'hard_restart', label: '强制重启', icon: 'zap', danger: true },
  { action: 'reinstall', label: '重装系统', icon: 'reinstall', danger: true },
]

const availablePowerActions = computed(() => {
  if (!canPower.value) return []
  if (upstreamLoading.value) return []
  if (!upstream.value) return powerActions // 尚未获取到能力时全部显示，获取后过滤
  const acts = upstream.value.actions ?? []
  // 空数组表示上游未明确能力，仍显示全部以兼容旧插件
  if (!acts.length) return powerActions
  return powerActions.filter((pa) => acts.includes(pa.action))
})

// 重装系统：系统列表
const reinstallOpen = ref(false)
const osList = ref<OSImage[]>([])
const osLoading = ref(false)
const selectedOs = ref('')

async function openReinstall() {
  if (!item.value) return
  reinstallOpen.value = true
  selectedOs.value = ''
  if (osList.value.length) return
  osLoading.value = true
  try {
    osList.value = await serviceApi.osList(item.value.id)
  } catch {
    osList.value = []
  } finally {
    osLoading.value = false
  }
}

const forceOpen = ref(false)
const forceTarget = ref<PowerAction | null>(null)
const forceMessage = ref('')

async function power(action: PowerAction, confirmed = false) {
  if (!item.value || poweringAction.value) return
  if (action === 'reinstall') {
    await openReinstall()
    return
  }
  if (action.startsWith('hard_') && !confirmed) {
    forceTarget.value = action
    forceMessage.value = t('services.powerForceConfirm', {
      label: powerActions.find((pa) => pa.action === action)?.label ?? action,
    })
    forceOpen.value = true
    return
  }
  poweringAction.value = action
  try {
    await serviceApi.power(item.value.id, action)
    toast.success(t('services.powerSubmitted'))
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    poweringAction.value = null
  }
}

const reinstallConfirmOpen = ref(false)

async function confirmForcePower() {
  const action = forceTarget.value
  forceOpen.value = false
  forceTarget.value = null
  if (!action) return
  await power(action, true)
}

/** 重装先收起系统选择框，确认框只聚焦“数据会被清空”这一件事；选中的系统保留在 selectedOs。 */
function askReinstallConfirm() {
  if (!item.value) return
  if (osList.value.length && !selectedOs.value) {
    toast.error(t('services.selectOSHint'))
    return
  }
  reinstallOpen.value = false
  reinstallConfirmOpen.value = true
}

async function confirmReinstall() {
  if (!item.value) return
  reinstallConfirmOpen.value = false
  poweringAction.value = 'reinstall'
  try {
    await serviceApi.power(item.value.id, 'reinstall', selectedOs.value || undefined)
    toast.success(t('services.powerSubmitted'))
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    poweringAction.value = null
  }
}

 /** 开通重试横幅：pending/failed 才出现，错误文案直接展示后端下发的 provision_error。 */
 const showProvisionBanner = computed(
   () => !!item.value && (item.value.status === 'pending' || item.value.status === 'failed'),
 )
 const retrying = ref(false)
 const retryOpen = ref(false)
 function askProvisionRetry() {
   if (!item.value) return
   retryOpen.value = true
 }
 async function confirmProvisionRetry() {
   retryOpen.value = false
   if (!item.value) return
   retrying.value = true
   try {
     item.value = await serviceApi.retry(item.value.id)
     toast.success(t('services.retried'))
   } catch (err) {
     toast.error(errorMessage(err))
   } finally {
     retrying.value = false
   }
 }
onMounted(async () => {
  await load()
  await loadUpstream()
  await loadMetrics()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="item?.name ?? t('services.detailTit')">
      <template #actions>
        <Button v-if="canRenew" size="sm" variant="outline" :disabled="balanceRenewing" @click="askRenew('balance')">
          <Loader2 v-if="balanceRenewing" class="animate-spin" />
          <RefreshCcw v-else />
          余额续费
        </Button>
        <Button v-if="canRenew" size="sm" :disabled="renewing || !methods.length || isFree" :title="isFree ? '免费服务请使用余额续费' : ''" @click="askRenew('external')">
          <Loader2 v-if="renewing" class="animate-spin" />
          <RefreshCcw v-else />
          {{ t('services.renew') }}
        </Button>
        <Button variant="outline" size="sm" as-child>
          <RouterLink :to="{ name: 'services' }">
            <ArrowLeft />
            {{ t('common.back') }}
          </RouterLink>
        </Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="3" />

     <Alert v-if="item && showProvisionBanner" variant="warning">
       <AlertDescription class="flex flex-wrap items-center gap-3">
         <span class="min-w-48 flex-1">
           {{ item.status === 'failed' ? t('services.failedHint') : t('services.pendingHint') }}
           <span v-if="item.provision_error" class="mt-1 block text-xs break-all">
             {{ t('services.provisionError') }}：{{ item.provision_error }}
           </span>
         </span>
         <Button variant="outline" size="sm" :disabled="retrying" @click="askProvisionRetry">
           <Loader2 v-if="retrying" class="animate-spin" />
           <RotateCcw v-else />
           {{ retrying ? t('services.retrying') : t('services.retryProvision') }}
         </Button>
       </AlertDescription>
     </Alert>
    <div v-if="item && canRenew" class="space-y-3 rounded-lg border p-4">
      <div v-if="isFree" class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">免费服务请使用“余额续费”</div>
      <template v-else>
        <label for="renew-payment-method" class="text-sm font-medium">{{ t('payment.method') }}</label>
        <select id="renew-payment-method" v-model="selectedMethod" class="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none" :disabled="!methods.length || renewing">
          <option value="" disabled>{{ methods.length ? t('payment.selectMethod') : t('payment.unavailable') }}</option>
          <option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option>
        </select>
      </template>
      <div v-if="payment" class="space-y-3 rounded-lg border p-3 text-sm">
        <div class="flex items-center justify-between gap-3">
          <span>{{ t('payment.status') }}</span>
          <span :class="payment.status === 'failed' ? 'text-destructive' : 'font-medium'">{{ t(`payment.${payment.status}`) }}</span>
        </div>
        <p v-if="payment.status === 'failed'" class="text-destructive text-xs">{{ payment.failure_reason || t('payment.failed') }}</p>
        <div v-if="payment.status === 'pending'" class="flex flex-wrap gap-2">
          <Button v-if="payment.pay_url" variant="outline" size="sm" @click="openPayment">
            <ExternalLink />
            {{ t('payment.open') }}
          </Button>
          <Button variant="outline" size="sm" :disabled="querying" @click="queryPayment">
            <RefreshCcw :class="querying ? 'animate-spin' : ''" />
            {{ querying ? t('payment.querying') : t('payment.query') }}
          </Button>
        </div>
      </div>
    </div>

    <Card v-if="item && canPower">
      <CardContent class="space-y-3">
        <h2 class="text-sm font-medium">{{ t('services.powerTitle') }}</h2>
        <p class="text-muted-foreground text-xs">{{ t('services.powerHint') }}</p>
        <div v-if="upstreamLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="animate-spin size-4" />
          {{ t('services.loadingOS') }}
        </div>
        <div v-else-if="!availablePowerActions.length" class="text-muted-foreground text-sm">
          {{ t('services.powerUnsupported') }}
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <Button
            v-for="pa in availablePowerActions"
            :key="pa.action"
            :variant="pa.danger ? 'destructive' : 'outline'"
            size="sm"
            :disabled="poweringAction !== null"
            @click="power(pa.action)"
          >
            <Loader2 v-if="poweringAction === pa.action" class="animate-spin" />
            <Power v-else-if="pa.icon === 'power'" />
            <PowerOff v-else-if="pa.icon === 'powerOff'" />
            <RotateCcw v-else-if="pa.icon === 'reboot'" />
            <Zap v-else-if="pa.icon === 'zap'" />
            <ZapOff v-else-if="pa.icon === 'zapOff'" />
            <HardDriveDownload v-else />
            {{ pa.label }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card v-if="item && canPower && (upstream?.cpu || upstream?.ipv4 || upstream?.ssh_host)">
      <CardContent class="space-y-4">
        <h2 class="text-sm font-medium">上游主机信息</h2>
        <dl class="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div v-if="upstream?.cpu"><dt class="text-muted-foreground text-xs">CPU</dt><dd>{{ upstream.cpu }} 核</dd></div>
          <div v-if="upstream?.memory_mb"><dt class="text-muted-foreground text-xs">内存</dt><dd>{{ upstream.memory_mb }} MB</dd></div>
          <div v-if="upstream?.disk_gb"><dt class="text-muted-foreground text-xs">硬盘</dt><dd>{{ upstream.disk_gb }} GB</dd></div>
          <div v-if="upstream?.bandwidth_mbps"><dt class="text-muted-foreground text-xs">带宽</dt><dd>{{ upstream.bandwidth_mbps }} Mbps</dd></div>
          <div v-if="upstream?.ipv4"><dt class="text-muted-foreground text-xs">IPv4（内网）</dt><dd class="break-all">{{ upstream.ipv4 }}</dd></div>
          <div v-if="upstream?.ssh_host"><dt class="text-muted-foreground text-xs">SSH 主机</dt><dd class="break-all tabular">{{ upstream.ssh_host }}</dd></div>
          <div v-if="upstream?.ssh_port"><dt class="text-muted-foreground text-xs">SSH 端口</dt><dd class="tabular">{{ upstream.ssh_port }}</dd></div>
          <div v-if="upstream?.ssh_username"><dt class="text-muted-foreground text-xs">SSH 用户</dt><dd>{{ upstream.ssh_username }}</dd></div>
          <div v-if="sshAddress" class="sm:col-span-2 lg:col-span-3">
            <dt class="text-muted-foreground text-xs">连接地址（NAT 映射）</dt>
            <dd class="mt-1 flex flex-wrap items-center gap-2">
              <code class="bg-muted/40 rounded-md border px-3 py-1.5 text-sm tabular">{{ sshAddress }}</code>
              <Button variant="outline" size="sm" @click="copyText(sshAddress)">复制地址</Button>
              <code v-if="sshCommand" class="bg-muted/40 rounded-md border px-3 py-1.5 text-sm tabular">{{ sshCommand }}</code>
              <Button v-if="sshCommand" variant="outline" size="sm" @click="copyText(sshCommand)">复制命令</Button>
            </dd>
          </div>
        </dl>
        <div v-if="upstream?.ssh_password" class="space-y-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <code class="bg-muted/40 rounded-md border px-3 py-2 text-sm tabular">{{ showUpstreamSSH ? upstream.ssh_password : '••••••••••••' }}</code>
            <Button variant="outline" size="sm" @click="showUpstreamSSH = !showUpstreamSSH">{{ showUpstreamSSH ? '隐藏' : '显示' }}</Button>
            <Button variant="outline" size="sm" @click="copyText(upstream.ssh_password)">复制</Button>
            <Badge v-if="upstream?.ssh_ready" variant="outline">SSH 就绪</Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="item && canPower">
      <CardContent class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-medium">{{ t('services.liveMetrics') }}</h2>
          <Button variant="outline" size="sm" :disabled="metricsLoading" @click="loadMetrics">
            <Loader2 v-if="metricsLoading" class="animate-spin" />
            <RefreshCcw v-else />
            {{ t('services.metricsRefresh') }}
          </Button>
        </div>
        <p class="text-muted-foreground text-xs">{{ t('services.metricsHint') }}</p>
        <div v-if="metricsLoading && !metrics" class="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 class="animate-spin" />
        </div>
        <dl v-else-if="metrics" class="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt class="text-muted-foreground text-xs">{{ t('services.cpuUsage') }}</dt><dd class="tabular">{{ metrics.cpu_percent.toFixed(1) }}%</dd></div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.memUsage') }}</dt>
            <dd class="tabular">{{ metrics.memory_used_mb }} / {{ metrics.memory_total_mb }} MB ({{ memPercent.toFixed(0) }}%)</dd>
          </div>
          <div><dt class="text-muted-foreground text-xs">{{ t('services.bandwidthDown') }}</dt><dd class="tabular">{{ formatRate(metrics.bandwidth_rx_bps) }}</dd></div>
          <div><dt class="text-muted-foreground text-xs">{{ t('services.bandwidthUp') }}</dt><dd class="tabular">{{ formatRate(metrics.bandwidth_tx_bps) }}</dd></div>
          <div><dt class="text-muted-foreground text-xs">{{ t('services.trafficDown') }}</dt><dd class="tabular">{{ formatBytes(metrics.network_rx_bytes) }}</dd></div>
          <div><dt class="text-muted-foreground text-xs">{{ t('services.trafficUp') }}</dt><dd class="tabular">{{ formatBytes(metrics.network_tx_bytes) }}</dd></div>
        </dl>
        <p v-else-if="metricsError" class="text-muted-foreground text-xs">{{ t('services.metricsUnavailable') }}</p>
      </CardContent>
    </Card>

    <Dialog v-model:open="reinstallOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('services.powerReinstall') }}</DialogTitle>
          <DialogDescription>{{ t('services.selectOSHint') }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div v-if="osLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="animate-spin size-4" />
            {{ t('services.loadingOS') }}
          </div>
          <div v-else-if="osList.length" class="space-y-2">
            <Label>{{ t('services.selectOS') }}</Label>
            <Select :model-value="selectedOs" @update:model-value="(v: any) => (selectedOs = String(v))">
              <SelectTrigger>
                <SelectValue :placeholder="t('services.selectOS')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="os in osList" :key="os.id" :value="os.id">
                  <span v-if="os.group" class="text-muted-foreground mr-1">[{{ os.group }}]</span>{{ os.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-else class="text-muted-foreground text-sm">{{ t('services.noOSList') }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="reinstallOpen = false">{{ t('common.cancel') }}</Button>
          <Button :disabled="poweringAction !== null" @click="askReinstallConfirm">
            <Loader2 v-if="poweringAction === 'reinstall'" class="animate-spin" />
            {{ t('common.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      v-model:open="renewOpen"
      :title="t('services.renew')"
      :description="renewMessage"
      :confirm-text="t('services.renew')"
      @confirm="confirmRenew"
    />
    <ConfirmDialog
      v-model:open="forceOpen"
      :title="t('services.powerTitle')"
      :description="forceMessage"
      :confirm-text="t('common.confirm')"
      danger
      @confirm="confirmForcePower"
    />
    <ConfirmDialog
      v-model:open="reinstallConfirmOpen"
      :title="t('services.powerReinstall')"
      :description="t('services.powerReinstallConfirm')"
      :confirm-text="t('common.confirm')"
      danger
      @confirm="confirmReinstall"
    />
     <ConfirmDialog
       v-model:open="retryOpen"
       :title="t('services.retryProvision')"
       :description="t('services.retryConfirm')"
       :confirm-text="t('common.retry')"
       :confirming="retrying"
       @confirm="confirmProvisionRetry"
     />

    <Card v-if="item">
      <CardContent>
        <dl class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.status') }}</dt>
            <dd class="mt-1"><StateBadge kind="service" :value="item.status" /></dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.cycle') }}</dt>
            <dd class="mt-1 text-sm">{{ cycleLabel(item.billing_cycle) }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.price') }}</dt>
            <dd class="mt-1 text-sm"><Money :cents="item.price_cents" /></dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.nextDue') }}</dt>
            <dd class="mt-1 text-sm tabular">
              {{ isZeroTime(item.next_due_at) ? '-' : formatDate(item.next_due_at) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.expires') }}</dt>
            <dd class="mt-1 text-sm tabular">
              {{ isZeroTime(item.expires_at) ? '-' : formatDate(item.expires_at) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.createdAt') }}</dt>
            <dd class="mt-1 text-sm tabular">{{ formatDateTime(item.created_at) }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.orderId') }}</dt>
            <dd class="mt-1 text-sm tabular">#{{ item.order_id }}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  </div>
</template>
