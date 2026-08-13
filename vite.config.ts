import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      // import.meta.dirname 而非 __dirname：本文件以 ESM 加载，Vite 8 已弃用后者。
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // 产物会被 go:embed 嵌入后端二进制，体积直接影响可执行文件大小。
    // 800KB 的默认告警阈值对本项目足够，超出说明该拆包了。
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    // 开发期把 /api 转发到后端，浏览器视角同源，避免 CORS 与 cookie 丢失。
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
      },
    },
  },
})
