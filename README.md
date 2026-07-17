# NotesFlash

NotesFlash 是一个轻量、搜索优先的云端纯文本笔记 MVP：桌面端负责快速输入，手机端通过 PWA 随时查看；所有笔记保持扁平，不提供文件夹、笔记本或 Markdown 渲染。

## MVP 功能

- Svelte 5 + Vite + Tailwind CSS 4 + daisyUI 5。
- macOS Tauri 2 小型窗口，`Command + Shift + Space` 全局唤起并聚焦搜索框。
- 手机端可安装 PWA，不需要 App Store 应用。
- 笔记以完整正文流从上到下平铺，不折叠、不截断。
- 搜索第一项始终是快速创建；搜索文字自动成为新笔记标题。
- 关键词阶段使用字符匹配；随后通过 Workers AI + Vectorize 余弦相似度补充语义结果。
- `↑` / `↓` 选择结果，`Enter` 打开，`Tab` 复制命中行并进入行内编辑。
- 纯文本标题和正文，不解析 Markdown。
- 支持 JPEG、PNG、WebP、GIF、AVIF 图片上传、R2 私有保存和流内展示。
- Cloudflare D1 保存正文，FTS5 trigram 负责中文字符检索。
- Cloudflare Queue 异步生成 Embedding，笔记保存不等待 AI。
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
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

`build:cloud-pwa` 会把最新的 `dist/` 同步到 `cloud/public/`。本地 Worker 随后在同一个 origin 提供 PWA、`/setup` 和 `/api/*`。Miniflare 可以验证 D1、FTS5、R2、配对、CRUD、静态资源和图片；Workers AI 与 Vectorize 需要远程绑定或部署到 Cloudflare 后验证。

## 部署到用户自己的 Cloudflare

把当前工作树推送到公开的 `main` 分支后，可以使用：

```text
https://deploy.workers.cloudflare.com/?url=https://github.com/realllllty/notesflash/tree/main/cloud
```

Cloudflare 当前支持把完全隔离的 GitHub 子目录作为 Deploy Button 模板；`cloud/` 已包含自己的依赖、Worker 源码、migration 和预构建 PWA，因此可以独立导入。Cloudflare 会读取 `wrangler.jsonc`，自动配置 Worker Static Assets、D1、R2、Workers AI、Vectorize 和 Queue。`cloud/package.json` 的 `deploy` 脚本会先按 binding 名运行远程 D1 migration。

部署时必须设置一个足够长的 `OWNER_SETUP_SECRET`。部署完成后，同一个地址就是手机端 PWA：

```text
https://<your-worker>.workers.dev/
```

初始化或恢复配对访问：

```text
https://<your-worker>.workers.dev/setup
```

输入 Secret 后生成十分钟有效的配对码。PWA 会自动预填当前 Worker 地址；macOS 客户端只需填写同一地址和配对码。手机用户随后在 Safari 中选择“添加到主屏幕”，不需要第二个 Pages 项目或 App Store 应用。

`OWNER_SETUP_SECRET` 同时是紧急恢复配对凭据，应保存到密码管理器中；泄漏后需要在 Cloudflare 中轮换。

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
Workers AI  文档和查询 Embedding
Vectorize   语义向量与余弦相似度 Top-K
Queue       异步索引和向量删除
```

当前 MVP 不把笔记标题、正文、搜索结果或图片写入浏览器本地数据库；编辑内容只存在于运行内存，保存成功后进入 D1。当前连接 profile（Worker endpoint、device token、device ID）存放在 `localStorage`。正式公开发布前，macOS 应把 token 移入 Keychain，PWA 同源部署时应优先使用 Secure HttpOnly Cookie。

这套云端语义搜索不是零知识端到端加密：用户自己的 Worker、D1 和 Workers AI 在处理过程中能够看到明文。数据不会经过 NotesFlash 运营方的服务器。

## 文档

- [Cloudflare 后端与 API](cloud/README.md)
- [完整部署与平台验收](docs/DEPLOYMENT.md)

## License

MIT
