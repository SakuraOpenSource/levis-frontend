<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, ExternalLink, HardDriveDownload, Loader2, Power, PowerOff, RefreshCcw, RotateCcw } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
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
import { formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { ExternalPayment, OSImage, PaymentMethod, PowerAction, Service, UpstreamHost } from '@/lib/types'

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

async function renewWithBalance() {
  if (!item.value) return
  const price = priceLabel(item.value.price_cents, item.value.billing_cycle)
  if (!window.confirm(t('services.renewConfirm', { price }))) return
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
  const price = priceLabel(item.value.price_cents, item.value.billing_cycle)
  if (!window.confirm(t('services.renewConfirm', { price }))) return
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

const poweringAction = ref<PowerAction | null>(null)

const powerActions: { action: PowerAction; labelKey: string; icon: 'power' | 'powerOff' | 'reboot' | 'reinstall'; danger?: boolean }[] = [
  { action: 'boot', labelKey: 'services.powerBoot', icon: 'power' },
  { action: 'shutdown', labelKey: 'services.powerShutdown', icon: 'powerOff', danger: true },
  { action: 'reboot', labelKey: 'services.powerReboot', icon: 'reboot' },
  { action: 'reinstall', labelKey: 'services.powerReinstall', icon: 'reinstall', danger: true },
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

async function power(action: PowerAction) {
  if (!item.value || poweringAction.value) return
  if (action === 'reinstall') {
    await openReinstall()
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

async function confirmReinstall() {
  if (!item.value) return
  if (osList.value.length && !selectedOs.value) {
    toast.error(t('services.selectOSHint'))
    return
  }
  if (!window.confirm(t('services.powerReinstallConfirm'))) return
  reinstallOpen.value = false
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

onMounted(async () => {
  await load()
  await loadUpstream()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="item?.name ?? t('services.detailTit')">
      <template #actions>
        <Button v-if="canRenew" size="sm" variant="outline" :disabled="balanceRenewing" @click="renewWithBalance">
          <Loader2 v-if="balanceRenewing" class="animate-spin" />
          <RefreshCcw v-else />
          余额续费
        </Button>
        <Button v-if="canRenew" size="sm" :disabled="renewing || !methods.length || isFree" :title="isFree ? '免费服务请使用余额续费' : ''" @click="renew">
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
            <HardDriveDownload v-else />
            {{ t(pa.labelKey) }}
          </Button>
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
          <Button :disabled="poweringAction !== null" @click="confirmReinstall">
            <Loader2 v-if="poweringAction === 'reinstall'" class="animate-spin" />
            {{ t('common.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
