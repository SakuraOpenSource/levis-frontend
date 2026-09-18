<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-vue-next'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { openExternalUrl, openHtmlFragment } from '@/lib/utils'
import { kycApi } from '@/lib/endpoints'
import { formatBytes, formatDateTime, MAX_PHOTO_BYTES } from '@/lib/utils'
import type { KYCMine } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()

const state = ref<KYCMine | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// 站点是否配置了可用的实名认证插件（后端已把不可用配置回落为 manual）。
const pluginMode = computed(() => state.value?.mode !== 'manual')

const form = reactive({ realName: '', idNumber: '' })
const front = ref<File | null>(null)
const back = ref<File | null>(null)
const formError = ref<string | null>(null)
const submitting = ref(false)

// 插件模式：按字段声明收集用户输入；secret 字段不回显，提交空值即跳过。
const dynamicValues = reactive<Record<string, string>>({})
const externalBusy = ref(false)
const externalHint = ref<string | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | null = null

// 只有「从未提交」和「已驳回」两种情况允许填表：审核中要等结果，
// 已通过的资料改不了。
const record = computed(() => state.value?.record ?? null)
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
    state.value = await kycApi.mine()
    photoVersion.value += 1
    if (record.value && !pluginMode.value) {
      // 驳回后重新提交时把原来填的带出来，用户只改要改的部分。
      form.realName = record.value.real_name
    }
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

/** 按字段声明初始化动态表单，模式切换或重新加载时重建。 */
function resetDynamicForm() {
  for (const key of Object.keys(dynamicValues)) {
    delete dynamicValues[key]
  }
  for (const field of state.value?.fields ?? []) {
    dynamicValues[field.key] = ''
  }
}

async function submitManual() {
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
    const mine = await kycApi.mine()
    state.value = mine
    await kycApi.submit(
      form.realName.trim(),
      form.idNumber.trim().toUpperCase(),
      front.value,
      back.value,
    )
    await load()
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

/** 校验动态表单：必填、select 选项交给后端兜底，这里只拦空值。 */
function validateDynamic(): string | null {
  for (const field of state.value?.fields ?? []) {
    if (field.required && !dynamicValues[field.key]?.trim()) {
      return t('kyc.fieldRequired', { field: field.label })
    }
  }
  return null
}

/**
 * 发起第三方认证并按返回内容引导用户：
 * certify_html 内嵌渲染，certify_url 新窗口跳转，随后轮询结果。
 */
async function startExternal() {
  formError.value = null
  const invalid = validateDynamic()
  if (invalid) {
    formError.value = invalid
    return
  }
  externalBusy.value = true
  try {
    const values: Record<string, string> = {}
    for (const [key, value] of Object.entries(dynamicValues)) {
      values[key] = value.trim()
    }
    const result = await kycApi.startExternal(values)
    await load()
    externalHint.value = result.message || t('kyc.externalStarted')
    if (result.certify_html) {
      openHtmlFragment(result.certify_html)
    } else if (result.certify_url) {
      openExternalUrl(result.certify_url)
    }
    schedulePoll()
    toast.success(t('kyc.externalStarted'))
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    externalBusy.value = false
  }
}

/** 认证在支付宝侧完成，前端定时轮询主程序同步结论。 */
function schedulePoll() {
  stopPoll()
  pollTimer = setTimeout(async () => {
    try {
      const { record: updated, passed } = await kycApi.queryExternal()
      if (state.value) {
        state.value.record = updated
      }
      if (passed === 'T' || passed === 'F') {
        stopPoll()
        if (passed === 'T') {
          toast.success(t('kyc.externalPassed'))
        } else {
          toast.error(t('kyc.externalFailed'))
        }
        return
      }
    } catch {
      // 单次轮询失败不打断：认证可能在第三方侧还没生效。
    }
    schedulePoll()
  }, 5000)
}

function stopPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

onMounted(async () => {
  await load()
  resetDynamicForm()
})
onUnmounted(stopPoll)
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
                      : pluginMode
                        ? t('kyc.pendingExternalHint')
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
              <div v-if="record.real_name">
                <dt class="text-muted-foreground text-xs">{{ t('kyc.realName') }}</dt>
                <dd class="mt-1 text-sm font-medium">{{ record.real_name }}</dd>
              </div>
              <div v-if="record.id_number">
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

            <div v-if="!pluginMode" class="grid gap-4 sm:grid-cols-2">
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

      <!-- 人工审核：上传证件照，管理员比对。 -->
      <Card v-if="!pluginMode && canSubmit">
        <CardHeader>
          <CardTitle class="text-base">
            {{ record ? t('kyc.resubmit') : t('kyc.submit') }}
          </CardTitle>
          <CardDescription>{{ t('kyc.idNumberHint') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="max-w-2xl space-y-5" @submit.prevent="submitManual">
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

      <!-- 插件认证：按插件声明的字段渲染动态表单。 -->
      <Card v-else-if="pluginMode && canSubmit">
        <CardHeader>
          <CardTitle class="text-base">
            {{ record ? t('kyc.resubmit') : t('kyc.submit') }}
          </CardTitle>
          <CardDescription>
            {{
              externalHint ||
                t('kyc.pluginModeHint', {
                  plugin: state?.plugin_name || t('kyc.pluginFallbackName'),
                })
            }}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="max-w-2xl space-y-5" @submit.prevent="startExternal">
            <ErrorAlert :message="formError" />

            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="field in state?.fields ?? []" :key="field.key" class="space-y-2">
                <Label :for="`kyc-field-${field.key}`">
                  {{ field.label }}
                  <span v-if="field.required" class="text-destructive">*</span>
                </Label>
                <Textarea
                  v-if="field.type === 'textarea'"
                  :id="`kyc-field-${field.key}`"
                  v-model="dynamicValues[field.key]"
                  :disabled="externalBusy"
                  rows="3"
                />
                <Select v-else-if="field.type === 'select'" v-model="dynamicValues[field.key]">
                  <SelectTrigger :id="`kyc-field-${field.key}`" :disabled="externalBusy">
                    <SelectValue :placeholder="field.label" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in field.options ?? []"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  v-else
                  :id="`kyc-field-${field.key}`"
                  v-model="dynamicValues[field.key]"
                  :type="field.type === 'number' ? 'number' : field.secret ? 'password' : 'text'"
                  :autocomplete="field.secret ? 'new-password' : 'off'"
                  :disabled="externalBusy"
                />
                <p v-if="field.hint" class="text-muted-foreground text-xs">{{ field.hint }}</p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <Button type="submit" :disabled="externalBusy">
                <Loader2 v-if="externalBusy" class="animate-spin" />
                {{ t('kyc.startExternal') }}
              </Button>
              <Button
                v-if="record?.status === 'pending' && record.plugin_id"
                type="button"
                variant="outline"
                :disabled="externalBusy"
                @click="schedulePoll"
              >
                <RefreshCw class="mr-1 size-4" />
                {{ t('kyc.checkResult') }}
              </Button>
              <a
                v-if="externalHint"
                class="text-muted-foreground inline-flex items-center gap-1 text-xs"
                href="https://www.alipay.com/"
                target="_blank"
                rel="noopener"
              >
                <ExternalLink class="size-3" />
                {{ t('kyc.openAlipay') }}
              </a>
            </div>
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
