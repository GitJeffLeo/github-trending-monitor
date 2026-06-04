import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 4173);
const NODE = "C:\\Users\\133\\.workbuddy\\binaries\\node\\versions\\22.12.0\\node.exe";

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"]
]);

function safePath(urlPath) {
  const requested = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath);
  const fullPath = normalize(join(ROOT, requested));
  if (!fullPath.startsWith(ROOT)) return null;
  return fullPath;
}

// 抓取锁：防止并发重复触发
let fetchLock = false;
let lastFetchResult = null;

function runFetchScript() {
  return new Promise((resolve) => {
    const child = spawn(NODE, [join(ROOT, "scripts", "fetch-github-trending.mjs")], {
      cwd: ROOT,
      env: { ...process.env }
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d; });
    child.stderr?.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      resolve({ code, stdout: stdout.slice(-3000), stderr: stderr.slice(-3000) });
    });
    child.on("error", (err) => {
      resolve({ code: -1, stdout, stderr: err.message });
    });
  });
}

createServer(async (request, response) => {
  const parsedUrl = new URL(request.url, `http://localhost:${PORT}`);
  const urlPath = parsedUrl.pathname;

  // POST /api/fetch — 触发抓取（异步执行）
  if (urlPath === "/api/fetch" && request.method === "POST") {
    if (fetchLock) {
      response.writeHead(429, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, message: "已有抓取任务正在运行，请稍候再试。" }));
      return;
    }

    fetchLock = true;
    response.writeHead(202, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, message: "抓取任务已启动" }));

    runFetchScript().then((result) => {
      lastFetchResult = { ...result, time: new Date().toISOString() };
      fetchLock = false;
    }).catch((err) => {
      lastFetchResult = { ok: false, error: err.message, time: new Date().toISOString() };
      fetchLock = false;
    });
    return;
  }

  // GET /api/fetch/status — 查询抓取状态
  if (urlPath === "/api/fetch/status" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ running: fetchLock, lastResult: lastFetchResult }));
    return;
  }

  // 静态文件服务
  try {
    const path = safePath(urlPath);
    if (!path) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const body = await readFile(path);
    response.writeHead(200, {
      "Content-Type": types.get(extname(path)) ?? "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(PORT, () => {
  console.log(`GitHub 黑马看板：http://localhost:${PORT}`);
});
