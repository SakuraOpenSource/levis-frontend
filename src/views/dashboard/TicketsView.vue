<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessageSquarePlus } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Button } from '@/components/ui/button'
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
import { ticketApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/utils'
import type { Ticket } from '@/lib/types'

const { t } = useI18n()

const items = ref<Ticket[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<string | null>(null)

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await ticketApi.list({ page: target, page_size: pageSize.value })
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
    <PageHeader :title="t('tickets.title')" :description="t('tickets.subtitle')">
      <template #actions>
        <Button as-child size="sm">
          <RouterLink :to="{ name: 'ticket-new' }">
            <MessageSquarePlus />
            {{ t('tickets.newTitle') }}
          </RouterLink>
        </Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('tickets.ticketNo') }}</TableHead>
                <TableHead>{{ t('tickets.subject') }}</TableHead>
                <TableHead>{{ t('tickets.status') }}</TableHead>
                <TableHead>{{ t('tickets.lastReply') }}</TableHead>
                <TableHead>{{ t('tickets.createdAt') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="5">{{ t('tickets.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ item.ticket_no }}
                </TableCell>
                <TableCell class="font-medium">
                  <RouterLink
                    :to="{ name: 'ticket-detail', params: { id: item.id } }"
                    class="hover:underline"
                  >
                    {{ item.subject }}
                  </RouterLink>
                </TableCell>
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
