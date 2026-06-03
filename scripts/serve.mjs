import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 4173);

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

createServer(async (request, response) => {
  try {
    const path = safePath(new URL(request.url, `http://localhost:${PORT}`).pathname);
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
