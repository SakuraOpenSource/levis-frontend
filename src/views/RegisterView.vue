<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

import CaptchaField from '@/components/app/CaptchaField.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const site = useSiteStore()

const form = reactive({ username: '', email: '', password: '', confirm: '' })
const captcha = reactive({ id: '', code: '' })
const captchaField = ref<InstanceType<typeof CaptchaField> | null>(null)
const error = ref<string | null>(null)
const submitting = ref(false)

async function submit() {
  error.value = null
  if (!form.username.trim() || !form.email.trim() || !form.password) {
    error.value = t('error.required')
    return
  }
  if (form.password !== form.confirm) {
    error.value = t('auth.passwordMismatch')
    return
  }
  if (site.captchaRegister && !captcha.code.trim()) {
    error.value = t('auth.captchaRequired')
    return
  }
  submitting.value = true
  try {
    // 后端注册接口固定 role=user，前端也不传任何角色字段。
    await auth.register({
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      ...(site.captchaRegister
        ? { captcha_id: captcha.id, captcha_code: captcha.code.trim() }
        : {}),
    })
    await router.replace({ name: 'dashboard' })
  } catch (err) {
    error.value = errorMessage(err)
    // 验证码是一次性的，这次提交已把它消耗掉，必须换一张再试。
    captchaField.value?.refresh()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-svh items-center justify-center px-4 py-10">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-xl">{{ t('auth.registerTitle') }}</CardTitle>
        <CardDescription>{{ site.siteName }} · {{ t('auth.registerSubtitle') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <ErrorAlert :message="error" />

          <div class="space-y-2">
            <Label for="username">{{ t('auth.username') }}</Label>
            <Input id="username" v-model="form.username" autocomplete="username" autofocus required />
            <p class="text-muted-foreground text-xs">{{ t('auth.usernameHint') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="email">{{ t('auth.email') }}</Label>
            <Input id="email" v-model="form.email" type="email" autocomplete="email" required />
          </div>

          <div class="space-y-2">
            <Label for="password">{{ t('auth.password') }}</Label>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              required
            />
            <p class="text-muted-foreground text-xs">{{ t('install.passwordHint') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="confirm">{{ t('auth.confirmPassword') }}</Label>
            <Input
              id="confirm"
              v-model="form.confirm"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>

          <CaptchaField
            v-if="site.captchaRegister"
            ref="captchaField"
            id="register-captcha"
            v-model:challenge-id="captcha.id"
            v-model:code="captcha.code"
            :charset="site.captchaCharset"
            :disabled="submitting"
          />

          <Button type="submit" class="w-full" :disabled="submitting">
            <Loader2 v-if="submitting" class="animate-spin" />
            {{ submitting ? t('auth.registering') : t('auth.submitRegister') }}
          </Button>

          <p class="text-center text-sm">
            <RouterLink :to="{ name: 'login' }" class="text-primary hover:underline">
              {{ t('auth.toLogin') }}
            </RouterLink>
          </p>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
