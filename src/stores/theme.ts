import { ref, watchEffect } from 'vue'
import { defineStore } from 'pinia'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'levis_theme'

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(initialTheme())

  // style.css 里的暗色变体是 &:is(.dark *)，所以类挂在 <html> 上。
  watchEffect(() => {
    document.documentElement.classList.toggle('dark', theme.value === 'dark')
    localStorage.setItem(STORAGE_KEY, theme.value)
  })

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggle }
})
