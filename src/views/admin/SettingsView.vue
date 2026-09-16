<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Plus, X } from 'lucide-vue-next'

import CaptchaField from '@/components/app/CaptchaField.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import {
  CAPTCHA_CHARSETS,
  CAPTCHA_MAX_LENGTH,
  CAPTCHA_MIN_LENGTH,
  HOME_FEATURE_ICONS,
  KYC_MODE_MANUAL,
  type CaptchaCharset,
  type HomeFeature,
  type HomeStat,
  type KYCPluginOption,
} from '@/lib/types'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const toast = useToast()
const site = useSiteStore()

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)
/** 预览用的独立 key：换了字符集或位数后重挂组件，才能看到新配置的效果。 */
const previewKey = ref(0)

const form = reactive({
  loginEnabled: false,
  registerEnabled: true,
  charset: 'digit' as CaptchaCharset,
  // Select 的值必须是字符串。
  length: String(CAPTCHA_MIN_LENGTH + 2),
  // 实名认证模式：manual 或实名认证插件 ID。
  kycMode: KYC_MODE_MANUAL,
})
const kycOptions = ref<KYCPluginOption[]>([])

/** 站点名称、简介与流量包兜底单价：安装后唯一可改的地方。 */
const siteForm = reactive({
  name: '',
  description: '',
  // 流量包兜底单价按元输入，保存时换算成分；空串表示未定价。
  trafficPrice: '',
})

/** 公开主页的编辑态，结构与后端 HomeConfig 对齐，保存时整体下发。 */
const homeForm = reactive({
  enabled: false,
  badge: '',
  title: '',
  subtitle: '',
  description: '',
  primaryText: '',
  primaryLink: '',
  secondaryText: '',
  secondaryLink: '',
  heroImageUrl: '',
  stats: [] as HomeStat[],
  features: [] as HomeFeature[],
  showProducts: true,
})

const lengthOptions = computed(() => {
  const out: string[] = []
  for (let n = CAPTCHA_MIN_LENGTH; n <= CAPTCHA_MAX_LENGTH; n++) out.push(String(n))
  return out
})

/** 两个开关都关掉时，字符集与位数存了也用不上，界面上明说一句。 */
const allDisabled = computed(() => !form.loginEnabled && !form.registerEnabled)

/** 元字符串转分：空串、非法输入或非正数都归 0（未定价）。 */
function yuanToFen(input: string): number {
  const n = Number.parseFloat(input)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100)
}

function charsetLabel(charset: CaptchaCharset) {
  return t(`admin.captchaCharset_${charset}`)
}

function addStat() {
  if (homeForm.stats.length >= 4) return
  homeForm.stats.push({ value: '', label: '' })
}

function removeStat(index: number) {
  homeForm.stats.splice(index, 1)
}

function addFeature() {
  if (homeForm.features.length >= 8) return
  homeForm.features.push({ icon: HOME_FEATURE_ICONS[0], title: '', desc: '', link: '' })
}

function removeFeature(index: number) {
  homeForm.features.splice(index, 1)
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [cfg, kyc, siteCfg, homeCfg] = await Promise.all([
      adminApi.captchaSettings(),
      adminApi.kycSettings(),
      adminApi.siteSettings(),
      adminApi.homeConfig(),
    ])
    form.loginEnabled = cfg.login_enabled
    form.registerEnabled = cfg.register_enabled
    form.charset = cfg.charset
    form.length = String(cfg.length)
    // 配置指向的插件已卸载时，下拉里没有这个值会显示不出来；回落人工审核。
    form.kycMode =
      kyc.mode === KYC_MODE_MANUAL || kyc.plugins.some((p) => p.id === kyc.mode)
        ? kyc.mode
        : KYC_MODE_MANUAL
    kycOptions.value = kyc.plugins
    siteForm.name = siteCfg.site_name
    siteForm.description = siteCfg.site_description
    // 分转元展示；未定价（0）显示为空串。
    siteForm.trafficPrice = siteCfg.traffic_price_per_gb_cents
      ? (siteCfg.traffic_price_per_gb_cents / 100).toFixed(2)
      : ''
    homeForm.enabled = homeCfg.enabled
    homeForm.badge = homeCfg.badge
    homeForm.title = homeCfg.title
    homeForm.subtitle = homeCfg.subtitle
    homeForm.description = homeCfg.description
    homeForm.primaryText = homeCfg.primary_button.text
    homeForm.primaryLink = homeCfg.primary_button.link
    homeForm.secondaryText = homeCfg.secondary_button.text
    homeForm.secondaryLink = homeCfg.secondary_button.link
    homeForm.heroImageUrl = homeCfg.hero_image_url
    homeForm.stats = (homeCfg.stats ?? []).map((s) => ({ value: s.value, label: s.label }))
    homeForm.features = (homeCfg.features ?? []).map((f) => ({
      icon: f.icon,
      title: f.title,
      desc: f.desc,
      link: f.link,
    }))
    homeForm.showProducts = homeCfg.show_products
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  formError.value = null
  saving.value = true
  try {
    await Promise.all([
      adminApi.updateCaptchaSettings({
        login_enabled: form.loginEnabled,
        register_enabled: form.registerEnabled,
        charset: form.charset,
        length: Number(form.length),
      }),
      adminApi.updateKYCSettings(form.kycMode),
      adminApi.updateSiteSettings({
        site_name: siteForm.name,
        site_description: siteForm.description,
        traffic_price_per_gb_cents: yuanToFen(siteForm.trafficPrice),
      }),
      adminApi.updateHomeConfig({
        enabled: homeForm.enabled,
        badge: homeForm.badge,
        title: homeForm.title,
        subtitle: homeForm.subtitle,
        description: homeForm.description,
        primary_button: { text: homeForm.primaryText, link: homeForm.primaryLink },
        secondary_button: { text: homeForm.secondaryText, link: homeForm.secondaryLink },
        hero_image_url: homeForm.heroImageUrl,
        stats: homeForm.stats,
        features: homeForm.features,
        show_products: homeForm.showProducts,
      }),
    ])
    // 重拉 bootstrap：登录注册页的验证码开关、浏览器标题与公开主页都来自它，
    // 不刷新的话本次会话里改动看不出效果。
    await site.load(true)
    previewKey.value++
    toast.success(t('common.saved'))
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('admin.settingsTitle')" :description="t('admin.settingsSubtitle')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <form v-else class="space-y-6" @submit.prevent="save">
      <ErrorAlert :message="formError" />

      <Card>
        <CardHeader>
          <CardTitle>{{ t('admin.siteInfoTitle') }}</CardTitle>
          <CardDescription>{{ t('admin.siteInfoSubtitle') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="max-w-sm space-y-2">
            <Label for="site-name">{{ t('admin.siteName') }}</Label>
            <Input id="site-name" v-model="siteForm.name" maxlength="64" />
          </div>
          <div class="max-w-xl space-y-2">
            <Label for="site-description">{{ t('admin.siteDescription') }}</Label>
            <Textarea id="site-description" v-model="siteForm.description" rows="3" maxlength="500" />
            <p class="text-muted-foreground text-xs">{{ t('admin.siteDescriptionHint') }}</p>
          </div>
          <div class="max-w-sm space-y-2">
            <Label for="site-traffic-price">{{ t('admin.trafficPricePerGB') }}</Label>
            <div class="flex items-center gap-2">
              <Input
                id="site-traffic-price"
                v-model="siteForm.trafficPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              <span class="text-muted-foreground shrink-0 text-xs">元 / GB</span>
            </div>
            <p class="text-muted-foreground text-xs">{{ t('admin.trafficPricePerGBHint') }}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('admin.homeTitle') }}</CardTitle>
          <CardDescription>{{ t('admin.homeSubtitle') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <Label for="home-enabled">{{ t('admin.homeEnabled') }}</Label>
              <p class="text-muted-foreground text-xs">{{ t('admin.homeEnabledHint') }}</p>
            </div>
            <Switch id="home-enabled" v-model="homeForm.enabled" />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="home-badge">{{ t('admin.homeBadge') }}</Label>
              <Input id="home-badge" v-model="homeForm.badge" maxlength="30" />
              <p class="text-muted-foreground text-xs">{{ t('admin.homeBadgeHint') }}</p>
            </div>
            <div class="space-y-2">
              <Label for="home-title">{{ t('admin.homeMainTitle') }}</Label>
              <Input id="home-title" v-model="homeForm.title" maxlength="60" />
              <p class="text-muted-foreground text-xs">{{ t('admin.homeMainTitleHint') }}</p>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="home-subtitle">{{ t('admin.homeSubTitle') }}</Label>
            <Input id="home-subtitle" v-model="homeForm.subtitle" maxlength="120" />
            <p class="text-muted-foreground text-xs">{{ t('admin.homeSubTitleHint') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="home-description">{{ t('admin.homeDescription') }}</Label>
            <Textarea id="home-description" v-model="homeForm.description" rows="3" maxlength="500" />
            <p class="text-muted-foreground text-xs">{{ t('admin.homeDescriptionHint') }}</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="home-primary-text">{{ t('admin.homePrimaryButton') }}</Label>
              <Input
                id="home-primary-text"
                v-model="homeForm.primaryText"
                :placeholder="t('admin.homeButtonText')"
                maxlength="20"
              />
              <Input
                v-model="homeForm.primaryLink"
                :placeholder="t('admin.homeButtonLink')"
                maxlength="500"
              />
              <p class="text-muted-foreground text-xs">{{ t('admin.homeButtonLinkHint') }}</p>
            </div>
            <div class="space-y-2">
              <Label for="home-secondary-text">{{ t('admin.homeSecondaryButton') }}</Label>
              <Input
                id="home-secondary-text"
                v-model="homeForm.secondaryText"
                :placeholder="t('admin.homeButtonText')"
                maxlength="20"
              />
              <Input
                v-model="homeForm.secondaryLink"
                :placeholder="t('admin.homeButtonLink')"
                maxlength="500"
              />
              <p class="text-muted-foreground text-xs">{{ t('admin.homeButtonLinkHint') }}</p>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="home-hero">{{ t('admin.homeHeroImage') }}</Label>
            <Input
              id="home-hero"
              v-model="homeForm.heroImageUrl"
              placeholder="https://… 或 /…"
              maxlength="1000"
            />
            <p class="text-muted-foreground text-xs">{{ t('admin.homeHeroImageHint') }}</p>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between gap-4">
              <div class="space-y-1">
                <Label>{{ t('admin.homeStats') }}（{{ homeForm.stats.length }}/4）</Label>
                <p class="text-muted-foreground text-xs">{{ t('admin.homeStatsHint') }}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                :disabled="homeForm.stats.length >= 4"
                @click="addStat"
              >
                <Plus />
                {{ t('admin.homeAddStat') }}
              </Button>
            </div>
            <div
              v-for="(stat, index) in homeForm.stats"
              :key="index"
              class="flex items-start gap-2"
            >
              <Input
                v-model="stat.value"
                :placeholder="t('admin.homeStatValue')"
                maxlength="30"
                class="max-w-40"
              />
              <Input
                v-model="stat.label"
                :placeholder="t('admin.homeStatLabel')"
                maxlength="30"
                class="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                :aria-label="t('admin.homeRemove')"
                @click="removeStat(index)"
              >
                <X />
              </Button>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between gap-4">
              <div class="space-y-1">
                <Label>{{ t('admin.homeFeatures') }}（{{ homeForm.features.length }}/8）</Label>
                <p class="text-muted-foreground text-xs">{{ t('admin.homeFeaturesHint') }}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                :disabled="homeForm.features.length >= 8"
                @click="addFeature"
              >
                <Plus />
                {{ t('admin.homeAddFeature') }}
              </Button>
            </div>
            <div
              v-for="(feature, index) in homeForm.features"
              :key="index"
              class="space-y-2 rounded-lg border p-3"
            >
              <div class="flex items-center gap-2">
                <Select v-model="feature.icon">
                  <SelectTrigger class="w-40" :aria-label="t('admin.homeFeatureIcon')">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="icon in HOME_FEATURE_ICONS" :key="icon" :value="icon">
                      {{ icon }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  v-model="feature.title"
                  :placeholder="t('admin.homeFeatureTitle')"
                  maxlength="30"
                  class="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  :aria-label="t('admin.homeRemove')"
                  @click="removeFeature(index)"
                >
                  <X />
                </Button>
              </div>
              <Textarea
                v-model="feature.desc"
                :placeholder="t('admin.homeFeatureDesc')"
                rows="2"
                maxlength="200"
              />
              <Input
                v-model="feature.link"
                :placeholder="t('admin.homeFeatureLink')"
                maxlength="500"
              />
            </div>
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <Label for="home-show-products">{{ t('admin.homeShowProducts') }}</Label>
              <p class="text-muted-foreground text-xs">{{ t('admin.homeShowProductsHint') }}</p>
            </div>
            <Switch id="home-show-products" v-model="homeForm.showProducts" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('admin.captchaTitle') }}</CardTitle>
          <CardDescription>{{ t('admin.captchaSubtitle') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <Label for="captcha-login">{{ t('admin.captchaLogin') }}</Label>
              <p class="text-muted-foreground text-xs">{{ t('admin.captchaLoginHint') }}</p>
            </div>
            <Switch id="captcha-login" v-model="form.loginEnabled" />
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <Label for="captcha-register">{{ t('admin.captchaRegister') }}</Label>
              <p class="text-muted-foreground text-xs">{{ t('admin.captchaRegisterHint') }}</p>
            </div>
            <Switch id="captcha-register" v-model="form.registerEnabled" />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="captcha-charset">{{ t('admin.captchaType') }}</Label>
              <Select v-model="form.charset">
                <SelectTrigger id="captcha-charset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="item in CAPTCHA_CHARSETS" :key="item" :value="item">
                    {{ charsetLabel(item) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-muted-foreground text-xs">{{ t('admin.captchaTypeHint') }}</p>
            </div>

            <div class="space-y-2">
              <Label for="captcha-length">{{ t('admin.captchaLength') }}</Label>
              <Select v-model="form.length">
                <SelectTrigger id="captcha-length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="item in lengthOptions" :key="item" :value="item">
                    {{ t('admin.captchaLengthOption', { n: item }) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-muted-foreground text-xs">{{ t('admin.captchaLengthHint') }}</p>
            </div>
          </div>

          <p v-if="allDisabled" class="text-muted-foreground text-xs">
            {{ t('admin.captchaAllDisabled') }}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('admin.kycTitle') }}</CardTitle>
          <CardDescription>{{ t('admin.kycSubtitle') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="max-w-sm space-y-2">
            <Label for="kyc-mode">{{ t('admin.kycMode') }}</Label>
            <Select v-model="form.kycMode">
              <SelectTrigger id="kyc-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{{ t('admin.kycModeManual') }}</SelectItem>
                <SelectItem v-for="option in kycOptions" :key="option.id" :value="option.id">
                  {{ option.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-muted-foreground text-xs">{{ t('admin.kycModeHint') }}</p>
            <p v-if="form.kycMode !== 'manual' && !kycOptions.length" class="text-destructive text-xs">
              {{ t('admin.kycNoPlugins') }}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('admin.captchaPreview') }}</CardTitle>
          <CardDescription>{{ t('admin.captchaPreviewHint') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <!-- 预览走的是真实签发接口，因此展示的一定是当前已保存的配置。 -->
          <div class="max-w-sm">
            <CaptchaField
              :key="previewKey"
              id="captcha-preview"
              :charset="form.charset"
            />
          </div>
        </CardContent>
      </Card>

      <div class="flex justify-end">
        <Button type="submit" :disabled="saving">
          <Loader2 v-if="saving" class="animate-spin" />
          {{ t('common.save') }}
        </Button>
      </div>
    </form>
  </div>
</template>
