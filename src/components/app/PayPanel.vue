<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Loader2, RefreshCcw, XCircle } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PayIcon from '@/components/app/PayIcon.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { errorMessage } from '@/lib/api'
import { invoiceApi, orderApi, paymentApi } from '@/lib/endpoints'
import type { ExternalPayment, PaymentMethod } from '@/lib/types'
import { formatCents } from '@/lib/utils'

const props = defineProps<{
  totalCents: number
  balanceCents: number
  purpose: 'order' | 'invoice'
  targetId: number
}>()

const emit = defineEmits<{ paid: [] }>()

const { t } = useI18n()

const methods = ref<PaymentMethod[]>([])
const loadingMethods = ref(true)
const methodsError = ref<string | null>(null)

/** 'balance' 为余额全额结算的伪选项，其余为外部支付方式 ID。 */
const selected = ref('balance')
const deductYuan = ref('0')
const payment = ref<ExternalPayment | null>(null)
const paying = ref(false)
const querying = ref(false)
const cancelling = ref(false)
const error = ref<string | null>(null)

const maxDeductCents = computed(() => Math.max(0, Math.min(props.balanceCents, props.totalCents)))
const balanceCovers = computed(() => props.balanceCents >= props.totalCents)

function defaultDeductYuan() {
  return (maxDeductCents.value / 100).toFixed(2)
}

/** 输入框是字符串：解析失败按 0 处理，提交前再钳位。 */
const deductCents = computed(() => {
  const raw = Number(deductYuan.value)
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(maxDeductCents.value, Math.max(0, Math.round(raw * 100)))
})

const isExternal = computed(() => selected.value !== 'balance')
const showDeduct = computed(() => isExternal.value && props.balanceCents > 0)
/** 余额伪选项或抵扣拉满都走全额余额结算，无需跳转渠道。 */
const isBalancePath = computed(() => !isExternal.value || deductCents.value >= props.totalCents)
const onlineCents = computed(() => (isBalancePath.value ? 0 : props.totalCents - deductCents.value))

const payDisabled = computed(() => {
  if (paying.value || loadingMethods.value) return true
  if (payment.value?.status === 'pending') return true
  if (isBalancePath.value) return !balanceCovers.value
  return !selected.value || !methods.value.length
})

const payLabel = computed(() => {
  if (!paying.value) return t('checkout.pay')
  return isBalancePath.value ? t('checkout.paying') : t('payment.creating')
})

function clampDeduct() {
  deductYuan.value = (deductCents.value / 100).toFixed(2)
}

function openPayment() {
  if (payment.value?.pay_url) window.open(payment.value.pay_url, '_blank', 'noopener,noreferrer')
}

async function loadMethods() {
  loadingMethods.value = true
  methodsError.value = null
  try {
    methods.value = await paymentApi.methods()
  } catch (err) {
    methodsError.value = errorMessage(err)
    methods.value = []
  } finally {
    loadingMethods.value = false
  }
  // 默认选中：余额够就走余额，否则落在第一个外部方式上。
  if (balanceCovers.value) {
    selected.value = 'balance'
  } else {
    selected.value = methods.value[0]?.id ?? 'balance'
  }
  deductYuan.value = defaultDeductYuan()
}

async function pay() {
  if (payDisabled.value) return
  paying.value = true
  error.value = null
  try {
    if (isBalancePath.value) {
      if (props.purpose === 'order') await orderApi.pay(props.targetId)
      else await invoiceApi.pay(props.targetId)
      emit('paid')
      return
    }
    const intent = await paymentApi.create(props.purpose, props.targetId, selected.value, deductCents.value)
    if (intent.status === 'paid') {
      emit('paid')
      return
    }
    payment.value = intent
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
  error.value = null
  try {
    payment.value = await paymentApi.query(payment.value.id)
    if (payment.value.status === 'paid') emit('paid')
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    querying.value = false
  }
}

async function cancelPayment() {
  if (!payment.value) return
  cancelling.value = true
  error.value = null
  try {
    await paymentApi.cancel(payment.value.id)
    payment.value = null
    error.value = null
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    cancelling.value = false
  }
}

/** 父级刷新余额/总额后同步抵扣默认值；已有待支付单时不碰用户输入。 */
watch(
  () => [props.totalCents, props.balanceCents] as const,
  () => {
    if (payment.value) return
    deductYuan.value = defaultDeductYuan()
    if (balanceCovers.value && !methods.value.length) selected.value = 'balance'
  },
)

onMounted(loadMethods)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">{{ t('checkout.payMethod') }}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <ErrorAlert :message="methodsError" />
      <ErrorAlert :message="error" />
      <LoadingBlock v-if="loadingMethods" :rows="2" />

      <template v-else>
        <Alert v-if="!methods.length && !balanceCovers" variant="warning">
          <AlertDescription>{{ t('payment.unavailable') }}</AlertDescription>
        </Alert>

        <div role="radiogroup" :aria-label="t('payment.method')" class="space-y-2">
          <label
            class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-[border-color,box-shadow] duration-150 has-checked:border-primary has-checked:shadow-xs focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 has-checked:bg-primary/5"
            :class="balanceCents < totalCents ? 'opacity-70' : ''"
          >
            <input
              v-model="selected"
              type="radio"
              value="balance"
              name="pay-method"
              class="size-4 shrink-0 cursor-pointer accent-primary"
              :disabled="balanceCents < totalCents"
            />
            <PayIcon icon="wallet" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium">{{ t('payment.balance') }}</span>
              <span class="text-muted-foreground block text-xs">
                {{ t('checkout.balanceAvailable') }}：{{ formatCents(balanceCents) }}
                <template v-if="balanceCents < totalCents"> · {{ t('checkout.insufficient') }}</template>
              </span>
            </span>
          </label>

          <label
            v-for="method in methods"
            :key="method.id"
            class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-[border-color,box-shadow] duration-150 has-checked:border-primary has-checked:shadow-xs focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 has-checked:bg-primary/5"
          >
            <input
              v-model="selected"
              type="radio"
              :value="method.id"
              name="pay-method"
              class="size-4 shrink-0 cursor-pointer accent-primary"
            />
            <PayIcon :icon="method.icon" />
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ method.name }}</span>
          </label>
        </div>

        <div v-if="showDeduct" class="space-y-2">
          <Label for="pay-deduct">{{ t('payment.deduct') }}</Label>
          <Input
            id="pay-deduct"
            v-model="deductYuan"
            type="number"
            min="0"
            :max="(maxDeductCents / 100).toFixed(2)"
            step="0.01"
            @change="clampDeduct"
          />
          <p class="text-muted-foreground text-xs">{{ t('payment.deductMax', { amount: formatCents(maxDeductCents) }) }}</p>
        </div>

        <div class="space-y-1.5 rounded-lg border p-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground">{{ t('payment.balanceDeduct') }}</span>
            <Money :cents="isBalancePath ? totalCents : deductCents" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground">{{ t('payment.onlinePay') }}</span>
            <Money :cents="onlineCents" class="font-medium" />
          </div>
          <Separator class="my-1" />
          <div class="flex items-center justify-between gap-3">
            <span class="font-medium">{{ t('cart.total') }}</span>
            <Money :cents="totalCents" class="font-semibold" />
          </div>
        </div>

        <p v-if="isExternal && isBalancePath && balanceCovers" class="text-muted-foreground text-xs">
          {{ t('payment.fullSettleHint') }}
        </p>
        <p v-else-if="isExternal" class="text-muted-foreground text-xs">{{ t('payment.externalHint') }}</p>

        <div v-if="payment" class="space-y-3 rounded-lg border p-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <span>{{ t('payment.status') }}</span>
            <span :class="payment.status === 'failed' ? 'text-destructive' : 'font-medium'">
              {{ t(`payment.${payment.status}`) }}
            </span>
          </div>
          <p v-if="payment.status === 'failed'" class="text-destructive text-xs">
            {{ payment.failure_reason || t('payment.failed') }}
          </p>
          <div v-if="payment.status === 'pending'" class="flex flex-wrap gap-2">
            <Button v-if="payment.pay_url" variant="outline" size="sm" @click="openPayment">
              <ExternalLink />
              {{ t('payment.open') }}
            </Button>
            <Button variant="outline" size="sm" :disabled="querying" @click="queryPayment">
              <RefreshCcw :class="querying ? 'animate-spin' : ''" />
              {{ querying ? t('payment.querying') : t('payment.query') }}
            </Button>
            <Button variant="ghost" size="sm" :disabled="cancelling" @click="cancelPayment">
              <XCircle :class="cancelling ? 'animate-spin' : ''" />
              {{ cancelling ? t('payment.cancelling') : t('payment.cancelPay') }}
            </Button>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <Button :disabled="payDisabled" @click="pay">
            <Loader2 v-if="paying" class="animate-spin" />
            {{ payLabel }}
          </Button>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
