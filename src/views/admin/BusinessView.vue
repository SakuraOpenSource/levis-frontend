<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, RotateCcw, Search } from 'lucide-vue-next'

import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import { formatDate, isZeroTime } from '@/lib/utils'
import type { Product, Service, ServiceStatus } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const items = ref<Service[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const error = ref<string | null>(null)
const retryingId = ref<number | null>(null)

// Select 不接受空值：allStatus / allProducts 为「不过滤」哨兵。
const status = ref<ServiceStatus | 'all'>('all')
const productId = ref('all')
const userIdText = ref('')

const products = ref<Product[]>([])

const STATUSES: ServiceStatus[] = ['pending', 'failed', 'active', 'suspended', 'terminated']

const productNames = computed(() => {
  const map = new Map<number, string>()
  for (const item of products.value) map.set(item.id, item.name)
  return map
})

const canRetry = (item: Service) => item.status === 'pending' || item.status === 'failed'

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const userId = Number(userIdText.value)
    const result = await adminApi.services({
      page: target,
      page_size: pageSize.value,
      user_id: userIdText.value.trim() && Number.isFinite(userId) && userId > 0 ? userId : undefined,
      product_id: productId.value === 'all' ? undefined : Number(productId.value),
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

const retryOpen = ref(false)
const retryTarget = ref<Service | null>(null)

function askRetry(item: Service) {
  retryTarget.value = item
  retryOpen.value = true
}

async function retry() {
  const item = retryTarget.value
  retryOpen.value = false
  if (!item) return
  retryingId.value = item.id
  try {
    await adminApi.retryService(item.id)
    toast.success(t('business.retried'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    retryingId.value = null
    retryTarget.value = null
  }
}

onMounted(async () => {
  try {
    const result = await adminApi.products({ page: 1, page_size: 200 })
    products.value = result.items ?? []
  } catch {
    products.value = []
  }
  await load()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('business.title')" :description="t('business.subtitle')" />

    <div class="flex flex-wrap items-end gap-3">
      <div class="w-40 space-y-1.5">
        <Label for="biz-user">{{ t('business.filterUserId') }}</Label>
        <div class="flex gap-1.5">
          <Input
            id="biz-user"
            v-model="userIdText"
            inputmode="numeric"
            :placeholder="t('business.filterUserIdHint')"
            @keyup.enter="load(1)"
          />
          <Button variant="outline" size="icon" class="size-9 shrink-0" :aria-label="t('common.search')" @click="load(1)">
            <Search />
          </Button>
        </div>
      </div>
      <div class="w-52 space-y-1.5">
        <Label for="biz-product">{{ t('business.filterProduct') }}</Label>
        <Select v-model="productId" @update:model-value="load(1)">
          <SelectTrigger id="biz-product">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('business.filterAllProducts') }}</SelectItem>
            <SelectItem v-for="item in products" :key="item.id" :value="String(item.id)">
              {{ item.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="w-44 space-y-1.5">
        <Label for="biz-status">{{ t('services.status') }}</Label>
        <Select v-model="status" @update:model-value="load(1)">
          <SelectTrigger id="biz-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('tickets.filterAll') }}</SelectItem>
            <SelectItem v-for="value in STATUSES" :key="value" :value="value">
              {{ t(`serviceStatus.${value}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="5" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{{ t('business.buyer') }}</TableHead>
                <TableHead>{{ t('services.name') }}</TableHead>
                <TableHead>{{ t('business.product') }}</TableHead>
                <TableHead>{{ t('services.status') }}</TableHead>
                <TableHead>{{ t('business.provisionError') }}</TableHead>
                <TableHead class="text-right">{{ t('services.price') }}</TableHead>
                <TableHead>{{ t('services.expires') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="9">{{ t('business.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-mono text-xs tabular">{{ item.id }}</TableCell>
                <TableCell class="tabular">#{{ item.user_id }}</TableCell>
                <TableCell class="max-w-44 truncate font-medium" :title="item.name">
                  {{ item.name }}
                </TableCell>
                <TableCell class="max-w-40 truncate text-xs text-muted-foreground" :title="productNames.get(item.product_id) ?? ''">
                  {{ productNames.get(item.product_id) ?? `#${item.product_id} · ${cycleLabel(item.billing_cycle)}` }}
                </TableCell>
                <TableCell><StateBadge kind="service" :value="item.status" /></TableCell>
                <TableCell class="max-w-56 truncate text-xs text-destructive" :title="item.provision_error || ''">
                  {{ item.provision_error || '-' }}
                </TableCell>
                <TableCell class="text-right"><Money :cents="item.price_cents" /></TableCell>
                <TableCell class="text-xs tabular">
                  {{ isZeroTime(item.expires_at) ? '-' : formatDate(item.expires_at) }}
                </TableCell>
                <TableCell class="text-right">
                  <Button
                    v-if="canRetry(item)"
                    variant="ghost"
                    size="sm"
                    :disabled="retryingId === item.id"
                    @click="askRetry(item)"
                  >
                    <Loader2 v-if="retryingId === item.id" class="animate-spin" />
                    <RotateCcw v-else />
                    {{ t('business.retry') }}
                  </Button>
                  <span v-else class="text-xs text-muted-foreground">-</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pager :page="page" :page-size="pageSize" :total="total" @change="load" />
    </template>

    <ConfirmDialog
      v-model:open="retryOpen"
      :title="t('business.retry')"
      :description="retryTarget ? t('business.retryConfirm', { name: retryTarget.name }) : ''"
      :confirm-text="t('common.retry')"
      @confirm="retry"
    />
  </div>
</template>
