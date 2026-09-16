import { http, postForm } from './api'
 import type {
 AdminInvoiceDetail,
 AdminStats,
 APIKeyCreated,
 APIKeyInput,
 APIKeyList,
 Article,
 ArticleInput,
 ArticleStatus,
 Bootstrap,
 CaptchaChallenge,
 CaptchaSettings,
 CartView,
  Category,
  CategoryInput,
  CreateUserInput,
  DatabaseConfig,
  EmailSettings,
  HomeConfig,
 InstallRequest,
 Invoice,
 KYCExternalStart,
 KYCVerificationDetail,
 KYCExternalStatus,
 KYCMine,
 KYCSettings,
 KYCStatus,
 Order,
 Page,
 PayResult,
 PowerAction,
 Product,
 ProductInput,
 ProductStatus,
 RenewResult,
 Service,
 ServiceStatus,
 SiteSettings,
 Ticket,
 TicketReply,
 TicketStatus,
 Transaction,
 UpdateUserInput,
 User,
 UserStatus,
 Verification,
 WalletOverview,
 BillingCycle,
 Plugin,
 PluginConfigInput,
 ModuleConfigField,
 NatCreateInput,
 NatMapping,
 PluginListResponse,
 ExternalPayment,
 PaymentMethod,
 PaymentMethodAdmin,
 PaymentPlugin,
 OSImage,
 HostMetrics,
 HostVNC,
 UpstreamHost,
 UpstreamInterface,
 } from './types'
interface PageQuery {
  page?: number
  page_size?: number
}
 /** 批量操作单条失败原因，与后端 service.BatchItemFailure 一致。 */
 export interface BatchItemFailure {
   id: number
   reason: string
 }

 /** 批量操作结果：成功的 ID 与逐条失败原因，与后端 service.BatchResult 一致。 */
 export interface BatchResult {
   ok: number[]
   failed: BatchItemFailure[]
 }

 /** 证件照的两面，与后端 service.SideFront / SideBack 一致。 */
 export type PhotoSide = 'front' | 'back'

/**
 * 把工单的主题、正文与附件装进 FormData。
 *
 * 附件字段名固定为 files —— 后端按这个名字取多文件。
 */
function ticketForm(fields: Record<string, string>, files: File[]): FormData {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value)
  }
  for (const file of files) {
    form.append('files', file)
  }
  return form
}

/** 站点与安装。 */
export const siteApi = {
  async bootstrap() {
    const { data } = await http.get<Bootstrap>('/bootstrap')
    return data
  },
  async testDatabase(config: DatabaseConfig) {
    const { data } = await http.post<{ ok: boolean }>('/install/test-db', config)
    return data
  },
  async install(payload: InstallRequest) {
    const { data } = await http.post<{ ok: boolean; user?: User }>('/install', payload)
    return data
  },
}

/** 图形验证码。签发接口无需登录 —— 登录、注册页正是在没有登录态时用它。 */
export const captchaApi = {
  async issue() {
    const { data } = await http.get<CaptchaChallenge>('/captcha')
    return data
  },
}

/** 邮箱验证码：注册页发码。登录码随登录票据签发，不走此接口。 */
export const emailApi = {
  async sendCode(scene: 'register', email: string) {
    const { data } = await http.post<{ ok: boolean }>('/email/code', { scene, email })
    return data
  },
}

/** 带验证码的表单额外要提交的字段。 */
export interface CaptchaAnswer {
  captcha_id?: string
  captcha_code?: string
}

/** 认证与个人资料。 */
export const authApi = {
  async register(
    payload: { username: string; email: string; password: string; email_code?: string } & CaptchaAnswer,
  ) {
    const { data } = await http.post<{ user: User }>('/auth/register', payload)
    return data.user
  },
  async login(identifier: string, password: string, captcha: CaptchaAnswer = {}) {
    const { data } = await http.post<{ user?: User; need_email_code?: boolean; ticket?: string; masked_email?: string }>(
      '/auth/login',
      { identifier, password, ...captcha },
    )
    if (data.need_email_code || !data.user) {
      throw Object.assign(new Error('need_email_code'), {
        needEmailCode: true as const,
        ticket: data.ticket ?? '',
        maskedEmail: data.masked_email ?? '',
      })
    }
    return data.user
  },
  /** 登录二次校验：票据 + 邮箱验证码换会话。 */
  async loginEmailCode(ticket: string, code: string) {
    const { data } = await http.post<{ user: User }>('/auth/login/email', { ticket, code })
    return data.user
  },
  async logout() {
    await http.post('/auth/logout')
  },
  async me() {
    const { data } = await http.get<{ user: User }>('/me')
    return data.user
  },
  async updateEmail(password: string, email: string) {
    const { data } = await http.patch<{ user: User }>('/me/email', { password, email })
    return data.user
  },
  async updatePassword(oldPassword: string, newPassword: string) {
    await http.post('/me/password', { old_password: oldPassword, new_password: newPassword })
  },
}

/** 商品目录（公开）。 */
export const catalogApi = {
  async categories() {
    const { data } = await http.get<{ items: Category[] | null }>('/catalog/categories')
    return data.items ?? []
  },
  async products(categoryId?: number) {
    const { data } = await http.get<{ items: Product[] | null }>('/catalog/products', {
      params: categoryId ? { category_id: categoryId } : undefined,
    })
    return data.items ?? []
  },
  async product(id: number) {
    const { data } = await http.get<Product>(`/catalog/products/${id}`)
    return data
  },
  /** 接口商品购买时可选的系统镜像（按商品驱动过滤）。 */
  async productOs(id: number) {
    const { data } = await http.get<{ items: { id: string; name: string; group: string }[] | null }>(
      `/catalog/products/${id}/os`,
    )
    return data.items ?? []
  },
  /** 可申请的代理等级列表。 */
  async agentProgramTiers() {
    const { data } = await http.get<{ items: Array<{ id: number; name: string; min_balance_cents: number }> }>('/agent-program/tiers')
    return data
  },
  /** 提交代理申请。 */
  async applyAgentProgram(payload: { tier_id: number; contact: string; remark?: string }) {
    const { data } = await http.post('/agent-program/apply', payload)
    return data
  },
  /** 当前用户的代理加盟信息（等级/下一档/生效折扣）。 */
  async agentProgramSummary() {
    const { data } = await http.get<{ enabled: boolean; mode: 'auto' | 'manual'; tier: { id: number; name: string; min_balance_cents: number } | null; next_tier: { id: number; name: string; min_balance_cents: number } | null; bound: boolean; balance_cents: number; application: { id: number; tier_id: number; status: string; review_remark: string; created_at: string } | null; discounts: Array<{ category_id: number; discount_permille: number }> }>('/agent-program/summary')
    return data
  },
}

/**
 * 知识库文章（公开）。只返回已发布的；草稿与不存在一律 404，
 * 避免通过公开接口探测草稿的存在。
 */
export const articleApi = {
  async getById(id: number) {
    const { data } = await http.get<Article>(`/articles/by-id/${id}`)
    return data
  },
  async get(slug: string) {
    const { data } = await http.get<Article>(`/articles/${encodeURIComponent(slug)}`)
    return data
  },
}

/** 购物车。写操作统一返回最新购物车，省一次拉取。 */
export const cartApi = {
  async list() {
    const { data } = await http.get<CartView>('/cart/items')
    return data
  },
  async add(productId: number, quantity: number, billingCycle: BillingCycle) {
    const { data } = await http.post<CartView>('/cart/items', {
      product_id: productId,
      quantity,
      billing_cycle: billingCycle,
    })
    return data
  },
  async updateQuantity(itemId: number, quantity: number) {
    const { data } = await http.patch<CartView>(`/cart/items/${itemId}`, { quantity })
    return data
  },
  async remove(itemId: number) {
    const { data } = await http.delete<CartView>(`/cart/items/${itemId}`)
    return data
  },
}

 /** 外部支付。order/invoice 用途的第 4 个参数是同步抵扣的余额（balance_cents）；recharge 用途则是充值金额（amount_cents，后端按 AmountCents 校验且拒绝余额抵扣）。 */
 export const paymentApi = {
   async methods() {
     const { data } = await http.get<{ items: PaymentMethod[] }>('/payments/methods')
     return data.items ?? []
   },
   async create(
     purpose: ExternalPayment['purpose'],
     targetId: number,
     pluginId: string,
     cents?: number,
   ) {
     const { data } = await http.post<ExternalPayment>('/payments', {
       purpose,
       target_id: targetId,
       plugin_id: pluginId,
       ...(cents === undefined ? {} : purpose === 'recharge' ? { amount_cents: cents } : { balance_cents: cents }),
     })
     return data
   },
   async get(id: number) {
     const { data } = await http.get<ExternalPayment>(`/payments/${id}`)
     return data
   },
   async query(id: number) {
     const { data } = await http.post<ExternalPayment>(`/payments/${id}/query`)
     return data
   },
   /** 取消待支付 intent：已抵扣余额退回，状态置为 failed。 */
   async cancel(id: number) {
     const { data } = await http.post<ExternalPayment>(`/payments/${id}/cancel`)
     return data
   },
 }
/** 订单与支付。agree 表示已阅读并同意商品绑定的购买协议。 */
export const orderApi = {
  async create(agree = false) {
    const { data } = await http.post<Order>('/orders', { agree })
    return data
  },
  async list(query: PageQuery = {}) {
    const { data } = await http.get<Page<Order>>('/orders', { params: query })
    return data
  },
  async get(id: number) {
    const { data } = await http.get<Order>(`/orders/${id}`)
    return data
  },
  async buyNow(payload: { product_id: number; quantity: number; billing_cycle?: string; options?: Record<string, string>; agree?: boolean }) {
    const { data } = await http.post<Order>('/orders/direct', payload)
    return data
  },
  async pay(id: number) {
    const { data } = await http.post<PayResult>(`/orders/${id}/pay`)
    return data
  },
  async cancel(id: number) {
    await http.post(`/orders/${id}/cancel`)
  },
}

 /** 已购服务。 */
 export const serviceApi = {
   async list(query: PageQuery = {}) {
     const { data } = await http.get<Page<Service>>('/services', { params: query })
     return data
   },
   async get(id: number) {
     const { data } = await http.get<Service>(`/services/${id}`)
     return data
   },
   async renew(id: number) {
     const { data } = await http.post<RenewResult>(`/services/${id}/renew`)
     return data
   },
   /** 生成续费账单并跳转账单页支付（余额/在线统一走 PayPanel）。 */
   async renewInvoice(id: number) {
     const { data } = await http.post<Invoice>(`/services/${id}/renew-invoice`)
     return data
   },
   /** 生成流量包账单：extra 为数量，unit 取 GB 或 TB（后端按 1TB=1024GB 换算）。 */
   async trafficInvoice(id: number, extra: number, unit: 'GB' | 'TB' = 'GB') {
     const { data } = await http.post<Invoice>(`/services/${id}/traffic-invoice`, {
       extra_gb: extra,
       unit,
     })
     return data
   },
   /** 重试上游开通：仅 pending/failed 状态可重试，成功后服务变为 active。 */
   async retry(id: number) {
     const { data } = await http.post<Service>(`/services/${id}/retry`)
     return data
   },
   async power(id: number, action: PowerAction, os?: string) {
     const { data } = await http.post<{ message: string }>(`/services/${id}/power`, { action, ...(os ? { os } : {}) })
     return data
   },
   async upstream(id: number) {
     const { data } = await http.get<UpstreamHost>(`/services/${id}/upstream`)
     return data
   },
   /** 实时监控：CPU/内存/带宽占用，上游不支持时抛错由调用方降级。 */
   async metrics(id: number) {
     const { data } = await http.get<HostMetrics>(`/services/${id}/metrics`)
     return data
   },
   /** VNC 可用性：available 为 false 时看 message 原因，不直接暴露上游票据。 */
   async vnc(id: number) {
     const { data } = await http.get<HostVNC>(`/services/${id}/vnc`)
     return data
   },
   async osList(id: number) {
     const { data } = await http.get<{ items: OSImage[] }>(`/services/${id}/os`)
     return data.items ?? []
   },
   /** NAT 端口映射列表。 */
   async natList(id: number) {
     const { data } = await http.get<{ items: NatMapping[] | null }>(`/services/${id}/nat`)
     return data.items ?? []
   },
   /** 新增 NAT 映射：host_port 省略或 0 表示由系统自动分配。 */
   async natCreate(id: number, payload: NatCreateInput) {
     const { data } = await http.post<{ mapping: NatMapping }>(`/services/${id}/nat`, payload)
     return data.mapping
   },
   /** 删除 NAT 映射，返回后端 message。 */
   async natDelete(id: number, mappingId: number) {
     const { data } = await http.delete<{ message: string }>(`/services/${id}/nat/${mappingId}`)
     return data
   },
 }

/** 钱包。 */
export const walletApi = {
  async overview() {
    const { data } = await http.get<WalletOverview>('/wallet')
    return data
  },
  async transactions(query: PageQuery = {}) {
    const { data } = await http.get<Page<Transaction>>('/wallet/transactions', { params: query })
    return data
  },
  async recharge(amountCents: number) {
    const { data } = await http.post<Transaction>('/wallet/recharge', {
      amount_cents: amountCents,
    })
    return data
  },
}

 /** 账单。 */
 export const invoiceApi = {
   async list(query: PageQuery = {}) {
     const { data } = await http.get<Page<Invoice>>('/invoices', { params: query })
     return data
   },
   async get(id: number) {
     const { data } = await http.get<Invoice>(`/invoices/${id}`)
     return data
   },
   /** 全额余额结算：订单账单会触发开通，续费账单会延长到期。 */
   async pay(id: number) {
     const { data } = await http.post<Invoice>(`/invoices/${id}/pay`)
     return data
   },
 }

/** 工单。建单与回复都是 multipart，因此走 postForm。 */
export const ticketApi = {
  async list(query: PageQuery = {}) {
    const { data } = await http.get<Page<Ticket>>('/tickets', { params: query })
    return data
  },
  async get(id: number) {
    const { data } = await http.get<Ticket>(`/tickets/${id}`)
    return data
  },
  async create(subject: string, body: string, files: File[] = []) {
    return postForm<Ticket>('/tickets', ticketForm({ subject, body }, files))
  },
  async reply(id: number, body: string, files: File[] = []) {
    return postForm<TicketReply>(`/tickets/${id}/replies`, ticketForm({ body }, files))
  },
  async close(id: number) {
    await http.post(`/tickets/${id}/close`)
  },
  /**
   * 附件下载地址。同源请求，cookie 自动带上，直接放进 <a href download> 即可，
   * 不必绕 blob URL。
   */
  attachmentUrl(ticketId: number, attachmentId: number) {
    return `/api/tickets/${ticketId}/attachments/${attachmentId}`
  },
}

/** 实名认证。 */
export const kycApi = {
  /**
   * 状态与站点认证模式。mode 为 manual 时渲染证件照上传表单；
   * 为插件 ID 时按 fields 渲染插件声明的动态表单。
   */
  async mine() {
    const { data } = await http.get<KYCMine>('/kyc')
    return data
  },
  async submit(realName: string, idNumber: string, front: File, back: File) {
    const form = new FormData()
    form.append('real_name', realName)
    form.append('id_number', idNumber)
    form.append('front', front)
    form.append('back', back)
    return postForm<Verification>('/kyc', form)
  },
  /** 通过实名认证插件发起第三方认证，values 的键由插件字段声明决定。 */
  async startExternal(values: Record<string, string>) {
    const { data } = await http.post<KYCExternalStart>('/kyc/external', { values })
    return data
  },
  /** 查询第三方认证结果。passed: T / F / P。 */
  async queryExternal() {
    const { data } = await http.get<KYCExternalStatus>('/kyc/external')
    return data
  },
  /** 证件照地址，可直接作为 <img src>。 */
  photoUrl(side: PhotoSide) {
    return `/api/kyc/photo/${side}`
  },
}

/** API Key。管理这些 Key 走的是浏览器登录态，不是 Key 自己。 */
export const apiKeyApi = {
  async list() {
    const { data } = await http.get<APIKeyList>('/api-keys')
    return data
  },
  async create(payload: APIKeyInput) {
    const { data } = await http.post<APIKeyCreated>('/api-keys', payload)
    return data
  },
  async revoke(id: number) {
    await http.delete(`/api-keys/${id}`)
  },
}

/** 管理后台。 */
export const adminApi = {
  async stats() {
    const { data } = await http.get<AdminStats>('/admin/stats')
    return data
  },
  async users(query: PageQuery & { keyword?: string } = {}) {
    const { data } = await http.get<Page<User>>('/admin/users', { params: query })
    return data
  },
  async createUser(payload: CreateUserInput) {
    const { data } = await http.post<User>('/admin/users', payload)
    return data
  },
  async updateUser(id: number, payload: UpdateUserInput) {
    const { data } = await http.patch<User>(`/admin/users/${id}`, payload)
    return data
  },
   async deleteUser(id: number) {
     await http.delete(`/admin/users/${id}`)
   },
   /** 批量启用/禁用用户，返回逐条结果（自我禁用记为单条失败）。 */
   async batchUsersStatus(ids: number[], status: UserStatus) {
     const { data } = await http.post<BatchResult>('/admin/users/batch-status', { ids, status })
     return data
   },
   /** 批量删除用户，返回逐条结果（自删/删光管理员记为单条失败）。 */
   async batchDeleteUsers(ids: number[]) {
     const { data } = await http.post<BatchResult>('/admin/users/batch-delete', { ids })
     return data
   },
  async categories() {
    const { data } = await http.get<{ items: Category[] | null }>('/admin/categories')
    return data.items ?? []
  },
  async createCategory(payload: CategoryInput) {
    const { data } = await http.post<Category>('/admin/categories', payload)
    return data
  },
  async updateCategory(id: number, payload: CategoryInput) {
    const { data } = await http.patch<Category>(`/admin/categories/${id}`, payload)
    return data
  },
  async deleteCategory(id: number) {
    await http.delete(`/admin/categories/${id}`)
  },
  async agentProgram() {
    const { data } = await http.get<{ enabled: boolean; mode: string; tiers: Array<{ id: number; name: string; min_balance_cents: number; sort: number; discounts: Array<{ category_id: number; discount_permille: number }> }> }>('/admin/agent-program')
    return data
  },
  async updateAgentProgram(payload: { enabled: boolean; mode?: string; tiers: Array<{ name: string; min_balance_cents: number; sort: number }>; discounts: Array<{ tier_id: number; category_id: number; discount_permille: number }> }) {
    const { data } = await http.put('/admin/agent-program', payload)
    return data
  },
  async agentApplications(status?: string) {
    const { data } = await http.get<{ items: Array<{ id: number; user_id: number; username: string; email: string; balance_cents: number; tier_name: string; contact: string; remark: string; status: string; review_remark: string; created_at: string }> }>('/admin/agent-program/applications', { params: status ? { status } : {} })
    return data.items ?? []
  },
  async reviewAgentApplication(id: number, payload: { approve: boolean; review_remark?: string }) {
    const { data } = await http.post(`/admin/agent-program/applications/${id}/review`, payload)
    return data
  },
  async products(query: PageQuery & { category_id?: number } = {}) {
    const { data } = await http.get<Page<Product>>('/admin/products', { params: query })
    return data
  },
  async createProduct(payload: ProductInput) {
    const { data } = await http.post<Product>('/admin/products', payload)
    return data
  },
  async updateProduct(id: number, payload: ProductInput) {
    const { data } = await http.patch<Product>(`/admin/products/${id}`, payload)
    return data
  },
  async deleteProduct(id: number) {
    await http.delete(`/admin/products/${id}`)
  },
   /** 批量上架/下架商品，返回逐条结果。 */
   async batchProductsStatus(ids: number[], status: ProductStatus) {
     const { data } = await http.post<BatchResult>('/admin/products/batch-status', { ids, status })
     return data
   },
   /** 批量删除商品，返回逐条结果（已有服务引用的记为单条失败）。 */
   async batchDeleteProducts(ids: number[]) {
     const { data } = await http.post<BatchResult>('/admin/products/batch-delete', { ids })
     return data
   },
  async provisionPlugins() {
    const { data } = await http.get<{
      items: { id: string; name: string; config?: ModuleConfigField[] }[]
    }>('/admin/provision-plugins')
    return data.items ?? []
  },
  async interfaces() {
    const { data } = await http.get<{ items: UpstreamInterface[] | null }>('/admin/interfaces')
    return data.items ?? []
  },
  async createInterface(payload: { name: string; plugin_id: string; config: Record<string, string> }) {
    const { data } = await http.post<UpstreamInterface>('/admin/interfaces', payload)
    return data
  },
  async updateInterface(id: number, payload: { name: string; plugin_id: string; config: Record<string, string> }) {
    const { data } = await http.patch<UpstreamInterface>(`/admin/interfaces/${id}`, payload)
    return data
  },
  async deleteInterface(id: number) {
    await http.delete(`/admin/interfaces/${id}`)
  },
  async testInterface(id: number) {
    const { data } = await http.post<{ message: string }>(`/admin/interfaces/${id}/test`)
    return data
  },
  async upstreamProducts(pluginId: string) {
    const { data } = await http.get<{
      items: {
        id: string
        name: string
        description: string
        group_name: string
        price_cents: number
        billing_cycle: string
      }[]
    }>('/admin/upstream-products', { params: { plugin_id: pluginId } })
    return data.items ?? []
  },
  async syncProductInfo(productId: number) {
    const { data } = await http.post<{ message: string }>(`/admin/products/${productId}/sync-info`)
    return data
  },
  async userServices(userId: number, query: PageQuery = {}) {
    const { data } = await http.get<Page<Service>>(`/admin/users/${userId}/services`, {
      params: query,
    })
    return data
  },
  /** 跨用户服务总览，支持按用户、商品与状态过滤。 */
  async services(query: PageQuery & { user_id?: number; product_id?: number; status?: string } = {}) {
    const { data } = await http.get<Page<Service>>('/admin/services', { params: query })
    return data
  },
  async updateService(id: number, status: ServiceStatus) {
    const { data } = await http.patch<Service>(`/admin/services/${id}`, { status })
    return data
  },
  /** 以管理员身份重试任意服务的上游开通（仅 pending/failed 可重试）。 */
  async retryService(id: number) {
    const { data } = await http.post<Service>(`/admin/services/${id}/retry`)
    return data
  },
  async deleteService(id: number) {
    await http.delete(`/admin/services/${id}`)
  },
   /** 批量暂停/恢复服务，返回逐条结果（已终止等状态记为单条失败）。 */
   async batchServicesStatus(ids: number[], status: 'active' | 'suspended') {
     const { data } = await http.post<BatchResult>('/admin/services/batch-status', { ids, status })
     return data
   },
   /** 批量删除服务，返回逐条结果（上游终止失败的记为单条失败）。 */
   async batchDeleteServices(ids: number[]) {
     const { data } = await http.post<BatchResult>('/admin/services/batch-delete', { ids })
     return data
   },
  async createServiceForUser(userId: number, payload: { product_id: number; quantity?: number; billing_cycle?: string; provision: boolean }) {
    const { data } = await http.post<Service>(`/admin/users/${userId}/services`, payload)
    return data
  },
  async bindService(id: number, payload: { upstream_plugin_id: string; upstream_host_id: string }) {
    const { data } = await http.post<Service>(`/admin/services/${id}/bind`, payload)
    return data
  },
  /** 全部订单，支持按用户与状态过滤。 */
  async orders(query: PageQuery & { user_id?: number; status?: string } = {}) {
    const { data } = await http.get<Page<Order>>('/admin/orders', { params: query })
    return data
  },
  async order(id: number) {
    const { data } = await http.get<Order>(`/admin/orders/${id}`)
    return data
  },
  /** 全部账单，支持按用户与状态过滤。 */
  async invoices(query: PageQuery & { user_id?: number; status?: string } = {}) {
    const { data } = await http.get<Page<Invoice>>('/admin/invoices', { params: query })
    return data
  },
  /** 账单详情：明细 + 关联的外部支付。 */
  async invoice(id: number) {
    const { data } = await http.get<AdminInvoiceDetail>(`/admin/invoices/${id}`)
    return data
  },
  /** 文章列表，status 为空时不过滤。 */
  async articles(query: PageQuery & { status?: ArticleStatus | '' } = {}) {
    const params = { ...query, status: query.status || undefined }
    const { data } = await http.get<Page<Article>>('/admin/articles', { params })
    return data
  },
  async article(id: number) {
    const { data } = await http.get<Article>(`/admin/articles/${id}`)
    return data
  },
  async createArticle(payload: ArticleInput) {
    const { data } = await http.post<Article>('/admin/articles', payload)
    return data
  },
  async updateArticle(id: number, payload: ArticleInput) {
    const { data } = await http.patch<Article>(`/admin/articles/${id}`, payload)
    return data
  },
  /** 仍被商品引用为购买协议时后端会 409 拒绝。 */
  async deleteArticle(id: number) {
    await http.delete(`/admin/articles/${id}`)
  },
  async paymentPlugins() {
    const { data } = await http.get<{ items: PaymentPlugin[] }>('/admin/payment-plugins')
    return data.items ?? []
  },
  async paymentMethods() {
    const { data } = await http.get<{ items: PaymentMethodAdmin[] }>('/admin/payment-methods')
    return data.items ?? []
  },
  async createPaymentMethod(payload: { name: string; plugin_id: string; config: Record<string, string>; enabled?: boolean; sort_order?: number; icon?: string }) {
    const { data } = await http.post<PaymentMethodAdmin>('/admin/payment-methods', payload)
    return data
  },
  async updatePaymentMethod(id: number, payload: { name?: string; plugin_id?: string; config?: Record<string, string>; enabled?: boolean; sort_order?: number; icon?: string }) {
    const { data } = await http.patch<PaymentMethodAdmin>(`/admin/payment-methods/${id}`, payload)
    return data
  },
  async deletePaymentMethod(id: number) {
    await http.delete(`/admin/payment-methods/${id}`)
  },
  async captchaSettings() {
    const { data } = await http.get<CaptchaSettings>('/admin/settings/captcha')
    return data
  },
  async updateCaptchaSettings(payload: CaptchaSettings) {
    const { data } = await http.put<CaptchaSettings>('/admin/settings/captcha', payload)
    return data
  },
  /** 站点名称与简介（安装后可编辑）。 */
  async siteSettings() {
    const { data } = await http.get<SiteSettings>('/admin/settings/site')
    return data
  },
  async updateSiteSettings(payload: SiteSettings) {
    const { data } = await http.put<SiteSettings>('/admin/settings/site', payload)
    return data
  },
  /** 公开主页的完整配置。 */
  async homeConfig() {
    const { data } = await http.get<HomeConfig>('/admin/settings/home')
    return data
  },
  async updateHomeConfig(payload: HomeConfig) {
    const { data } = await http.put<HomeConfig>('/admin/settings/home', payload)
    return data
  },
  /** 实名认证模式设置：manual 或实名认证插件 ID，选项来自已装插件。 */
  async kycSettings() {
    const { data } = await http.get<KYCSettings>('/admin/settings/kyc')
    return data
  },
  async updateKYCSettings(mode: string) {
    const { data } = await http.put<{ mode: string }>('/admin/settings/kyc', { mode })
    return data
  },
  /** SMTP 邮件配置：密码只写不读（has_password 表示已配置）。 */
  async emailSettings() {
    const { data } = await http.get<EmailSettings>('/admin/settings/email')
    return data
  },
  async updateEmailSettings(payload: EmailSettings & { smtp_password?: string }) {
    const { data } = await http.put<EmailSettings>('/admin/settings/email', payload)
    return data
  },
  async emailTest(email: string) {
    const { data } = await http.post<{ ok: boolean }>('/admin/settings/email/test', { email })
    return data
  },
  async tickets(query: PageQuery & { status?: TicketStatus } = {}) {
    const { data } = await http.get<Page<Ticket>>('/admin/tickets', { params: query })
    return data
  },
  async ticket(id: number) {
    const { data } = await http.get<Ticket>(`/admin/tickets/${id}`)
    return data
  },
  async replyTicket(id: number, body: string, files: File[] = []) {
    return postForm<TicketReply>(`/admin/tickets/${id}/replies`, ticketForm({ body }, files))
  },
  async closeTicket(id: number) {
    await http.post(`/admin/tickets/${id}/close`)
  },
  async reopenTicket(id: number) {
    await http.post(`/admin/tickets/${id}/reopen`)
  },
  ticketAttachmentUrl(ticketId: number, attachmentId: number) {
    return `/api/admin/tickets/${ticketId}/attachments/${attachmentId}`
  },
  async verifications(query: PageQuery & { status?: KYCStatus } = {}) {
    const { data } = await http.get<Page<Verification>>('/admin/verifications', { params: query })
    return data
  },
  /** 详情里的 id_number 是完整号码，管理员要拿它与照片比对。 */
  async verification(id: number) {
    const { data } = await http.get<KYCVerificationDetail>(`/admin/verifications/${id}`)
    return data
  },
  verificationPhotoUrl(id: number, side: PhotoSide) {
    return `/api/admin/verifications/${id}/photo/${side}`
  },
  async approveVerification(id: number) {
    const { data } = await http.post<Verification>(`/admin/verifications/${id}/approve`)
    return data
  },
  async rejectVerification(id: number, reason: string) {
    const { data } = await http.post<Verification>(`/admin/verifications/${id}/reject`, { reason })
    return data
  },
  async plugins() {
    const { data } = await http.get<PluginListResponse>('/admin/plugins')
    return data
  },
  async plugin(id: string) {
    const { data } = await http.get<Plugin>(`/admin/plugins/${id}`)
    return data
  },
  async installPlugin(file: File) {
    const form = new FormData()
    form.append('file', file)
    return postForm<{ id: string }>('/admin/plugins/install', form)
  },
  async reloadPlugins() {
    const { data } = await http.post<PluginListResponse>('/admin/plugins/reload')
    return data
  },
  async updatePluginConfig(id: string, payload: PluginConfigInput) {
    const { data } = await http.put<Plugin>(`/admin/plugins/${id}/config`, payload)
    return data
  },
  async frontendPluginConfig(id: string) {
    const { data } = await http.get<{ pid: string; gateway_url: string; payment_type: string; key_set: boolean }>(`/admin/plugins/${id}/frontend-config`)
    return data
  },
  async updateFrontendPluginConfig(id: string, values: Record<string, string>) {
    await http.put(`/admin/plugins/${id}/frontend-config`, { values })
  },
  async enablePlugin(id: string) {
    const { data } = await http.post<Plugin>(`/admin/plugins/${id}/enable`)
    return data
  },
  async disablePlugin(id: string) {
    const { data } = await http.post<Plugin>(`/admin/plugins/${id}/disable`)
    return data
  },
  async pluginLogs(id: string) {
    const { data } = await http.get<{ lines: string[] }>(`/admin/plugins/${id}/logs`)
    return data.lines
  },
}
