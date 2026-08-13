import { useI18n } from 'vue-i18n'

import type { BillingCycle } from '@/lib/types'
import { formatCents } from '@/lib/utils'

/** 计费周期的文案与「价格/周期」组合展示。多处页面共用。 */
export function useCycleLabel() {
  const { t } = useI18n()

  const cycleLabel = (cycle: BillingCycle) => t(`cycle.${cycle}`)
  const cycleSuffix = (cycle: BillingCycle) => t(`cycleSuffix.${cycle}`)
  const priceLabel = (cents: number, cycle: BillingCycle) =>
    `${formatCents(cents)}${cycleSuffix(cycle)}`

  return { cycleLabel, cycleSuffix, priceLabel }
}
