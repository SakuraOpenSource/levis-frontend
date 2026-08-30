<script setup lang="ts">
// 代理加盟（用户端）：查看等级体系与我的状态，提交/跟踪代理申请。
import { computed, onMounted, reactive, ref } from 'vue'
import { Crown, Loader2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { catalogApi } from '@/lib/endpoints'
import type { Category } from '@/lib/types'

const toast = useToast()

const loading = ref(true)
const error = ref<string | null>(null)
const submitting = ref(false)
const categories = ref<Category[]>([])

interface Summary {
  enabled: boolean
  mode: 'auto' | 'manual'
  tier: { id: number; name: string; min_balance_cents: number } | null
  next_tier: { id: number; name: string; min_balance_cents: number } | null
  bound: boolean
  balance_cents: number
  application: { id: number; tier_id: number; status: string; review_remark: string; created_at: string } | null
  discounts: { category_id: number; discount_permille: number }[]
}

const summary = ref<Summary | null>(null)

const form = reactive({
  tierId: '',
  contact: '',
  remark: '',
})

const statusText: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '未通过',
}

const tiersList = ref<Array<{ id: number; name: string; min_balance_cents: number }>>([])

/** 我的等级在生效折扣里按分组名展示。 */
const discountRows = computed(() => {
  if (!summary.value) return []
  const names = new Map<number, string>()
  const walk = (items: Category[]) => {
    for (const item of items) {
      names.set(item.id, item.name)
      walk(item.children ?? [])
    }
  }
  walk(categories.value)
  return summary.value.discounts.map((d) => ({
    name: names.get(d.category_id) ?? `分组 #${d.category_id}`,
    label: `${(d.discount_permille / 10).toFixed(1)} 折`,
  }))
})

const canApply = computed(
  () =>
    summary.value?.enabled &&
    (!summary.value.tier || summary.value.bound === false) &&
    summary.value.application?.status !== 'pending',
)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [sum, cats, tiers] = await Promise.all([
      catalogApi.agentProgramSummary(),
      catalogApi.categories(),
      catalogApi.agentProgramTiers(),
    ])
    summary.value = sum
    categories.value = cats
    tiersList.value = tiers.items ?? []
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!form.tierId) {
    toast.error('请选择申请的代理等级')
    return
  }
  if (!form.contact.trim()) {
    toast.error('请填写联系方式')
    return
  }
  submitting.value = true
  try {
    await catalogApi.applyAgentProgram({
      tier_id: Number(form.tierId),
      contact: form.contact.trim(),
      remark: form.remark.trim(),
    })
    toast.success('申请已提交，请等待管理员审核')
    form.contact = ''
    form.remark = ''
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="代理加盟"
      description="成为代理享受进货折扣：余额达到等级门槛自动升级，也可以提交申请由管理员审核预授权"
    />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else-if="summary && !summary.enabled">
      <Card>
        <CardContent class="text-muted-foreground py-12 text-center text-sm">
          代理加盟暂未开放，请稍后再来。
        </CardContent>
      </Card>
    </template>

    <template v-else-if="summary">
      <!-- 我的代理状态 -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Crown class="text-primary size-5" />
            我的代理状态
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-3 text-sm">
          <div v-if="summary.tier" class="flex flex-wrap items-center gap-2">
            当前等级：
            <Badge class="gap-1">
              <Crown class="size-3" />
              {{ summary.tier.name }}
            </Badge>
            <span v-if="summary.bound" class="text-muted-foreground text-xs">（管理员授权）</span>
            <span v-else class="text-muted-foreground text-xs">（余额达标自动获得）</span>
          </div>
          <p v-else class="text-muted-foreground">
            当前还不是代理。余额达到任一等级门槛即自动升级，或提交申请由管理员预授权。
          </p>

          <div v-if="discountRows.length" class="text-sm">
            生效折扣：
            <span
              v-for="(row, i) in discountRows"
              :key="row.name"
              class="text-muted-foreground"
            >{{ i > 0 ? '、' : '' }}{{ row.name }} {{ row.label }}</span>
          </div>

          <p v-if="summary.next_tier" class="text-muted-foreground text-xs">
            距下一档「{{ summary.next_tier.name }}」还差 ¥{{
              Math.max(0, (summary.next_tier.min_balance_cents - summary.balance_cents) / 100).toFixed(2)
            }}
          </p>

          <div
            v-if="summary.application"
            class="bg-muted rounded-md px-3 py-2 text-xs"
          >
            最近申请：{{ statusText[summary.application.status] || summary.application.status }}
            <span v-if="summary.application.review_remark" class="text-muted-foreground">
              （{{ summary.application.review_remark }}）
            </span>
          </div>
        </CardContent>
      </Card>

      <!-- 申请表单 -->
      <Card v-if="canApply">
        <CardHeader>
          <CardTitle>提交代理申请</CardTitle>
          <CardDescription>
            {{
              summary.mode === 'manual'
                ? '当前为手动审核模式：需要余额达到所申请等级的门槛后才能提交申请，审核通过即预授权'
                : '余额尚未达标？提交申请说明情况，管理员审核通过后可直接预授权等级'
            }}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="submit">
            <div class="grid gap-2">
              <Label for="agent-tier">申请等级</Label>
              <Select v-model="form.tierId">
                <SelectTrigger id="agent-tier">
                  <SelectValue placeholder="选择等级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="tier in tiersList"
                    :key="tier.id"
                    :value="String(tier.id)"
                  >
                    {{ tier.name }}（预存 ¥{{ (tier.min_balance_cents / 100).toFixed(0) }}）
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="grid gap-2">
              <Label for="agent-contact">联系方式 *</Label>
              <Input
                id="agent-contact"
                v-model="form.contact"
                placeholder="QQ / 微信 / Telegram / 邮箱"
                required
              />
            </div>
            <div class="grid gap-2">
              <Label for="agent-remark">申请说明</Label>
              <Textarea
                id="agent-remark"
                v-model="form.remark"
                rows="3"
                placeholder="介绍你的推广渠道 / 客户规模等（选填）"
              />
            </div>
            <Button type="submit" :disabled="submitting">
              <Loader2 v-if="submitting" class="animate-spin" />
              提交申请
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card v-else-if="summary.application?.status === 'pending'">
        <CardContent class="text-muted-foreground py-8 text-center text-sm">
          您的申请正在审核中，通过后会自动开通对应等级。
        </CardContent>
      </Card>
    </template>
  </div>
</template>
