<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import Money from '@/components/app/Money.vue'
import { Button } from '@/components/ui/button'
import { serviceApi } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import type { Service } from '@/lib/types'
import { formatCents, formatDateTime } from '@/lib/utils'

const props = withDefaults(defineProps<{ service: Service; balanceCents?: number | null; compact?: boolean }>(), { balanceCents: null, compact: false })
const emit = defineEmits<{ updated: [service: Service] }>()
const busy = ref(false)
const open = ref(false)
const target = ref(false)
const error = ref<string | null>(null)
const eligible = computed(() => props.service.billing_cycle !== 'onetime' && (props.service.status === 'active' || props.service.auto_renew))
const insufficient = computed(() => props.balanceCents !== null && props.balanceCents < props.service.price_cents)
function ask() {
  if (!eligible.value || busy.value) return
  target.value = !props.service.auto_renew
  error.value = null
  open.value = true
}
async function confirm() {
  if (busy.value || !open.value) return
  busy.value = true
  try {
    await serviceApi.setAutoRenew(props.service.id, target.value)
    const service = await serviceApi.get(props.service.id)
    emit('updated', service)
    open.value = false
  } catch (err) { error.value = errorMessage(err) }
  finally { busy.value = false }
}
</script>

<template>
  <div :class="compact ? 'space-y-1' : 'space-y-3 rounded-lg border bg-muted/20 p-4'">
    <div class="flex items-center justify-between gap-3">
      <span v-if="!compact" class="text-sm font-semibold">自动续费</span>
      <Button role="switch" :aria-checked="!!service.auto_renew" :aria-label="`${service.name ?? ''}自动续费`" :variant="service.auto_renew ? 'default' : 'outline'" size="sm" :disabled="busy || !eligible" @click="ask">
        <Loader2 v-if="busy" class="animate-spin" />{{ service.auto_renew ? '已开启' : '已关闭' }}
      </Button>
    </div>
    <p v-if="compact" class="text-xs text-muted-foreground">{{ service.billing_cycle === 'onetime' ? '一次性服务不适用' : '仅扣站内余额' }}</p>
    <template v-else>
      <p class="text-sm text-muted-foreground">系统在到期前 24 小时续费窗口内尝试从 Levis 钱包扣款 <Money :cents="service.price_cents" />。不会自动发起外部支付；未结续费账单或支付处理中可能阻止自动扣款。</p>
      <p class="text-xs text-muted-foreground">当前钱包余额：<Money v-if="balanceCents !== null" :cents="balanceCents" /><span v-else>暂未获取，请到钱包核实</span> · 下次到期：{{ formatDateTime(service.next_due_at) }}</p>
      <p v-if="insufficient" class="text-xs text-amber-700 dark:text-amber-400">当前余额不足以覆盖一期续费，请及时充值。续费失败后原有到期暂停 / 删除策略仍然生效。</p>
      <p v-if="service.billing_cycle === 'onetime'" class="text-xs text-muted-foreground">一次性服务不支持自动续费。</p>
    </template>
    <ErrorAlert :message="error" />
    <ConfirmDialog v-model:open="open" :title="target ? '开启自动续费' : '关闭自动续费'" :description="target ? `授权系统在到期续费窗口尝试从 Levis 钱包扣除一期费用 ${formatCents(service.price_cents)}。余额不足时仍须手动续费，不会调用外部支付。` : '关闭后不再自动扣除钱包余额，请在到期前手动续费。已有账单不会被自动取消。'" :confirming="busy" @confirm="confirm" />
  </div>
</template>
