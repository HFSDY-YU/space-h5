# SpaceBook H5 手机端

这是基于 SpaceBook / RuoYi 后端开发的移动端 H5 项目，面向学生、老师、管理员三类角色，优先覆盖手机端高频链路：房间占用查看、常规预约、长期固定排课预约、我的预约、通知消息、管理员审核与轻量房间管理。

项目作为独立前端仓库维护，当前远程仓库：

```text
https://github.com/HFSDY-YU/space-h5.git
```

## 技术栈

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

## 功能状态

### 通用能力

- 验证码登录、Token 持久化、退出登录。
- 登录后拉取用户信息、角色与权限，根据角色展示对应底部导航。
- Axios 统一封装 RuoYi `AjaxResult`、`TableDataInfo`、`Authorization: Bearer <token>`。
- 登录态过期时统一清理本地缓存并回到登录页。
- 通知中心已接入后端通知接口，支持全部/未读筛选、查看消息详情、全部已读。
- 我的页已提供个人资料、修改密码、用户协议、隐私政策等独立页面。

### 首页与房间查看

- 首页展示房间占用矩阵，支持日期切换、日历选择、搜索和筛选。
- 筛选支持楼栋、楼层、设备、教室类型。
- 房间状态按移动端要求收敛为：空闲、审核中、占用。
- 房间行可点击进入房间详情；非空闲时段可进入当前时段占用详情。
- 房间详情展示房间基础信息和本周占用图，今天之前的时段标记为已过期。

### 常规预约

- 首页点击空闲房间时段进入常规预约。
- 支持自动带入房间、日期、后端固定时段。
- 预约表单填写主题、用途、人数、备注。
- 提交后走后端预约冲突校验和审核流程。

### 长期固定排课预约

- 长期预约独立入口：`/reservation/long`。
- 支持三种模式：
  - 每周固定：选择开始日期、结束日期、星期与固定时段。
  - 每日固定：选择开始日期、结束日期与固定时段。
  - 自定义：通过日历选择多个日期，每个日期可选择一个或多个固定时段。
- 后端固定时段：
  - 上午：08:30-13:30
  - 下午：14:00-18:00
  - 晚间：18:30-22:30
- 先选日期和时间，再进入教室选择页。
- 教室选择页独立展示，支持搜索、筛选、分页查询。
- 确认页填写申请信息并提交批量预约。

### 我的预约

- 老师可查看全部个人预约。
- 状态支持：全部、待审核、已通过、已驳回、已取消、已结束。
- 列表自动补全预约详情，确保房间、日期、时段、场次数量可见。
- 支持查看详情和取消待审核预约。

### 管理员审核

- 管理员审核页支持待审核、取消待审、审核记录三个视图。
- 支持搜索、预约类型筛选、人数筛选、日期范围筛选。
- 待审核支持单条通过/驳回和批量通过/批量驳回。
- 审核记录接入真实后端列表，并自动补全房间、日期、时段和场次信息。

### 管理员房间管理

- 管理员房间列表只展示房间基础信息，点击进入详情。
- 支持搜索和筛选，筛选交互与首页一致。
- 房间详情中的启用/停用管理通过底部弹窗完成。

## 后端地址配置

开发环境默认读取 `.env.development`：

```env
VITE_API_BASE_URL=/dev-api
```

开发时由 `vite.config.ts` 将 `/dev-api` 代理到本地后端：

```ts
server: {
  host: '0.0.0.0',
  proxy: {
    '/dev-api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/dev-api/, ''),
    },
  },
}
```

生产打包默认读取 `.env.production`：

```env
VITE_API_BASE_URL=/prod-api
```

部署时需要在 Nginx 或网关中将 `/prod-api` 反向代理到后端服务。注意：Vite 环境变量会在打包时写入 `dist` 产物，修改 `.env.production` 后需要重新执行 `pnpm build`。

如果需要“打包后只改配置文件、不重新构建”，后续可改造为运行时配置，例如读取 `public/config.js` 或 `public/config.json`。

## 开发命令

安装依赖：

```powershell
pnpm install
```

启动开发服务：

```powershell
pnpm dev
```

代码检查：

```powershell
pnpm lint
```

生产构建：

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

格式化：

```powershell
pnpm format
```

## 手机访问开发服务

开发服务已配置 `host: '0.0.0.0'`，同一局域网手机访问步骤：

1. 电脑启动：

```powershell
pnpm dev
```

2. 查询电脑局域网 IP，例如 `192.168.1.100`。

3. 手机浏览器打开：

```text
http://192.168.1.100:5173/
```

如果手机无法访问，请检查 Windows 防火墙、电脑和手机是否在同一局域网、Vite 控制台是否显示 Network 地址。

## 目录结构

```text
space-h5/
├── e2e/                         # Playwright 端到端测试
├── public/                      # 静态资源
├── src/
│   ├── api/                     # 后端接口封装
│   ├── components/              # 通用组件
│   ├── layouts/                 # 移动端布局
│   ├── mock/                    # 开发期占位数据
│   ├── router/                  # 路由与登录守卫
│   ├── services/                # 数据映射和业务草稿
│   ├── stores/                  # Pinia 状态
│   ├── styles/                  # 全局样式和主题变量
│   ├── types/                   # 前端类型定义
│   ├── views/                   # 页面视图
│   ├── App.vue
│   └── main.ts
├── ui设计/                      # UI 参考图和设计方案
├── 功能清单.md
├── 技术选型.md
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

## 维护约定

- 新增后端接口时，统一放在 `src/api/`，页面不要直接拼接 Axios 请求。
- 后端字段到移动端展示字段的转换优先放在 `src/services/spaceMapper.ts`。
- 列表、详情、提交等异步状态优先使用 TanStack Query 管理。
- 页面新增或交互变化后，同步更新本 README、`功能清单.md` 或 `技术选型.md`。
- 核心移动端页面变更后，优先用 375px、390px、430px 手机视口验证。
