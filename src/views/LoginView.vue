<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

import CaptchaField from '@/components/app/CaptchaField.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, ErrorCode, errorMessage } from '@/lib/api'
import { authApi } from '@/lib/endpoints'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const site = useSiteStore()

const form = reactive({ identifier: '', password: '' })
const captcha = reactive({ id: '', code: '' })
const captchaField = ref<InstanceType<typeof CaptchaField> | null>(null)
const error = ref<string | null>(null)
const submitting = ref(false)

/** 管理员凭证被普通入口定向拒绝时，展示专用入口引导。 */
const adminEntryHint = ref(false)

/** 登录邮箱验证码的第二步状态：票据与掩码邮箱由首次登录响应给出。 */
const emailStep = reactive({ active: false, ticket: '', maskedEmail: '' })
const emailCode = ref('')

/** 登录成功后的统一落地：恢复购物车并按 redirect/角色跳转。 */
async function finishLogin(user: { role: string }) {
  cart.load().catch(() => {})
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    await router.replace(redirect)
    return
  }
  await router.replace({ name: user.role === 'admin' ? 'admin' : 'dashboard' })
}

async function submit() {
  error.value = null
  adminEntryHint.value = false
  if (!form.identifier.trim() || !form.password) {
    error.value = t('error.required')
    return
  }
  if (site.captchaLogin && !captcha.code.trim()) {
    error.value = t('auth.captchaRequired')
    return
  }
  submitting.value = true
  try {
    const user = await auth.login(
      form.identifier.trim(),
      form.password,
      site.captchaLogin ? { captcha_id: captcha.id, captcha_code: captcha.code.trim() } : {},
    )
    await finishLogin(user)
  } catch (err) {
    // 站点开启登录邮箱验证码时，密码正确也会以 needEmailCode「错误」返回。
    if (err && typeof err === 'object' && (err as { needEmailCode?: boolean }).needEmailCode) {
      const info = err as { ticket?: string; maskedEmail?: string }
      emailStep.active = true
      emailStep.ticket = info.ticket ?? ''
      emailStep.maskedEmail = info.maskedEmail ?? ''
      emailCode.value = ''
    } else if (err instanceof ApiError && err.code === ErrorCode.AdminEntryRequired) {
      // 管理员凭证在普通入口被定向拒绝：给出专用入口引导而不是一句报错。
      adminEntryHint.value = true
    } else {
      error.value = errorMessage(err)
      // 验证码是一次性的，哪怕这次是密码错也已经作废，必须换一张。
      captchaField.value?.refresh()
    }
  } finally {
    submitting.value = false
  }
}

/** 第二步：票据 + 邮箱验证码换会话。 */
async function submitEmailCode() {
  error.value = null
  if (!emailCode.value.trim()) {
    error.value = t('auth.emailCodeRequired')
    return
  }
  submitting.value = true
  try {
    const user = await authApi.loginEmailCode(emailStep.ticket, emailCode.value.trim())
    await auth.restore() // 会话 cookie 已就位，把本地状态恢复起来
    await finishLogin(user)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-svh items-center justify-center px-4 py-10">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-xl">{{ site.siteName }}</CardTitle>
        <CardDescription>{{ t('auth.loginSubtitle') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <!-- 第二步：邮箱验证码 -->
        <form v-if="emailStep.active" class="space-y-4" @submit.prevent="submitEmailCode">
          <ErrorAlert :message="error" />
          <p class="text-muted-foreground text-sm">
            {{ t('auth.emailCodeLoginSent', { email: emailStep.maskedEmail }) }}
          </p>
          <div class="space-y-2">
            <Label for="login-email-code">{{ t('auth.emailCode') }}</Label>
            <Input
              id="login-email-code"
              v-model="emailCode"
              inputmode="numeric"
              maxlength="6"
              autofocus
              required
            />
          </div>
          <Button type="submit" class="w-full" :disabled="submitting">
            <Loader2 v-if="submitting" class="animate-spin" />
            {{ t('auth.submitLogin') }}
          </Button>
          <p class="text-center text-sm">
            <button
              type="button"
              class="text-primary hover:underline"
              @click="emailStep.active = false"
            >
              {{ t('auth.backToLogin') }}
            </button>
          </p>
        </form>

        <!-- 第一步：账号密码 -->
        <form v-else class="space-y-4" @submit.prevent="submit">
          <ErrorAlert :message="error" />

          <div class="space-y-2">
            <Label for="identifier">{{ t('auth.identifier') }}</Label>
            <Input
              id="identifier"
              v-model="form.identifier"
              autocomplete="username"
              autofocus
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="password">{{ t('auth.password') }}</Label>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <CaptchaField
            v-if="site.captchaLogin"
            ref="captchaField"
            id="login-captcha"
            v-model:challenge-id="captcha.id"
            v-model:code="captcha.code"
            :charset="site.captchaCharset"
            :disabled="submitting"
          />

          <!-- 管理员凭证被定向拒绝：引导去专用入口，而不是让用户反复撞错。 -->
          <div
            v-if="adminEntryHint"
            class="bg-muted text-foreground flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <span>{{ t('auth.adminEntryHint') }}</span>
            <RouterLink :to="{ name: 'admin-login' }" class="text-primary hover:underline">
              {{ t('auth.goAdminLogin') }}
            </RouterLink>
          </div>
          <Button type="submit" class="w-full" :disabled="submitting">
            <Loader2 v-if="submitting" class="animate-spin" />
            {{ submitting ? t('auth.loggingIn') : t('auth.submitLogin') }}
          </Button>

          <p class="text-center text-sm">
            <RouterLink :to="{ name: 'register' }" class="text-primary hover:underline">
              {{ t('auth.toRegister') }}
            </RouterLink>
          </p>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
