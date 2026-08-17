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

/** 文件大小按 1024 进制取整展示，用于附件列表与上限提示。 */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KiB', 'MiB', 'GiB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  // 小于 10 时保留一位小数，免得 1.4 与 1.9 都显示成「1 MiB」。
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

/** 上传上限，与后端 service 里的常量一致。 */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
export const MAX_ATTACHMENTS = 5
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
