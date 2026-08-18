<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Puzzle, RefreshCw, Upload } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import type { Plugin, PluginConfigField, PluginScope } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()
const plugins = ref<Plugin[]>([])
const scopes = ref<PluginScope[]>([])
const loading = ref(true)
const busy = ref(false)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)
const file = ref<File | null>(null)
const selected = ref<Plugin | null>(null)
const logs = ref<string[]>([])
const frontendOpen = ref(false)
const logOpen = ref(false)
const values = reactive<Record<string, string>>({})
const granted = ref<PluginScope[]>([])

const frontendURL = computed(() => selected.value?.frontend_url ?? '')

function selectPlugin(item: Plugin) {
  selected.value = item
  formError.value = null
  for (const key of Object.keys(values)) delete values[key]
  for (const field of item.config) values[field.key] = field.secret ? '' : field.value
  granted.value = [...item.granted_scopes] as PluginScope[]
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await adminApi.plugins()
    plugins.value = data.items ?? []
    scopes.value = data.scopes ?? []
    if (selected.value) {
      const current = plugins.value.find((item) => item.id === selected.value?.id)
      if (current) selectPlugin(current)
    }
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function reload() {
  busy.value = true
  try {
    const data = await adminApi.reloadPlugins()
    plugins.value = data.items ?? []
    scopes.value = data.scopes ?? []
    toast.success(t('common.saved'))
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

function choose(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function install() {
  if (!file.value) {
    formError.value = t('admin.pluginNoFile')
    return
  }
  busy.value = true
  formError.value = null
  try {
    await adminApi.installPlugin(file.value)
    file.value = null
    toast.success(t('admin.pluginInstalled'))
    await load()
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function toggle(item: Plugin) {
  busy.value = true
  try {
    const updated = item.enabled ? await adminApi.disablePlugin(item.id) : await adminApi.enablePlugin(item.id)
    const index = plugins.value.findIndex((entry) => entry.id === item.id)
    if (index >= 0) plugins.value[index] = updated
    if (selected.value?.id === updated.id) selectPlugin(updated)
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function saveConfig() {
  if (!selected.value) return
  busy.value = true
  formError.value = null
  try {
    const updated = await adminApi.updatePluginConfig(selected.value.id, {
      values: { ...values },
      scopes: granted.value,
    })
    const index = plugins.value.findIndex((entry) => entry.id === updated.id)
    if (index >= 0) plugins.value[index] = updated
    selectPlugin(updated)
    toast.success(t('common.saved'))
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function showLogs(item: Plugin) {
  selected.value = item
  logOpen.value = true
  try {
    logs.value = await adminApi.pluginLogs(item.id)
  } catch (err) {
    formError.value = errorMessage(err)
  }
}

function fieldType(field: PluginConfigField) {
  return field.type === 'number' ? 'number' : 'text'
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('admin.pluginsTitle')" :description="t('admin.pluginsSubtitle')" />
    <ErrorAlert :message="error" />
    <ErrorAlert :message="formError" />

    <Card>
      <CardHeader>
        <CardTitle>{{ t('admin.pluginInstall') }}</CardTitle>
        <CardDescription>{{ t('admin.pluginChooseFile') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input type="file" accept=".zip,application/zip" @change="choose" />
        <Button :disabled="busy" @click="install"><Upload />{{ t('admin.pluginInstall') }}</Button>
        <Button variant="outline" :disabled="busy" @click="reload"><RefreshCw :class="busy ? 'animate-spin' : ''" />{{ t('admin.pluginReload') }}</Button>
      </CardContent>
    </Card>

    <div v-if="loading" class="text-muted-foreground">{{ t('common.loading') }}</div>
    <div v-else-if="!plugins.length" class="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
      <Puzzle class="mx-auto mb-2 size-8" />{{ t('common.empty') }}
    </div>
    <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div class="space-y-4">
        <Card v-for="item in plugins" :key="item.id">
          <CardContent class="space-y-4 pt-6">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="font-semibold">{{ item.name || item.id }}</h2>
                <p class="text-muted-foreground text-xs">{{ item.id }}<span v-if="item.version"> · {{ item.version }}</span></p>
              </div>
              <StateBadge kind="plugin" :value="item.state" />
            </div>
            <p v-if="item.description" class="text-muted-foreground text-sm">{{ item.description }}</p>
            <p v-if="item.last_error" class="text-destructive text-xs">{{ item.last_error }}</p>
            <p v-if="item.state === 'skipped'" class="text-muted-foreground text-xs">{{ item.last_error }}</p>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="capability in item.capabilities" :key="capability" variant="outline">{{ capability }}</Badge>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button size="sm" :disabled="busy || item.state === 'skipped'" @click="toggle(item)">
                <Loader2 v-if="busy" class="animate-spin" />{{ item.enabled ? t('admin.pluginDisable') : t('admin.pluginEnable') }}
              </Button>
              <Button size="sm" variant="outline" @click="selectPlugin(item)">{{ t('admin.pluginConfigure') }}</Button>
              <Button size="sm" variant="ghost" @click="showLogs(item)">{{ t('admin.pluginLogs') }}</Button>
              <Button v-if="item.has_frontend" size="sm" variant="outline" @click="selectPlugin(item); frontendOpen = true">{{ t('admin.pluginFrontend') }}</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card v-if="selected">
        <CardHeader>
          <CardTitle>{{ selected.name || selected.id }}</CardTitle>
          <CardDescription>{{ t('admin.pluginConfig') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="space-y-6" @submit.prevent="saveConfig">
            <div v-if="selected.config.length" class="space-y-4">
              <div v-for="field in selected.config" :key="field.key" class="space-y-2">
                <Label :for="`plugin-${field.key}`">{{ field.label }}<span v-if="field.required"> *</span></Label>
                <Textarea v-if="field.type === 'textarea'" :id="`plugin-${field.key}`" v-model="values[field.key]" :placeholder="field.secret && field.has_value ? '••••••••' : undefined" />
                <select v-else-if="field.type === 'select'" :id="`plugin-${field.key}`" v-model="values[field.key]" class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm">
                  <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <Input v-else :id="`plugin-${field.key}`" v-model="values[field.key]" :type="field.secret ? 'password' : fieldType(field)" />
                <p v-if="field.hint" class="text-muted-foreground text-xs">{{ field.hint }}</p>
              </div>
            </div>
            <p v-else class="text-muted-foreground text-sm">{{ t('admin.pluginNoConfig') }}</p>
            <div v-if="scopes.length" class="space-y-3">
              <Label>{{ t('admin.pluginGrantedScopes') }}</Label>
              <label v-for="scope in scopes" :key="scope" class="flex items-center gap-3 text-sm">
                <input v-model="granted" type="checkbox" :value="scope" />{{ scope }}
              </label>
            </div>
            <Button type="submit" :disabled="busy"><Loader2 v-if="busy" class="animate-spin" />{{ t('common.save') }}</Button>
          </form>
        </CardContent>
      </Card>
    </div>

    <Dialog v-model:open="frontendOpen">
      <DialogContent class="h-[calc(100dvh-2rem)] max-w-6xl p-2 sm:p-3">
        <DialogHeader class="px-3 pt-3">
          <DialogTitle>{{ selected?.name || selected?.id }}</DialogTitle>
          <DialogDescription>{{ t('admin.pluginFrontend') }}</DialogDescription>
        </DialogHeader>
        <iframe v-if="frontendURL" :src="frontendURL" class="min-h-0 flex-1 rounded border" :title="selected?.name || selected?.id" />
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="logOpen">
      <DialogContent>
        <DialogHeader><DialogTitle>{{ t('admin.pluginLogs') }}</DialogTitle></DialogHeader>
        <pre class="bg-muted max-h-[60dvh] overflow-auto rounded p-3 text-xs whitespace-pre-wrap">{{ logs.join('\n') || t('common.empty') }}</pre>
      </DialogContent>
    </Dialog>
  </div>
</template>
