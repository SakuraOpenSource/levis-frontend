<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Card, CardContent } from '@/components/ui/card'
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

const items = ref<Invoice[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<string | null>(null)

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await invoiceApi.list({ page: target, page_size: pageSize.value })
    items.value = result.items ?? []
    total.value = result.total
    page.value = result.page
    pageSize.value = result.page_size
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('invoices.title')" :description="t('invoices.subtitle')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('invoices.invoiceNo') }}</TableHead>
                <TableHead>{{ t('invoices.status') }}</TableHead>
                <TableHead class="text-right">{{ t('invoices.total') }}</TableHead>
                <TableHead>{{ t('invoices.dueAt') }}</TableHead>
                <TableHead>{{ t('invoices.paidAt') }}</TableHead>
                <TableHead>{{ t('invoices.createdAt') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="6">{{ t('invoices.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium tabular">
                  <RouterLink
                    :to="{ name: 'invoice-detail', params: { id: item.id } }"
                    class="hover:underline"
                  >
                    {{ item.invoice_no }}
                  </RouterLink>
                </TableCell>
                <TableCell><StateBadge kind="invoice" :value="item.status" /></TableCell>
                <TableCell class="text-right"><Money :cents="item.total_cents" /></TableCell>
                <TableCell class="tabular">
                  {{ isZeroTime(item.due_at) ? '-' : formatDate(item.due_at) }}
                </TableCell>
                <TableCell class="tabular">
                  {{ isZeroTime(item.paid_at) ? '-' : formatDateTime(item.paid_at) }}
                </TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ formatDateTime(item.created_at) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pager :page="page" :page-size="pageSize" :total="total" @change="load" />
    </template>
  </div>
</template>
