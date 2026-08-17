<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Loader2, Search, X } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import StateBadge from '@/components/app/StateBadge.vue'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/utils'
import { KYC_STATUSES, type KYCStatus, type Verification } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()

const items = ref<Verification[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
// Select 不接受空值，用 all 表示不过滤。默认只看待审核的：管理员打开这页就是来清队列的。
const status = ref<KYCStatus | 'all'>('pending')
const loading = ref(true)
const error = ref<string | null>(null)

const detailOpen = ref(false)
// 详情里的号码是完整的，只在对话框打开期间存在。
const detail = ref<Verification | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)
const acting = ref(false)

const rejectOpen = ref(false)
const reason = ref('')
// 驳回对话框盖在详情之上，错误得就近显示 —— 写到 detailError 里会被挡住看不见。
const rejectError = ref<string | null>(null)

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await adminApi.verifications({
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

async function openDetail(record: Verification) {
  detail.value = null
  detailError.value = null
  detailOpen.value = true
  detailLoading.value = true
  try {
    // 列表里的号码是打码的，审核要完整号码，得单独拉详情。
    detail.value = await adminApi.verification(record.id)
  } catch (err) {
    detailError.value = errorMessage(err)
  } finally {
    detailLoading.value = false
  }
}

async function approve() {
  if (!detail.value) return
  if (!window.confirm(t('admin.approveConfirm'))) return
  acting.value = true
  try {
    await adminApi.approveVerification(detail.value.id)
    toast.success(t('admin.approved'))
    detailOpen.value = false
    await load()
  } catch (err) {
    detailError.value = errorMessage(err)
  } finally {
    acting.value = false
  }
}

function openReject() {
  reason.value = ''
  rejectError.value = null
  rejectOpen.value = true
}

async function reject() {
  if (!detail.value) return
  if (!reason.value.trim()) {
    rejectError.value = t('error.required')
    return
  }
  acting.value = true
  try {
    await adminApi.rejectVerification(detail.value.id, reason.value.trim())
    toast.success(t('admin.rejected'))
    rejectOpen.value = false
    detailOpen.value = false
    await load()
  } catch (err) {
    rejectError.value = errorMessage(err)
  } finally {
    acting.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="t('admin.verificationsTitle')"
      :description="t('admin.verificationsSubtitle')"
    />

    <div class="flex max-w-xs items-center gap-2">
      <Label for="kyc-status" class="shrink-0 text-sm">{{ t('admin.filterByStatus') }}</Label>
      <Select v-model="status" @update:model-value="load(1)">
        <SelectTrigger id="kyc-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{{ t('tickets.filterAll') }}</SelectItem>
          <SelectItem v-for="value in KYC_STATUSES" :key="value" :value="value">
            {{ t(`kycStatus.${value}`) }}
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
                <TableHead>{{ t('admin.username') }}</TableHead>
                <TableHead>{{ t('admin.realName') }}</TableHead>
                <TableHead>{{ t('admin.idNumber') }}</TableHead>
                <TableHead>{{ t('tickets.status') }}</TableHead>
                <TableHead>{{ t('admin.submittedAt') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="6">
                {{ t('admin.noVerifications') }}
              </TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium">{{ item.username }}</TableCell>
                <TableCell>{{ item.real_name }}</TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ item.id_number }}
                </TableCell>
                <TableCell><StateBadge kind="kyc" :value="item.status" /></TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ formatDateTime(item.submitted_at) }}
                </TableCell>
                <TableCell class="text-right">
                  <Button variant="ghost" size="sm" @click="openDetail(item)">
                    <Search />
                    {{ t('common.detail') }}
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pager :page="page" :page-size="pageSize" :total="total" @change="load" />
    </template>

    <Dialog v-model:open="detailOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ t('admin.verificationDetail') }}</DialogTitle>
          <DialogDescription>{{ t('admin.idNumberFullHint') }}</DialogDescription>
        </DialogHeader>

        <ErrorAlert :message="detailError" />
        <LoadingBlock v-if="detailLoading" :rows="3" />

        <div v-else-if="detail" class="space-y-4">
          <dl class="grid gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('admin.username') }}</dt>
              <dd class="mt-1 text-sm font-medium">{{ detail.username }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('tickets.status') }}</dt>
              <dd class="mt-1"><StateBadge kind="kyc" :value="detail.status" /></dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('admin.realName') }}</dt>
              <dd class="mt-1 text-sm font-medium">{{ detail.real_name }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('admin.idNumber') }}</dt>
              <dd class="mt-1 text-sm font-medium tabular">{{ detail.id_number }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">{{ t('admin.submittedAt') }}</dt>
              <dd class="mt-1 text-sm tabular">{{ formatDateTime(detail.submitted_at) }}</dd>
            </div>
            <div v-if="detail.reviewed_at">
              <dt class="text-muted-foreground text-xs">{{ t('admin.reviewedAt') }}</dt>
              <dd class="mt-1 text-sm tabular">{{ formatDateTime(detail.reviewed_at) }}</dd>
            </div>
          </dl>

          <div v-if="detail.reject_reason" class="text-sm">
            <span class="text-muted-foreground text-xs">{{ t('admin.rejectReason') }}：</span>
            {{ detail.reject_reason }}
          </div>

          <div>
            <p class="mb-2 text-sm font-medium">{{ t('admin.photos') }}</p>
            <div class="grid gap-4 sm:grid-cols-2">
              <figure class="space-y-2">
                <a
                  :href="adminApi.verificationPhotoUrl(detail.id, 'front')"
                  target="_blank"
                  rel="noopener"
                >
                  <img
                    :src="adminApi.verificationPhotoUrl(detail.id, 'front')"
                    :alt="t('admin.photoFront')"
                    class="bg-muted/30 aspect-[8/5] w-full rounded-md border object-contain"
                  />
                </a>
                <figcaption class="text-muted-foreground text-xs">
                  {{ t('admin.photoFront') }}
                </figcaption>
              </figure>
              <figure class="space-y-2">
                <a
                  :href="adminApi.verificationPhotoUrl(detail.id, 'back')"
                  target="_blank"
                  rel="noopener"
                >
                  <img
                    :src="adminApi.verificationPhotoUrl(detail.id, 'back')"
                    :alt="t('admin.photoBack')"
                    class="bg-muted/30 aspect-[8/5] w-full rounded-md border object-contain"
                  />
                </a>
                <figcaption class="text-muted-foreground text-xs">
                  {{ t('admin.photoBack') }}
                </figcaption>
              </figure>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="detailOpen = false">
            {{ t('common.close') }}
          </Button>
          <!-- 只有 pending 能审：已审过的记录再点一次会被后端拒掉，按钮就不该出现。 -->
          <template v-if="detail?.status === 'pending'">
            <Button type="button" variant="outline" :disabled="acting" @click="openReject">
              <X />
              {{ t('admin.reject') }}
            </Button>
            <Button type="button" :disabled="acting" @click="approve">
              <Loader2 v-if="acting" class="animate-spin" />
              <Check v-else />
              {{ t('admin.approve') }}
            </Button>
          </template>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="rejectOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('admin.rejectTitle') }}</DialogTitle>
          <DialogDescription>{{ t('admin.rejectReasonHint') }}</DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="reject">
          <ErrorAlert :message="rejectError" />
          <div class="space-y-2">
            <Label for="reject-reason">{{ t('admin.rejectReason') }}</Label>
            <Textarea id="reject-reason" v-model="reason" rows="3" maxlength="255" required />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" @click="rejectOpen = false">
              {{ t('common.cancel') }}
            </Button>
            <Button type="submit" :disabled="acting">
              <Loader2 v-if="acting" class="animate-spin" />
              {{ t('admin.reject') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
