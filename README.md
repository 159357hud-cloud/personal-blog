# 动态个人博客

这是一个免第三方依赖的 Node.js 动态博客，包含：

- 前台首页与文章详情页
- `/admin` 后台登录
- 文章新增、编辑、删除、发布与取消发布
- 本地 JSON 数据存储

## 启动

1. 可选：把 `.env.example` 复制为 `.env`，修改管理员账号密码。
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

## 适合怎么部署

这个项目会把文章数据写进本地文件，所以更适合部署到支持持久磁盘的环境，比如：

- 云服务器 / VPS
- Railway 挂载卷
- Render 挂载磁盘

仓库里已经提供了 `render.yaml`，可以直接用于 Render 部署。

如果你要正式上线，建议至少配置这些环境变量：

```env
ADMIN_USERNAME=你的后台账号
ADMIN_PASSWORD=你的后台密码
ADMIN_COOKIE_SECRET=一串足够长的随机字符串
DATA_DIR=/你的持久化目录
PORT=3000
```

## 数据文件

- 站点信息：`data/site.json`
- 文章数据：`data/posts.json`

你可以直接改 `data/site.json` 里的名字、简介、项目和社交链接，让它更像你自己的个人网站。
