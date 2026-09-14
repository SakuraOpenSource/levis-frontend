import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

/** 主题色 ID：neutral 是默认黑（跟随 style.css 的 :root/.dark 令牌）。 */
export type AccentId = 'neutral' | 'blue' | 'green' | 'purple' | 'orange' | 'red'

export interface AccentPreset {
  id: AccentId
  /** Button bg-primary 等的底色，light/dark 共用一套（行内样式优先级高于 .dark 规则）。 */
  primary: string
  primaryForeground: string
  ring: string
  /** 取色器圆点的展示色（纯色近似即可）。 */
  swatch: string
}

export const ACCENTS: AccentPreset[] = [
  {
    id: 'neutral',
    primary: 'oklch(0.205 0 0)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.708 0 0)',
    swatch: '#18181b',
  },
  {
    id: 'blue',
    primary: 'oklch(0.546 0.245 262.881)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.623 0.214 259.815)',
    swatch: '#2563eb',
  },
  {
    id: 'green',
    primary: 'oklch(0.596 0.145 163.225)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.696 0.17 162.48)',
    swatch: '#16a34a',
  },
  {
    id: 'purple',
    primary: 'oklch(0.558 0.288 302.321)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.714 0.203 305.504)',
    swatch: '#9333ea',
  },
  {
    id: 'orange',
    primary: 'oklch(0.646 0.222 41.116)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.75 0.183 55.934)',
    swatch: '#ea580c',
  },
  {
    id: 'red',
    primary: 'oklch(0.577 0.245 27.325)',
    primaryForeground: 'oklch(0.985 0 0)',
    ring: 'oklch(0.712 0.194 13.428)',
    swatch: '#dc2626',
  },
]

const STORAGE_KEY = 'levis_accent'

/** 被主题色接管的 CSS 变量：style.css 里 @theme inline 把它们映射成工具类。 */
const MANAGED_PROPS = [
  '--primary',
  '--primary-foreground',
  '--ring',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-ring',
] as const

function initialAccent(): AccentId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (ACCENTS.some((a) => a.id === saved)) return saved as AccentId
  } catch {
    // 隐私模式 localStorage 不可用，回落默认黑。
  }
  return 'neutral'
}

/**
 * 把主题色写到 <html> 行内样式，覆盖 style.css 的 :root/.dark 令牌。
 * 默认黑不清写色值而是删掉行内覆盖，让 CSS 自身的明暗两套继续生效。
 */
function applyAccent(id: AccentId) {
  if (typeof document === 'undefined') return
  const style = document.documentElement.style
  const found = ACCENTS.find((a) => a.id === id)
  if (!found || id === 'neutral') {
    for (const prop of MANAGED_PROPS) style.removeProperty(prop)
    return
  }
  style.setProperty('--primary', found.primary)
  style.setProperty('--primary-foreground', found.primaryForeground)
  style.setProperty('--ring', found.ring)
  style.setProperty('--sidebar-primary', found.primary)
  style.setProperty('--sidebar-primary-foreground', found.primaryForeground)
  style.setProperty('--sidebar-ring', found.ring)
}

export const useAccentStore = defineStore('accent', () => {
  const accent = ref<AccentId>(initialAccent())

  // 初始化即应用：刷新后主题色不闪回默认黑。
  applyAccent(accent.value)

  watch(accent, (id) => {
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // 存不住也生效本次会话。
    }
    applyAccent(id)
  })

  function setAccent(id: AccentId) {
    accent.value = id
  }

  return { accent, setAccent }
})
