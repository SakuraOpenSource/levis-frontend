<script setup lang="ts">
 import { computed, onMounted, reactive, ref } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRoute, useRouter } from 'vue-router'
 import { Loader2, Minus, Plus } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { articleApi, catalogApi, orderApi } from '@/lib/endpoints'
import { regionInfo } from '@/lib/regions'
 import type { Article, Product, ProvisionConfig, UpstreamAgent } from '@/lib/types'

/**
 * 接口商品购买页：弹性云在区间内自选规格，固定配置只展示；
 * 按驱动列出可选系统镜像，提交后生成待支付订单并跳转结算页。
 * 普通商品不走这里 —— 它们直接加购物车。
 */

const route = useRoute()
const router = useRouter()
const toast = useToast()
 const { t } = useI18n()
 const { cycleLabel } = useCycleLabel()

 const product = ref<Product | null>(null)
 const loading = ref(true)
 const error = ref<string | null>(null)
 const submitting = ref(false)
 const formError = ref<string | null>(null)
 /** 购买协议：商品绑定了协议文章（单选或多选）时必须勾选同意才能下单。 */
 const agreed = ref(false)
 /** 单选协议（旧字段，兼容）。 */
 const agreement = ref<Article | null>(null)
 /** 多选协议：按 agreement_article_ids 批量解析。 */
 const agreements = ref<Article[]>([])
 const allAgreements = computed(() => {
   const list = [...agreements.value]
   if (agreement.value && !list.some((a) => a.id === agreement.value!.id)) list.unshift(agreement.value)
   return list
 })
 const agreementRequired = computed(
   () => product.value?.agreement_article_id != null || (product.value?.agreement_article_ids?.length ?? 0) > 0,
 )
 const agreementTitle = computed(() => agreement.value?.title || t('agreement.fallbackTitle'))
 const agreementSlug = computed(() => agreement.value?.slug ?? '')

const images = ref<{ id: string; name: string; group: string }[]>([])
const imagesLoading = ref(false)
const imagesError = ref<string | null>(null)
/** 可选被控节点：非空时展示节点选择，提交带 agent_id。 */
const agents = ref<UpstreamAgent[]>([])
const selectedAgent = ref('')

const selectedImage = ref('')
const quantity = ref(1)

const cfg = computed<ProvisionConfig | null>(() => product.value?.provision_config ?? null)

/** 地区徽标：未设置（''）时隐藏，台湾等特殊映射由 regions.ts 统一处理。 */
const regionTag = computed(() => regionInfo(product.value?.region || ''))
/** 选配编辑态：键与后端约定一致，值一律是数字（提交时转字符串）。 */
const picks = reactive({
  cpu: 1,
  memory_mb: 512,
  disk_gb: 10,
  bandwidth_mbps: 10,
  traffic_gb: 0,
})

/** 弹性表单的资源行。流量 0 表示不限。 */
const FIELDS = [
  { key: 'cpu' as const, label: 'CPU', unit: '核', hint: '' },
  { key: 'memory_mb' as const, label: '内存', unit: 'MB', hint: '' },
  { key: 'disk_gb' as const, label: '硬盘', unit: 'GB', hint: '' },
  { key: 'bandwidth_mbps' as const, label: '带宽', unit: 'Mbps', hint: '' },
  { key: 'traffic_gb' as const, label: '流量', unit: 'GB', hint: '0 表示不限流量' },
]

/** 流量统一按 GB 展示，0 表示不限。 */
function trafficLabel(gb: number) {
  return gb === 0 ? '不限' : `${gb} GB`
}

const fixedSpecs = computed(() => {
  if (!cfg.value) return []
  return [
    { label: 'CPU', value: `${formatSpec(cfg.value.cpu.min)} 核` },
    { label: '内存', value: `${cfg.value.memory_mb.min} MB` },
    { label: '硬盘', value: `${cfg.value.disk_gb.min} GB` },
    { label: '带宽', value: cfg.value.bandwidth_mbps.min > 0 ? `${cfg.value.bandwidth_mbps.min} Mbps` : '不限' },
    { label: '流量', value: trafficLabel(cfg.value.traffic_gb.min) },
    { label: '驱动', value: cfg.value.driver === 'incus' ? 'Incus 容器' : 'QEMU 虚拟机' },
  ]
})

/** 规格数值展示：去掉浮点尾差与尾零（2 → "2"、0.25 → "0.25"、0.30000004 → "0.3"）。 */
function formatSpec(value: number) {
  return String(Math.round(value * 100) / 100)
}

function initPicks(config: ProvisionConfig) {
  picks.cpu = config.cpu.min
  picks.memory_mb = config.memory_mb.min
  picks.disk_gb = config.disk_gb.min
  picks.bandwidth_mbps = config.bandwidth_mbps.min
  picks.traffic_gb = config.traffic_gb.min
}

/**
 * 弹性步长：CPU 支持小数核数（如 0.05），其余维度仍保持整数语义、
 * 至少为 1；历史配置没有 step 字段时按 1 兼容。
 */
function rangeStep(field: (typeof FIELDS)[number], config = cfg.value) {
  const step = config?.[field.key].step ?? 1
  if (field.key === 'cpu') return step > 0 ? step : 1
  return Math.max(step, 1)
}

/** 吸附到最近的合法步长点并夹回区间内，两位小数取整消除浮点尾差。 */
function snapToStep(range: { min: number; max: number }, value: number, step: number) {
  const steps = Math.round((value - range.min) / step)
  const snapped = Math.round((range.min + steps * step) * 100) / 100
  return Math.min(range.max, Math.max(range.min, snapped))
}

function clampPick(field: (typeof FIELDS)[number]) {
  if (!cfg.value) return
  const range = cfg.value[field.key]
  const raw = Number(picks[field.key])
  picks[field.key] = snapToStep(range, Number.isFinite(raw) ? raw : range.min, rangeStep(field))
}

function adjustPick(field: (typeof FIELDS)[number], direction: number) {
  if (!cfg.value) return
  const range = cfg.value[field.key]
  picks[field.key] = snapToStep(range, picks[field.key] + direction * rangeStep(field), rangeStep(field))
}

const provisionExtraCents = computed(() => {
  if (!cfg.value || cfg.value.mode !== 'elastic') return 0
  return FIELDS.reduce((total, field) => {
    const range = cfg.value![field.key]
    const step = rangeStep(field)
    const unitPrice = range.unit_price_cents ?? 0
    return total + Math.max(0, Math.round((picks[field.key] - range.min) / step)) * unitPrice
  }, 0)
})

const selectedUnitPriceCents = computed(() => (product.value?.price_cents ?? 0) + provisionExtraCents.value)
const selectedTotalCents = computed(() => selectedUnitPriceCents.value * Math.max(quantity.value, 1))

 /**
  * 协议标题按需解析：公开文章接口只支持按 slug 读取，而商品只暴露数字 ID，
  * 因此这里用管理端接口按 ID 读取标题与 slug；普通买家无管理权限时会失败，
  * 此时静默回退为通用名称，购买 gating 不受影响。
  */
 async function loadAgreement(articleId: number) {
   try {
    agreement.value = await articleApi.getById(articleId)
   } catch {
     agreement.value = null
   }
 }

 /**
  * 批量解析多选协议：失败的静默降级为空列表，购买 gating 仍按商品字段生效。
  */
 async function loadAgreements(articleIds: number[]) {
   try {
     agreements.value = await articleApi.getByIds(articleIds)
   } catch {
     agreements.value = []
   }
 }
async function loadImages() {
  imagesLoading.value = true
  imagesError.value = null
  try {
    images.value = await catalogApi.productOs(Number(route.params.id))
    if (!images.value.length) {
      imagesError.value = '上游暂无可用的系统镜像'
    }
  } catch (err) {
    imagesError.value = errorMessage(err)
  } finally {
    imagesLoading.value = false
  }
}

/** 加载可选被控节点：仅在线节点可选中；空列表时隐藏选择器（上游自动选）。 */
async function loadAgents() {
  try {
    agents.value = await catalogApi.productAgents(Number(route.params.id))
  } catch {
    agents.value = []
  }
}

function agentLabel(a: UpstreamAgent) {
  const name = a.display_name || a.name
  return a.status === 'online' ? name : `${name}（离线）`
}

 async function submit() {
   formError.value = null
   if (!cfg.value || !product.value) return
   if (!selectedImage.value) {
     formError.value = '请选择操作系统'
     return
   }
   if (agreementRequired.value && !agreed.value) {
     formError.value = t('agreement.agreeRequired')
     return
   }
  if (cfg.value.mode === 'elastic') {
    for (const field of FIELDS) {
      const range = cfg.value[field.key]
      const value = Number(picks[field.key])
      const step = rangeStep(field)
      // 与后端同口径：区间内且 (value-min)/step 接近整数，浮点留 1e-6 容差。
      const steps = (value - range.min) / step
      if (
        !Number.isFinite(value) ||
        value < range.min ||
        value > range.max ||
        Math.abs(steps - Math.round(steps)) > 1e-6
      ) {
        formError.value = `${field.label}需在 ${formatSpec(range.min)} - ${formatSpec(range.max)} ${field.unit} 之间，步长为 ${formatSpec(step)}`
        return
      }
    }
  }
  submitting.value = true
  try {
    const order = await orderApi.buyNow({
      product_id: product.value.id,
      quantity: quantity.value,
       billing_cycle: product.value.billing_cycle,
       agree: agreed.value,
      options: {
        driver: cfg.value.driver,
        // formatSpec 统一去浮点尾差：0.5000000000000001 会提交成 "0.5"。
        cpu: formatSpec(picks.cpu),
        memory_mb: formatSpec(picks.memory_mb),
        disk_gb: formatSpec(picks.disk_gb),
        bandwidth_mbps: formatSpec(picks.bandwidth_mbps),
        traffic_gb: formatSpec(picks.traffic_gb),
        image_id: selectedImage.value,
        image_name: images.value.find((item) => item.id === selectedImage.value)?.name ?? '',
        ...(selectedAgent.value ? { agent_id: selectedAgent.value } : {}),
      },
    })
    toast.success('订单已创建，请完成支付')
    await router.push({ name: 'checkout', params: { id: String(order.id) } })
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const item = await catalogApi.product(Number(route.params.id))
    product.value = item
    if (!item.interface_id || !item.provision_config) {
      // 普通商品回到商城，由购物车承接。
      await router.replace({ name: 'shop' })
      return
    }
     initPicks(item.provision_config)
     if (item.agreement_article_id != null) await loadAgreement(item.agreement_article_id)
     if ((item.agreement_article_ids?.length ?? 0) > 0) await loadAgreements(item.agreement_article_ids ?? [])
    await loadImages()
    await loadAgents()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <PageHeader :title="product?.name ?? '商品详情'" :description="product?.description || ''" />
    <p v-if="regionTag.code" class="text-sm text-muted-foreground">
      <span aria-hidden="true">{{ regionTag.flag }}</span> {{ regionTag.name }}
    </p>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else-if="product && cfg">
      <Card>
        <CardHeader>
          <CardTitle class="text-base">{{ cfg.mode === 'elastic' ? '弹性配置' : '固定配置' }}</CardTitle>
          <CardDescription>
            {{ cfg.mode === 'elastic' ? '在管理员设定的区间内自由选择规格' : '该商品为固定规格' }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-5">
          <dl v-if="cfg.mode === 'fixed'" class="space-y-1.5 text-sm">
            <div v-for="spec in fixedSpecs" :key="spec.label" class="flex items-baseline gap-3">
              <dt class="text-muted-foreground w-16 shrink-0 text-xs">{{ spec.label }}</dt>
              <dd class="flex-1 text-right">{{ spec.value }}</dd>
            </div>
          </dl>

          <div v-else class="space-y-4">
            <div v-for="field in FIELDS" :key="field.key" class="space-y-1.5">
              <div class="flex items-center justify-between">
                <Label :for="`pick-${field.key}`">{{ field.label }}</Label>
                <span class="text-muted-foreground text-xs">
                  {{ field.key === 'traffic_gb' ? trafficLabel(picks.traffic_gb) : `${formatSpec(picks[field.key])} ${field.unit}` }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  :id="`pick-${field.key}-range`"
                  v-model.number="picks[field.key]"
                  type="range"
                  class="accent-primary min-w-0 flex-1"
                  :min="cfg[field.key].min"
                  :max="cfg[field.key].max"
                  :step="rangeStep(field)"
                  :aria-label="field.label"
                  @change="clampPick(field)"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  class="size-9 shrink-0"
                  :disabled="picks[field.key] <= cfg[field.key].min"
                  :aria-label="`${field.label}减少一个步长`"
                  @click="adjustPick(field, -1)"
                >
                  <Minus />
                </Button>
                <Input
                  :id="`pick-${field.key}`"
                  v-model.number="picks[field.key]"
                  type="number"
                  :min="cfg[field.key].min"
                  :max="cfg[field.key].max"
                  :step="rangeStep(field)"
                  class="w-24"
                  @change="clampPick(field)"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  class="size-9 shrink-0"
                  :disabled="picks[field.key] >= cfg[field.key].max"
                  :aria-label="`${field.label}增加一个步长`"
                  @click="adjustPick(field, 1)"
                >
                  <Plus />
                </Button>
              </div>
              <p class="text-muted-foreground text-xs">
                {{ field.hint || `可选 ${formatSpec(cfg[field.key].min)} - ${formatSpec(cfg[field.key].max)} ${field.unit}，步长 ${formatSpec(rangeStep(field))}` }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">操作系统</CardTitle>
          <CardDescription>
            {{ cfg.driver === 'incus' ? 'Incus 驱动只能安装 Incus 镜像' : 'QEMU 驱动只能安装 QEMU 镜像' }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-2">
          <ErrorAlert :message="imagesError" />
          <Select v-if="!imagesError" v-model="selectedImage" :disabled="imagesLoading">
            <SelectTrigger>
              <SelectValue :placeholder="imagesLoading ? '加载中…' : '请选择系统镜像'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="image in images" :key="image.id" :value="image.id">
                {{ image.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card v-if="agents.length > 0 && (product?.provision_config?.allow_buyer_agent ?? false)">
        <CardHeader>
          <CardTitle class="text-base">部署节点</CardTitle>
          <CardDescription>选择实例将被创建的被控节点；不选则按商品配置分配。</CardDescription>
        </CardHeader>
        <CardContent>
          <Select v-model="selectedAgent">
            <SelectTrigger>
              <SelectValue placeholder="自动分配（推荐）" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">自动分配（推荐）</SelectItem>
              <SelectItem v-for="a in agents" :key="a.id" :value="a.id" :disabled="a.status !== 'online'">
                {{ agentLabel(a) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="flex flex-wrap items-center gap-4">
          <div class="space-y-1.5">
            <Label for="buy-quantity">数量</Label>
            <Input id="buy-quantity" v-model.number="quantity" type="number" min="1" class="w-24" />
          </div>
          <div class="ml-auto text-right">
            <p class="text-muted-foreground text-xs">
              基础价（{{ cycleLabel(product.billing_cycle) }}）
            </p>
            <Money :cents="product.price_cents" />
            <p v-if="provisionExtraCents" class="text-muted-foreground text-xs">
              增量 + <Money :cents="provisionExtraCents" /> / 份
            </p>
            <p class="text-muted-foreground text-xs">总价</p>
            <Money class="text-xl font-semibold" :cents="selectedTotalCents" />
          </div>
        </CardContent>
      </Card>

       <div v-if="agreementRequired" class="flex items-start gap-2.5 rounded-lg border p-4">
         <input
           id="buy-agree"
           v-model="agreed"
           type="checkbox"
           class="accent-primary mt-1 size-4 shrink-0 cursor-pointer"
         />
         <div class="text-sm leading-6">
           <Label for="buy-agree" class="cursor-pointer font-normal">
             <template v-if="allAgreements.length > 1">
               {{ t('agreement.agreeMultiple', { count: allAgreements.length }) }}
             </template>
             <template v-else>{{ t('agreement.agree', { title: agreementTitle }) }}</template>
           </Label>
           <span v-if="allAgreements.length > 1" class="mx-1 text-muted-foreground">：</span>
           <template v-if="allAgreements.length > 1">
             <RouterLink
               v-for="(a, i) in allAgreements"
               :key="a.id"
               :to="{ name: 'article-detail', params: { slug: a.slug } }"
               target="_blank"
               class="text-primary mr-2 text-xs underline underline-offset-4"
             >{{ a.title }}<span v-if="i < allAgreements.length - 1">、</span></RouterLink>
           </template>
           <RouterLink
             v-else-if="agreementSlug"
             :to="{ name: 'article-detail', params: { slug: agreementSlug } }"
             target="_blank"
             class="text-primary ml-2 text-xs whitespace-nowrap underline underline-offset-4"
           >
             {{ t('agreement.viewAgreement') }}
           </RouterLink>
         </div>
       </div>
       <ErrorAlert :message="formError" />
       <Button
         class="w-full"
         size="lg"
         :disabled="submitting || (agreementRequired && !agreed)"
         :title="agreementRequired && !agreed ? t('agreement.agreeRequired') : undefined"
         @click="submit"
       >
         <Loader2 v-if="submitting" class="animate-spin" />
         立即购买
       </Button>
    </template>
  </div>
</template>
