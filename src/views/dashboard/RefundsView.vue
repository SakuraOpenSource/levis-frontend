<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, errorMessage } from '@/lib/api'
import { refundApi } from '@/lib/endpoints'
import { formatCents, formatDateTime } from '@/lib/utils'
import type { RefundRequest, RefundStatus } from '@/lib/types'

/**
 * 用户退款中心：发起退款申请（按已支付订单/支付记录）、查看进度、
 * 撤回待审申请。策略判定由后端即时给出：自动通过的会直接退款。
 */

const { t } = useI18n()

const items = ref<RefundRequest[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// 申请表单：目标支付记录 ID + 原因。订单号可留空。
const open = ref(false)
const submitting = ref(false)
const formError = ref<string | null>(null)
const paymentId = ref('')
const reason = ref('')

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

async function submit() {
  formError.value = null
  submitting.value = true
  try {
    const payload: { payment_id?: number; reason: string } = { reason: reason.value.trim() }
    const pid = Number(paymentId.value)
    if (pid > 0) payload.payment_id = pid
    await refundApi.create(payload)
    open.value = false
    paymentId.value = ''
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

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ t('refund.title') }}</h1>
        <p class="text-muted-foreground text-sm">{{ t('refund.subtitle') }}</p>
      </div>
      <Dialog v-model:open="open">
        <DialogTrigger as-child>
          <Button>
            <RotateCcw class="mr-1 size-4" />
            {{ t('refund.new') }}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{ t('refund.new') }}</DialogTitle>
            <DialogDescription>{{ t('refund.newHint') }}</DialogDescription>
          </DialogHeader>
          <div class="space-y-4">
            <div class="space-y-2">
              <Label for="refund-payment">{{ t('refund.paymentId') }}</Label>
              <Input
                id="refund-payment"
                v-model="paymentId"
                type="number"
                min="1"
                :placeholder="t('refund.paymentIdPlaceholder')"
              />
              <p class="text-muted-foreground text-xs">{{ t('refund.paymentIdHint') }}</p>
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
            <Button :disabled="submitting || !reason.trim()" @click="submit">
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
