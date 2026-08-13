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
import { useCycleLabel } from '@/composables/useCycleLabel'
import { errorMessage } from '@/lib/api'
import { serviceApi } from '@/lib/endpoints'
import { formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { Service } from '@/lib/types'

const { t } = useI18n()
const { cycleLabel } = useCycleLabel()

const items = ref<Service[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<string | null>(null)

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await serviceApi.list({ page: target, page_size: pageSize.value })
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
    <PageHeader :title="t('services.title')" :description="t('services.subtitle')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('services.name') }}</TableHead>
                <TableHead>{{ t('services.status') }}</TableHead>
                <TableHead>{{ t('services.cycle') }}</TableHead>
                <TableHead class="text-right">{{ t('services.price') }}</TableHead>
                <TableHead>{{ t('services.nextDue') }}</TableHead>
                <TableHead>{{ t('services.createdAt') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="6">{{ t('services.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium">
                  <RouterLink
                    :to="{ name: 'service-detail', params: { id: item.id } }"
                    class="hover:underline"
                  >
                    {{ item.name }}
                  </RouterLink>
                </TableCell>
                <TableCell><StateBadge kind="service" :value="item.status" /></TableCell>
                <TableCell>{{ cycleLabel(item.billing_cycle) }}</TableCell>
                <TableCell class="text-right"><Money :cents="item.price_cents" /></TableCell>
                <TableCell class="tabular">
                  {{ isZeroTime(item.next_due_at) ? '-' : formatDate(item.next_due_at) }}
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
