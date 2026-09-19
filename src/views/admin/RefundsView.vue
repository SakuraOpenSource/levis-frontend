<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'
import { refundApi } from '@/lib/endpoints'
import { formatCents, formatDateTime } from '@/lib/utils'
import type { RefundRequest, RefundStatus } from '@/lib/types'

/**
 * 管理后台退款审批：全量申请列表 + 通过/驳回 + 渠道失败重试。
 * 顶部为退款策略卡片（自动审批 / 强制人工 / 满 N 小时不退）。
 */

const { t } = useI18n()

const items = ref<RefundRequest[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const statusFilter = ref<RefundStatus | ''>('')

// 策略编辑态。
const policy = ref({ force_manual: true, auto_approve_all: false, no_refund_after_hours: 0 })
const policySaving = ref(false)
const policySaved = ref(false)

// 审批弹窗态。
const reviewItem = ref<RefundRequest | null>(null)
const reviewApprove = ref(true)
const reviewRemark = ref('')
const reviewing = ref(false)
const reviewError = ref<string | null>(null)

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
    const [page, policyResult] = await Promise.all([
      refundApi.adminList({ status: statusFilter.value }),
      refundApi.policy(),
    ])
    items.value = page.items ?? []
    policy.value = policyResult
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function savePolicy() {
  policySaving.value = true
  policySaved.value = false
  try {
    policy.value = await refundApi.savePolicy({ ...policy.value })
    policySaved.value = true
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    policySaving.value = false
  }
}

function openReview(item: RefundRequest, approve: boolean) {
  reviewItem.value = item
  reviewApprove.value = approve
  reviewRemark.value = ''
  reviewError.value = null
}

async function submitReview() {
  if (!reviewItem.value) return
  reviewing.value = true
  reviewError.value = null
  try {
    await refundApi.adminReview(reviewItem.value.id, {
      approve: reviewApprove.value,
      remark: reviewRemark.value.trim(),
    })
    reviewItem.value = null
    await load()
  } catch (err) {
    reviewError.value = errorMessage(err)
  } finally {
    reviewing.value = false
  }
}

async function retry(item: RefundRequest) {
  error.value = null
  try {
    await refundApi.adminRetry(item.id)
    await load()
  } catch (err) {
    error.value = errorMessage(err)
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ t('admin.refundsTitle') }}</h1>
        <p class="text-muted-foreground text-sm">{{ t('admin.refundsSubtitle') }}</p>
      </div>
      <select
        v-model="statusFilter"
        class="border-input bg-background h-9 rounded-md border px-3 text-sm"
        @change="load"
      >
        <option value="">{{ t('refund.filterAll') }}</option>
        <option value="pending">{{ t('refund.status.pending') }}</option>
        <option value="approved">{{ t('refund.status.approved') }}</option>
        <option value="failed">{{ t('refund.status.failed') }}</option>
        <option value="refunded">{{ t('refund.status.refunded') }}</option>
        <option value="rejected">{{ t('refund.status.rejected') }}</option>
        <option value="canceled">{{ t('refund.status.canceled') }}</option>
      </select>
    </header>

    <ErrorAlert v-if="error" :message="error" />
    <LoadingBlock v-if="loading" :rows="6" />

    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle>{{ t('admin.refundPolicyTitle') }}</CardTitle>
          <CardDescription>{{ t('admin.refundPolicySubtitle') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="flex max-w-xl items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <Label for="policy-force-manual">{{ t('admin.refundForceManual') }}</Label>
              <p class="text-muted-foreground text-xs">{{ t('admin.refundForceManualHint') }}</p>
            </div>
            <Switch id="policy-force-manual" v-model="policy.force_manual" />
          </div>
          <div class="flex max-w-xl items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <Label for="policy-auto-all">{{ t('admin.refundAutoAll') }}</Label>
              <p class="text-muted-foreground text-xs">{{ t('admin.refundAutoAllHint') }}</p>
            </div>
            <Switch id="policy-auto-all" v-model="policy.auto_approve_all" />
          </div>
          <div class="max-w-xs space-y-2">
            <Label for="policy-no-refund-hours">{{ t('admin.refundNoRefundHours') }}</Label>
            <div class="flex items-center gap-2">
              <Input id="policy-no-refund-hours" v-model.number="policy.no_refund_after_hours" type="number" min="0" />
              <span class="text-muted-foreground shrink-0 text-xs">{{ t('refund.hours') }}</span>
            </div>
            <p class="text-muted-foreground text-xs">{{ t('admin.refundNoRefundHoursHint') }}</p>
          </div>
          <div class="flex items-center gap-3">
            <Button size="sm" :disabled="policySaving" @click="savePolicy">{{ t('common.save') }}</Button>
            <span v-if="policySaved" class="text-muted-foreground text-xs">{{ t('common.saved') }}</span>
          </div>
        </CardContent>
      </Card>

      <Card v-if="items.length === 0">
        <CardContent class="text-muted-foreground py-12 text-center text-sm">
          {{ t('refund.emptyAdmin') }}
        </CardContent>
      </Card>

      <div v-else class="space-y-3">
        <Card v-for="item in items" :key="item.id">
          <CardContent class="space-y-2 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium tabular">{{ item.refund_no }}</span>
                <Badge :variant="STATUS_VARIANT[item.status]">
                  {{ t(`refund.status.${item.status}`) }}
                </Badge>
                <span class="text-muted-foreground text-xs">UID {{ item.user_id }}</span>
              </div>
              <span class="text-sm font-semibold tabular">{{ formatCents(item.amount_cents) }}</span>
            </div>
            <p class="text-sm">{{ item.reason }}</p>
            <div class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs tabular">
              <span>{{ formatDateTime(item.created_at) }}</span>
              <span v-if="item.channel_cents > 0">{{ t('refund.channelPart') }} {{ formatCents(item.channel_cents) }}</span>
              <span v-if="item.balance_cents > 0">{{ t('refund.balancePart') }} {{ formatCents(item.balance_cents) }}</span>
              <span>{{ t('refund.order') }} #{{ item.order_id }}</span>
              <span v-if="item.fail_reason" class="text-destructive">{{ item.fail_reason }}</span>
            </div>
            <div class="flex flex-wrap gap-2 pt-1">
              <Button v-if="item.status === 'pending'" size="sm" @click="openReview(item, true)">
                {{ t('refund.approve') }}
              </Button>
              <Button v-if="item.status === 'pending'" size="sm" variant="outline" @click="openReview(item, false)">
                {{ t('refund.reject') }}
              </Button>
              <Button v-if="item.status === 'failed'" size="sm" variant="outline" @click="retry(item)">
                {{ t('refund.retry') }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <Dialog :open="reviewItem !== null" @update:open="reviewItem = null">
      <DialogContent v-if="reviewItem">
        <DialogHeader>
          <DialogTitle>
            {{ reviewApprove ? t('refund.approve') : t('refund.reject') }} · {{ reviewItem.refund_no }}
          </DialogTitle>
          <DialogDescription>
            {{ formatCents(reviewItem.amount_cents) }} ·
            {{ reviewApprove ? t('refund.approveHint') : t('refund.rejectHint') }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="review-remark">{{ t('refund.reviewRemarkLabel') }}</Label>
            <Textarea id="review-remark" v-model="reviewRemark" rows="3" maxlength="500" />
          </div>
          <ErrorAlert :message="reviewError" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="reviewItem = null">{{ t('common.cancel') }}</Button>
          <Button
            :variant="reviewApprove ? 'default' : 'destructive'"
            :disabled="reviewing || (!reviewApprove && !reviewRemark.trim())"
            @click="submitReview"
          >
            {{ reviewApprove ? t('refund.approve') : t('refund.reject') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
