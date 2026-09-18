<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader2, ShieldCheck } from 'lucide-vue-next'

import CaptchaField from '@/components/app/CaptchaField.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, errorMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const site = useSiteStore()

const form = reactive({ identifier: '', password: '' })
const captcha = reactive({ id: '', code: '' })
const captchaField = ref<InstanceType<typeof CaptchaField> | null>(null)
const error = ref<string | null>(null)
const submitting = ref(false)

/**
 * 管理员专用登录入口。与普通登录的差异（后端保证）：
 * - 验证码强制校验，与站点开关无关 —— 因此这里恒显示验证码输入；
 * - 登录失败按独立计数限速；
 * - 会话有效期更短（12 小时）。
 */
async function submit() {
  error.value = null
  if (!form.identifier.trim() || !form.password) {
    error.value = t('error.required')
    return
  }
  if (!captcha.code.trim()) {
    error.value = t('auth.captchaRequired')
    return
  }
  submitting.value = true
  try {
    await auth.adminLogin(form.identifier.trim(), form.password, {
      captcha_id: captcha.id,
      captcha_code: captcha.code.trim(),
    })
    await router.replace({ name: 'admin' })
  } catch (err) {
    error.value = errorMessage(err)
    // 验证码是一次性的：无论这次是密码错还是验证码错，这张图都已作废。
    if (!(err instanceof ApiError) || err.code !== 'TOO_MANY_REQUESTS') {
      captchaField.value?.refresh()
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-svh items-center justify-center px-4 py-10">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-xl">
          <ShieldCheck class="size-5" aria-hidden="true" />
          {{ t('auth.adminLoginTitle') }}
        </CardTitle>
        <CardDescription>{{ t('auth.adminLoginSubtitle') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <ErrorAlert :message="error" />

          <div class="space-y-2">
            <Label for="admin-identifier">{{ t('auth.identifier') }}</Label>
            <Input
              id="admin-identifier"
              v-model="form.identifier"
              autocomplete="username"
              autofocus
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="admin-password">{{ t('auth.password') }}</Label>
            <Input
              id="admin-password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <!-- 管理员入口强制验证码：不受站点开关影响，恒显示。 -->
          <CaptchaField
            ref="captchaField"
            id="admin-login-captcha"
            v-model:challenge-id="captcha.id"
            v-model:code="captcha.code"
            :charset="site.captchaCharset"
            :disabled="submitting"
          />

          <Button type="submit" class="w-full" :disabled="submitting">
            <Loader2 v-if="submitting" class="animate-spin" />
            {{ submitting ? t('auth.loggingIn') : t('auth.submitLogin') }}
          </Button>

          <p class="text-center text-sm">
            <RouterLink :to="{ name: 'login' }" class="text-primary hover:underline">
              {{ t('auth.backToUserLogin') }}
            </RouterLink>
          </p>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
