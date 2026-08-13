<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircle2, Info, Loader2, Wallet } from 'lucide-vue-next'

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
import { orderApi, walletApi } from '@/lib/endpoints'
import type { Order, PayResult } from '@/lib/types'
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
const result = ref<PayResult | null>(null)

const orderId = computed(() => Number(route.params.id))
const insufficient = computed(
  () => !!order.value && balanceCents.value < order.value.total_cents,
)
const payable = computed(() => order.value?.status === 'pending')

async function loadAll() {
  const [fetched, wallet] = await Promise.all([
    orderApi.get(orderId.value),
    walletApi.overview(),
  ])
  order.value = fetched
  balanceCents.value = wallet.balance_cents
}

async function pay() {
  if (!order.value) return
  paying.value = true
  error.value = null
  try {
    result.value = await orderApi.pay(order.value.id)
    order.value = result.value.order
    // 支付扣了余额，同步顶栏显示的数字。
    await auth.refresh()
    const wallet = await walletApi.overview()
    balanceCents.value = wallet.balance_cents
    toast.success(t('checkout.success'))
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    paying.value = false
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
      <Card v-if="result">
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
              <RouterLink :to="{ name: 'invoice-detail', params: { id: result.invoice.id } }">
                {{ t('checkout.viewInvoice') }}
              </RouterLink>
            </Button>
          </div>
        </CardContent>
      </Card>

      <template v-else>
        <Alert>
          <Info />
          <AlertDescription>{{ t('checkout.fakeNotice') }}</AlertDescription>
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
            <div class="flex items-center justify-between rounded-lg border p-3">
              <span class="flex items-center gap-2 text-sm font-medium">
                <Wallet class="size-4" />
                {{ t('checkout.balance') }}
              </span>
              <span class="text-sm">
                {{ t('checkout.balanceAvailable') }}
                <Money :cents="balanceCents" class="ml-1 font-medium" />
              </span>
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
              <Button :disabled="!payable || insufficient || paying" @click="pay">
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
