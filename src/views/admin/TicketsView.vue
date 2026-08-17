<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { adminApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/utils'
import { TICKET_STATUSES, type Ticket, type TicketStatus } from '@/lib/types'

const { t } = useI18n()

const items = ref<Ticket[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
// Select 不接受空值作为选项，用 all 表示不过滤，请求时再转成 undefined。
const status = ref<TicketStatus | 'all'>('all')
const loading = ref(true)
const error = ref<string | null>(null)

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await adminApi.tickets({
      page: target,
      page_size: pageSize.value,
      status: status.value === 'all' ? undefined : status.value,
    })
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
    <PageHeader :title="t('admin.ticketsTitle')" :description="t('admin.ticketsSubtitle')" />

    <div class="flex max-w-xs items-center gap-2">
      <Label for="ticket-status" class="shrink-0 text-sm">{{ t('admin.filterByStatus') }}</Label>
      <Select v-model="status" @update:model-value="load(1)">
        <SelectTrigger id="ticket-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{{ t('tickets.filterAll') }}</SelectItem>
          <SelectItem v-for="value in TICKET_STATUSES" :key="value" :value="value">
            {{ t(`ticketStatus.${value}`) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="5" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('tickets.ticketNo') }}</TableHead>
                <TableHead>{{ t('tickets.subject') }}</TableHead>
                <TableHead>{{ t('tickets.submitter') }}</TableHead>
                <TableHead>{{ t('tickets.status') }}</TableHead>
                <TableHead>{{ t('tickets.lastReply') }}</TableHead>
                <TableHead>{{ t('tickets.createdAt') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="6">{{ t('common.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ item.ticket_no }}
                </TableCell>
                <TableCell class="font-medium">
                  <RouterLink
                    :to="{ name: 'admin-ticket-detail', params: { id: item.id } }"
                    class="hover:underline"
                  >
                    {{ item.subject }}
                  </RouterLink>
                </TableCell>
                <TableCell>{{ item.username }}</TableCell>
                <TableCell><StateBadge kind="ticket" :value="item.status" /></TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ formatDateTime(item.last_reply_at) }}
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
