<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, ExternalLink, HardDriveDownload, Loader2, Power, PowerOff, RefreshCcw, RotateCcw, Zap, ZapOff } from 'lucide-vue-next'
import RFB from '@novnc/novnc'

import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import PayPanel from '@/components/app/PayPanel.vue'
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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { catalogApi, serviceApi, walletApi } from '@/lib/endpoints'
import { formatBytes, formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { HostMetrics, Invoice, OSImage, PowerAction, Service, UpstreamHost } from '@/lib/types'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const item = ref<Service | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
/** 续费账单：创建成功后挂载 PayPanel（purpose="invoice"）统一收银，结算完成即清空。 */
const renewInvoice = ref<Invoice | null>(null)
const creatingRenew = ref(false)
const walletBalance = ref(0)

const canRenew = computed(
  () => item.value?.status === 'active' && item.value.billing_cycle !== 'onetime',
)

const isFree = computed(() => item.value?.price_cents === 0)

async function load() {
  try {
    const [service, wallet] = await Promise.all([
      serviceApi.get(Number(route.params.id)),
      walletApi.overview().catch(() => null),
    ])
    item.value = service
    walletBalance.value = wallet?.balance_cents ?? 0
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

/** 续费走统一收银台：先生成续费账单，再用 PayPanel（余额抵扣 + 在线支付）结算。 */
async function startRenew() {
  if (!item.value || creatingRenew.value || renewInvoice.value) return
  creatingRenew.value = true
  try {
    renewInvoice.value = await serviceApi.renewInvoice(item.value.id)
    toast.success(t('services.renewInvoiceDone'))
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    creatingRenew.value = false
  }
}

/** PayPanel 结算完成后重载服务与钱包（未付账单计数即账单状态），收起收银台。 */
async function onRenewPaid() {
  renewInvoice.value = null
  try {
    const [service, wallet] = await Promise.all([
      serviceApi.get(Number(route.params.id)),
      walletApi.overview(),
    ])
    item.value = service
    walletBalance.value = wallet.balance_cents
    toast.success(t('services.renewed'))
  } catch (err) {
    toast.error(errorMessage(err))
  }
}
/** 流量包加购：GB/TB 切换 + 数量 + 价格预览，账单复用 PayPanel（purpose="invoice"）。 */
const trafficInvoice = ref<Invoice | null>(null)
const creatingTraffic = ref(false)
const trafficUnit = ref<'GB' | 'TB'>('GB')
const trafficAmount = ref(100)
const trafficPrice = ref<{ unitPrice: number; step: number } | null>(null)

const canTraffic = computed(() => item.value?.status === 'active')

/** 以 GB 为单位的加购量（TB 按 1TB=1024GB 换算），与后端校验口径一致。 */
const trafficExtraGB = computed(
  () => (Number(trafficAmount.value) || 0) * (trafficUnit.value === 'TB' ? 1024 : 1),
)

/** 价格预览：取自商品 provision_config.traffic_gb；无定价时显示兜底提示。 */
const trafficPreviewCents = computed(() => {
   if (!trafficPrice.value || trafficPrice.value.unitPrice <= 0) return null
   const step = Math.max(trafficPrice.value.step, 1)
  if (trafficExtraGB.value <= 0 || trafficExtraGB.value % step !== 0) return null
   return (trafficExtraGB.value / step) * trafficPrice.value.unitPrice
})
 
/** 提交门禁：超范围必禁；已知单价但步长不对齐也禁（兜底定价未知时放行，后端计费）。 */
const trafficSubmittable = computed(() => {
  if (trafficExtraGB.value < 1 || trafficExtraGB.value > 10240) return false
  if (trafficPrice.value && trafficPrice.value.unitPrice > 0 && trafficPreviewCents.value === null) return false
  return true
})
async function loadTrafficPrice() {
  trafficPrice.value = null
  if (!item.value) return
  try {
    const product = await catalogApi.product(item.value.product_id)
    const range = product.provision_config?.traffic_gb
    if (range && (range.unit_price_cents ?? 0) > 0) {
      trafficPrice.value = { unitPrice: range.unit_price_cents ?? 0, step: Math.max(range.step ?? 1, 1) }
    }
  } catch {
    trafficPrice.value = null
  }
}

/** 流量账单走统一收银台：先生成账单，再用 PayPanel（余额抵扣 + 在线支付）结算。 */
async function startTraffic() {
   if (!item.value || creatingTraffic.value || trafficInvoice.value || !trafficSubmittable.value) return
  creatingTraffic.value = true
  try {
    trafficInvoice.value = await serviceApi.trafficInvoice(item.value.id, Number(trafficAmount.value) || 0, trafficUnit.value)
    toast.success(t('services.trafficInvoiceDone'))
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    creatingTraffic.value = false
  }
}

/** PayPanel 结算完成后重载服务与钱包（配额即服务状态），收起收银台。 */
async function onTrafficPaid() {
  trafficInvoice.value = null
  try {
    const [service, wallet] = await Promise.all([
      serviceApi.get(Number(route.params.id)),
      walletApi.overview(),
    ])
    item.value = service
    walletBalance.value = wallet.balance_cents
    toast.success(t('services.trafficPaid'))
  } catch (err) {
    toast.error(errorMessage(err))
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
/** 近 30 次采样环形缓冲，支撑图表卡片的 SVG 迷你折线。 */
const metricHistory = ref<{ cpu: number; mem: number; rx: number; tx: number }[]>([])
let metricsTimer: number | null = null

function stopMetricsTimer() {
  if (metricsTimer !== null) {
    window.clearInterval(metricsTimer)
    metricsTimer = null
  }
}

function startMetricsTimer() {
  stopMetricsTimer()
  metricsTimer = window.setInterval(() => {
    void loadMetrics(true)
  }, 10000)
}

function pushMetricSample() {
  if (!metrics.value) return
  metricHistory.value = [
    ...metricHistory.value.slice(-29),
    {
      cpu: metrics.value.cpu_percent,
      mem: memPercent.value,
      rx: metrics.value.bandwidth_rx_bps,
      tx: metrics.value.bandwidth_tx_bps,
    },
  ]
}

/** 实时占用：上游不支持或查询失败时静默降级，只显示静态规格。quiet 轮询失败时保留上次数据。 */
async function loadMetrics(quiet = false) {
  if (!item.value || !canPower.value) return
  if (!quiet) {
    metricsLoading.value = true
    metricsError.value = false
  }
  try {
    metrics.value = await serviceApi.metrics(item.value.id)
    pushMetricSample()
  } catch {
    if (!quiet) {
      metrics.value = null
      metricsError.value = true
    }
  } finally {
    if (!quiet) metricsLoading.value = false
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

/** 迷你折线：按峰值归一化到 120x36 画布，无数据时返回空路径。 */
function sparkPoints(values: number[]): string {
  if (!values.length) return ''
  const peak = Math.max(...values, 1)
  const step = values.length > 1 ? 120 / (values.length - 1) : 0
  return values
    .map((value, index) => `${(index * step).toFixed(1)},${(34 - (value / peak) * 30).toFixed(1)}`)
    .join(' ')
}

const chartSeries = computed(() => {
  if (!metricHistory.value.length) return []
  return [
    {
      key: 'cpu',
      label: t('services.chartCpu'),
      values: metricHistory.value.map((sample) => sample.cpu),
      current: metrics.value ? `${metrics.value.cpu_percent.toFixed(1)}%` : '-',
    },
    {
      key: 'mem',
      label: t('services.chartMem'),
      values: metricHistory.value.map((sample) => sample.mem),
      current: `${memPercent.value.toFixed(0)}%`,
    },
    {
      key: 'down',
      label: t('services.chartDown'),
      values: metricHistory.value.map((sample) => sample.rx),
      current: formatRate(metrics.value?.bandwidth_rx_bps ?? 0),
    },
    {
      key: 'up',
      label: t('services.chartUp'),
      values: metricHistory.value.map((sample) => sample.tx),
      current: formatRate(metrics.value?.bandwidth_tx_bps ?? 0),
    },
  ]
})

const vncTarget = ref<HTMLElement | null>(null)
const vncAvailable = ref(false)
const vncMessage = ref('')
/** 上游页面控制台地址（魔方财务类上游）：有值时走外链，不建 RFB 连接。 */
const vncViewerUrl = ref('')
const vncChecking = ref(false)
const vncConnecting = ref(false)
const vncConnected = ref(false)
const vncEverConnected = ref(false)

let rfb: RFB | null = null
let vncManualClose = false

/** VNC 可用性门禁：上游未提供控制台时只展示原因，不建连接。 */
async function checkVnc() {
  if (!item.value || !canPower.value) return
  vncChecking.value = true
  try {
    const info = await serviceApi.vnc(item.value.id)
    vncAvailable.value = info.available
    vncMessage.value = info.message || ''
    vncViewerUrl.value = info.viewer_url || ''
  } catch {
    vncAvailable.value = false
    vncMessage.value = ''
    vncViewerUrl.value = ''
  } finally {
    vncChecking.value = false
  }
}

/** 页面控制台型上游（魔方财务）：新窗口打开上游 viewer 页，不走站内 RFB 中继。 */
function openVncViewer() {
  if (!vncViewerUrl.value) return
  window.open(vncViewerUrl.value, '_blank', 'noopener')
}

function onVncConnect() {
  vncConnected.value = true
  vncEverConnected.value = true
  vncConnecting.value = false
  toast.success(t('services.vncConnected'))
}

function onVncDisconnect(e: Event) {
  vncConnected.value = false
  vncConnecting.value = false
  if (vncManualClose) {
    vncManualClose = false
    return
  }
  const detail = (e as CustomEvent).detail ?? {}
  toast.error(detail.clean ? t('services.vncDisconnected') : t('services.vncUnexpected'))
}

/** 静默拆除当前 VNC 会话：复用于重连、切换服务与卸载，不弹 toast。 */
function teardownVnc() {
  if (rfb) {
    try {
      rfb.removeEventListener('connect', onVncConnect)
      rfb.removeEventListener('disconnect', onVncDisconnect)
    } catch {
      // 旧会话解绑失败可忽略。
    }
    try {
      rfb.disconnect()
    } catch {
      // 关闭阶段异常可忽略，状态以本地为准。
    }
    rfb = null
  }
  vncConnected.value = false
}

async function connectVnc() {
  if (!item.value || vncConnecting.value) return
  vncConnecting.value = true
  vncManualClose = false
  try {
    teardownVnc()
    await nextTick()
    if (!vncTarget.value || !item.value) {
      vncConnecting.value = false
      return
    }
    // 同源中继：与 virtualis 一致，scale 拉伸铺满、resizeSession 关闭。
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${scheme}://${window.location.host}/api/services/${item.value.id}/vnc/ws`
    rfb = new RFB(vncTarget.value, url)
    rfb.scaleViewport = true
    rfb.resizeSession = false
    rfb.addEventListener('connect', onVncConnect)
    rfb.addEventListener('disconnect', onVncDisconnect)
  } catch (err) {
    vncConnecting.value = false
    toast.error(errorMessage(err))
  }
}

function disconnectVnc() {
  vncManualClose = true
  teardownVnc()
  vncManualClose = false
  vncConnecting.value = false
  toast.success(t('services.vncDisconnected'))
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
  await loadTrafficPrice()
  await loadUpstream()
  await loadMetrics()
  await checkVnc()
  // 图表约 10 秒采样一次（见 chartsHint），静默轮询不闪加载态；离开页面即停。
  startMetricsTimer()
})

/** 路由复用组件时（services/1 → services/2）重置轮询与 VNC，避免旧会话泄漏。 */
watch(() => route.params.id, async () => {
  teardownVnc()
  stopMetricsTimer()
  renewInvoice.value = null
  trafficInvoice.value = null
  trafficPrice.value = null
  metrics.value = null
  metricHistory.value = []
  upstream.value = null
  error.value = null
  loading.value = true
  await load()
  await loadTrafficPrice()
  await loadUpstream()
  await loadMetrics()
  await checkVnc()
  startMetricsTimer()
})

onBeforeUnmount(() => {
  stopMetricsTimer()
  teardownVnc()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="item?.name ?? t('services.detailTit')">
      <template #actions>
        <Button
          v-if="canRenew && !renewInvoice"
          size="sm"
          :disabled="creatingRenew || isFree"
          :title="isFree ? '免费服务无需在线续费' : ''"
          @click="startRenew"
        >
          <Loader2 v-if="creatingRenew" class="animate-spin" />
          <RefreshCcw v-else />
          {{ creatingRenew ? t('services.renewing') : t('services.renew') }}
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
    <div v-if="item && canRenew && isFree" class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      免费服务无需在线续费
    </div>
    <PayPanel
       v-if="item && canRenew && !isFree && renewInvoice"
       :total-cents="renewInvoice.total_cents"
       :balance-cents="walletBalance"
       purpose="invoice"
       :target-id="renewInvoice.id"
       @paid="onRenewPaid"
    />

    <Card v-if="item && canTraffic">
      <CardContent class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-medium">{{ t('services.trafficTitle') }}</h2>
          <span class="text-muted-foreground text-xs">{{ t('services.trafficQuota') }}：{{ item.traffic_extra_gb ?? 0 }} GB</span>
        </div>
        <p class="text-muted-foreground text-xs">{{ t('services.trafficHint') }}</p>
        <div v-if="!trafficInvoice" class="flex flex-wrap items-end gap-3">
          <div class="flex gap-1">
            <Button :variant="trafficUnit === 'GB' ? 'default' : 'outline'" size="sm" @click="trafficUnit = 'GB'">
              {{ t('services.trafficUnitGB') }}
            </Button>
            <Button :variant="trafficUnit === 'TB' ? 'default' : 'outline'" size="sm" @click="trafficUnit = 'TB'">
              {{ t('services.trafficUnitTB') }}
            </Button>
          </div>
          <div class="space-y-1">
            <Label for="traffic-amount">{{ t('services.trafficAmount') }}（{{ trafficUnit }}）</Label>
            <Input id="traffic-amount" v-model.number="trafficAmount" type="number" min="1" class="w-32" />
          </div>
          <Button size="sm" :disabled="creatingTraffic || !trafficSubmittable" @click="startTraffic">
            <Loader2 v-if="creatingTraffic" class="animate-spin" />
            {{ creatingTraffic ? t('services.trafficCreating') : t('services.trafficCreate') }}
          </Button>
        </div>
        <p v-if="!trafficInvoice && trafficPrice" class="text-muted-foreground text-xs">
          {{ t('services.trafficPreview') }}：<Money v-if="trafficPreviewCents !== null" :cents="trafficPreviewCents" /><span v-else>-</span>
          <template v-if="trafficExtraGB % Math.max(trafficPrice.step, 1) !== 0">
            · {{ t('services.trafficStepHint', { step: trafficPrice.step }) }}
          </template>
        </p>
        <p v-else-if="!trafficInvoice" class="text-muted-foreground text-xs">{{ t('services.trafficPriceUnknown') }}</p>
        <PayPanel
          v-if="trafficInvoice"
          :total-cents="trafficInvoice.total_cents"
          :balance-cents="walletBalance"
          purpose="invoice"
          :target-id="trafficInvoice.id"
          @paid="onTrafficPaid"
        />
      </CardContent>
    </Card>
    <!-- 电源操作卡片 -->
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
       <CardContent class="space-y-3">
         <div class="flex flex-wrap items-center justify-between gap-2">
           <h2 class="text-sm font-medium">{{ t('services.vncTitle') }}</h2>
           <div class="flex gap-2">
             <Button v-if="vncViewerUrl" variant="default" size="sm" @click="openVncViewer">
               <ExternalLink class="size-4" />
               {{ t('services.vncOpenExternal') }}
             </Button>
             <template v-else>
               <Button
                 v-if="!vncConnected"
                 variant="outline"
                 size="sm"
                 :disabled="!vncAvailable || vncConnecting || vncChecking"
                 @click="connectVnc"
               >
                 <Loader2 v-if="vncConnecting || vncChecking" class="animate-spin" />
                 {{ vncConnecting ? t('services.vncConnecting') : vncEverConnected ? t('services.vncReconnect') : t('services.vncOpen') }}
               </Button>
               <Button v-else variant="outline" size="sm" @click="disconnectVnc">
                 {{ t('services.vncDisconnect') }}
               </Button>
             </template>
           </div>
         </div>
         <p class="text-muted-foreground text-xs">{{ t('services.vncHint') }}</p>
         <p v-if="!vncAvailable" class="text-muted-foreground text-sm">
           {{ vncChecking ? t('services.vncConnecting') : vncMessage || t('services.vncUnavailable') }}
         </p>
         <template v-else-if="vncViewerUrl">
           <p class="text-muted-foreground text-xs">{{ t('services.vncExternalHint') }}</p>
         </template>
         <template v-else>
           <div ref="vncTarget" class="h-[420px] w-full overflow-hidden rounded-lg border bg-black" />
           <p v-if="vncConnected" class="text-xs text-emerald-600">{{ t('services.vncConnected') }}</p>
         </template>
       </CardContent>
     </Card>

    <Card v-if="item && canPower">
      <CardContent class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-medium">{{ t('services.liveMetrics') }}</h2>
          <Button variant="outline" size="sm" :disabled="metricsLoading" @click="() => loadMetrics()">
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
        <div class="space-y-2 border-t pt-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-xs font-medium">{{ t('services.chartsTitle') }}</h3>
            <Button variant="ghost" size="sm" :disabled="metricsLoading" @click="() => loadMetrics()">
              <RefreshCcw class="size-3" />
              {{ t('services.chartsRefresh') }}
            </Button>
          </div>
          <p class="text-muted-foreground text-xs">{{ t('services.chartsHint') }}</p>
          <div v-if="chartSeries.length" class="grid gap-3 sm:grid-cols-2">
            <div v-for="series in chartSeries" :key="series.key" class="space-y-1 rounded-lg border p-3">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-muted-foreground text-xs">{{ series.label }}</span>
                <span class="text-xs tabular">{{ series.current }}</span>
              </div>
              <svg viewBox="0 0 120 36" preserveAspectRatio="none" class="text-primary h-9 w-full" role="img" :aria-label="series.label">
                <polyline :points="sparkPoints(series.values)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
              </svg>
            </div>
          </div>
          <p v-else class="text-muted-foreground text-xs">{{ t('services.chartsEmpty') }}</p>
        </div>
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
            <dt class="text-muted-foreground text-xs">{{ t('services.trafficQuota') }}</dt>
            <dd class="mt-1 text-sm tabular">{{ item.traffic_extra_gb ?? 0 }} GB</dd>
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
