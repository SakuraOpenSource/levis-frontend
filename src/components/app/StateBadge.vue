<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { Badge, type BadgeVariants } from '@/components/ui/badge'

type Kind = 'order' | 'service' | 'invoice' | 'product' | 'user'

const props = defineProps<{ kind: Kind; value: string }>()

const { t } = useI18n()

/** 状态 → 徽标配色。集中一处，避免各页面各配一套。 */
const VARIANTS: Record<Kind, Record<string, BadgeVariants['variant']>> = {
  order: { pending: 'warning', paid: 'success', cancelled: 'secondary' },
  service: {
    pending: 'warning',
    active: 'success',
    suspended: 'destructive',
    terminated: 'secondary',
  },
  invoice: { unpaid: 'warning', paid: 'success', cancelled: 'secondary' },
  product: { active: 'success', hidden: 'secondary' },
  user: { active: 'success', disabled: 'destructive' },
}

const LABEL_PREFIX: Record<Kind, string> = {
  order: 'orderStatus',
  service: 'serviceStatus',
  invoice: 'invoiceStatus',
  product: 'admin.productStatus',
  user: 'admin.status',
}

const variant = computed<BadgeVariants['variant']>(
  () => VARIANTS[props.kind][props.value] ?? 'outline',
)

const label = computed(() => {
  if (props.kind === 'product') {
    return props.value === 'active' ? t('admin.productStatusActive') : t('admin.productStatusHidden')
  }
  if (props.kind === 'user') {
    return props.value === 'active' ? t('admin.statusActive') : t('admin.statusDisabled')
  }
  return t(`${LABEL_PREFIX[props.kind]}.${props.value}`)
})
</script>

<template>
  <Badge :variant="variant">{{ label }}</Badge>
</template>
