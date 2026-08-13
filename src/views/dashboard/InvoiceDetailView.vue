<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

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
import { invoiceApi } from '@/lib/endpoints'
import { formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { Invoice } from '@/lib/types'

const { t } = useI18n()
const route = useRoute()

const invoice = ref<Invoice | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    invoice.value = await invoiceApi.get(Number(route.params.id))
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
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
      <Card>
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
