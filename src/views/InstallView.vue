<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { CheckCircle2, Database, HardDrive, Loader2, Server, User } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'
import { siteApi } from '@/lib/endpoints'
import { cn } from '@/lib/utils'
import type { DatabaseConfig, DatabaseDriver } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const router = useRouter()
const site = useSiteStore()
const auth = useAuthStore()

const step = ref(0)
const error = ref<string | null>(null)
const testing = ref(false)
const tested = ref(false)
const submitting = ref(false)

const db = reactive<DatabaseConfig>({
  driver: 'sqlite',
  path: '',
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  name: 'levis',
})

const form = reactive({
  siteName: '',
  siteDescription: '',
  adminUsername: '',
  adminEmail: '',
  adminPassword: '',
})

const DRIVERS: { value: DatabaseDriver; label: string; hint: string; icon: typeof HardDrive }[] = [
  { value: 'sqlite', label: 'install.driverSqlite', hint: 'install.driverSqliteHint', icon: HardDrive },
  { value: 'mysql', label: 'install.driverMysql', hint: 'install.driverMysqlHint', icon: Database },
  {
    value: 'postgres',
    label: 'install.driverPostgres',
    hint: 'install.driverPostgresHint',
    icon: Server,
  },
]

const needsNetwork = computed(() => db.driver !== 'sqlite')

// 切换驱动时端口跟着变，同时作废上一次的连接测试结果。
watch(
  () => db.driver,
  (driver) => {
    tested.value = false
    error.value = null
    if (driver === 'mysql') db.port = 3306
    if (driver === 'postgres') db.port = 5432
  },
)

// 任何连接参数改动都要重新测试，否则「已测试通过」是过期结论。
watch([() => db.host, () => db.port, () => db.user, () => db.password, () => db.name, () => db.path], () => {
  tested.value = false
})

/** 只发送当前驱动用得到的字段，避免把 MySQL 的默认值写进 SQLite 配置。 */
function databasePayload(): DatabaseConfig {
  if (db.driver === 'sqlite') {
    return { driver: 'sqlite', path: db.path?.trim() ?? '' }
  }
  return {
    driver: db.driver,
    host: db.host?.trim(),
    port: Number(db.port) || 0,
    user: db.user?.trim(),
    password: db.password,
    name: db.name?.trim(),
  }
}

async function testConnection() {
  error.value = null
  testing.value = true
  try {
    await siteApi.testDatabase(databasePayload())
    tested.value = true
  } catch (err) {
    tested.value = false
    error.value = errorMessage(err)
  } finally {
    testing.value = false
  }
}

function nextStep() {
  error.value = null
  // SQLite 建库即用，不强制测试；网络数据库参数容易填错，必须先测通，
  // 否则错误会推迟到「完成安装」时才暴露。
  if (step.value === 0 && needsNetwork.value && !tested.value) {
    error.value = t('install.testFirst')
    return
  }
  if (step.value === 1 && !form.siteName.trim()) {
    error.value = t('error.required')
    return
  }
  step.value += 1
}

function prevStep() {
  error.value = null
  step.value -= 1
}

async function submit() {
  error.value = null
  if (!form.adminUsername.trim() || !form.adminEmail.trim() || !form.adminPassword) {
    error.value = t('error.required')
    return
  }
  submitting.value = true
  try {
    const result = await siteApi.install({
      database: databasePayload(),
      site_name: form.siteName.trim(),
      site_description: form.siteDescription.trim(),
      admin_username: form.adminUsername.trim(),
      admin_email: form.adminEmail.trim(),
      admin_password: form.adminPassword,
    })
    // 后端安装成功后已直接下发管理员登录态。
    site.markInstalled(form.siteName.trim(), form.siteDescription.trim())
    if (result.user) {
      auth.setUser(result.user)
    } else {
      await auth.restore()
    }
    step.value = 3
    // 稍作停顿让用户看到成功状态，再进管理后台。
    window.setTimeout(() => router.replace({ name: 'admin' }), 900)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}

const STEPS = ['install.stepDatabase', 'install.stepSite', 'install.stepAdmin']
</script>

<template>
  <div class="flex min-h-svh items-center justify-center px-4 py-10">
    <Card class="w-full max-w-xl">
      <CardHeader>
        <CardTitle class="text-xl">{{ t('install.title') }}</CardTitle>
        <CardDescription>{{ t('install.subtitle') }}</CardDescription>

        <!-- 步骤指示器 -->
        <ol class="mt-4 flex items-center gap-2" :aria-label="t('install.title')">
          <li
            v-for="(label, index) in STEPS"
            :key="label"
            class="flex flex-1 items-center gap-2"
            :aria-current="step === index ? 'step' : undefined"
          >
            <span
              :class="
                cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular',
                  step > index && 'bg-success border-success text-success-foreground',
                  step === index && 'bg-primary border-primary text-primary-foreground',
                )
              "
            >
              {{ index + 1 }}
            </span>
            <span class="truncate text-xs">{{ t(label) }}</span>
            <span v-if="index < STEPS.length - 1" class="bg-border h-px flex-1" />
          </li>
        </ol>
      </CardHeader>

      <CardContent class="space-y-5">
        <ErrorAlert :message="error" />

        <!-- 第一步：数据库 -->
        <div v-if="step === 0" class="space-y-5">
          <fieldset class="space-y-2">
            <legend class="mb-2 text-sm font-medium">{{ t('install.driver') }}</legend>
            <div class="grid gap-2">
              <label
                v-for="item in DRIVERS"
                :key="item.value"
                :class="
                  cn(
                    'hover:bg-accent flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    db.driver === item.value && 'border-primary bg-accent',
                  )
                "
              >
                <input
                  v-model="db.driver"
                  type="radio"
                  name="driver"
                  :value="item.value"
                  class="mt-1 size-4 accent-current"
                />
                <component :is="item.icon" class="mt-0.5 size-4 shrink-0" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium">{{ t(item.label) }}</span>
                  <span class="text-muted-foreground block text-xs">{{ t(item.hint) }}</span>
                </span>
              </label>
            </div>
          </fieldset>

          <div v-if="db.driver === 'sqlite'" class="space-y-2">
            <Label for="db-path">{{ t('install.path') }}</Label>
            <Input
              id="db-path"
              v-model="db.path"
              :placeholder="t('install.pathPlaceholder')"
              autocomplete="off"
            />
          </div>

          <div v-else class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="db-host">{{ t('install.host') }}</Label>
              <Input id="db-host" v-model="db.host" autocomplete="off" />
            </div>
            <div class="space-y-2">
              <Label for="db-port">{{ t('install.port') }}</Label>
              <Input id="db-port" v-model="db.port" type="number" min="1" max="65535" />
            </div>
            <div class="space-y-2">
              <Label for="db-user">{{ t('install.user') }}</Label>
              <Input id="db-user" v-model="db.user" autocomplete="off" />
            </div>
            <div class="space-y-2">
              <Label for="db-password">{{ t('install.password') }}</Label>
              <Input
                id="db-password"
                v-model="db.password"
                type="password"
                autocomplete="new-password"
              />
            </div>
            <div class="space-y-2 sm:col-span-2">
              <Label for="db-name">{{ t('install.dbName') }}</Label>
              <Input id="db-name" v-model="db.name" autocomplete="off" />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <Button variant="outline" :disabled="testing" @click="testConnection">
              <Loader2 v-if="testing" class="animate-spin" />
              {{ testing ? t('install.testing') : t('install.testConnection') }}
            </Button>
            <span v-if="tested" class="text-success flex items-center gap-1 text-sm">
              <CheckCircle2 class="size-4" />
              {{ t('install.testOk') }}
            </span>
          </div>
        </div>

        <!-- 第二步：站点信息 -->
        <div v-else-if="step === 1" class="space-y-4">
          <div class="space-y-2">
            <Label for="site-name">{{ t('install.siteName') }}</Label>
            <Input
              id="site-name"
              v-model="form.siteName"
              :placeholder="t('install.siteNamePlaceholder')"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="site-desc">
              {{ t('install.siteDescription') }}
              <span class="text-muted-foreground text-xs">（{{ t('common.optional') }}）</span>
            </Label>
            <Textarea id="site-desc" v-model="form.siteDescription" rows="3" />
          </div>
        </div>

        <!-- 第三步：管理员 -->
        <form v-else-if="step === 2" class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="admin-username">
              <User class="size-4" />
              {{ t('install.adminUsername') }}
            </Label>
            <Input
              id="admin-username"
              v-model="form.adminUsername"
              autocomplete="username"
              required
            />
            <p class="text-muted-foreground text-xs">{{ t('auth.usernameHint') }}</p>
          </div>
          <div class="space-y-2">
            <Label for="admin-email">{{ t('install.adminEmail') }}</Label>
            <Input id="admin-email" v-model="form.adminEmail" type="email" autocomplete="email" required />
          </div>
          <div class="space-y-2">
            <Label for="admin-password">{{ t('install.adminPassword') }}</Label>
            <Input
              id="admin-password"
              v-model="form.adminPassword"
              type="password"
              autocomplete="new-password"
              required
            />
            <p class="text-muted-foreground text-xs">{{ t('install.passwordHint') }}</p>
          </div>
        </form>

        <!-- 完成 -->
        <div v-else class="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 class="text-success size-10" />
          <p class="text-sm">{{ t('install.done') }}</p>
        </div>

        <div v-if="step < 3" class="flex items-center justify-between gap-3 pt-2">
          <Button v-if="step > 0" variant="ghost" @click="prevStep">
            {{ t('install.prevStep') }}
          </Button>
          <span v-else />
          <Button v-if="step < 2" @click="nextStep">{{ t('install.nextStep') }}</Button>
          <Button v-else :disabled="submitting" @click="submit">
            <Loader2 v-if="submitting" class="animate-spin" />
            {{ submitting ? t('install.installing') : t('install.submit') }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
