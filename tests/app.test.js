const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { once } = require("node:events");
const { spawn } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const ADMIN_USERNAME = "tester";
const ADMIN_PASSWORD = "secret-pass-123";

test("healthz returns ok after startup", async (t) => {
  const app = await startServer(t);
  const response = await fetch(`${app.baseUrl}/healthz`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, "ok");
  assert.equal(payload.provider, "file");
  assert.equal(payload.storageReady, true);
});

test("unauthenticated admin dashboard redirects to login", async (t) => {
  const app = await startServer(t);
  const response = await fetch(`${app.baseUrl}/admin/dashboard`, { redirect: "manual" });

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/admin");
});

test("admin login accepts valid credentials and rejects invalid ones", async (t) => {
  const app = await startServer(t);

  const failed = await postForm(`${app.baseUrl}/admin/login`, {
    username: ADMIN_USERNAME,
    password: "wrong-password"
  });
  assert.equal(failed.status, 401);

  const succeeded = await postForm(`${app.baseUrl}/admin/login`, {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD
  });

  assert.equal(succeeded.status, 303);
  assert.equal(succeeded.headers.get("location"), "/admin/dashboard?notice=%E7%99%BB%E5%BD%95%E6%88%90%E5%8A%9F%EF%BC%8C%E6%AC%A2%E8%BF%8E%E5%9B%9E%E6%9D%A5%E3%80%82");
  assert.ok(getSessionCookie(succeeded));
});

test("creating a published post persists it and shows it on the homepage", async (t) => {
  const app = await startServer(t);
  const cookie = await login(app.baseUrl);
  const title = "Automated regression post";
  const slug = "automated-regression-post";

  const response = await postForm(
    `${app.baseUrl}/admin/posts`,
    {
      title,
      slug,
      category: "Testing",
      tags: "automation, regression",
      summary: "A published post created from automated tests.",
      content: "## Smoke check\nThis post proves the create flow works.",
      published: "on"
    },
    cookie
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/admin/dashboard?notice=%E6%96%87%E7%AB%A0%E5%B7%B2%E5%88%9B%E5%BB%BA%E3%80%82");

  const homepage = await fetch(`${app.baseUrl}/`);
  const homepageHtml = await homepage.text();
  assert.match(homepageHtml, new RegExp(title));

  const savedPosts = JSON.parse(await fs.readFile(path.join(app.dataDir, "posts.json"), "utf8"));
  const savedPost = savedPosts.find((post) => post.slug === slug);

  assert.ok(savedPost);
  assert.equal(savedPost.published, true);
  assert.equal(savedPost.title, title);
});

test("site settings can update social links from the admin", async (t) => {
  const app = await startServer(t);
  const cookie = await login(app.baseUrl);

  const response = await postForm(
    `${app.baseUrl}/admin/site`,
    {
      authorEmail: "contact@example.com",
      socialLabel1: "GitHub",
      socialHref1: "https://github.com/159357hud-cloud",
      socialLabel2: "Email",
      socialHref2: "contact@example.com"
    },
    cookie
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/admin/site?notice=%E8%B4%A6%E5%8F%B7%E9%93%BE%E6%8E%A5%E5%B7%B2%E6%9B%B4%E6%96%B0%E3%80%82");

  const savedSite = JSON.parse(await fs.readFile(path.join(app.dataDir, "site.json"), "utf8"));
  assert.equal(savedSite.author.email, "contact@example.com");
  assert.deepEqual(savedSite.socialLinks, [
    { label: "GitHub", href: "https://github.com/159357hud-cloud" },
    { label: "Email", href: "mailto:contact@example.com" }
  ]);

  const homepage = await fetch(`${app.baseUrl}/`);
  const homepageHtml = await homepage.text();
  assert.match(homepageHtml, /https:\/\/github\.com\/159357hud-cloud/);
  assert.match(homepageHtml, /mailto:contact@example\.com/);
});

async function startServer(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "personal-blog-test-"));
  const port = await getAvailablePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      DATA_PROVIDER: "file",
      DATA_DIR: dataDir,
      ADMIN_USERNAME,
      ADMIN_PASSWORD,
      ADMIN_COOKIE_SECRET: "test-cookie-secret",
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const cleanup = async () => {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([once(child, "exit"), wait(2000)]);
    }

    await fs.rm(dataDir, { recursive: true, force: true });
  };

  t.after(cleanup);

  await waitForHealth(`http://127.0.0.1:${port}`, child, () => output);

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    dataDir
  };
}

async function waitForHealth(baseUrl, child, getOutput) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10000) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early.\n${getOutput()}`);
    }

    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) {
        const payload = await response.json();
        if (payload.storageReady) {
          return;
        }
      }
    } catch {
      // Server is still starting.
    }

    await wait(150);
  }

  throw new Error(`Server did not become healthy in time.\n${getOutput()}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAvailablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

async function login(baseUrl) {
  const response = await postForm(`${baseUrl}/admin/login`, {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD
  });
  const cookie = getSessionCookie(response);

  assert.ok(cookie, "Expected admin login to return a session cookie.");
  return cookie;
}

async function postForm(url, payload, cookie = "") {
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded"
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  return fetch(url, {
    method: "POST",
    redirect: "manual",
    headers,
    body: new URLSearchParams(payload)
  });
}

function getSessionCookie(response) {
  if (typeof response.headers.getSetCookie === "function") {
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) {
      return cookies[0].split(";")[0];
    }
  }

  const rawCookie = response.headers.get("set-cookie");
  return rawCookie ? rawCookie.split(";")[0] : "";
}
