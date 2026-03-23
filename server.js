const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const ROOT_DIR = __dirname;

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(ROOT_DIR, process.env.DATA_DIR)
  : path.join(ROOT_DIR, "data");
const SEED_DIR = path.join(ROOT_DIR, "data");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");
const SITE_FILE = path.join(DATA_DIR, "site.json");
const SEED_POSTS_FILE = path.join(SEED_DIR, "posts.json");
const SEED_SITE_FILE = path.join(SEED_DIR, "site.json");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";
const COOKIE_SECRET = process.env.ADMIN_COOKIE_SECRET || "local-dev-secret-change-me";
const COOKIE_NAME = "north_journal_admin";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_POSTS_TABLE = String(process.env.SUPABASE_POSTS_TABLE || "posts").trim();
const SUPABASE_SITE_TABLE = String(process.env.SUPABASE_SITE_TABLE || "site_content").trim();
const DATA_PROVIDER = resolveDataProvider(process.env.DATA_PROVIDER, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const STORAGE_MAX_ATTEMPTS = DATA_PROVIDER === "supabase" ? 20 : 1;
const STORAGE_RETRY_DELAY_MS = DATA_PROVIDER === "supabase" ? 5000 : 0;

const storageState = {
  ready: false,
  inProgress: false,
  attempts: 0,
  lastError: null,
  nextRetryAt: null
};

const DEFAULT_SITE = {
  siteName: "北岸手记",
  tagline: "把产品、生活与创作慢慢写成自己的节奏。",
  intro: "这里是我的个人网站。我会在这里记录工作复盘、项目随笔、阅读感受，以及那些值得留住的小想法。",
  author: {
    name: "林见",
    role: "独立开发者 / 视觉设计师",
    bio: "我喜欢把模糊的想法做成具体的作品，也喜欢把日常经验整理成能被反复使用的系统。",
    location: "上海 / Remote",
    email: "hello@example.com"
  },
  projects: [
    {
      name: "Wave Atlas",
      summary: "一个整理灵感、项目卡片和长期主题的知识画布，用来把零散想法串起来。",
      link: "#"
    },
    {
      name: "Quiet Sprint",
      summary: "给独立创作者准备的轻量节奏管理模板，帮助在工作和副业之间切换。",
      link: "#"
    },
    {
      name: "North Studio",
      summary: "我正在慢慢搭建的个人工作室品牌，用来承接设计、写作和数字产品实验。",
      link: "#"
    }
  ],
  socialLinks: [
    { label: "GitHub", href: "https://github.com/159357hud-cloud" },
    { label: "X / Twitter", href: "https://x.com/your-name" },
    { label: "Email", href: "mailto:hello@example.com" }
  ]
};

const DEFAULT_POSTS = [
  {
    id: "c36bf4ee-4b85-4f7f-8de8-2cdf980fd4d8",
    title: "把爱好慢慢做成作品，而不是做成压力",
    slug: "把爱好慢慢做成作品",
    summary: "从灵感、执行到复盘，我越来越相信个人项目最重要的不是快，而是可持续。",
    content:
      "## 为什么我开始重新安排个人项目\n以前我总觉得，做个人项目就应该高强度冲刺。后来才发现，当一件事只能靠热情硬撑时，它往往很难真正长久。\n\n现在我更在意的是节奏。哪怕每天只推进一点点，只要它能稳定地向前，作品就会慢慢长出来。\n\n## 我现在更看重的三件事\n- 先做最小版本，不在一开始追求面面俱到。\n- 给项目留下呼吸空间，让它能随着时间迭代。\n- 把过程写下来，这样每一次尝试都会积累成下一次的起点。\n\n> 当爱好开始要求你立刻证明价值时，它就容易变成压力。\n\n我想保留那种带着好奇心做事的感觉。它不一定最快，但往往能走得更远。",
    category: "创作",
    tags: ["个人项目", "创作习惯", "复盘"],
    featured: true,
    published: true,
    createdAt: "2026-03-18T09:00:00.000Z",
    updatedAt: "2026-03-20T12:30:00.000Z",
    publishedAt: "2026-03-20T12:30:00.000Z"
  },
  {
    id: "a0d8f79f-d9d6-4f53-88f9-f44eae37f39e",
    title: "我怎么整理自己的知识系统",
    slug: "我怎么整理自己的知识系统",
    summary: "笔记不是收藏夹，而是帮我做判断和行动的工具。",
    content:
      "## 先有主题，再有工具\n我不会再为了尝试新工具而迁移笔记了。真正有用的系统，应该先回答一个问题：我到底要长期记录什么？\n\n对我来说，目前最重要的三类内容是项目、写作和生活观察。所以我的笔记结构也围绕这三件事展开。\n\n## 我会主动丢掉什么\n- 只摘录、不加工的资料\n- 和当前目标完全无关的收藏\n- 需要频繁维护但几乎不回看的复杂结构\n\n最后留下来的，往往都很简单，但足够让我在下一次需要时快速找到方向。",
    category: "方法",
    tags: ["知识管理", "笔记", "效率"],
    featured: false,
    published: true,
    createdAt: "2026-03-16T09:00:00.000Z",
    updatedAt: "2026-03-19T08:15:00.000Z",
    publishedAt: "2026-03-19T08:15:00.000Z"
  },
  {
    id: "fbe4d51d-85f7-4664-89fb-e41f8e7d3227",
    title: "在正职和副业之间找到不内耗的节奏",
    slug: "在正职和副业之间找到不内耗的节奏",
    summary: "这是一篇草稿，准备写写我最近如何分配精力。",
    content:
      "## 草稿\n这篇文章还在整理中，准备写工作日和周末不同的执行方式，以及如何给副业设定清晰边界。",
    category: "生活",
    tags: ["副业", "时间管理"],
    featured: false,
    published: false,
    createdAt: "2026-03-21T07:30:00.000Z",
    updatedAt: "2026-03-21T07:30:00.000Z",
    publishedAt: null
  }
];

const server = http.createServer(async (req, res) => {
  try {
    await routeRequest(req, res);
  } catch (error) {
    console.error(error);
    const site = await readSiteConfig().catch(() => DEFAULT_SITE);
    sendHtml(
      res,
      500,
      renderSimplePage(
        site,
        "服务器出错了",
        `
          <main class="page-shell">
            <section class="panel empty-state">
              <strong>服务器暂时没有成功处理这次请求。</strong>
              <p>你可以稍后再试，或者回到首页继续浏览。</p>
              <div class="header-actions">
                <a class="button" href="/">返回首页</a>
                <a class="secondary-button" href="/admin">进入后台</a>
              </div>
            </section>
          </main>
        `
      )
    );
  }
});

bootstrap();

async function bootstrap() {
  startStorageInitialization();
  server.listen(PORT, HOST, () => {
    console.log(
      `Dynamic blog is running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT} (${DATA_PROVIDER} storage)`
    );
  });
}

async function routeRequest(req, res) {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (req.method === "GET" && pathname === "/healthz") {
    sendResponse(
      res,
      200,
      JSON.stringify({
        status: "ok",
        provider: DATA_PROVIDER,
        storageReady: storageState.ready,
        attempts: storageState.attempts,
        lastError: formatErrorMessage(storageState.lastError)
      }),
      "application/json; charset=utf-8"
    );
    return;
  }

  if (req.method === "GET" && pathname === "/favicon.ico") {
    sendResponse(res, 204, "", "text/plain; charset=utf-8");
    return;
  }

  if (pathname.startsWith("/static/")) {
    await serveStaticAsset(pathname, res);
    return;
  }

  if (!storageState.ready) {
    startStorageInitialization();

    const site = DEFAULT_SITE;
    sendHtml(
      res,
      503,
      renderSimplePage(
        site,
        `${site.siteName} | 正在启动`,
        `
          <main class="page-shell">
            <section class="panel empty-state">
              <strong>网站正在连接数据服务，请稍后刷新。</strong>
              <p>当前存储模式：${escapeHtml(DATA_PROVIDER)}，启动尝试次数：${storageState.attempts}</p>
              ${
                storageState.lastError
                  ? `<p>最近一次错误：${escapeHtml(formatErrorMessage(storageState.lastError))}</p>`
                  : "<p>服务已经启动，正在完成最后的初始化。</p>"
              }
            </section>
          </main>
        `
      )
    );
    return;
  }

  if (req.method === "GET" && pathname === "/") {
    const [site, posts] = await Promise.all([readSiteConfig(), readPosts()]);
    const publishedPosts = sortPosts(posts.filter((post) => post.published));
    sendHtml(res, 200, renderHomePage(site, publishedPosts));
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/post/")) {
    const slug = pathname.slice("/post/".length);
    const [site, posts] = await Promise.all([readSiteConfig(), readPosts()]);
    const publishedPosts = posts.filter((post) => post.published);
    const post = publishedPosts.find((item) => item.slug === slug);

    if (!post) {
      sendHtml(
        res,
        404,
        renderSimplePage(
          site,
          "文章不存在",
          `
            <main class="page-shell">
              <section class="panel empty-state">
                <strong>这篇文章还没有发布，或者已经被移动了。</strong>
                <p>你可以先回到首页看看其他内容。</p>
                <a class="button" href="/">返回首页</a>
              </section>
            </main>
          `
        )
      );
      return;
    }

    const relatedPosts = sortPosts(
      publishedPosts.filter((item) => item.id !== post.id && item.category === post.category)
    ).slice(0, 3);

    sendHtml(res, 200, renderPostPage(site, post, relatedPosts));
    return;
  }

  if (req.method === "GET" && pathname === "/admin") {
    if (isAuthenticated(req)) {
      redirect(res, "/admin/dashboard", 303);
      return;
    }

    const site = await readSiteConfig();
    sendHtml(res, 200, renderAdminLogin(site, "", requestUrl.searchParams.get("notice") || ""));
    return;
  }

  if (req.method === "POST" && pathname === "/admin/login") {
    const [site, form] = await Promise.all([readSiteConfig(), parseFormBody(req)]);
    const username = normalizeText(form.username);
    const password = String(form.password || "");

    if (!isValidLogin(username, password)) {
      sendHtml(res, 401, renderAdminLogin(site, "账号或密码不正确。"));
      return;
    }

    setCookie(
      res,
      serializeCookie(COOKIE_NAME, createAuthToken(username), {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        maxAge: SESSION_MAX_AGE_SECONDS,
        secure: process.env.NODE_ENV === "production"
      })
    );
    redirectWithNotice(res, "/admin/dashboard", "登录成功，欢迎回来。");
    return;
  }

  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated(req)) {
      redirect(res, "/admin", 303);
      return;
    }

    if (req.method === "POST" && pathname === "/admin/logout") {
      setCookie(
        res,
        serializeCookie(COOKIE_NAME, "", {
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
          maxAge: 0,
          secure: process.env.NODE_ENV === "production"
        })
      );
      redirectWithNotice(res, "/admin", "已退出后台。");
      return;
    }

    if (req.method === "GET" && pathname === "/admin/dashboard") {
      const [site, posts] = await Promise.all([readSiteConfig(), readPosts()]);
      sendHtml(
        res,
        200,
        renderAdminDashboard(site, sortPosts(posts), requestUrl.searchParams.get("notice") || "")
      );
      return;
    }

    if (req.method === "GET" && pathname === "/admin/posts/new") {
      const site = await readSiteConfig();
      sendHtml(res, 200, renderEditorPage(site));
      return;
    }

    if (req.method === "POST" && pathname === "/admin/posts") {
      const [site, posts, form] = await Promise.all([readSiteConfig(), readPosts(), parseFormBody(req)]);

      try {
        const nextPost = buildPostFromForm(form, posts);
        const nextPosts = sortPosts([nextPost, ...posts]);
        await savePosts(nextPosts);
        redirectWithNotice(res, "/admin/dashboard", "文章已创建。");
      } catch (error) {
        sendHtml(res, 422, renderEditorPage(site, form, error.message));
      }
      return;
    }

    const editMatch = pathname.match(/^\/admin\/posts\/([^/]+)\/edit$/);
    if (req.method === "GET" && editMatch) {
      const id = editMatch[1];
      const [site, posts] = await Promise.all([readSiteConfig(), readPosts()]);
      const post = posts.find((item) => item.id === id);

      if (!post) {
        sendHtml(
          res,
          404,
          renderSimplePage(
            site,
            "文章不存在",
            `
              <main class="admin-wrap">
                <section class="empty-state">
                  <strong>这篇文章已经不存在了。</strong>
                  <p>你可以回到后台继续管理其他文章。</p>
                  <a class="button" href="/admin/dashboard">返回后台</a>
                </section>
              </main>
            `,
            "admin-body"
          )
        );
        return;
      }

      sendHtml(res, 200, renderEditorPage(site, post));
      return;
    }

    const updateMatch = pathname.match(/^\/admin\/posts\/([^/]+)$/);
    if (req.method === "POST" && updateMatch) {
      const id = updateMatch[1];
      const [site, posts, form] = await Promise.all([readSiteConfig(), readPosts(), parseFormBody(req)]);
      const currentPost = posts.find((item) => item.id === id);

      if (!currentPost) {
        sendHtml(
          res,
          404,
          renderSimplePage(
            site,
            "文章不存在",
            `
              <main class="admin-wrap">
                <section class="empty-state">
                  <strong>没有找到要更新的文章。</strong>
                  <p>它可能已经被删除了。</p>
                  <a class="button" href="/admin/dashboard">返回后台</a>
                </section>
              </main>
            `,
            "admin-body"
          )
        );
        return;
      }

      try {
        const updatedPost = buildPostFromForm(form, posts, currentPost);
        const nextPosts = sortPosts(posts.map((item) => (item.id === id ? updatedPost : item)));
        await savePosts(nextPosts);
        redirectWithNotice(res, "/admin/dashboard", "文章已更新。");
      } catch (error) {
        sendHtml(res, 422, renderEditorPage(site, { ...currentPost, ...form }, error.message));
      }
      return;
    }

    const statusMatch = pathname.match(/^\/admin\/posts\/([^/]+)\/status$/);
    if (req.method === "POST" && statusMatch) {
      const id = statusMatch[1];
      const posts = await readPosts();
      const post = posts.find((item) => item.id === id);

      if (!post) {
        redirectWithNotice(res, "/admin/dashboard", "没有找到对应文章。");
        return;
      }

      const now = new Date().toISOString();
      const nextPosts = sortPosts(
        posts.map((item) =>
          item.id === id
            ? {
                ...item,
                published: !item.published,
                publishedAt: item.published ? item.publishedAt : item.publishedAt || now,
                updatedAt: now
              }
            : item
        )
      );

      await savePosts(nextPosts);
      redirectWithNotice(res, "/admin/dashboard", post.published ? "文章已切换为草稿。" : "文章已发布。");
      return;
    }

    const deleteMatch = pathname.match(/^\/admin\/posts\/([^/]+)\/delete$/);
    if (req.method === "POST" && deleteMatch) {
      const id = deleteMatch[1];
      const posts = await readPosts();
      const nextPosts = posts.filter((item) => item.id !== id);

      if (nextPosts.length === posts.length) {
        redirectWithNotice(res, "/admin/dashboard", "没有找到要删除的文章。");
        return;
      }

      await savePosts(sortPosts(nextPosts));
      redirectWithNotice(res, "/admin/dashboard", "文章已删除。");
      return;
    }
  }

  const site = await readSiteConfig();
  sendHtml(
    res,
    404,
    renderSimplePage(
      site,
      "页面不存在",
      `
        <main class="page-shell">
          <section class="panel empty-state">
            <strong>这个页面没有找到。</strong>
            <p>你可以回到首页，或者进入后台继续编辑网站内容。</p>
            <div class="header-actions">
              <a class="button" href="/">返回首页</a>
              <a class="secondary-button" href="/admin">进入后台</a>
            </div>
          </section>
        </main>
      `
    )
  );
}

function loadEnvFile() {
  const envFile = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envFile)) {
    return;
  }

  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function startStorageInitialization() {
  if (storageState.ready || storageState.inProgress) {
    return;
  }

  storageState.inProgress = true;
  void initializeStorageWithRetry();
}

async function initializeStorageWithRetry() {
  while (!storageState.ready && storageState.attempts < STORAGE_MAX_ATTEMPTS) {
    storageState.attempts += 1;

    try {
      await ensureStorage();
      storageState.ready = true;
      storageState.lastError = null;
      storageState.nextRetryAt = null;
      console.log(`Storage initialized successfully on attempt ${storageState.attempts}.`);
      break;
    } catch (error) {
      storageState.lastError = error;
      storageState.nextRetryAt =
        STORAGE_RETRY_DELAY_MS > 0 ? new Date(Date.now() + STORAGE_RETRY_DELAY_MS).toISOString() : null;

      console.error(
        `Storage initialization attempt ${storageState.attempts} failed: ${
          error && error.message ? error.message : String(error)
        }`
      );

      if (storageState.attempts >= STORAGE_MAX_ATTEMPTS || STORAGE_RETRY_DELAY_MS === 0) {
        break;
      }

      await delay(STORAGE_RETRY_DELAY_MS);
    }
  }

  storageState.inProgress = false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureStorage() {
  if (DATA_PROVIDER === "supabase") {
    await ensureSupabaseStorage();
    return;
  }

  await fsp.mkdir(DATA_DIR, { recursive: true });

  if (!fs.existsSync(POSTS_FILE)) {
    const seedPosts = await readJsonFile(SEED_POSTS_FILE, DEFAULT_POSTS);
    await saveJsonFile(POSTS_FILE, Array.isArray(seedPosts) ? seedPosts : DEFAULT_POSTS);
  }

  if (!fs.existsSync(SITE_FILE)) {
    const seedSite = await readJsonFile(SEED_SITE_FILE, DEFAULT_SITE);
    await saveJsonFile(SITE_FILE, normalizeSite(seedSite));
  }
}

async function readPosts() {
  if (DATA_PROVIDER === "supabase") {
    return readPostsFromSupabase();
  }

  const posts = await readJsonFile(POSTS_FILE, DEFAULT_POSTS);
  return Array.isArray(posts) ? posts : DEFAULT_POSTS;
}

async function savePosts(posts) {
  if (DATA_PROVIDER === "supabase") {
    await replacePostsInSupabase(posts);
    return;
  }

  await saveJsonFile(POSTS_FILE, posts);
}

async function readSiteConfig() {
  if (DATA_PROVIDER === "supabase") {
    return readSiteConfigFromSupabase();
  }

  const rawSite = await readJsonFile(SITE_FILE, DEFAULT_SITE);
  return normalizeSite(rawSite);
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallbackValue;
    }

    throw error;
  }
}

async function saveJsonFile(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  await fsp.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fsp.rename(tempPath, filePath);
}

async function ensureSupabaseStorage() {
  assertSupabaseConfigured();

  const [seedSite, seedPosts] = await Promise.all([
    readJsonFile(SEED_SITE_FILE, DEFAULT_SITE),
    readJsonFile(SEED_POSTS_FILE, DEFAULT_POSTS)
  ]);

  const siteRows = await supabaseRequest("GET", `${SUPABASE_SITE_TABLE}?select=id,data&id=eq.1`);
  if (!Array.isArray(siteRows) || siteRows.length === 0) {
    await upsertSiteConfigToSupabase(normalizeSite(seedSite));
  }

  const postRows = await supabaseRequest("GET", `${SUPABASE_POSTS_TABLE}?select=id&limit=1`);
  if (!Array.isArray(postRows) || postRows.length === 0) {
    const initialPosts = Array.isArray(seedPosts) ? seedPosts : DEFAULT_POSTS;
    await replacePostsInSupabase(initialPosts);
  }
}

async function readPostsFromSupabase() {
  const rows = await supabaseRequest("GET", `${SUPABASE_POSTS_TABLE}?select=id,data,updated_at`);
  if (!Array.isArray(rows)) {
    return DEFAULT_POSTS;
  }

  return rows
    .map((row) => (row && row.data && typeof row.data === "object" ? row.data : null))
    .filter(Boolean);
}

async function replacePostsInSupabase(posts) {
  assertSupabaseConfigured();

  const normalizedPosts = Array.isArray(posts) ? posts : [];
  const payload = normalizedPosts.map((post) => ({
    id: post.id,
    data: post,
    updated_at: post.updatedAt || new Date().toISOString()
  }));

  if (payload.length > 0) {
    await supabaseRequest("POST", `${SUPABASE_POSTS_TABLE}?on_conflict=id`, payload, {
      Prefer: "resolution=merge-duplicates,return=minimal"
    });
  }

  const existingRows = await supabaseRequest("GET", `${SUPABASE_POSTS_TABLE}?select=id`);
  const incomingIds = new Set(normalizedPosts.map((post) => post.id));
  const staleIds = Array.isArray(existingRows)
    ? existingRows.map((row) => row.id).filter((id) => id && !incomingIds.has(id))
    : [];

  for (const id of staleIds) {
    await supabaseRequest("DELETE", `${SUPABASE_POSTS_TABLE}?id=eq.${encodeURIComponent(id)}`);
  }
}

async function readSiteConfigFromSupabase() {
  const rows = await supabaseRequest("GET", `${SUPABASE_SITE_TABLE}?select=id,data&id=eq.1`);
  if (Array.isArray(rows) && rows[0] && rows[0].data && typeof rows[0].data === "object") {
    return normalizeSite(rows[0].data);
  }

  return DEFAULT_SITE;
}

async function upsertSiteConfigToSupabase(site) {
  assertSupabaseConfigured();

  await supabaseRequest(
    "POST",
    `${SUPABASE_SITE_TABLE}?on_conflict=id`,
    [{ id: 1, data: site, updated_at: new Date().toISOString() }],
    { Prefer: "resolution=merge-duplicates,return=minimal" }
  );
}

async function supabaseRequest(method, resource, body, headers = {}) {
  assertSupabaseConfigured();

  const baseUrl = SUPABASE_URL.replace(/\/+$/, "");
  const targetUrl = new URL(`${baseUrl}/rest/v1/${resource}`);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const response = await sendHttpsRequest(targetUrl, {
    method,
    headers: buildSupabaseHeaders(body !== undefined, headers),
    body: payload
  });
  const text = response.text;

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Supabase request failed (${response.statusCode}): ${text || response.statusMessage}`);
  }

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase storage is enabled, but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }
}

function buildSupabaseHeaders(hasBody, extraHeaders = {}) {
  const resolvedHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...extraHeaders
  };

  if (!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_")) {
    resolvedHeaders.Authorization = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  }

  return resolvedHeaders;
}

async function sendHttpsRequest(targetUrl, options) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: options.method,
        headers: options.headers,
        family: 4,
        timeout: 15000
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 0,
            statusMessage: response.statusMessage || "",
            text: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error(`HTTPS request timed out for ${targetUrl.hostname}`));
    });

    request.on("error", (error) => {
      reject(new Error(`HTTPS request failed for ${targetUrl.hostname}: ${error.message}`, { cause: error }));
    });

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}

function formatErrorMessage(error) {
  if (!error) {
    return "";
  }

  const parts = [error.message];

  if (error.cause && error.cause.message && error.cause.message !== error.message) {
    parts.push(error.cause.message);
  }

  return parts.filter(Boolean).join(" | ");
}

function normalizeSite(rawSite) {
  const site = rawSite && typeof rawSite === "object" ? rawSite : {};

  return {
    siteName: normalizeText(site.siteName) || DEFAULT_SITE.siteName,
    tagline: normalizeText(site.tagline) || DEFAULT_SITE.tagline,
    intro: normalizeText(site.intro) || DEFAULT_SITE.intro,
    author: {
      name: normalizeText(site.author?.name) || DEFAULT_SITE.author.name,
      role: normalizeText(site.author?.role) || DEFAULT_SITE.author.role,
      bio: normalizeText(site.author?.bio) || DEFAULT_SITE.author.bio,
      location: normalizeText(site.author?.location) || DEFAULT_SITE.author.location,
      email: normalizeText(site.author?.email) || DEFAULT_SITE.author.email
    },
    projects:
      Array.isArray(site.projects) && site.projects.length > 0
        ? site.projects
            .map((item) => ({
              name: normalizeText(item.name),
              summary: normalizeText(item.summary),
              link: normalizeText(item.link) || "#"
            }))
            .filter((item) => item.name && item.summary)
        : DEFAULT_SITE.projects,
    socialLinks:
      Array.isArray(site.socialLinks) && site.socialLinks.length > 0
        ? site.socialLinks
            .map((item) => normalizeSocialLink(item))
            .filter((item) => item.label)
        : DEFAULT_SITE.socialLinks
  };
}

function normalizeSocialLink(item) {
  const label = normalizeText(item?.label);
  const href = normalizeText(item?.href) || "#";
  const fallback = DEFAULT_SITE.socialLinks.find((entry) => entry.label === label);

  return {
    label,
    href: isPlaceholderSocialHref(label, href) ? fallback?.href || href : href
  };
}

function isPlaceholderSocialHref(label, href) {
  if (!href) {
    return true;
  }

  if (label === "GitHub" && href === "https://github.com/your-name") {
    return true;
  }

  if (label === "X / Twitter" && href === "https://x.com/your-name") {
    return true;
  }

  if (label === "Email" && href === "mailto:hello@example.com") {
    return true;
  }

  return false;
}

function buildPostFromForm(form, posts, existingPost = null) {
  const title = normalizeText(form.title);
  const content = normalizeContent(form.content);
  const summary = normalizeText(form.summary) || buildExcerpt(content, 110);
  const category = normalizeText(form.category) || "随笔";
  const tags = normalizeTags(form.tags);
  const featured = hasTruthyValue(form.featured);
  const published = hasTruthyValue(form.published);

  if (!title) {
    throw new Error("文章标题不能为空。");
  }

  if (!content) {
    throw new Error("文章正文不能为空。");
  }

  const now = new Date().toISOString();
  const desiredSlug = normalizeText(form.slug) || title;
  const slug = ensureUniqueSlug(posts, desiredSlug, existingPost?.id);

  return {
    id: existingPost?.id || crypto.randomUUID(),
    title,
    slug,
    summary,
    content,
    category,
    tags,
    featured,
    published,
    createdAt: existingPost?.createdAt || now,
    updatedAt: now,
    publishedAt: published ? existingPost?.publishedAt || now : existingPost?.publishedAt || null
  };
}

function normalizeContent(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function resolveDataProvider(rawValue, supabaseUrl, supabaseServiceRoleKey) {
  const normalized = String(rawValue || "").trim().toLowerCase();

  if (normalized === "file" || normalized === "supabase") {
    return normalized;
  }

  if (supabaseUrl && supabaseServiceRoleKey) {
    return "supabase";
  }

  return "file";
}

function normalizeTags(value) {
  const seen = new Set();
  return String(value || "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item.toLowerCase())) {
        return false;
      }

      seen.add(item.toLowerCase());
      return true;
    });
}

function ensureUniqueSlug(posts, source, currentId) {
  const base = slugify(source) || `post-${Date.now().toString(36)}`;
  let candidate = base;
  let counter = 2;

  while (posts.some((post) => post.slug === candidate && post.id !== currentId)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function sortPosts(posts) {
  return [...posts].sort((left, right) => {
    const leftDate = Date.parse(left.publishedAt || left.updatedAt || left.createdAt || 0);
    const rightDate = Date.parse(right.publishedAt || right.updatedAt || right.createdAt || 0);
    return rightDate - leftDate;
  });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildExcerpt(content, limit) {
  const plainText = stripMarkup(content).replace(/\s+/g, " ").trim();
  if (plainText.length <= limit) {
    return plainText;
  }

  return `${plainText.slice(0, limit).trim()}...`;
}

function stripMarkup(content) {
  return String(content || "")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\-\s+/gm, "")
    .replace(/^\>\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "");
}

function estimateReadingTime(content) {
  const units = String(content || "").match(/[\p{Script=Han}]|[A-Za-z0-9_]+/gu) || [];
  return Math.max(1, Math.ceil(units.length / 280));
}

function hasTruthyValue(value) {
  return value === "on" || value === "true" || value === "1";
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((cookies, chunk) => {
    const [key, ...rest] = chunk.trim().split("=");
    if (!key) {
      return cookies;
    }

    cookies[key] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return verifyAuthToken(cookies[COOKIE_NAME] || "");
}

function isValidLogin(username, password) {
  return safeCompare(username, ADMIN_USERNAME) && safeCompare(password, ADMIN_PASSWORD);
}

function safeCompare(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function createAuthToken(username) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
    }),
    "utf8"
  ).toString("base64url");

  const signature = crypto.createHmac("sha256", COOKIE_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [payload, signature] = token.split(".");
  const expectedSignature = crypto.createHmac("sha256", COOKIE_SECRET).update(payload).digest("base64url");

  if (!safeCompare(signature, expectedSignature)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push(`Path=${options.path || "/"}`);

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  return parts.join("; ");
}

function setCookie(res, value) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", value);
    return;
  }

  const values = Array.isArray(current) ? current : [current];
  res.setHeader("Set-Cookie", [...values, value]);
}

async function parseFormBody(req) {
  const chunks = [];
  let totalLength = 0;

  return new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      totalLength += chunk.length;
      if (totalLength > 2 * 1024 * 1024) {
        reject(new Error("表单内容过大。"));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const params = new URLSearchParams(body);
      const result = {};
      for (const [key, value] of params.entries()) {
        result[key] = value;
      }

      resolve(result);
    });

    req.on("error", reject);
  });
}

async function serveStaticAsset(pathname, res) {
  const relativePath = pathname.replace(/^\/static\//, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendResponse(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  try {
    const content = await fsp.readFile(filePath);
    sendBuffer(res, 200, content, getContentType(filePath));
  } catch (error) {
    if (error.code === "ENOENT") {
      sendResponse(res, 404, "Not Found", "text/plain; charset=utf-8");
      return;
    }

    throw error;
  }
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".js") {
    return "application/javascript; charset=utf-8";
  }

  if (extension === ".json") {
    return "application/json; charset=utf-8";
  }

  return "text/plain; charset=utf-8";
}

function sendHtml(res, statusCode, html) {
  sendResponse(res, statusCode, html, "text/html; charset=utf-8");
}

function sendResponse(res, statusCode, body, contentType) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function sendBuffer(res, statusCode, body, contentType) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function redirect(res, location, statusCode = 302) {
  res.writeHead(statusCode, { Location: location });
  res.end();
}

function redirectWithNotice(res, pathname, notice, statusCode = 303) {
  redirect(res, `${pathname}?notice=${encodeURIComponent(notice)}`, statusCode);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) {
    return "未设置日期";
  }

  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function renderInlineMarkup(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}

function renderPostContent(content) {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const fragments = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index].trim();
    if (!current) {
      continue;
    }

    if (current.startsWith("### ")) {
      fragments.push(`<h3>${renderInlineMarkup(current.slice(4))}</h3>`);
      continue;
    }

    if (current.startsWith("## ")) {
      fragments.push(`<h2>${renderInlineMarkup(current.slice(3))}</h2>`);
      continue;
    }

    if (current.startsWith("> ")) {
      const quoteLines = [renderInlineMarkup(current.slice(2))];
      while (lines[index + 1] && lines[index + 1].trim().startsWith("> ")) {
        index += 1;
        quoteLines.push(renderInlineMarkup(lines[index].trim().slice(2)));
      }

      fragments.push(`<blockquote><p>${quoteLines.join("<br>")}</p></blockquote>`);
      continue;
    }

    if (current.startsWith("- ")) {
      const items = [`<li>${renderInlineMarkup(current.slice(2))}</li>`];
      while (lines[index + 1] && lines[index + 1].trim().startsWith("- ")) {
        index += 1;
        items.push(`<li>${renderInlineMarkup(lines[index].trim().slice(2))}</li>`);
      }

      fragments.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const paragraphLines = [renderInlineMarkup(current)];
    while (lines[index + 1]) {
      const next = lines[index + 1].trim();
      if (!next || next.startsWith("## ") || next.startsWith("### ") || next.startsWith("> ") || next.startsWith("- ")) {
        break;
      }

      index += 1;
      paragraphLines.push(renderInlineMarkup(lines[index].trim()));
    }

    fragments.push(`<p>${paragraphLines.join("<br>")}</p>`);
  }

  return fragments.join("\n");
}

function renderNotice(notice) {
  if (!notice) {
    return "";
  }

  return `
    <section class="notice-card">
      <strong>操作结果</strong>
      <p>${escapeHtml(notice)}</p>
    </section>
  `;
}

function renderHomePage(site, posts) {
  const featuredPost = posts.find((post) => post.featured) || posts[0] || null;
  const listPosts = featuredPost ? posts.filter((post) => post.id !== featuredPost.id) : posts;
  const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))];
  const latestDate = posts[0] ? formatDate(posts[0].publishedAt || posts[0].updatedAt) : "还没有文章";

  return renderSimplePage(
    site,
    `${site.siteName} | ${site.tagline}`,
    `
      <main class="page-shell">
        <section class="panel hero-panel fade-up" data-reveal>
          <div class="hero-copy">
            <div class="kicker">个人网站 / 动态博客</div>
            <h1 class="hero-title">${escapeHtml(site.siteName)}</h1>
            <p class="hero-text">${escapeHtml(site.tagline)}</p>
            <p class="hero-text">${escapeHtml(site.intro)}</p>
            <div class="hero-actions">
              <a class="button" href="#articles">开始阅读</a>
              <a class="secondary-button" href="#about">认识我</a>
            </div>
            <div class="hero-metrics">
              <div class="metric-card">
                <span>已发布文章</span>
                <strong>${posts.length}</strong>
              </div>
              <div class="metric-card">
                <span>项目陈列</span>
                <strong>${site.projects.length}</strong>
              </div>
              <div class="metric-card">
                <span>最近更新</span>
                <strong>${escapeHtml(latestDate)}</strong>
              </div>
            </div>
          </div>
          <aside class="hero-aside">
            <section class="author-note">
              <strong>${escapeHtml(site.author.name)}</strong>
              <h3>${escapeHtml(site.author.role)}</h3>
              <p>${escapeHtml(site.author.bio)}</p>
              <div class="detail-list">
                <div class="detail-card">
                  <span>所在位置</span>
                  <strong>${escapeHtml(site.author.location)}</strong>
                </div>
                <div class="detail-card">
                  <span>联系邮箱</span>
                  <strong>${escapeHtml(site.author.email)}</strong>
                </div>
              </div>
            </section>
            <section class="author-note">
              <strong>社交与联系</strong>
              <div class="social-list">
                ${site.socialLinks
                  .map(
                    (item) => `
                      <a class="social-link" href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">
                        <span>${escapeHtml(item.label)}</span>
                        <span>打开</span>
                      </a>
                    `
                  )
                  .join("")}
              </div>
            </section>
          </aside>
        </section>

        ${featuredPost ? `
          <section class="split-grid section-block fade-up" data-reveal>
            <article class="feature-copy">
              <div class="eyebrow">精选文章</div>
              <h2>${escapeHtml(featuredPost.title)}</h2>
              <p>${escapeHtml(featuredPost.summary)}</p>
              <div class="feature-meta">
                <span class="meta-pill">分类：${escapeHtml(featuredPost.category)}</span>
                <span class="meta-pill">${estimateReadingTime(featuredPost.content)} 分钟阅读</span>
                <span class="meta-pill">${escapeHtml(formatDate(featuredPost.publishedAt || featuredPost.updatedAt))}</span>
              </div>
              <div class="post-actions">
                <a class="button" href="/post/${encodeURIComponent(featuredPost.slug)}">阅读全文</a>
                <a class="ghost-button" href="#articles">查看全部文章</a>
              </div>
            </article>
            <aside class="feature-spotlight">
              <div>
                <strong>最近在写什么</strong>
                <p class="hero-text">这个站点不只是博客，也是我的个人名片。文章、项目和联系方式都放在这里，后面你也可以继续扩展成作品集。</p>
              </div>
              <div class="detail-list">
                ${featuredPost.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}
              </div>
            </aside>
          </section>
        ` : ""}

        <section id="articles" class="section-block fade-up" data-reveal>
          <div class="section-heading">
            <div>
              <div class="eyebrow">Latest Writing</div>
              <h2>最新文章</h2>
              <p>这里展示已经发布的内容。你可以在后台继续创建草稿，再决定什么时候公开。</p>
            </div>
          </div>
          <div class="filter-bar">
            <button class="filter-chip is-active" type="button" data-filter="all">全部</button>
            ${categories
              .map(
                (category) => `
                  <button class="filter-chip" type="button" data-filter="${escapeHtml(category.toLowerCase())}">
                    ${escapeHtml(category)}
                  </button>
                `
              )
              .join("")}
            <span class="filter-summary" data-filter-summary>显示全部文章</span>
          </div>
          ${
            listPosts.length > 0
              ? `<div class="post-grid">
                  ${listPosts.map((post) => renderPostCard(post)).join("")}
                </div>`
              : `<section class="empty-state">
                  <strong>现在还没有更多已发布文章。</strong>
                  <p>你可以先到后台创建新文章，发布后这里会自动显示。</p>
                </section>`
          }
        </section>

        <section class="info-grid section-block fade-up" data-reveal>
          <section id="about" class="about-panel">
            <div class="eyebrow">About</div>
            <h2 class="hero-title" style="font-size: clamp(2rem, 4vw, 3.2rem);">关于我</h2>
            <p>${escapeHtml(site.author.bio)}</p>
            <p>${escapeHtml(site.intro)}</p>
            <div class="detail-list">
              <div class="detail-card">
                <span>主要身份</span>
                <strong>${escapeHtml(site.author.role)}</strong>
              </div>
              <div class="detail-card">
                <span>合作方式</span>
                <strong>写作 / 设计 / 数字产品</strong>
              </div>
            </div>
          </section>

          <section id="projects" class="project-panel">
            <div class="eyebrow">Projects</div>
            <h2 class="hero-title" style="font-size: clamp(2rem, 4vw, 3rem);">在做的事</h2>
            <div class="project-list">
              ${site.projects
                .map(
                  (project) => `
                    <article class="project-card">
                      <h3>${escapeHtml(project.name)}</h3>
                      <p>${escapeHtml(project.summary)}</p>
                      <a href="${escapeHtml(project.link)}">查看项目</a>
                    </article>
                  `
                )
                .join("")}
            </div>
          </section>

          <section id="contact" class="contact-panel">
            <div class="eyebrow">Contact</div>
            <h2 class="hero-title" style="font-size: clamp(2rem, 4vw, 3rem);">联系我</h2>
            <p>如果你想聊合作、网站改版、个人品牌、数字产品，或者只是想打个招呼，都可以通过下面这些方式找到我。</p>
            <div class="social-list">
              ${site.socialLinks
                .map(
                  (item) => `
                    <a class="social-link" href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">
                      <span>${escapeHtml(item.label)}</span>
                      <span>前往</span>
                    </a>
                  `
                )
                .join("")}
            </div>
          </section>
        </section>
      </main>
    `
  );
}

function renderPostCard(post) {
  return `
    <article class="post-card" data-post-card data-category="${escapeHtml(post.category.toLowerCase())}">
      <div class="post-statuses">
        <span class="status-pill ${post.published ? "published" : "draft"}">${post.published ? "已发布" : "草稿"}</span>
        ${post.featured ? '<span class="status-pill featured">精选</span>' : ""}
      </div>
      <div class="post-meta">
        <span>${escapeHtml(post.category)}</span>
        <span>${estimateReadingTime(post.content)} 分钟阅读</span>
      </div>
      <h3>${escapeHtml(post.title)}</h3>
      <p class="hero-text">${escapeHtml(post.summary)}</p>
      <div class="post-tag-list">
        ${post.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <div class="post-actions">
        <a class="post-link" href="/post/${encodeURIComponent(post.slug)}">阅读全文</a>
        <span class="muted-label">${escapeHtml(formatDate(post.publishedAt || post.updatedAt))}</span>
      </div>
    </article>
  `;
}

function renderPostPage(site, post, relatedPosts) {
  return renderSimplePage(
    site,
    `${post.title} | ${site.siteName}`,
    `
      <main class="page-shell">
        <a class="back-link" href="/">返回首页</a>
        <section class="article-layout fade-up" data-reveal>
          <article class="article-panel">
            <header class="article-header">
              <div class="article-breadcrumb">${escapeHtml(post.category)} / 文章</div>
              <h1>${escapeHtml(post.title)}</h1>
              <p class="article-lead">${escapeHtml(post.summary)}</p>
              <div class="article-meta">
                <span class="meta-pill">${escapeHtml(formatDate(post.publishedAt || post.updatedAt))}</span>
                <span class="meta-pill">${estimateReadingTime(post.content)} 分钟阅读</span>
                <span class="meta-pill">${escapeHtml(site.author.name)}</span>
              </div>
            </header>
            <div class="article-body">
              ${renderPostContent(post.content)}
            </div>
          </article>

          <aside class="article-side panel">
            <h3>文章信息</h3>
            <div class="detail-list">
              <div class="detail-card">
                <span>发布时间</span>
                <strong>${escapeHtml(formatDate(post.publishedAt || post.updatedAt))}</strong>
              </div>
              <div class="detail-card">
                <span>分类</span>
                <strong>${escapeHtml(post.category)}</strong>
              </div>
              <div class="detail-card">
                <span>阅读时长</span>
                <strong>${estimateReadingTime(post.content)} 分钟</strong>
              </div>
            </div>
            <h3>标签</h3>
            <div class="article-tag-list">
              ${post.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}
            </div>
            <h3>作者</h3>
            <p>${escapeHtml(site.author.name)} · ${escapeHtml(site.author.role)}</p>
            <p>${escapeHtml(site.author.bio)}</p>
            <div class="post-actions">
              <a class="button" href="mailto:${escapeHtml(site.author.email)}">联系作者</a>
            </div>
          </aside>
        </section>

        ${
          relatedPosts.length > 0
            ? `<section class="related-posts fade-up" data-reveal>
                <div class="section-heading">
                  <div>
                    <div class="eyebrow">Related</div>
                    <h2>你可能还会喜欢</h2>
                  </div>
                </div>
                <div class="post-grid">
                  ${relatedPosts.map((item) => renderPostCard(item)).join("")}
                </div>
              </section>`
            : ""
        }
      </main>
    `
  );
}

function renderAdminLogin(site, errorMessage = "", notice = "") {
  return renderSimplePage(
    site,
    `后台登录 | ${site.siteName}`,
    `
      <main class="login-shell">
        <section class="login-panel">
          <div class="kicker">Admin Login</div>
          <h1>进入你的写作后台</h1>
          <p>登录后你可以新增文章、编辑草稿、切换发布状态，以及持续维护这个个人网站。</p>
          ${notice ? `<p>${escapeHtml(notice)}</p>` : ""}
          ${errorMessage ? `<p class="error-text">${escapeHtml(errorMessage)}</p>` : ""}
          <form class="form-grid" method="post" action="/admin/login">
            <div class="field">
              <label for="username">账号</label>
              <input id="username" name="username" type="text" placeholder="admin" required>
            </div>
            <div class="field">
              <label for="password">密码</label>
              <input id="password" name="password" type="password" placeholder="请输入后台密码" required>
            </div>
            <div class="editor-actions">
              <button class="button" type="submit">登录后台</button>
              <a class="secondary-button" href="/">返回网站首页</a>
            </div>
          </form>
        </section>
      </main>
    `,
    "admin-body"
  );
}

function renderAdminDashboard(site, posts, notice) {
  const publishedCount = posts.filter((post) => post.published).length;
  const draftCount = posts.filter((post) => !post.published).length;
  const featuredCount = posts.filter((post) => post.featured).length;

  return renderSimplePage(
    site,
    `后台管理 | ${site.siteName}`,
    `
      <main class="admin-wrap">
        <section class="admin-heading">
          <div>
            <div class="kicker">Dashboard</div>
            <h1>管理你的动态博客</h1>
            <p>前台文章会从这里的已发布内容中自动读取。草稿不会公开显示。</p>
          </div>
          <div class="header-actions">
            <a class="button" href="/admin/posts/new">新建文章</a>
            <a class="secondary-button" href="/" target="_blank" rel="noreferrer">打开前台</a>
            <form method="post" action="/admin/logout">
              <button class="ghost-button" type="submit">退出登录</button>
            </form>
          </div>
        </section>

        ${renderNotice(notice)}

        <section class="admin-metrics">
          <div class="admin-card">
            <span>全部文章</span>
            <strong>${posts.length}</strong>
          </div>
          <div class="admin-card">
            <span>已发布</span>
            <strong>${publishedCount}</strong>
          </div>
          <div class="admin-card">
            <span>草稿</span>
            <strong>${draftCount}</strong>
          </div>
          <div class="admin-card">
            <span>精选文章</span>
            <strong>${featuredCount}</strong>
          </div>
        </section>

        <section class="admin-layout">
          ${
            posts.length > 0
              ? posts
                  .map(
                    (post) => `
                      <article class="admin-post">
                        <div class="status-row">
                          <span class="status-pill ${post.published ? "published" : "draft"}">${post.published ? "已发布" : "草稿"}</span>
                          ${post.featured ? '<span class="status-pill featured">精选</span>' : ""}
                          <span class="status-pill draft">${escapeHtml(post.category)}</span>
                        </div>
                        <div>
                          <h3>${escapeHtml(post.title)}</h3>
                          <p class="hero-text">${escapeHtml(post.summary)}</p>
                        </div>
                        <div class="post-meta">
                          <span>链接：/post/${escapeHtml(post.slug)}</span>
                          <span>${escapeHtml(formatDate(post.publishedAt || post.updatedAt))}</span>
                        </div>
                        <div class="post-tag-list">
                          ${post.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}
                        </div>
                        <div class="post-actions">
                          <a class="secondary-button" href="/admin/posts/${post.id}/edit">编辑</a>
                          <form method="post" action="/admin/posts/${post.id}/status">
                            <button class="ghost-button" type="submit">${post.published ? "转为草稿" : "立即发布"}</button>
                          </form>
                          <form method="post" action="/admin/posts/${post.id}/delete" data-confirm="确认删除这篇文章吗？删除后无法恢复。">
                            <button class="danger-button" type="submit">删除</button>
                          </form>
                          ${
                            post.published
                              ? `<a class="text-button" href="/post/${encodeURIComponent(post.slug)}" target="_blank" rel="noreferrer">预览前台</a>`
                              : ""
                          }
                        </div>
                      </article>
                    `
                  )
                  .join("")
              : `<section class="empty-state">
                  <strong>现在还没有文章。</strong>
                  <p>先写第一篇吧，发布后首页就会自动出现。</p>
                  <a class="button" href="/admin/posts/new">开始写作</a>
                </section>`
          }
        </section>
      </main>
    `,
    "admin-body"
  );
}

function renderEditorPage(site, post = {}, errorMessage = "") {
  const isEditing = Boolean(post.id);
  const tagsValue = Array.isArray(post.tags) ? post.tags.join(", ") : normalizeText(post.tags);
  const previewSlug = normalizeText(post.slug);
  const actionPath = isEditing ? `/admin/posts/${post.id}` : "/admin/posts";

  return renderSimplePage(
    site,
    `${isEditing ? "编辑文章" : "新建文章"} | ${site.siteName}`,
    `
      <main class="admin-wrap">
        <section class="editor-heading">
          <div>
            <div class="kicker">${isEditing ? "Edit Post" : "New Post"}</div>
            <h1>${isEditing ? "编辑文章" : "写一篇新文章"}</h1>
            <p>这里是你的内容后台。保存后文章会写入本地数据文件，发布后首页会自动展示。</p>
          </div>
          <div class="header-actions">
            <a class="secondary-button" href="/admin/dashboard">返回后台</a>
            <a class="ghost-button" href="/" target="_blank" rel="noreferrer">查看前台</a>
          </div>
        </section>

        ${errorMessage ? `<section class="notice-card"><strong>表单提示</strong><p class="error-text">${escapeHtml(errorMessage)}</p></section>` : ""}

        <section class="editor-layout">
          <article class="editor-panel">
            <form class="form-grid" method="post" action="${actionPath}">
              <div class="field">
                <label for="title">文章标题</label>
                <input id="title" name="title" type="text" value="${escapeHtml(post.title || "")}" placeholder="比如：我最近在重新设计自己的工作节奏" data-slug-source required>
              </div>

              <div class="field-row">
                <div class="field">
                  <label for="slug">文章链接</label>
                  <input id="slug" name="slug" type="text" value="${escapeHtml(previewSlug)}" placeholder="可留空，系统会自动生成" data-slug-target>
                  <small class="slug-preview" data-slug-preview>${previewSlug ? `/post/${escapeHtml(previewSlug)}` : "/post/文章链接"}</small>
                </div>
                <div class="field">
                  <label for="category">分类</label>
                  <input id="category" name="category" type="text" value="${escapeHtml(post.category || "")}" placeholder="创作 / 方法 / 生活">
                </div>
              </div>

              <div class="field">
                <label for="tags">标签</label>
                <input id="tags" name="tags" type="text" value="${escapeHtml(tagsValue || "")}" placeholder="用逗号分隔，比如：个人项目, 复盘, 写作">
              </div>

              <div class="field">
                <label for="summary">文章摘要</label>
                <textarea id="summary" name="summary" rows="3" placeholder="给首页卡片准备一段简短介绍">${escapeHtml(post.summary || "")}</textarea>
              </div>

              <div class="field">
                <label for="content">正文内容</label>
                <textarea id="content" name="content" rows="14" placeholder="支持普通段落，以及 ## 小标题、- 列表、&gt; 引用、**加粗**、\`行内代码\`" data-editor required>${escapeHtml(post.content || "")}</textarea>
                <small>正文统计：<span data-word-count>0 字 / 词</span></small>
              </div>

              <div class="checkbox-row">
                <label class="checkbox">
                  <input name="published" type="checkbox" ${post.published ? "checked" : ""}>
                  <span>保存后直接发布</span>
                </label>
                <label class="checkbox">
                  <input name="featured" type="checkbox" ${post.featured ? "checked" : ""}>
                  <span>设为首页精选</span>
                </label>
              </div>

              <div class="editor-actions">
                <button class="button" type="submit">${isEditing ? "保存更新" : "创建文章"}</button>
                <a class="secondary-button" href="/admin/dashboard">取消</a>
              </div>
            </form>
          </article>

          <aside class="editor-note">
            <h3>写作提示</h3>
            <ul>
              <li>标题和正文是必填项，文章链接可以留空自动生成。</li>
              <li>勾选“保存后直接发布”后，首页会立即公开显示。</li>
              <li>勾选“设为首页精选”后，这篇文章会优先出现在首页头图区域。</li>
              <li>内容支持基础排版：\`##\` 小标题、\`-\` 列表、\`&gt;\` 引用、\`**文字**\` 加粗。</li>
            </ul>
          </aside>
        </section>
      </main>
    `,
    "admin-body"
  );
}

function renderSimplePage(site, title, body, bodyClass = "") {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(site.tagline)}">
  <link rel="stylesheet" href="/static/site.css">
</head>
<body class="${escapeHtml(bodyClass)}">
  <header class="site-header">
    <div class="site-header-inner">
      <a class="brand-mark" href="/">
        <span class="brand-dot">北</span>
        <span class="brand-copy">
          <strong>${escapeHtml(site.siteName)}</strong>
          <span>${escapeHtml(site.tagline)}</span>
        </span>
      </a>
      <nav class="site-nav">
        <a href="/#articles">文章</a>
        <a href="/#about">关于</a>
        <a href="/#projects">项目</a>
        <a href="/#contact">联系</a>
        <a href="/admin">后台</a>
      </nav>
    </div>
  </header>
  ${body}
  <footer class="site-footer">
    <div class="site-footer-inner">
      <div class="footer-brand">
        <strong>${escapeHtml(site.siteName)}</strong>
        <span>${escapeHtml(site.author.name)} · ${escapeHtml(site.author.role)}</span>
      </div>
      <div class="footer-note">Powered by Node.js built-ins · 动态博客</div>
    </div>
  </footer>
  <script src="/static/site.js"></script>
</body>
</html>`;
}
