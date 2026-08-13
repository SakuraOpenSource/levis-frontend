# levis-frontend

[Levis](https://github.com/SakuraOpenSource/levis) 的前端。构建产物会被后端 `go:embed` 嵌入二进制，最终交付单个可执行文件 —— 因此这个仓库不单独部署。

## 技术栈

- Vite 8 + Vue 3 + TypeScript，包管理用 pnpm
- [shadcn-vue](https://www.shadcn-vue.com/) 风格组件（`new-york` / `neutral`），底层 primitive 是 [reka-ui](https://reka-ui.com/)
- Tailwind CSS v4：`@tailwindcss/vite` 插件 + `src/style.css` 里一行 `@import "tailwindcss"`，**没有 tailwind.config.js**
- vue-router（history 模式）、pinia、axios、vue-i18n（中文为默认语言）

## 开发

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

同时需要后端跑在 `127.0.0.1:8080`（在后端仓库执行 `make dev-backend`）。Vite 已把 `/api` 代理过去，浏览器视角同源，因此不用配 CORS，cookie 也不会丢。

```bash
pnpm build      # vue-tsc -b && vite build，产物在 dist/
pnpm preview
```

后端仓库的 `make build` 会自动调用这里的 `pnpm build` 并把 `dist/` 拷进 `internal/web/dist`，正常开发不需要手动搬产物。

## 目录结构

```
src/
├── main.ts              装 pinia / i18n / router，注入 401 处理器后挂载
├── router/index.ts      路由表 + 全局守卫（安装态、登录、管理员）
├── stores/              auth, site, cart, theme
├── lib/
│   ├── api.ts           axios 实例、CSRF 拦截器、ApiError 归一化
│   ├── endpoints.ts     按模块分组的类型化接口封装
│   ├── types.ts         与后端 model 一一对应的类型
│   └── utils.ts         cn()、金额与时间格式化
├── locales/zh-CN.ts     全部文案
├── composables/         useToast, useCycleLabel
├── components/
│   ├── ui/              shadcn-vue 组件
│   └── app/             业务级通用组件（PageHeader、Money、StateBadge、Pager…）
├── layouts/             SiteLayout, DashboardLayout, AdminLayout
└── views/               页面（dashboard/ 与 admin/ 两个子目录）
```

## 约定

**金额一律是「分」的整数。** 后端所有金额字段以 `int64` 存分，前端只在渲染时用 `formatCents` 除 100；用户输入的元转分统一走 `Math.round(Number(x) * 100)`，避免 `19.99 * 100` 的浮点误差。

**新增文案必须进 `src/locales/zh-CN.ts`**，不要在模板里写死中文。

**`SelectItem` 的 value 不能是空字符串**（reka-ui 保留空串用于清空选择）。需要「全部」「无」这类选项时用 `'0'` 之类的哨兵值，提交前转成 `null` 或 `undefined`。

**路由守卫先跑 `site.load()`**：未安装时任何路由都会被重定向到 `/install`；后端没起来时守卫放行，让页面自己报错，而不是白屏。

## 页面

| 路由 | 说明 |
|---|---|
| `/install` | 三步安装引导（数据库 → 站点信息 → 管理员），含测试连接 |
| `/login` `/register` | 普通用户与管理员共用登录入口，按 role 决定落地页 |
| `/shop` `/cart` `/checkout/:id?` | 商店（按大类 → 小类分组）、购物车、结账（模拟支付）。`/` 重定向到 `/shop` |
| `/dashboard` | 用户中心主页：服务数、余额、未付账单，卡片可点击跳转 |
| `/dashboard/services` `/dashboard/services/:id` | 已购买的产品 |
| `/dashboard/wallet` `/dashboard/invoices` `/dashboard/invoices/:id` | 钱包与账单 |
| `/dashboard/security` | 修改邮箱与密码 |
| `/admin` `/admin/users` `/admin/categories` `/admin/products` | 管理后台 |

## License

见 [LICENSE](LICENSE)。
