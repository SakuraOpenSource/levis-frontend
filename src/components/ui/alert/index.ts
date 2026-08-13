import { cva, type VariantProps } from 'class-variance-authority'

export { default as Alert } from './Alert.vue'
export { default as AlertTitle } from './AlertTitle.vue'
export { default as AlertDescription } from './AlertDescription.vue'

export const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid grid-cols-[0_1fr] has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 gap-x-3',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive: 'text-destructive bg-destructive/8 border-destructive/30',
        success: 'text-success bg-success/8 border-success/30',
        warning: 'text-warning-foreground bg-warning/15 border-warning/40',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export type AlertVariants = VariantProps<typeof alertVariants>
