<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import PhotoPicker from '@/components/app/PhotoPicker.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { kycApi } from '@/lib/endpoints'
import { formatBytes, formatDateTime, MAX_PHOTO_BYTES } from '@/lib/utils'
import type { Verification } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()

const record = ref<Verification | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const form = reactive({ realName: '', idNumber: '' })
const front = ref<File | null>(null)
const back = ref<File | null>(null)
const formError = ref<string | null>(null)
const submitting = ref(false)

// 只有「从未提交」和「已驳回」两种情况允许填表：审核中要等结果，
// 已通过的资料改不了。
const canSubmit = computed(() => !record.value || record.value.status === 'rejected')

/**
 * 证件照地址带一个时间戳查询串。
 *
 * 后端对照片下发 no-store，但重新提交后同一个 URL 指向的是新文件，
 * 加上时间戳能确保浏览器与中间层都不会拿旧的那张。
 */
const photoVersion = ref(0)
function photoUrl(side: 'front' | 'back') {
  return `${kycApi.photoUrl(side)}?v=${photoVersion.value}`
}

async function load() {
  loading.value = true
  error.value = null
  try {
    record.value = await kycApi.mine()
    photoVersion.value += 1
    if (record.value) {
      // 驳回后重新提交时把原来填的带出来，用户只改要改的部分。
      form.realName = record.value.real_name
    }
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function submit() {
  formError.value = null
  if (!form.realName.trim() || !form.idNumber.trim()) {
    formError.value = t('error.required')
    return
  }
  if (!front.value || !back.value) {
    formError.value = t('kyc.photoRequired')
    return
  }
  submitting.value = true
  try {
    record.value = await kycApi.submit(
      form.realName.trim(),
      form.idNumber.trim().toUpperCase(),
      front.value,
      back.value,
    )
    photoVersion.value += 1
    front.value = null
    back.value = null
    // 号码不留在内存里：提交完就没有再用它的地方了。
    form.idNumber = ''
    toast.success(t('kyc.submitted'))
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('kyc.title')" :description="t('kyc.subtitle')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle class="text-base">{{ t('kyc.status') }}</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-if="!record" class="flex flex-wrap items-center gap-3">
            <span class="text-sm font-medium">{{ t('kyc.notSubmitted') }}</span>
            <span class="text-muted-foreground text-xs">{{ t('kyc.notSubmittedHint') }}</span>
          </div>

          <template v-else>
            <div class="flex flex-wrap items-center gap-3">
              <StateBadge kind="kyc" :value="record.status" />
              <span class="text-muted-foreground text-xs">
                {{
                  record.status === 'approved'
                    ? t('kyc.approvedHint')
                    : record.status === 'rejected'
                      ? t('kyc.rejectedHint')
                      : t('kyc.pendingHint')
                }}
              </span>
            </div>

            <Alert v-if="record.status === 'rejected' && record.reject_reason" variant="destructive">
              <AlertDescription>
                {{ t('kyc.rejectReason') }}：{{ record.reject_reason }}
              </AlertDescription>
            </Alert>

            <dl class="grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-muted-foreground text-xs">{{ t('kyc.realName') }}</dt>
                <dd class="mt-1 text-sm font-medium">{{ record.real_name }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground text-xs">{{ t('kyc.idNumber') }}</dt>
                <dd class="mt-1 text-sm tabular">
                  {{ record.id_number }}
                  <span class="text-muted-foreground ml-1 text-xs">
                    （{{ t('kyc.maskedHint') }}）
                  </span>
                </dd>
              </div>
              <div>
                <dt class="text-muted-foreground text-xs">{{ t('kyc.submittedAt') }}</dt>
                <dd class="mt-1 text-sm tabular">{{ formatDateTime(record.submitted_at) }}</dd>
              </div>
              <div v-if="record.reviewed_at">
                <dt class="text-muted-foreground text-xs">{{ t('kyc.reviewedAt') }}</dt>
                <dd class="mt-1 text-sm tabular">{{ formatDateTime(record.reviewed_at) }}</dd>
              </div>
            </dl>

            <div class="grid gap-4 sm:grid-cols-2">
              <figure class="space-y-2">
                <img
                  :src="photoUrl('front')"
                  :alt="t('kyc.front')"
                  class="bg-muted/30 aspect-[8/5] w-full rounded-md border object-contain"
                />
                <figcaption class="text-muted-foreground text-xs">{{ t('kyc.front') }}</figcaption>
              </figure>
              <figure class="space-y-2">
                <img
                  :src="photoUrl('back')"
                  :alt="t('kyc.back')"
                  class="bg-muted/30 aspect-[8/5] w-full rounded-md border object-contain"
                />
                <figcaption class="text-muted-foreground text-xs">{{ t('kyc.back') }}</figcaption>
              </figure>
            </div>
          </template>
        </CardContent>
      </Card>

      <Card v-if="canSubmit">
        <CardHeader>
          <CardTitle class="text-base">
            {{ record ? t('kyc.resubmit') : t('kyc.submit') }}
          </CardTitle>
          <CardDescription>{{ t('kyc.idNumberHint') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="max-w-2xl space-y-5" @submit.prevent="submit">
            <ErrorAlert :message="formError" />

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="kyc-name">{{ t('kyc.realName') }}</Label>
                <Input id="kyc-name" v-model="form.realName" maxlength="32" required />
                <p class="text-muted-foreground text-xs">{{ t('kyc.realNameHint') }}</p>
              </div>
              <div class="space-y-2">
                <Label for="kyc-id">{{ t('kyc.idNumber') }}</Label>
                <Input
                  id="kyc-id"
                  v-model="form.idNumber"
                  maxlength="18"
                  autocomplete="off"
                  class="tabular"
                  required
                />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <PhotoPicker
                id="kyc-front"
                v-model="front"
                :label="t('kyc.front')"
                :max-bytes="MAX_PHOTO_BYTES"
                :disabled="submitting"
                @reject="formError = $event"
              />
              <PhotoPicker
                id="kyc-back"
                v-model="back"
                :label="t('kyc.back')"
                :max-bytes="MAX_PHOTO_BYTES"
                :disabled="submitting"
                @reject="formError = $event"
              />
            </div>
            <p class="text-muted-foreground text-xs">
              {{ t('kyc.photoHint', { size: formatBytes(MAX_PHOTO_BYTES) }) }}
            </p>

            <Button type="submit" :disabled="submitting">
              <Loader2 v-if="submitting" class="animate-spin" />
              {{ record ? t('kyc.resubmit') : t('kyc.submit') }}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card v-else-if="record?.status === 'approved'">
        <CardContent class="text-muted-foreground py-6 text-center text-sm">
          {{ t('kyc.approvedLocked') }}
        </CardContent>
      </Card>
    </template>
  </div>
</template>
