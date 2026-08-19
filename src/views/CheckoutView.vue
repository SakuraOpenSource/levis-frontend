<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircle2, ExternalLink, Info, Loader2, RefreshCcw } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { orderApi, paymentApi, walletApi } from '@/lib/endpoints'
import type { ExternalPayment, Order, PaymentMethod } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const order = ref<Order | null>(null)
const balanceCents = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const paying = ref(false)
const cancelling = ref(false)
const methods = ref<PaymentMethod[]>([])
const selectedMethod = ref('')
const payment = ref<ExternalPayment | null>(null)
const querying = ref(false)

const orderId = computed(() => Number(route.params.id))
const insufficient = computed(
  () => !!order.value && balanceCents.value < order.value.total_cents,
)
const payable = computed(() => order.value?.status === 'pending')

async function loadAll() {
  const [fetched, wallet, availableMethods] = await Promise.all([
    orderApi.get(orderId.value),
    walletApi.overview(),
    paymentApi.methods(),
  ])
  order.value = fetched
  balanceCents.value = wallet.balance_cents
  methods.value = availableMethods
  selectedMethod.value = availableMethods[0]?.id ?? ''
}

function openPayment() {
  if (payment.value?.pay_url) window.open(payment.value.pay_url, '_blank', 'noopener,noreferrer')
}

async function pay() {
  if (!order.value) return
  if (!selectedMethod.value) {
    toast.error(t('payment.methodRequired'))
    return
  }
  paying.value = true
  error.value = null
  try {
    payment.value = await paymentApi.create('order', order.value.id, selectedMethod.value)
    openPayment()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    paying.value = false
  }
}

async function queryPayment() {
  if (!payment.value) return
  querying.value = true
  try {
    payment.value = await paymentApi.query(payment.value.id)
    if (payment.value.status === 'paid') {
      await Promise.all([auth.refresh(), loadAll()])
      toast.success(t('payment.paid'))
    }
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    querying.value = false
  }
}

async function cancel() {
  if (!order.value) return
  cancelling.value = true
  try {
    await orderApi.cancel(order.value.id)
    toast.success(t('checkout.cancelled'))
    await router.push({ name: 'shop' })
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    cancelling.value = false
  }
}

onMounted(async () => {
  if (!Number.isFinite(orderId.value) || orderId.value <= 0) {
    // 没有订单号时无从结账，退回购物车。
    await router.replace({ name: 'cart' })
    return
  }
  try {
    await loadAll()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('checkout.title')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="3" />

    <template v-else-if="order">
      <!-- 支付成功 -->
      <Card v-if="payment?.status === 'paid'">
        <CardContent class="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 class="text-success size-12" />
          <div class="space-y-1">
            <p class="text-lg font-semibold">{{ t('checkout.success') }}</p>
            <p class="text-muted-foreground text-sm">{{ t('checkout.successHint') }}</p>
          </div>
          <div class="flex flex-wrap justify-center gap-3">
            <Button as-child>
              <RouterLink :to="{ name: 'services' }">{{ t('checkout.viewServices') }}</RouterLink>
            </Button>
            <Button variant="outline" as-child>
              <RouterLink :to="{ name: 'invoices' }">
                {{ t('checkout.viewInvoice') }}
              </RouterLink>
            </Button>
          </div>
        </CardContent>
      </Card>

      <template v-else>
        <Alert v-if="!methods.length" variant="warning">
          <Info />
          <AlertDescription>{{ t('payment.unavailable') }}</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center justify-between gap-2 text-base">
              <span>{{ t('checkout.summary') }}</span>
              <StateBadge kind="order" :value="order.status" />
            </CardTitle>
            <p class="text-muted-foreground text-xs">
              {{ t('checkout.orderNo') }}：<span class="tabular">{{ order.order_no }}</span>
            </p>
          </CardHeader>

          <CardContent class="space-y-4">
            <div
              v-for="item in order.items ?? []"
              :key="item.id"
              class="flex items-center justify-between gap-4 text-sm"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">{{ item.product_name }}</p>
                <p class="text-muted-foreground text-xs">
                  {{ cycleLabel(item.billing_cycle) }} ×
                  <span class="tabular">{{ item.quantity }}</span>
                </p>
              </div>
              <Money :cents="item.price_cents * item.quantity" />
            </div>

            <Separator />

            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ t('cart.total') }}</span>
              <Money :cents="order.total_cents" class="text-xl font-semibold" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('checkout.payMethod') }}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <label for="checkout-payment-method" class="text-sm font-medium">{{ t('payment.method') }}</label>
              <select id="checkout-payment-method" v-model="selectedMethod" class="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none" :disabled="!methods.length || paying">
                <option value="" disabled>{{ methods.length ? t('payment.selectMethod') : t('payment.unavailable') }}</option>
                <option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option>
              </select>
            </div>
            <div class="flex items-center justify-between rounded-lg border p-3">
              <span class="text-sm font-medium">{{ t('checkout.balanceAvailable') }}</span>
              <Money :cents="balanceCents" class="font-medium" />
            </div>

            <Alert v-if="insufficient && payable" variant="warning">
              <Info />
              <AlertDescription class="flex flex-wrap items-center gap-3">
                {{ t('checkout.insufficient') }}
                <Button variant="outline" size="sm" as-child>
                  <RouterLink :to="{ name: 'wallet' }">{{ t('checkout.goRecharge') }}</RouterLink>
                </Button>
              </AlertDescription>
            </Alert>

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

            <div class="flex flex-wrap justify-end gap-3">
              <Button
                v-if="payable"
                variant="ghost"
                :disabled="cancelling || paying"
                @click="cancel"
              >
                <Loader2 v-if="cancelling" class="animate-spin" />
                {{ t('checkout.cancelOrder') }}
              </Button>
              <Button :disabled="!payable || !methods.length || paying" @click="pay">
                <Loader2 v-if="paying" class="animate-spin" />
                {{ paying ? t('checkout.paying') : t('checkout.pay') }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </template>
    </template>
  </div>
</template>
