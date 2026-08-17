<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Download, Paperclip } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { formatBytes, formatDateTime } from '@/lib/utils'
import type { TicketReply } from '@/lib/types'

/**
 * 工单对话流。用户端与管理端共用一套气泡布局，只有附件地址不同 ——
 * 两端各写一份迟早在样式上分叉。
 */
const props = defineProps<{
  replies: TicketReply[]
  /** 附件下载地址的构造方式由调用方给出（用户端与管理端路径不同）。 */
  attachmentUrl: (attachmentId: number) => string
}>()

const { t } = useI18n()
</script>

<template>
  <ol class="space-y-4">
    <li
      v-for="reply in props.replies"
      :key="reply.id"
      class="rounded-lg border p-4"
      :class="reply.is_staff ? 'bg-muted/40' : 'bg-card'"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium">{{ reply.author_name }}</span>
        <Badge v-if="reply.is_staff" variant="default">{{ t('tickets.staff') }}</Badge>
        <span class="text-muted-foreground ml-auto text-xs tabular">
          {{ formatDateTime(reply.created_at) }}
        </span>
      </div>

      <!-- whitespace-pre-wrap 保留用户输入的换行；正文按纯文本渲染，不解析 HTML。 -->
      <p class="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap">{{ reply.body }}</p>

      <ul v-if="reply.attachments?.length" class="mt-3 space-y-1 border-t pt-3">
        <li v-for="file in reply.attachments" :key="file.id">
          <a
            :href="props.attachmentUrl(file.id)"
            :download="file.file_name"
            class="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs hover:underline"
          >
            <Paperclip class="size-3.5 shrink-0" />
            <span class="truncate">{{ file.file_name }}</span>
            <span class="tabular">{{ formatBytes(file.size_bytes) }}</span>
            <Download class="size-3.5 shrink-0" />
          </a>
        </li>
      </ul>
    </li>
  </ol>
</template>
