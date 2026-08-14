<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, Loader2, Pause, Play, Trash2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
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
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import { formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { Service } from '@/lib/types'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const userId = Number(route.params.id)
const username = (route.query.name as string) ?? ''

const items = ref<Service[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<string | null>(null)
/** 正在停用/恢复/删除的服务 ID，用于按钮的局部 loading。 */
const busyId = ref<number | null>(null)

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await adminApi.userServices(userId, {
      page: target,
      page_size: pageSize.value,
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

/** 停用 / 恢复：使用中 → 暂停，暂停 → 使用中。 */
async function toggleStatus(item: Service) {
  const next = item.status === 'active' ? 'suspended' : 'active'
  // 停用影响用户正常使用，多问一句；恢复可即时执行。
  if (next === 'suspended' && !window.confirm(t('admin.suspendServiceConfirm', { name: item.name }))) {
    return
  }
  busyId.value = item.id
  try {
    await adminApi.updateService(item.id, next)
    toast.success(next === 'suspended' ? t('admin.suspended') : t('admin.resumed'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busyId.value = null
  }
}

async function remove(item: Service) {
  if (!window.confirm(t('admin.deleteServiceConfirm', { name: item.name }))) return
  busyId.value = item.id
  try {
    await adminApi.deleteService(item.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busyId.value = null
  }
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="username ? t('admin.userServicesTitle', { name: username }) : t('admin.userServicesTitleRaw')"
      :description="t('admin.userServicesSubtitle')"
    >
      <template #actions>
        <Button variant="outline" size="sm" as-child>
          <RouterLink :to="{ name: 'admin-users' }">
            <ArrowLeft />
            {{ t('common.back') }}
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
                <TableHead>{{ t('services.name') }}</TableHead>
                <TableHead>{{ t('services.status') }}</TableHead>
                <TableHead>{{ t('services.cycle') }}</TableHead>
                <TableHead class="text-right">{{ t('services.price') }}</TableHead>
                <TableHead>{{ t('services.expires') }}</TableHead>
                <TableHead>{{ t('services.createdAt') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="7">{{ t('services.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium">{{ item.name }}</TableCell>
                <TableCell><StateBadge kind="service" :value="item.status" /></TableCell>
                <TableCell>{{ cycleLabel(item.billing_cycle) }}</TableCell>
                <TableCell class="text-right"><Money :cents="item.price_cents" /></TableCell>
                <TableCell class="tabular">
                  {{ isZeroTime(item.expires_at) ? '-' : formatDate(item.expires_at) }}
                </TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ formatDateTime(item.created_at) }}
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-if="item.status === 'active'"
                      variant="ghost"
                      size="sm"
                      :disabled="busyId === item.id"
                      @click="toggleStatus(item)"
                    >
                      <Loader2 v-if="busyId === item.id" class="animate-spin" />
                      <Pause v-else />
                      {{ t('admin.suspend') }}
                    </Button>
                    <Button
                      v-else-if="item.status === 'suspended'"
                      variant="ghost"
                      size="sm"
                      :disabled="busyId === item.id"
                      @click="toggleStatus(item)"
                    >
                      <Loader2 v-if="busyId === item.id" class="animate-spin" />
                      <Play v-else />
                      {{ t('admin.resume') }}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :disabled="busyId === item.id"
                      :aria-label="t('common.delete')"
                      @click="remove(item)"
                    >
                      <Trash2 class="text-destructive" />
                    </Button>
                  </div>
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
