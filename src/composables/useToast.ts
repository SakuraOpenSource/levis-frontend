import { ref } from 'vue'

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  message: string
}

/**
 * 极简的全局提示队列。只需要「操作成功/失败」这一种反馈，
 * 引入完整的 toast 库不划算。
 */
const toasts = ref<Toast[]>([])
const DURATION = 3200
let seq = 0

function push(tone: ToastTone, message: string) {
  const id = ++seq
  toasts.value.push({ id, tone, message })
  window.setTimeout(() => dismiss(id), DURATION)
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((item) => item.id !== id)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
  }
}
