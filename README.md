# 澳琴空间预约系统 H5 手机端

该目录承载基于现有 RuoYi 后端开发的 H5 手机端。工程已使用 Vite + Vue 3 脚手架初始化，后续开发应按 `技术选型.md` 中的边界推进，不复制 `ruoyi-ui/` 后台管理端的完整 CRUD。

## 当前技术栈

- Vue 3.5
- TypeScript 6
- Vite 8
- Vue Router 5
- Pinia 3
- Vant 4
- TanStack Query for Vue
- Axios
- VueUse
- Zod
- Lucide Vue
- Vitest 4
- Playwright
- ESLint 10
- Prettier 3
- oxlint
- pnpm 11

后续计划补充：

- UnoCSS：移动端原子化样式和设计变量。

## 与后端关系

- 后端接口以根目录 `API文档.md` 为准。
- 开发环境通过 `.env.development` 中的 `VITE_API_BASE_URL=/dev-api` 和 `vite.config.ts` 代理到 `http://localhost:8080`。
- 登录沿用 `POST /login`、`GET /captchaImage`、`GET /getInfo`、`POST /logout`。
- 请求认证沿用 `Authorization: Bearer <token>`。
- 普通响应沿用 RuoYi `AjaxResult`。
- 分页响应沿用 RuoYi `TableDataInfo`。
- H5 第一阶段优先覆盖公开空间查询、预约申请、我的预约、取消申请、审核待办等手机高频链路。
- 当前已接入真实后端的链路包括：验证码登录、Token 持久化、角色识别、首页占用矩阵、房间详情、预约申请、我的预约、预约详情、取消申请、审核待办和房间列表展示。

## 设计与需求文档

- `功能清单.md`：PC 端与移动端功能需求清单，后续页面、接口和测试用例以此为需求边界。
- `ui设计/登录页面.png`、`ui设计/主页.png`、`ui设计/我的页面.png`：移动端视觉参考图，定义登录、首页和我的页的基础风格。
- `ui设计/移动端UI设计方案.md`：第一版 H5 UI 设计方案，说明视觉规范、信息架构、角色菜单、页面结构、组件规范、路由建议和接口映射。

## 开发命令

安装依赖：

```powershell
pnpm install
```

启动开发服务：

```powershell
pnpm dev
```

类型检查和生产构建：

```powershell
pnpm build
```

单元测试：

```powershell
pnpm test:unit
```

端到端测试：

```powershell
pnpm exec playwright install
pnpm build
pnpm test:e2e
```

代码检查：

```powershell
pnpm lint
```

格式化：

```powershell
pnpm format
```

## 推荐开发顺序

1. 安装并锁定依赖，生成 `pnpm-lock.yaml`。
2. 维护 `.env.development` 和 `vite.config.ts`，确保 `/dev-api` 代理到本地后端。
3. 通过 `src/api/` 封装 Axios、Token、错误码、分页响应和空间预约接口。
4. 页面通过 `src/api/**` 与 `src/services/**` 消费真实接口，不在页面内直接拼接 Axios。
5. 用 Pinia 保存登录态、用户、角色和权限，用 TanStack Query 管理后端列表、详情和 mutation 后刷新。
6. 用 Playwright 增加 375px、390px、430px 手机视口关键流程验证。

## 目录边界

当前源码目录：

```text
space-h5/
├── e2e/
├── public/
├── src/
│   ├── api/
│   ├── components/
│   ├── layouts/
│   ├── mock/
│   ├── router/
│   ├── services/
│   ├── styles/
│   ├── stores/
│   ├── types/
│   ├── views/
│   ├── __tests__/
│   ├── App.vue
│   └── main.ts
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

当前页面已覆盖登录、首页房间查看、房间详情、预约申请、我的预约、预约详情、管理员审核、房间轻管理、消息和我的页。除消息页仍使用本地占位消息外，登录、空间查询、预约申请、我的预约、预约详情、取消申请、审核待办和房间列表已接入真实后端；`src/mock/` 仅保留未接入消息等开发期占位数据。

维护要求：

- 新增业务目录后同步更新根目录 `项目文件结构说明.md`。
- 新增或调整接口后同步更新根目录 `API文档.md`。
- 移动端链路、缓存策略、登录态策略变化后同步更新根目录 `项目完整链路说明.md` 和本目录 `技术选型.md`。
