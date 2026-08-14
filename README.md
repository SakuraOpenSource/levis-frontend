# levis-frontend

[Levis](https://github.com/SakuraOpenSource/levis) 前端。

## 技术栈

- Vite 8 + Vue 3 + TypeScript
- [shadcn-vue](https://www.shadcn-vue.com/) 风格组件（`new-york` / `neutral`） + [reka-ui](https://reka-ui.com/)
- Tailwind CSS v4
- vue-router（history 模式）、pinia、axios、vue-i18n（中文为默认语言）

## 开发

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

需同时运行后端。

```bash
pnpm build      # vue-tsc -b && vite build，产物在 dist/
pnpm preview
```

在后端执行 `make all` 会自动打包本项目编译产物至后端编译产物。

## 目录结构

```
src/
├── main.ts
├── router/index.ts
├── stores/
├── lib/
│   ├── api.ts
│   ├── endpoints.ts
│   ├── types.ts
│   └── utils.ts
├── locales/zh-CN.ts
├── composables/
├── components/
│   ├── ui/
│   └── app/
├── layouts/
└── views/
```

## 页面

| 路由 | 说明 |
|---|---|
| `/install` | 安装页面 |
| `/login` `/register` | 登录/注册页面 |
| `/shop` `/cart` `/checkout/:id?` | 商店 |
| `/dashboard` | 用户中心主页 |
| `/dashboard/services` `/dashboard/services/:id` | 已购买的产品 |
| `/dashboard/wallet` `/dashboard/invoices` `/dashboard/invoices/:id` | 钱包与账单 |
| `/dashboard/security` | 安全中心 |
| `/admin` `/admin/users` `/admin/categories` `/admin/products` | 管理后台 |

## License

本项目遵循 GPL-v3 开源协议。
