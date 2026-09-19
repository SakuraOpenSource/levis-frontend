<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RotateCcw } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, errorMessage } from '@/lib/api'
import { refundApi, serviceApi } from '@/lib/endpoints'
import { formatCents, formatDateTime } from '@/lib/utils'
import type { RefundRequest, RefundStatus, Service } from '@/lib/types'

/**
 * 用户退款中心：按已开通的产品发起退款（订单与支付记录由后端自动解析）、
 * 查看进度、撤回待审申请。策略判定由后端即时给出。
 */

const { t } = useI18n()

const items = ref<RefundRequest[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// 可选产品（进行中或已停机的都能退，已删的不可退）。
const services = ref<Service[]>([])
const servicesLoading = ref(false)

const open = ref(false)
const submitting = ref(false)
const formError = ref<string | null>(null)
const serviceId = ref('')
const reason = ref('')

const selectableServices = computed(() =>
  services.value.filter((s) => s.status !== 'terminated' && s.status !== 'failed'),
)

const STATUS_VARIANT: Record<RefundStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  refunded: 'default',
  rejected: 'destructive',
  failed: 'destructive',
  canceled: 'outline',
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const page = await refundApi.list()
    items.value = page.items ?? []
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function openDialog() {
  open.value = true
  servicesLoading.value = true
  try {
    const page = await serviceApi.list()
    services.value = page.items ?? []
  } catch {
    services.value = []
  } finally {
    servicesLoading.value = false
  }
}

async function submit() {
  formError.value = null
  if (!serviceId.value) {
    formError.value = t('refund.selectServiceRequired')
    return
  }
  submitting.value = true
  try {
    await refundApi.create({ service_id: Number(serviceId.value), reason: reason.value.trim() })
    open.value = false
    serviceId.value = ''
    reason.value = ''
    await load()
  } catch (err) {
    formError.value = err instanceof ApiError ? err.message : errorMessage(err)
  } finally {
    submitting.value = false
  }
}

async function cancel(id: number) {
  try {
    await refundApi.cancel(id)
    await load()
  } catch (err) {
    error.value = errorMessage(err)
  }
}

function serviceLabel(s: Service) {
  return `#${s.id} ${s.name}`
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ t('refund.title') }}</h1>
        <p class="text-muted-foreground text-sm">{{ t('refund.subtitle') }}</p>
      </div>
      <Dialog v-model:open="open" @update:open="(v: boolean) => v && openDialog()">
        <Button @click="openDialog">
          <RotateCcw class="mr-1 size-4" />
          {{ t('refund.new') }}
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{ t('refund.new') }}</DialogTitle>
            <DialogDescription>{{ t('refund.newHintService') }}</DialogDescription>
          </DialogHeader>
          <div class="space-y-4">
            <div class="space-y-2">
              <Label for="refund-service">{{ t('refund.selectService') }}</Label>
              <Select v-model="serviceId">
                <SelectTrigger id="refund-service">
                  <SelectValue :placeholder="t('refund.selectServicePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-if="servicesLoading" value="__loading" disabled>{{ t('common.loading') }}</SelectItem>
                  <SelectItem v-for="s in selectableServices" :key="s.id" :value="String(s.id)">
                    {{ serviceLabel(s) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-muted-foreground text-xs">{{ t('refund.selectServiceHint') }}</p>
            </div>
            <div class="space-y-2">
              <Label for="refund-reason">{{ t('refund.reason') }}</Label>
              <Textarea
                id="refund-reason"
                v-model="reason"
                rows="4"
                maxlength="500"
                :placeholder="t('refund.reasonPlaceholder')"
              />
            </div>
            <ErrorAlert :message="formError" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="open = false">{{ t('common.cancel') }}</Button>
            <Button :disabled="submitting || !reason.trim() || !serviceId" @click="submit">
              {{ t('common.submit') }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>

    <ErrorAlert v-if="error" :message="error" />
    <LoadingBlock v-if="loading" :rows="5" />

    <Card v-else-if="items.length === 0">
      <CardContent class="text-muted-foreground py-12 text-center text-sm">
        {{ t('refund.empty') }}
      </CardContent>
    </Card>

    <div v-else class="space-y-3">
      <Card v-for="item in items" :key="item.id">
        <CardContent class="space-y-2 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium tabular">{{ item.refund_no }}</span>
              <Badge :variant="STATUS_VARIANT[item.status]">
                {{ t(`refund.status.${item.status}`) }}
              </Badge>
            </div>
            <span class="text-sm font-semibold tabular">{{ formatCents(item.amount_cents) }}</span>
          </div>
          <p class="text-muted-foreground text-sm">{{ item.reason }}</p>
          <div class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs tabular">
            <span>{{ formatDateTime(item.created_at) }}</span>
            <span v-if="item.channel_cents > 0">{{ t('refund.channelPart') }} {{ formatCents(item.channel_cents) }}</span>
            <span v-if="item.balance_cents > 0">{{ t('refund.balancePart') }} {{ formatCents(item.balance_cents) }}</span>
          </div>
          <p v-if="item.review_remark" class="rounded-md border p-2 text-xs">
            {{ t('refund.reviewRemark') }}：{{ item.review_remark }}
          </p>
          <p v-if="item.fail_reason" class="text-destructive text-xs">
            {{ t('refund.failReason') }}：{{ item.fail_reason }}
          </p>
          <div v-if="item.status === 'pending'" class="pt-1">
            <Button variant="outline" size="sm" @click="cancel(item.id)">
              {{ t('refund.cancel') }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
