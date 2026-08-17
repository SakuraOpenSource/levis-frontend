<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import FilePicker from '@/components/app/FilePicker.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import TicketThread from '@/components/app/TicketThread.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import { formatBytes, formatDateTime, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from '@/lib/utils'
import type { Ticket } from '@/lib/types'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()

const id = Number(route.params.id)
const ticket = ref<Ticket | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const body = ref('')
const files = ref<File[]>([])
const replyError = ref<string | null>(null)
const replying = ref(false)
const acting = ref(false)

const closed = computed(() => ticket.value?.status === 'closed')

function attachmentUrl(attachmentId: number) {
  return adminApi.ticketAttachmentUrl(id, attachmentId)
}

async function load() {
  loading.value = true
  error.value = null
  try {
    ticket.value = await adminApi.ticket(id)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function submitReply() {
  replyError.value = null
  if (!body.value.trim()) {
    replyError.value = t('error.required')
    return
  }
  replying.value = true
  try {
    await adminApi.replyTicket(id, body.value.trim(), files.value)
    body.value = ''
    files.value = []
    toast.success(t('admin.ticketReplied'))
    // 回复后状态转 answered，重新拉详情让徽标跟着变。
    await load()
  } catch (err) {
    replyError.value = errorMessage(err)
  } finally {
    replying.value = false
  }
}

async function close() {
  if (!window.confirm(t('tickets.closeConfirm'))) return
  acting.value = true
  try {
    await adminApi.closeTicket(id)
    toast.success(t('tickets.closed'))
    await load()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    acting.value = false
  }
}

async function reopen() {
  acting.value = true
  try {
    await adminApi.reopenTicket(id)
    toast.success(t('tickets.reopened'))
    await load()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    acting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="ticket?.subject ?? t('admin.ticketDetailTitle')"
      :description="ticket ? `${t('tickets.ticketNo')} ${ticket.ticket_no}` : undefined"
    >
      <template #actions>
        <Button as-child variant="ghost" size="sm">
          <RouterLink :to="{ name: 'admin-tickets' }">
            <ArrowLeft />
            {{ t('common.back') }}
          </RouterLink>
        </Button>
        <Button
          v-if="ticket && closed"
          variant="outline"
          size="sm"
          :disabled="acting"
          @click="reopen"
        >
          <Loader2 v-if="acting" class="animate-spin" />
          <RotateCcw v-else />
          {{ t('tickets.reopen') }}
        </Button>
        <Button
          v-else-if="ticket"
          variant="outline"
          size="sm"
          :disabled="acting"
          @click="close"
        >
          <Loader2 v-if="acting" class="animate-spin" />
          {{ t('tickets.close') }}
        </Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="5" />

    <template v-else-if="ticket">
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <StateBadge kind="ticket" :value="ticket.status" />
        <span v-if="ticket.username">
          {{ t('tickets.submitter') }}：<span class="font-medium">{{ ticket.username }}</span>
        </span>
        <span class="text-muted-foreground text-xs tabular">
          {{ t('tickets.createdAt') }} {{ formatDateTime(ticket.created_at) }}
        </span>
      </div>

      <TicketThread :replies="ticket.replies ?? []" :attachment-url="attachmentUrl" />

      <Card v-if="!closed">
        <CardContent>
          <form class="space-y-4" @submit.prevent="submitReply">
            <ErrorAlert :message="replyError" />
            <div class="space-y-2">
              <Label for="admin-reply-body">{{ t('admin.ticketReply') }}</Label>
              <Textarea
                id="admin-reply-body"
                v-model="body"
                rows="5"
                :placeholder="t('tickets.replyPlaceholder')"
                required
              />
            </div>
            <div class="space-y-2">
              <FilePicker
                v-model="files"
                :max="MAX_ATTACHMENTS"
                :max-bytes="MAX_ATTACHMENT_BYTES"
                :disabled="replying"
                @reject="replyError = $event"
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
            <Button type="submit" :disabled="replying">
              <Loader2 v-if="replying" class="animate-spin" />
              {{ t('tickets.reply') }}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card v-else>
        <CardContent class="text-muted-foreground py-6 text-center text-sm">
          {{ t('admin.ticketClosedHint') }}
        </CardContent>
      </Card>
    </template>
  </div>
</template>
