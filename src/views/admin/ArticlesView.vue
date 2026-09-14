<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from 'lucide-vue-next'

import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import { renderMarkdown } from '@/lib/markdown'
import { formatDateTime } from '@/lib/utils'
import type { Article, ArticleStatus } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()

const items = ref<Article[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
// Select 不接受空值，用 all 表示不过滤（后端 status 为空时不过滤）。
const status = ref<ArticleStatus | 'all'>('all')
const loading = ref(true)
const error = ref<string | null>(null)
const deleting = ref<number | null>(null)

const dialogOpen = ref(false)
const editing = ref<Article | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const editorTab = ref('edit')

const form = reactive({
  slug: '',
  title: '',
  content_md: '',
  status: 'draft' as ArticleStatus,
  sort_order: '0',
})

const previewHtml = computed(() => renderMarkdown(form.content_md))

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await adminApi.articles({
      page: target,
      page_size: pageSize.value,
      status: status.value === 'all' ? '' : status.value,
    })
    items.value = result.items ?? []
    total.value = result.total
    page.value = result.page
    pageSize.value = result.page_size
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  formError.value = null
  editorTab.value = 'edit'
  Object.assign(form, { slug: '', title: '', content_md: '', status: 'draft' as ArticleStatus, sort_order: '0' })
  dialogOpen.value = true
}

function openEdit(item: Article) {
  editing.value = item
  formError.value = null
  editorTab.value = 'edit'
  Object.assign(form, {
    slug: item.slug,
    title: item.title,
    content_md: item.content_md,
    status: item.status,
    sort_order: String(item.sort_order),
  })
  dialogOpen.value = true
}

async function save() {
  formError.value = null
  if (!form.slug.trim() || !form.title.trim()) {
    formError.value = t('error.required')
    return
  }
  saving.value = true
  try {
    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      content_md: form.content_md,
      status: form.status,
      sort_order: Number(form.sort_order) || 0,
    }
    if (editing.value) {
      await adminApi.updateArticle(editing.value.id, payload)
      toast.success(t('common.saved'))
    } else {
      await adminApi.createArticle(payload)
      toast.success(t('common.created'))
    }
    dialogOpen.value = false
    await load()
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

const confirmOpen = ref(false)
const confirmTarget = ref<Article | null>(null)

function askRemove(item: Article) {
  confirmTarget.value = item
  confirmOpen.value = true
}

async function remove() {
  const item = confirmTarget.value
  confirmOpen.value = false
  if (!item) return
  deleting.value = item.id
  try {
    await adminApi.deleteArticle(item.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    // 仍被商品引用时后端 409，这里直接展示原文以便管理员去解引用。
    toast.error(errorMessage(err))
  } finally {
    deleting.value = null
  }
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('articles.title')" :description="t('articles.subtitle')">
      <template #actions>
        <Button size="sm" @click="openCreate">
          <Plus />
          {{ t('articles.newArticle') }}
        </Button>
      </template>
    </PageHeader>

    <div class="flex max-w-xs items-center gap-2">
      <Label for="article-status" class="shrink-0 text-sm">{{ t('articles.status') }}</Label>
      <Select v-model="status" @update:model-value="load(1)">
        <SelectTrigger id="article-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{{ t('tickets.filterAll') }}</SelectItem>
          <SelectItem value="draft">{{ t('articles.statusDraft') }}</SelectItem>
          <SelectItem value="published">{{ t('articles.statusPublished') }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="5" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('articles.articleTitle') }}</TableHead>
                <TableHead>{{ t('articles.slug') }}</TableHead>
                <TableHead>{{ t('articles.status') }}</TableHead>
                <TableHead class="text-right">{{ t('articles.sort') }}</TableHead>
                <TableHead>{{ t('articles.updatedAt') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="6">{{ t('common.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium">{{ item.title }}</TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground">{{ item.slug }}</TableCell>
                <TableCell>
                  <Badge :variant="item.status === 'published' ? 'success' : 'secondary'">
                    {{ item.status === 'published' ? t('articles.statusPublished') : t('articles.statusDraft') }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right tabular">{{ item.sort_order }}</TableCell>
                <TableCell class="text-xs tabular text-muted-foreground">
                  {{ formatDateTime(item.updated_at) }}
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-if="item.status === 'published'"
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :aria-label="t('articles.viewArticle')"
                      :title="t('articles.viewArticle')"
                      as-child
                    >
                      <RouterLink :to="{ name: 'article-detail', params: { slug: item.slug } }" target="_blank">
                        <ExternalLink />
                      </RouterLink>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :aria-label="t('common.edit')"
                      @click="openEdit(item)"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :disabled="deleting === item.id"
                      :aria-label="t('common.delete')"
                      @click="askRemove(item)"
                    >
                      <Loader2 v-if="deleting === item.id" class="animate-spin" />
                      <Trash2 v-else class="text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pager :page="page" :page-size="pageSize" :total="total" @change="load" />
    </template>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{{ editing ? t('articles.editArticle') : t('articles.newArticle') }}</DialogTitle>
          <DialogDescription>{{ t('articles.subtitle') }}</DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="save">
          <ErrorAlert :message="formError" />

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="a-title">{{ t('articles.articleTitle') }}</Label>
              <Input id="a-title" v-model="form.title" required maxlength="128" />
            </div>
            <div class="space-y-2">
              <Label for="a-slug">{{ t('articles.slug') }}</Label>
              <Input id="a-slug" v-model="form.slug" required maxlength="64" autocomplete="off" />
              <p class="text-xs text-muted-foreground">{{ t('articles.slugHint') }}</p>
            </div>
            <div class="space-y-2">
              <Label for="a-status">{{ t('articles.status') }}</Label>
              <Select v-model="form.status">
                <SelectTrigger id="a-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{{ t('articles.statusDraft') }}</SelectItem>
                  <SelectItem value="published">{{ t('articles.statusPublished') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="a-sort">{{ t('articles.sort') }}</Label>
              <Input id="a-sort" v-model="form.sort_order" type="number" />
              <p class="text-xs text-muted-foreground">{{ t('articles.sortHint') }}</p>
            </div>
          </div>

          <Tabs v-model="editorTab">
            <TabsList>
              <TabsTrigger value="edit">{{ t('articles.editTab') }}</TabsTrigger>
              <TabsTrigger value="preview">{{ t('articles.previewTab') }}</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" class="space-y-2">
              <Label for="a-content">{{ t('articles.content') }}</Label>
              <Textarea
                id="a-content"
                v-model="form.content_md"
                rows="14"
                class="font-mono text-[13px] leading-6"
              />
              <p class="text-xs text-muted-foreground">{{ t('articles.contentHint') }}</p>
            </TabsContent>
            <TabsContent value="preview">
              <div class="min-h-40 rounded-md border p-4">
                <p v-if="!form.content_md.trim()" class="text-sm text-muted-foreground">
                  {{ t('articles.previewEmpty') }}
                </p>
                <div v-else class="md-body" v-html="previewHtml" />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" @click="dialogOpen = false">
              {{ t('common.cancel') }}
            </Button>
            <Button type="submit" :disabled="saving">
              <Loader2 v-if="saving" class="animate-spin" />
              {{ t('common.save') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="t('common.delete')"
      :description="(confirmTarget ? t('articles.deleteConfirm', { name: confirmTarget.title }) : '') + ' ' + t('articles.referencedHint')"
      :confirm-text="t('common.delete')"
      danger
      @confirm="remove"
    />
  </div>
</template>
