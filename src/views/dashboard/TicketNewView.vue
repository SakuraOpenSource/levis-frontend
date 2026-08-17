<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import FilePicker from '@/components/app/FilePicker.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { ticketApi } from '@/lib/endpoints'
import { formatBytes, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from '@/lib/utils'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

const subject = ref('')
const body = ref('')
const files = ref<File[]>([])
const error = ref<string | null>(null)
const submitting = ref(false)

async function submit() {
  error.value = null
  if (!subject.value.trim() || !body.value.trim()) {
    error.value = t('error.required')
    return
  }
  submitting.value = true
  try {
    const ticket = await ticketApi.create(subject.value.trim(), body.value.trim(), files.value)
    toast.success(t('tickets.submitted'))
    // 直接进详情页：用户提交完最关心的是「收到了没有」。
    await router.push({ name: 'ticket-detail', params: { id: ticket.id } })
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('tickets.newTitle')" :description="t('tickets.newSubtitle')" />

    <Card>
      <CardContent>
        <form class="max-w-2xl space-y-5" @submit.prevent="submit">
          <ErrorAlert :message="error" />

          <div class="space-y-2">
            <Label for="ticket-subject">{{ t('tickets.subject') }}</Label>
            <Input id="ticket-subject" v-model="subject" maxlength="200" required />
            <p class="text-muted-foreground text-xs">{{ t('tickets.subjectHint') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="ticket-body">{{ t('tickets.body') }}</Label>
            <Textarea id="ticket-body" v-model="body" rows="8" required />
            <p class="text-muted-foreground text-xs">{{ t('tickets.bodyHint') }}</p>
          </div>

          <div class="space-y-2">
            <Label>{{ t('tickets.attachments') }}</Label>
            <FilePicker
              v-model="files"
              :max="MAX_ATTACHMENTS"
              :max-bytes="MAX_ATTACHMENT_BYTES"
              :disabled="submitting"
              @reject="error = $event"
            />
            <p class="text-muted-foreground text-xs">
              {{
                t('tickets.attachmentHint', {
                  count: MAX_ATTACHMENTS,
                  size: formatBytes(MAX_ATTACHMENT_BYTES),
                })
              }}
            </p>
          </div>

          <div class="flex gap-2">
            <Button type="submit" :disabled="submitting">
              <Loader2 v-if="submitting" class="animate-spin" />
              {{ t('common.submit') }}
            </Button>
            <Button as-child type="button" variant="ghost">
              <RouterLink :to="{ name: 'tickets' }">{{ t('common.cancel') }}</RouterLink>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
