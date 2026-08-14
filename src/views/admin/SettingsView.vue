<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2 } from 'lucide-vue-next'

import CaptchaField from '@/components/app/CaptchaField.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import {
  CAPTCHA_CHARSETS,
  CAPTCHA_MAX_LENGTH,
  CAPTCHA_MIN_LENGTH,
  type CaptchaCharset,
} from '@/lib/types'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const toast = useToast()
const site = useSiteStore()

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)
/** 预览用的独立 key：换了字符集或位数后重挂组件，才能看到新配置的效果。 */
const previewKey = ref(0)

const form = reactive({
  loginEnabled: false,
  registerEnabled: true,
  charset: 'digit' as CaptchaCharset,
  // Select 的值必须是字符串。
  length: String(CAPTCHA_MIN_LENGTH + 2),
})

const lengthOptions = computed(() => {
  const out: string[] = []
  for (let n = CAPTCHA_MIN_LENGTH; n <= CAPTCHA_MAX_LENGTH; n++) out.push(String(n))
  return out
})

/** 两个开关都关掉时，字符集与位数存了也用不上，界面上明说一句。 */
const allDisabled = computed(() => !form.loginEnabled && !form.registerEnabled)

function charsetLabel(charset: CaptchaCharset) {
  return t(`admin.captchaCharset_${charset}`)
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const cfg = await adminApi.captchaSettings()
    form.loginEnabled = cfg.login_enabled
    form.registerEnabled = cfg.register_enabled
    form.charset = cfg.charset
    form.length = String(cfg.length)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  formError.value = null
  saving.value = true
  try {
    await adminApi.updateCaptchaSettings({
      login_enabled: form.loginEnabled,
      register_enabled: form.registerEnabled,
      charset: form.charset,
      length: Number(form.length),
    })
    // 重新拉一次 bootstrap：登录、注册页靠它决定是否显示验证码，
    // 不刷新的话本次会话里改动看不出效果。
    await site.load(true)
    previewKey.value++
    toast.success(t('common.saved'))
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('admin.settingsTitle')" :description="t('admin.settingsSubtitle')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <form v-else class="space-y-6" @submit.prevent="save">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('admin.captchaTitle') }}</CardTitle>
          <CardDescription>{{ t('admin.captchaSubtitle') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <ErrorAlert :message="formError" />

          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <Label for="captcha-login">{{ t('admin.captchaLogin') }}</Label>
              <p class="text-muted-foreground text-xs">{{ t('admin.captchaLoginHint') }}</p>
            </div>
            <Switch id="captcha-login" v-model="form.loginEnabled" />
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <Label for="captcha-register">{{ t('admin.captchaRegister') }}</Label>
              <p class="text-muted-foreground text-xs">{{ t('admin.captchaRegisterHint') }}</p>
            </div>
            <Switch id="captcha-register" v-model="form.registerEnabled" />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="captcha-charset">{{ t('admin.captchaType') }}</Label>
              <Select v-model="form.charset">
                <SelectTrigger id="captcha-charset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="item in CAPTCHA_CHARSETS" :key="item" :value="item">
                    {{ charsetLabel(item) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-muted-foreground text-xs">{{ t('admin.captchaTypeHint') }}</p>
            </div>

            <div class="space-y-2">
              <Label for="captcha-length">{{ t('admin.captchaLength') }}</Label>
              <Select v-model="form.length">
                <SelectTrigger id="captcha-length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="item in lengthOptions" :key="item" :value="item">
                    {{ t('admin.captchaLengthOption', { n: item }) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-muted-foreground text-xs">{{ t('admin.captchaLengthHint') }}</p>
            </div>
          </div>

          <p v-if="allDisabled" class="text-muted-foreground text-xs">
            {{ t('admin.captchaAllDisabled') }}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('admin.captchaPreview') }}</CardTitle>
          <CardDescription>{{ t('admin.captchaPreviewHint') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <!-- 预览走的是真实签发接口，因此展示的一定是当前已保存的配置。 -->
          <div class="max-w-sm">
            <CaptchaField
              :key="previewKey"
              id="captcha-preview"
              :charset="form.charset"
            />
          </div>
        </CardContent>
      </Card>

      <div class="flex justify-end">
        <Button type="submit" :disabled="saving">
          <Loader2 v-if="saving" class="animate-spin" />
          {{ t('common.save') }}
        </Button>
      </div>
    </form>
  </div>
</template>
