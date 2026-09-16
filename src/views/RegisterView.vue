<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
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
import { emailApi } from '@/lib/endpoints'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const site = useSiteStore()

const form = reactive({ username: '', email: '', password: '', confirm: '', emailCode: '' })
const captcha = reactive({ id: '', code: '' })
const captchaField = ref<InstanceType<typeof CaptchaField> | null>(null)
const error = ref<string | null>(null)
const submitting = ref(false)
const codeSending = ref(false)
const codeCooldown = ref(0)
const codeSent = ref(false)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

/** 站点开启注册邮箱验证码时展示发码 + 输入框。 */
const emailCodeRequired = () => site.emailCodeRegister

function startCooldown(seconds: number) {
  codeCooldown.value = seconds
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    codeCooldown.value--
    if (codeCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

async function sendCode() {
  error.value = null
  if (!form.email.trim()) {
    error.value = t('auth.emailRequired')
    return
  }
  codeSending.value = true
  try {
    await emailApi.sendCode('register', form.email.trim())
    codeSent.value = true
    startCooldown(60)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    codeSending.value = false
  }
}

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
  if (emailCodeRequired() && !form.emailCode.trim()) {
    error.value = t('auth.emailCodeRequired')
    return
  }
  submitting.value = true
  try {
    // 后端注册接口固定 role=user，前端也不传任何角色字段。
    await auth.register({
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      ...(emailCodeRequired() ? { email_code: form.emailCode.trim() } : {}),
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
          <p v-if="codeSent" class="text-xs text-green-600">{{ t('auth.emailCodeSent') }}</p>

          <div class="space-y-2">
            <Label for="username">{{ t('auth.username') }}</Label>
            <Input id="username" v-model="form.username" autocomplete="username" autofocus required />
            <p class="text-muted-foreground text-xs">{{ t('auth.usernameHint') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="email">{{ t('auth.email') }}</Label>
            <Input id="email" v-model="form.email" type="email" autocomplete="email" required />
          </div>

          <div v-if="emailCodeRequired()" class="space-y-2">
            <Label for="email-code">{{ t('auth.emailCode') }}</Label>
            <div class="flex gap-2">
              <Input
                id="email-code"
                v-model="form.emailCode"
                inputmode="numeric"
                maxlength="6"
                class="flex-1"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="shrink-0"
                :disabled="codeSending || codeCooldown > 0"
                @click="sendCode"
              >
                <Loader2 v-if="codeSending" class="h-3 w-3 animate-spin" />
                {{
                  codeCooldown > 0
                    ? t('auth.emailCodeCooldown', { n: codeCooldown })
                    : t('auth.emailCodeSend')
                }}
              </Button>
            </div>
            <p class="text-muted-foreground text-xs">{{ t('auth.emailCodeHint') }}</p>
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
