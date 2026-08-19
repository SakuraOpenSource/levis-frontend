<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, ExternalLink, RefreshCcw } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api'
import { invoiceApi, paymentApi } from '@/lib/endpoints'
import { formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { ExternalPayment, Invoice, PaymentMethod } from '@/lib/types'

const { t } = useI18n()
const route = useRoute()

const invoice = ref<Invoice | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const methods = ref<PaymentMethod[]>([])
const selectedMethod = ref('')
const payment = ref<ExternalPayment | null>(null)
const paying = ref(false)
const querying = ref(false)

onMounted(async () => {
  try {
    const [fetched, availableMethods] = await Promise.all([
      invoiceApi.get(Number(route.params.id)),
      paymentApi.methods(),
    ])
    invoice.value = fetched
    methods.value = availableMethods
    selectedMethod.value = availableMethods[0]?.id ?? ''
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})

function openPayment() {
  if (payment.value?.pay_url) window.open(payment.value.pay_url, '_blank', 'noopener,noreferrer')
}

async function payInvoice() {
  if (!invoice.value || invoice.value.status !== 'unpaid') return
  if (!selectedMethod.value) {
    error.value = t('payment.methodRequired')
    return
  }
  paying.value = true
  error.value = null
  try {
    payment.value = await paymentApi.create('invoice', invoice.value.id, selectedMethod.value)
    if (payment.value.pay_url) window.open(payment.value.pay_url, '_blank', 'noopener,noreferrer')
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
    if (payment.value.status === 'paid') invoice.value = await invoiceApi.get(Number(route.params.id))
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    querying.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="invoice?.invoice_no ?? t('invoices.detailTitle')">
      <template #actions>
        <Button variant="outline" size="sm" as-child>
          <RouterLink :to="{ name: 'invoices' }">
            <ArrowLeft />
            {{ t('common.back') }}
          </RouterLink>
        </Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="3" />

    <template v-else-if="invoice">
      <Card v-if="invoice.status === 'unpaid'" class="border-primary">
        <CardContent class="space-y-4 py-5">
          <div class="space-y-2">
            <label for="invoice-payment-method" class="text-sm font-medium">{{ t('payment.method') }}</label>
            <select id="invoice-payment-method" v-model="selectedMethod" class="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none" :disabled="!methods.length || paying">
              <option value="" disabled>{{ methods.length ? t('payment.selectMethod') : t('payment.unavailable') }}</option>
              <option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option>
            </select>
          </div>
          <Button :disabled="!methods.length || paying" @click="payInvoice">{{ paying ? t('payment.creating') : t('invoices.pay') }}</Button>
          <div v-if="payment" class="space-y-3 rounded-lg border p-3 text-sm">
            <div class="flex items-center justify-between gap-3"><span>{{ t('payment.status') }}</span><span :class="payment.status === 'failed' ? 'text-destructive' : 'font-medium'">{{ t(`payment.${payment.status}`) }}</span></div>
            <p v-if="payment.status === 'failed'" class="text-destructive text-xs">{{ payment.failure_reason || t('payment.failed') }}</p>
            <div v-if="payment.status === 'pending'" class="flex flex-wrap gap-2">
              <Button v-if="payment.pay_url" variant="outline" size="sm" @click="openPayment"><ExternalLink />{{ t('payment.open') }}</Button>
              <Button variant="outline" size="sm" :disabled="querying" @click="queryPayment"><RefreshCcw :class="querying ? 'animate-spin' : ''" />{{ querying ? t('payment.querying') : t('payment.query') }}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="pb-0">
        <CardContent>
          <dl class="grid gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('invoices.status') }}</dt>
              <dd class="mt-1"><StateBadge kind="invoice" :value="invoice.status" /></dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('invoices.total') }}</dt>
              <dd class="mt-1">
                <Money :cents="invoice.total_cents" class="text-lg font-semibold" />
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('invoices.dueAt') }}</dt>
              <dd class="mt-1 text-sm tabular">
                {{ isZeroTime(invoice.due_at) ? '-' : formatDate(invoice.due_at) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('invoices.paidAt') }}</dt>
              <dd class="mt-1 text-sm tabular">
                {{ isZeroTime(invoice.paid_at) ? '-' : formatDateTime(invoice.paid_at) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('invoices.createdAt') }}</dt>
              <dd class="mt-1 text-sm tabular">{{ formatDateTime(invoice.created_at) }}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card class="pb-0">
        <CardHeader>
          <CardTitle class="text-base">{{ t('invoices.items') }}</CardTitle>
        </CardHeader>
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('invoices.description') }}</TableHead>
                <TableHead class="text-right">{{ t('invoices.amount') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!invoice.items?.length" :colspan="2">
                {{ t('common.empty') }}
              </TableEmpty>
              <TableRow v-for="item in invoice.items ?? []" v-else :key="item.id">
                <TableCell>{{ item.description }}</TableCell>
                <TableCell class="text-right"><Money :cents="item.amount_cents" /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Separator />
          <div class="flex items-center justify-between px-6 py-4">
            <span class="text-sm font-medium">{{ t('cart.total') }}</span>
            <Money :cents="invoice.total_cents" class="text-lg font-semibold" />
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
