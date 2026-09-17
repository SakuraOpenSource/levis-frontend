# levis-frontend

The web UI of [Levis](https://github.com/SakuraOpenSource/levis), a lightweight business management system. Built as a single-page application and normally delivered embedded inside the Levis single binary.

## Tech stack

- Vite 8 + Vue 3 + TypeScript
- [shadcn-vue](https://www.shadcn-vue.com/)-style components (`new-york` / `neutral`) built on [reka-ui](https://reka-ui.com/)
- Tailwind CSS v4
- vue-router (history mode), pinia, axios, vue-i18n (Chinese is the default locale)

## Development

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

The Levis backend must be running at the same time (`make dev-backend` in the backend repository); the dev server proxies `/api` to it.

```bash
pnpm build      # vue-tsc -b && vite build, output in dist/
pnpm preview
```

Running `make build` in the backend repository builds this project and embeds the output into the backend binary.

## Directory structure

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

## Pages

| Route | Description |
|---|---|
| `/install` | Installer |
| `/login` `/register` | Authentication (optional e-mail verification codes) |
| `/shop` `/cart` `/checkout/:id?` | Store and unified checkout |
| `/dashboard` | User center |
| `/dashboard/services` `/dashboard/services/:id` | Purchased services (NAT, metrics, VNC console) |
| `/dashboard/wallet` `/dashboard/invoices` `/dashboard/invoices/:id` | Wallet and invoices |
| `/dashboard/tickets` `/dashboard/security` | Tickets and security center |
| `/admin` | Admin panel (users, products, finance, services, plugins, settings) |

## License

This project is licensed under GPL-v3.
