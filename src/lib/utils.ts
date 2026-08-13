import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn 约定的 class 合并：clsx 处理条件类，twMerge 消解冲突的工具类。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 金额格式化。后端一律用 int64 分存储，这里是唯一的除 100 出口，
 * 避免各个页面各自算一遍导致精度写法不一致。
 */
export function formatCents(cents: number, currency = '¥') {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const text = `${currency}${(abs / 100).toFixed(2)}`
  return negative ? `-${text}` : text
}

/** 日期时间：按浏览器时区渲染 UTC 时间戳。 */
export function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

/** 只要日期部分，用于到期日、账期这类不关心时刻的字段。 */
export function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('zh-CN')
}

/** 零值时间（Go 的 time.Time 零值序列化结果）视作「无」。 */
export function isZeroTime(value?: string | null) {
  if (!value) return true
  return value.startsWith('0001-01-01')
}
