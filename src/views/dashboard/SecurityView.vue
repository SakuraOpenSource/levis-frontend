<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { authApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()

const emailForm = reactive({ email: auth.user?.email ?? '', password: '' })
const emailError = ref<string | null>(null)
const emailSaving = ref(false)

const passwordForm = reactive({ oldPassword: '', newPassword: '', confirm: '' })
const passwordError = ref<string | null>(null)
const passwordSaving = ref(false)

async function submitEmail() {
  emailError.value = null
  if (!emailForm.email.trim() || !emailForm.password) {
    emailError.value = t('error.required')
    return
  }
  emailSaving.value = true
  try {
    const user = await authApi.updateEmail(emailForm.password, emailForm.email.trim())
    auth.setUser(user)
    emailForm.password = ''
    toast.success(t('security.emailUpdated'))
  } catch (err) {
    emailError.value = errorMessage(err)
  } finally {
    emailSaving.value = false
  }
}

async function submitPassword() {
  passwordError.value = null
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    passwordError.value = t('error.required')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirm) {
    passwordError.value = t('auth.passwordMismatch')
    return
  }
  passwordSaving.value = true
  try {
    await authApi.updatePassword(passwordForm.oldPassword, passwordForm.newPassword)
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirm = ''
    toast.success(t('security.passwordUpdated'))
  } catch (err) {
    passwordError.value = errorMessage(err)
  } finally {
    passwordSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('security.title')" :description="t('security.subtitle')" />

    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t('security.accountInfo') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('security.username') }}</dt>
            <dd class="mt-1 text-sm font-medium">
              {{ auth.user?.username }}
              <span class="text-muted-foreground ml-1 text-xs">
                （{{ t('security.usernameLocked') }}）
              </span>
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('security.role') }}</dt>
            <dd class="mt-1">
              <Badge :variant="auth.isAdmin ? 'default' : 'secondary'">
                {{ auth.isAdmin ? t('admin.roleAdmin') : t('admin.roleUser') }}
              </Badge>
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('auth.email') }}</dt>
            <dd class="mt-1 text-sm">{{ auth.user?.email }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{{ t('security.createdAt') }}</dt>
            <dd class="mt-1 text-sm tabular">{{ formatDateTime(auth.user?.created_at) }}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t('security.changeEmail') }}</CardTitle>
        <CardDescription>{{ t('security.changeEmailHint') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="max-w-md space-y-4" @submit.prevent="submitEmail">
          <ErrorAlert :message="emailError" />
          <div class="space-y-2">
            <Label for="new-email">{{ t('security.newEmail') }}</Label>
            <Input id="new-email" v-model="emailForm.email" type="email" autocomplete="email" required />
          </div>
          <div class="space-y-2">
            <Label for="email-password">{{ t('security.currentPassword') }}</Label>
            <Input
              id="email-password"
              v-model="emailForm.password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>
          <Button type="submit" :disabled="emailSaving">
            <Loader2 v-if="emailSaving" class="animate-spin" />
            {{ t('common.save') }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t('security.changePassword') }}</CardTitle>
        <CardDescription>{{ t('security.changePasswordHint') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="max-w-md space-y-4" @submit.prevent="submitPassword">
          <ErrorAlert :message="passwordError" />
          <div class="space-y-2">
            <Label for="old-password">{{ t('security.oldPassword') }}</Label>
            <Input
              id="old-password"
              v-model="passwordForm.oldPassword"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="new-password">{{ t('security.newPassword') }}</Label>
            <Input
              id="new-password"
              v-model="passwordForm.newPassword"
              type="password"
              autocomplete="new-password"
              required
            />
            <p class="text-muted-foreground text-xs">{{ t('install.passwordHint') }}</p>
          </div>
          <div class="space-y-2">
            <Label for="confirm-password">{{ t('security.confirmPassword') }}</Label>
            <Input
              id="confirm-password"
              v-model="passwordForm.confirm"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>
          <Button type="submit" :disabled="passwordSaving">
            <Loader2 v-if="passwordSaving" class="animate-spin" />
            {{ t('common.save') }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
