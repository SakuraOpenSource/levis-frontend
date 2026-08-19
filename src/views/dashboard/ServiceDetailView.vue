<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, ExternalLink, Loader2, RefreshCcw } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { serviceApi, paymentApi } from '@/lib/endpoints'
import { formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { ExternalPayment, PaymentMethod, Service } from '@/lib/types'

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

/** 只有使用中且非一次性付费的服务才有「续费」一说。 */
const canRenew = computed(
  () => item.value?.status === 'active' && item.value.billing_cycle !== 'onetime',
)

async function load() {
  try {
    const [service, availableMethods] = await Promise.all([
      serviceApi.get(Number(route.params.id)),
      paymentApi.methods(),
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

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="item?.name ?? t('services.detailTit')">
      <template #actions>
        <Button v-if="canRenew" size="sm" :disabled="renewing || !methods.length" @click="renew">
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
      <label for="renew-payment-method" class="text-sm font-medium">{{ t('payment.method') }}</label>
      <select id="renew-payment-method" v-model="selectedMethod" class="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none" :disabled="!methods.length || renewing">
        <option value="" disabled>{{ methods.length ? t('payment.selectMethod') : t('payment.unavailable') }}</option>
        <option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option>
      </select>
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
