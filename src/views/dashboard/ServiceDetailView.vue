<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, Loader2, RefreshCcw } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { serviceApi } from '@/lib/endpoints'
import { formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { Service } from '@/lib/types'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { cycleLabel, priceLabel } = useCycleLabel()

const item = ref<Service | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const renewing = ref(false)

/** 只有使用中且非一次性付费的服务才有「续费」一说。 */
const canRenew = computed(
  () => item.value?.status === 'active' && item.value.billing_cycle !== 'onetime',
)

async function load() {
  try {
    item.value = await serviceApi.get(Number(route.params.id))
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function renew() {
  if (!item.value) return
  const price = priceLabel(item.value.price_cents, item.value.billing_cycle)
  if (!window.confirm(t('services.renewConfirm', { price }))) return
  renewing.value = true
  try {
    const result = await serviceApi.renew(item.value.id)
    item.value = result.service
    toast.success(t('services.renewed'))
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    renewing.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="item?.name ?? t('services.detailTit')">
      <template #actions>
        <Button v-if="canRenew" size="sm" :disabled="renewing" @click="renew">
          <Loader2 v-if="renewing" class="animate-spin" />
          <RefreshCcw v-else />
          {{ t('services.renew') }}
        </Button>
        <Button variant="outline" size="sm" as-child>
          <RouterLink :to="{ name: 'services' }">
            <ArrowLeft />
            {{ t('common.back') }}
          </RouterLink>
        </Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="3" />

    <Card v-else-if="item">
      <CardContent>
        <dl class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.status') }}</dt>
            <dd class="mt-1"><StateBadge kind="service" :value="item.status" /></dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.cycle') }}</dt>
            <dd class="mt-1 text-sm">{{ cycleLabel(item.billing_cycle) }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.price') }}</dt>
            <dd class="mt-1 text-sm"><Money :cents="item.price_cents" /></dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.nextDue') }}</dt>
            <dd class="mt-1 text-sm tabular">
              {{ isZeroTime(item.next_due_at) ? '-' : formatDate(item.next_due_at) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.expires') }}</dt>
            <dd class="mt-1 text-sm tabular">
              {{ isZeroTime(item.expires_at) ? '-' : formatDate(item.expires_at) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.createdAt') }}</dt>
            <dd class="mt-1 text-sm tabular">{{ formatDateTime(item.created_at) }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('services.orderId') }}</dt>
            <dd class="mt-1 text-sm tabular">#{{ item.order_id }}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  </div>
</template>
