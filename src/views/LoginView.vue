<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api'
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
const error = ref<string | null>(null)
const submitting = ref(false)

async function submit() {
  error.value = null
  if (!form.identifier.trim() || !form.password) {
    error.value = t('error.required')
    return
  }
  submitting.value = true
  try {
    const user = await auth.login(form.identifier.trim(), form.password)
    cart.load().catch(() => {})

    // 带 redirect 时优先回原目标；否则按角色决定落地页。
    const redirect = route.query.redirect
    if (typeof redirect === 'string' && redirect.startsWith('/')) {
      await router.replace(redirect)
      return
    }
    await router.replace({ name: user.role === 'admin' ? 'admin' : 'dashboard' })
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
        <form class="space-y-4" @submit.prevent="submit">
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
