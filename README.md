# NotesFlash

NotesFlash 是一个轻量、搜索优先的云端纯文本笔记 MVP：桌面端负责快速输入，手机端通过 PWA 随时查看；所有笔记保持扁平，不提供文件夹、笔记本或 Markdown 渲染。

## MVP 功能

- Svelte 5 + Vite + Tailwind CSS 4 + daisyUI 5。
- macOS Tauri 2 小型窗口，`Command + Shift + Space` 全局唤起并聚焦搜索框。
- 手机端可安装 PWA，不需要 App Store 应用。
- 笔记以完整正文流从上到下平铺，不折叠、不截断。
- 搜索第一项始终是快速创建；搜索文字自动成为新笔记标题。
- 关键词阶段使用字符匹配；精确搜索为空时，用 Workers AI 多语言 embedding 在 Vectorize 里做行级检索，结果会指出命中的具体行与字符区间，中英文可以互相召回。
- `↑` / `↓` 选择结果，`Enter` 打开，`Tab` 复制命中行并进入行内编辑。
- 纯文本标题和正文，不解析 Markdown。
- 支持 JPEG、PNG、WebP、GIF、AVIF 图片上传、R2 私有保存和流内展示。
- Cloudflare D1 保存正文，FTS5 trigram 负责中文字符检索。
- Cloudflare Queue 异步按行切块生成 Embedding，笔记保存不等待 AI。
- 用户通过 Deploy to Cloudflare 把 PWA、Worker API 和数据资源一次部署到自己的账号；项目不需要 NotesFlash OAuth 或数据服务。

## 目录

```text
src/             共用 Svelte 前端和 PWA
src-tauri/       macOS Tauri 2 封装与全局快捷键
cloud/           用户自部署的 Cloudflare Worker、PWA 静态产物与数据资源
docs/            完整部署、签名、公证、配对和验收文档
```

## 本地运行前端

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:4173`。没有 Cloudflare 后端时，可以选择“不落盘的演示模式”；演示内容仅存在于当前页面内存，刷新后消失。

生产检查：

```bash
npm run check
npm run test:run
npm run build
```

## 本地运行 Cloudflare Worker

```bash
npm install
npm run build:cloud-pwa
cd cloud
npm install
npm run db:migrate:local
npm run dev
```

`build:cloud-pwa` 会把最新的 `dist/` 同步到 `cloud/public/`。本地 Worker 随后在同一个 origin 提供 PWA、`/setup` 和 `/api/*`。Miniflare 可以验证 D1、FTS5、R2、配对、CRUD、静态资源和图片；Workers AI、AI Search 与保留的 Vectorize 回退需要远程绑定或部署到 Cloudflare 后验证。

## 部署到用户自己的 Cloudflare

把当前工作树推送到公开的 `main` 分支后，可以使用：

```text
https://deploy.workers.cloudflare.com/?url=https://github.com/realllllty/notesflash/tree/main/cloud
```

Cloudflare 当前支持把完全隔离的 GitHub 子目录作为 Deploy Button 模板；`cloud/` 已包含自己的依赖、Worker 源码、migration 和预构建 PWA，因此可以独立导入。Cloudflare 会读取 `wrangler.jsonc`，配置 Worker Static Assets、D1、R2、Workers AI、默认 AI Search namespace、Vectorize 和 Queue。默认语义检索使用 AI Search 的 trigram keyword + multilingual vector hybrid retrieval，并由 RRF 融合；每个标题和每个非空逻辑正文行是一个独立 item。旧的 Vectorize 行级实现仍保留为 `SEMANTIC_BACKEND=vectorize` 的显式回退，不会在 AI Search 故障时静默启用。

AI Search 目前是 Cloudflare Open Beta。NotesFlash 使用 built-in storage，并通过 Items Workers binding 直接上传标题和正文行；Cloudflare 文档明确这条路径不需要 R2-backed data source 使用的 service API token，也不要求用户向 NotesFlash 填任何 AI Search token。Worker 通过 `AI_SEARCH` namespace binding 幂等创建/打开 `notesflash-search` 实例；`cloud/package.json` 的 `deploy` 脚本仍会确保回退用的 `notesflash-chunks`（768 维 cosine）存在，再按 binding 名运行远程 D1 migration。

部署过程不要求用户填写 NotesFlash 的环境变量或初始化 Secret。部署完成后，同一个地址就是手机端 PWA：

```text
https://<your-worker>.workers.dev/
```

首次初始化和领取配对码：

```text
https://<your-worker>.workers.dev/setup
```

在尚未初始化的实例中，用户需要在 `/setup` 明确点击“初始化并显示一次性配对码”。Worker 会原子地认领实例，并只在这次响应中显示一个十分钟有效、单次使用的配对码；D1 仅保存它的哈希。PWA 会自动预填当前 Worker 地址，macOS 客户端只需填写同一地址和配对码。手机用户随后在 Safari 中选择“添加到主屏幕”，不需要第二个 Pages 项目或 App Store 应用。

同一个配对码的明文不会再次显示。如果用户误刷新页面或首个码过期，在首台真实设备尚未完成配对时，同一浏览器可凭 24 小时有效的 HttpOnly 初始化 Cookie 生成替代码；D1 同时校验服务端过期时间，生成替代码会立即让旧码失效。Cookie 丢失后不会向其他匿名浏览器开放恢复入口。

这个无 Secret 的首次认领采用 TOFU（首次使用即信任）模型：部署者应在部署完成后立即打开 `/setup` 并点击认领；在此之前，任何先访问该地址并主动点击认领的人都有可能抢先占用实例。首台真实设备配对完成后，浏览器初始化凭据立即失效，后续配对码只能由已经连接并通过认证的设备在设置中生成。

如果所有设备 token 都丢失，当前 MVP 没有面向应用的匿名恢复入口；用户只能通过自己的 Cloudflare 账号和 D1 管理能力进行 break-glass 恢复。图片 URL 的签名密钥由 Worker 自动生成并保存在用户自己的 D1 中，不需要环境变量。旧部署升级并验证图片访问和配对正常后，可以删除遗留的 `OWNER_SETUP_SECRET` Worker binding。

删除笔记会先进入 30 天的后端可恢复期（当前恢复入口是 API）；向量清理完成并超过保留期后，Cron 会永久删除 D1 正文和关联的 R2 图片。可通过 `TRASH_RETENTION_DAYS` 调整。

## macOS 客户端

需要 macOS、Xcode Command Line Tools 和 Rust stable：

```bash
npm ci
npm run tauri -- dev
npm run tauri -- build
```

默认行为：

- 窗口 `720 × 760`，最小 `480 × 560`。
- `Command + Shift + Space` 显示并聚焦主窗口。
- 关闭窗口时隐藏而非终止，快捷键继续生效。
- 第二次启动时恢复已有窗口，不创建第二个进程。

macOS 签名、公证、Universal Binary 和 DMG 详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 数据边界

云端数据分工：

```text
D1          当前笔记、设备、Session、配对码、FTS5 索引
R2          私有图片字节
AI Search   标题/正文行明文副本、hybrid 索引与 RRF 检索
Workers AI  短查询中英翻译；Vectorize 回退所需 Embedding
Vectorize   显式回退用的行级 chunk 向量
Queue       异步索引、provider 清理和向量删除
```

当前 MVP 不把笔记标题、正文、搜索结果或图片写入浏览器本地数据库；编辑内容只存在于运行内存，保存成功后进入 D1。当前连接 profile（Worker endpoint、device token、device ID）存放在 `localStorage`。正式公开发布前，macOS 应把 token 移入 Keychain，PWA 同源部署时应优先使用 Secure HttpOnly Cookie。

这套云端语义搜索不是零知识端到端加密：用户自己的 Worker 和 D1 保存笔记明文；默认启用时，Cloudflare AI Search built-in storage 还会保存每个标题和非空正文行的明文副本并处理搜索词，Workers AI 会处理需要翻译的短查询。软删除后，Queue 会先异步删除对应 AI Search items，完成后 D1/R2 才能按保留期永久清理。NotesFlash 不在 metadata 或 item key 中上传原始 note ID，数据也不会经过 NotesFlash 运营方的服务器。

## 文档

- [Cloudflare 后端与 API](cloud/README.md)
- [完整部署与平台验收](docs/DEPLOYMENT.md)

## License

MIT
