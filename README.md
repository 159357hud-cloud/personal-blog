# 动态个人博客

这是一个带后台的个人博客，支持：

- 前台首页与文章详情页
- `/admin` 后台登录
- 文章新增、编辑、删除、发布与取消发布
- 两种存储模式
  - 本地 JSON：适合本地开发或有持久磁盘的服务器
  - Supabase：适合免费部署，不依赖本地磁盘

## 本地启动

1. 可选：把 `.env.example` 复制成 `.env`
2. 运行：

```bash
npm start
```

3. 打开：

- 前台：`http://localhost:3000`
- 后台：`http://localhost:3000/admin`

默认后台账号来自环境变量：

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## 存储模式

### 1. 本地文件模式

默认使用本地 JSON 文件：

- `data/site.json`
- `data/posts.json`

环境变量示例：

```env
DATA_PROVIDER=file
DATA_DIR=./data
```

这种模式适合：

- 本地开发
- VPS
- 支持持久磁盘的 Render / Railway

### 2. Supabase 模式

如果你想走免费部署路线，推荐把数据存到 Supabase。

环境变量示例：

```env
DATA_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_POSTS_TABLE=posts
SUPABASE_SITE_TABLE=site_content
```

初始化步骤：

1. 在 Supabase 新建一个项目
2. 打开 SQL Editor
3. 执行 [`supabase/schema.sql`](./supabase/schema.sql)
4. 在部署平台里配置上面的环境变量

说明：

- 服务第一次启动时，如果远程表里是空的，会自动把仓库里的 `data/*.json` 作为初始内容写进去
- `SUPABASE_SERVICE_ROLE_KEY` 只能放在服务端环境变量里，不要暴露到前端

## Render 部署

### 免费部署友好版

推荐：

- Render Free Web Service
- Supabase Free Project

仓库根目录的 `render.yaml` 已经默认配置成这一套，所以可以直接走 Render Blueprint。

在 Render 手动创建 `Web Service`，配置：

- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/`

环境变量至少填写：

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=10000
DATA_PROVIDER=supabase
ADMIN_USERNAME=你的后台账号
ADMIN_PASSWORD=你的后台密码
ADMIN_COOKIE_SECRET=一串随机长字符串
SUPABASE_URL=你的 Supabase 项目地址
SUPABASE_SERVICE_ROLE_KEY=你的 service role key
SUPABASE_POSTS_TABLE=posts
SUPABASE_SITE_TABLE=site_content
```

这种模式下不需要挂磁盘。

### 付费持久磁盘版

如果你后面想切回本地文件持久化方案，可以参考 `render.paid.yaml`。

## 文件说明

- 服务入口：`server.js`
- 公共样式：`public/site.css`
- 页面交互：`public/site.js`
- 本地站点资料：`data/site.json`
- 本地文章数据：`data/posts.json`
- Supabase 初始化 SQL：`supabase/schema.sql`

## 适合怎么用

- 想最快上线：Render Free + Supabase Free
- 想最稳长期跑：VPS / 付费 Render + 本地文件或数据库
- 想继续自定义页面：直接改 `data/site.json`、后台文章、或前端样式文件
