import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(ROOT, "data");
const INDEX_FILE = resolve(DATA_DIR, "index.json");
const TRENDING_URL = "https://github.com/trending?since=daily";

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "github-rising-stars-watch/1.0",
      "Accept": "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseNumber(value) {
  if (!value) return 0;
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

function parseTrending(html) {
  const articleMatches = [...html.matchAll(/<article class="Box-row">([\s\S]*?)<\/article>/g)];

  return articleMatches.slice(0, 25).map((match, index) => {
    const article = match[1];
    const repoMatch = article.match(/<h2[\s\S]*?<a[^>]+href="\/([^"]+)"[\s\S]*?<\/a>/);
    const repoPath = repoMatch ? repoMatch[1].replace(/\s/g, "") : "";
    const [owner = "", name = ""] = repoPath.split("/");

    const descriptionMatch = article.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const languageMatch = article.match(/<span[^>]*itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/);
    const starsMatch = article.match(/href="\/[^"]+\/stargazers"[\s\S]*?>([\s\S]*?)<\/a>/);
    const forksMatch = article.match(/href="\/[^"]+\/forks"[\s\S]*?>([\s\S]*?)<\/a>/);
    const starsTodayMatch = article.match(/(\d[\d,]*)\s+stars?\s+today/i);

    return {
      rank: index + 1,
      owner,
      name,
      repo: repoPath,
      url: `https://github.com/${repoPath}`,
      description: descriptionMatch ? stripTags(descriptionMatch[1]) : "",
      language: languageMatch ? stripTags(languageMatch[1]) : "Unknown",
      stars: starsMatch ? parseNumber(stripTags(starsMatch[1])) : 0,
      forks: forksMatch ? parseNumber(stripTags(forksMatch[1])) : 0,
      starsToday: starsTodayMatch ? parseNumber(starsTodayMatch[1]) : 0
    };
  }).filter((item) => item.repo);
}

async function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8"));
}

// 滑动窗口天数：仓库在此天数内出现过则不标记为"新入榜"
const WINDOW_DAYS = 7;

/**
 * 加载最近 windowDays 天内出现过的所有仓库集合，
 * 以及最新一天的完整数据（用于 rank/stars 增量计算）。
 */
async function loadWindowState(index, today) {
  const pastSnapshots = (index.snapshots ?? [])
    .filter((s) => s.date !== today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const windowSnapshots = pastSnapshots.slice(-WINDOW_DAYS);

  // 构建窗口内出现过的仓库集合
  const recentlySeen = new Set();
  for (const snap of windowSnapshots) {
    const data = await readJson(
      resolve(DATA_DIR, snap.file),
      { repositories: [] }
    );
    for (const repo of (data.repositories || [])) {
      recentlySeen.add(repo.repo);
    }
  }

  // 最新一天的数据用于 rank/stars 增量
  const latestSnap = windowSnapshots.at(-1);
  let latestItems = [];
  if (latestSnap) {
    const latestData = await readJson(
      resolve(DATA_DIR, latestSnap.file),
      { repositories: [] }
    );
    latestItems = latestData.repositories || [];
  }

  return { recentlySeen, latestItems };
}

function buildComparison(items, latestItems, recentlySeen) {
  const previousByRepo = new Map(latestItems.map((item) => [item.repo, item]));

  return items.map((item) => {
    const previous = previousByRepo.get(item.repo);
    return {
      ...item,
      previousRank: previous?.rank ?? null,
      rankChange: previous ? previous.rank - item.rank : null,
      starChangeSinceLastSnapshot: previous ? item.stars - previous.stars : null,
      // 关键改动：使用 7 天滑动窗口判定"新入榜"
      isNewToday: !recentlySeen.has(item.repo)
    };
  });
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const html = await fetchText(TRENDING_URL);
  const items = parseTrending(html);

  if (items.length === 0) {
    throw new Error("No trending repositories were parsed from GitHub.");
  }

  const index = await readJson(INDEX_FILE, { snapshots: [] });
  const { recentlySeen, latestItems } = await loadWindowState(index, today);

  const repositories = buildComparison(items, latestItems, recentlySeen);
  const snapshot = {
    date: today,
    source: TRENDING_URL,
    capturedAt: new Date().toISOString(),
    topRising: [...repositories].sort((a, b) => b.starsToday - a.starsToday).slice(0, 5),
    topTen: repositories.slice(0, 10),
    repositories
  };

  await writeFile(resolve(DATA_DIR, `${today}.json`), JSON.stringify(snapshot, null, 2), "utf8");

  const nextIndex = {
    snapshots: [
      ...index.snapshots.filter((item) => item.date !== today),
      { date: today, file: `${today}.json`, capturedAt: snapshot.capturedAt }
    ].sort((a, b) => a.date.localeCompare(b.date))
  };

  await writeFile(INDEX_FILE, JSON.stringify(nextIndex, null, 2), "utf8");
  console.log(`Saved ${repositories.length} repositories to data/${today}.json`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
