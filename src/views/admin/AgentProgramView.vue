<script setup lang="ts">
// 代理加盟管理页：开关 + 代理等级（按预存余额判定）+ 每级分组折扣。
// 折扣用千分比表示（800 = 8 折），小分组配置覆盖大分组。
import { computed, onMounted, ref } from 'vue'
import { Loader2, Plus, Trash2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi, catalogApi } from '@/lib/endpoints'
import type { Category } from '@/lib/types'

const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const enabled = ref(false)

interface TierRow {
  key: number
  name: string
  min_balance: string
  discounts: { category_id: number; permille: number }[]
}

let keySeq = 1
const tiers = ref<TierRow[]>([])
const categories = ref<Category[]>([])

/** 分组下拉候选项：递归平铺带层级缩进。 */
const categoryRows = computed(() => {
  const out: { id: number; label: string }[] = []
  const walk = (items: Category[], depth: number) => {
    for (const item of items) {
      out.push({ id: item.id, label: `${'　'.repeat(depth)}${depth > 0 ? '└ ' : ''}${item.name}` })
      walk(item.children ?? [], depth + 1)
    }
  }
  walk(categories.value, 0)
  return out
})

function yuanToCents(yuan: string): number {
  const n = Number(yuan)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, '')
}

function permilleLabel(permille: number) {
  return `${(permille / 10).toFixed(1)} 折`
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [cfg, cats] = await Promise.all([
      adminApi.agentProgram(),
      catalogApi.categories(),
    ])
    enabled.value = cfg.enabled
    tiers.value = (cfg.tiers ?? []).map((tier: { name: string; min_balance_cents: number; discounts?: Array<{ category_id: number; discount_permille: number }> }) => ({
      key: keySeq++,
      name: tier.name,
      min_balance: centsToYuan(tier.min_balance_cents),
      discounts: (tier.discounts ?? [])
        .filter((d: { discount_permille: number }) => d.discount_permille > 0 && d.discount_permille < 1000)
        .map((d: { category_id: number; discount_permille: number }) => ({ category_id: d.category_id, permille: d.discount_permille })),
    }))
    categories.value = cats
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

function addTier() {
  tiers.value.push({ key: keySeq++, name: '', min_balance: '', discounts: [] })
}

function removeTier(key: number) {
  tiers.value = tiers.value.filter((tier) => tier.key !== key)
}

function addDiscount(tier: TierRow) {
  tier.discounts.push({ category_id: categoryRows.value[0]?.id ?? 0, permille: 800 })
}

function tierError(): string | null {
  for (const tier of tiers.value) {
    if (!tier.name.trim()) return '等级名称不能为空'
    if (yuanToCents(tier.min_balance) < 0) return '预存门槛不能为负'
    for (const d of tier.discounts) {
      if (!d.category_id) return '折扣未选择分组'
      if (d.permille < 100 || d.permille > 999) return '折扣需在 10.0 折 ~ 99.9 折之间'
    }
  }
  return null
}

async function save() {
  const problem = tierError()
  if (problem) {
    toast.error(problem)
    return
  }
  saving.value = true
  try {
    await adminApi.updateAgentProgram({
      enabled: enabled.value,
      tiers: tiers.value.map((tier) => ({
        name: tier.name.trim(),
        min_balance_cents: yuanToCents(tier.min_balance),
        sort: 0,
      })),
      // 后端按 tier 在数组中的下标关联折扣。
      discounts: tiers.value.flatMap((tier, index) =>
        tier.discounts.map((d) => ({ tier_id: index, category_id: d.category_id, discount_permille: d.permille })),
      ),
    })
    toast.success('已保存')
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="代理加盟" description="按预存余额自动判定代理等级，等级享受对应分组的进货折扣（小分组覆盖大分组）">
      <template #actions>
        <Button :disabled="saving" @click="save">
          <Loader2 v-if="saving" class="animate-spin" />
          保存配置
        </Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle>功能开关</CardTitle>
          <CardDescription>关闭后所有用户按原价购买，已有订单不受影响</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-between gap-4">
            <div class="space-y-1">
              <Label for="agent-enabled">启用代理加盟</Label>
              <p class="text-muted-foreground text-xs">
                用户余额达到等级门槛即自动成为该级代理，无需申请
              </p>
            </div>
            <Switch id="agent-enabled" v-model="enabled" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div class="flex items-center justify-between gap-3">
            <div>
              <CardTitle>代理等级与折扣</CardTitle>
              <CardDescription>
                门槛为「当前余额 ≥ 该值」即判定为该级；多档满足取最高。折扣按千分比填写，800 即 8 折
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" @click="addTier">
              <Plus />
              添加等级
            </Button>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <p v-if="!tiers.length" class="text-muted-foreground py-6 text-center text-sm">
            还没有代理等级，点击「添加等级」创建第一档（例如：一级代理，预存 1000 元，云服务器 8 折）
          </p>

          <div
            v-for="(tier, index) in tiers"
            :key="tier.key"
            class="space-y-3 rounded-lg border p-4"
          >
            <div class="flex flex-wrap items-end gap-3">
              <div class="grid flex-1 gap-1.5">
                <Label>等级名称</Label>
                <Input v-model="tier.name" placeholder="一级代理" />
              </div>
              <div class="grid gap-1.5">
                <Label>预存门槛（元）</Label>
                <Input v-model="tier.min_balance" type="number" min="0" placeholder="1000" class="w-36" />
              </div>
              <Button variant="ghost" size="icon" class="size-9" @click="removeTier(tier.key)">
                <Trash2 class="text-destructive" />
              </Button>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label class="text-muted-foreground text-xs">分组折扣（第 {{ index + 1 }} 档）</Label>
                <Button variant="ghost" size="sm" @click="addDiscount(tier)">
                  <Plus />
                  添加折扣
                </Button>
              </div>
              <div
                v-for="(discount, dIndex) in tier.discounts"
                :key="dIndex"
                class="flex flex-wrap items-center gap-2"
              >
                <Select v-model="discount.category_id as any">
                  <SelectTrigger class="w-64">
                    <SelectValue placeholder="选择分组" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="row in categoryRows" :key="row.id" :value="row.id">
                      {{ row.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span class="text-muted-foreground text-sm">：</span>
                <Input
                  v-model.number="discount.permille"
                  type="number"
                  min="100"
                  max="999"
                  class="w-24"
                />
                <span class="text-muted-foreground text-sm">‰（{{ permilleLabel(discount.permille) }}）</span>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  @click="tier.discounts.splice(dIndex, 1)"
                >
                  <Trash2 class="text-destructive" />
                </Button>
              </div>
              <p v-if="!tier.discounts.length" class="text-muted-foreground text-xs">
                未配置折扣时该等级按原价购买；同一分组只配一条，子分组的配置优先于父分组
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
