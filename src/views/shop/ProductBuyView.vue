<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

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
import { catalogApi, orderApi } from '@/lib/endpoints'
import type { Product, ProvisionConfig } from '@/lib/types'

/**
 * 接口商品购买页：弹性云在区间内自选规格，固定配置只展示；
 * 按驱动列出可选系统镜像，提交后生成待支付订单并跳转结算页。
 * 普通商品不走这里 —— 它们直接加购物车。
 */

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const product = ref<Product | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)

const images = ref<{ id: string; name: string; group: string }[]>([])
const imagesLoading = ref(false)
const imagesError = ref<string | null>(null)

const selectedImage = ref('')
const quantity = ref(1)

const cfg = computed<ProvisionConfig | null>(() => product.value?.provision_config ?? null)

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

/** 大于 1024 GB 的流量以 TB 展示。 */
function trafficLabel(gb: number) {
  if (gb === 0) return '不限'
  return gb >= 1024 ? `${(gb / 1024).toFixed(gb % 1024 === 0 ? 0 : 1)} TB` : `${gb} GB`
}

const fixedSpecs = computed(() => {
  if (!cfg.value) return []
  return [
    { label: 'CPU', value: `${cfg.value.cpu.min} 核` },
    { label: '内存', value: `${cfg.value.memory_mb.min} MB` },
    { label: '硬盘', value: `${cfg.value.disk_gb.min} GB` },
    { label: '带宽', value: cfg.value.bandwidth_mbps.min > 0 ? `${cfg.value.bandwidth_mbps.min} Mbps` : '不限' },
    { label: '流量', value: trafficLabel(cfg.value.traffic_gb.min) },
    { label: '驱动', value: cfg.value.driver === 'incus' ? 'Incus 容器' : 'QEMU 虚拟机' },
  ]
})

function initPicks(config: ProvisionConfig) {
  picks.cpu = config.cpu.min
  picks.memory_mb = config.memory_mb.min
  picks.disk_gb = config.disk_gb.min
  picks.bandwidth_mbps = config.bandwidth_mbps.min
  picks.traffic_gb = config.traffic_gb.min
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

async function submit() {
  formError.value = null
  if (!cfg.value || !product.value) return
  if (!selectedImage.value) {
    formError.value = '请选择操作系统'
    return
  }
  if (cfg.value.mode === 'elastic') {
    for (const field of FIELDS) {
      const range = cfg.value[field.key]
      const value = picks[field.key]
      if (value < range.min || value > range.max) {
        formError.value = `${field.label}需在 ${range.min} - ${range.max} ${field.unit} 之间`
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
      options: {
        driver: cfg.value.driver,
        cpu: String(picks.cpu),
        memory_mb: String(picks.memory_mb),
        disk_gb: String(picks.disk_gb),
        bandwidth_mbps: String(picks.bandwidth_mbps),
        traffic_gb: String(picks.traffic_gb),
        image_id: selectedImage.value,
        image_name: images.value.find((item) => item.id === selectedImage.value)?.name ?? '',
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
    await loadImages()
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
                  {{ field.key === 'traffic_gb' ? trafficLabel(picks.traffic_gb) : `${picks[field.key]} ${field.unit}` }}
                </span>
              </div>
              <Input
                :id="`pick-${field.key}`"
                v-model.number="picks[field.key]"
                type="number"
                :min="cfg[field.key].min"
                :max="cfg[field.key].max"
                :step="field.key === 'memory_mb' ? 128 : 1"
              />
              <p class="text-muted-foreground text-xs">
                {{ field.hint || `可选 ${cfg[field.key].min} - ${cfg[field.key].max} ${field.unit}` }}
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

      <Card>
        <CardContent class="flex flex-wrap items-center gap-4">
          <div class="space-y-1.5">
            <Label for="buy-quantity">数量</Label>
            <Input id="buy-quantity" v-model.number="quantity" type="number" min="1" class="w-24" />
          </div>
          <div class="ml-auto text-right">
            <p class="text-muted-foreground text-xs">
              单价（{{ cycleLabel(product.billing_cycle) }}）
            </p>
            <Money class="text-xl font-semibold" :cents="product.price_cents * Math.max(quantity, 1)" />
          </div>
        </CardContent>
      </Card>

      <ErrorAlert :message="formError" />
      <Button class="w-full" size="lg" :disabled="submitting" @click="submit">
        <Loader2 v-if="submitting" class="animate-spin" />
        立即购买
      </Button>
    </template>
  </div>
</template>
