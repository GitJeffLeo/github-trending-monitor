import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summarize, tagLabel, generateBrowserEngineJSON } from "../lib/summaries.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(ROOT, "data");
const REPORT_FILE = resolve(ROOT, "report.html");
const SUMMARIES_FILE = resolve(DATA_DIR, "summaries.zh.json");

function reportFileName(snapshot) {
  const date = String(snapshot.date ?? "").replaceAll("-", ".");
  const topStars = snapshot.topRising?.[0]?.starsToday ?? 0;
  return `${date}飙升${topStars}⭐️Report.html`;
}

function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8"));
}

function rankChange(item) {
  if (item.isNewToday) return "新入榜";
  if (item.rankChange === 0) return "排名持平";
  if (item.rankChange > 0) return `上升 ${item.rankChange}`;
  if (item.rankChange < 0) return `下降 ${Math.abs(item.rankChange)}`;
  return "暂无昨日对比";
}

function tagBadges(tags) {
  if (!tags || tags.length === 0) return "";
  return `<div class="tag-badges">${tags.map((t) => `<span class="tag-badge">${tagLabel(t)}</span>`).join("")}</div>`;
}

function metaPills(item) {
  return [
    item.language || "Unknown",
    `${item.stars.toLocaleString("zh-CN")} stars`,
    `今日 +${item.starsToday.toLocaleString("zh-CN")}`,
    rankChange(item)
  ].map((text) => `<span>${escapeHtml(text)}</span>`).join("");
}

function risingCard(item, index, summaries) {
  const result = summarize(item.repo, item.name, item.description, item.language, summaries);
  return `
    <a class="rising-card ${index === 0 ? "primary" : ""}" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
      <div class="rising-topline">
        <span class="rank-badge">#${index + 1}</span>
        <strong>+${item.starsToday.toLocaleString("zh-CN")}</strong>
      </div>
      <h3>${escapeHtml(item.repo)}</h3>
      <p>${escapeHtml(result.summary)}</p>
      ${tagBadges(result.tags)}
      <div class="repo-meta">${metaPills(item)}</div>
    </a>`;
}

function tableRow(item, summaries) {
  const result = summarize(item.repo, item.name, item.description, item.language, summaries);
  return `
    <a class="rank-row ${item.isNewToday ? "is-new" : ""}" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
      <div class="rank-num">#${item.rank}</div>
      <div class="rank-main">
        <div class="repo-title">${escapeHtml(item.repo)}</div>
        <p class="use-case">${escapeHtml(result.summary)}${tagBadges(result.tags)}</p>
        <p class="repo-desc">${escapeHtml(item.description || "暂无英文简介")}</p>
      </div>
      <div class="rank-stats">
        <strong>${item.starsToday.toLocaleString("zh-CN")}</strong>
        <span>今日增星</span>
      </div>
      <div class="rank-stats">
        <strong>${item.stars.toLocaleString("zh-CN")}</strong>
        <span>总星数</span>
      </div>
      <div class="rank-change">${escapeHtml(rankChange(item))}</div>
    </a>`;
}

async function main() {
  const index = await readJson(resolve(DATA_DIR, "index.json"), { snapshots: [] });
  const latest = index.snapshots.at(-1);
  if (!latest) throw new Error("No snapshots found. Run fetch first.");

  const snapshot = await readJson(resolve(DATA_DIR, latest.file), null);
  const summaries = await readJson(SUMMARIES_FILE, {});
  const repos = snapshot.repositories ?? [];
  const css = await readFile(resolve(ROOT, "styles.css"), "utf8");
  const topRising = snapshot.topRising ?? [];
  const topTen = snapshot.topTen ?? [];
  const datedReportFile = resolve(ROOT, reportFileName(snapshot));

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>GitHub 黑马监测 - ${escapeHtml(snapshot.date)}</title>
    <style>${css}</style>
  </head>
  <body>
    <main class="shell">
      <header class="topbar report-hero">
        <div>
          <p class="eyebrow">Daily GitHub Creative Radar</p>
          <h1>GitHub 黑马监测</h1>
          <p>${escapeHtml(snapshot.date)} 采集自 GitHub Trending Daily，重点观察今天突然冒头的项目和创意方向。</p>
        </div>
        <div class="date-card">
          <span>最新记录</span>
          <strong>${escapeHtml(snapshot.date)}</strong>
        </div>
      </header>

      <section class="metrics" aria-label="今日概览">
        <div><span>记录项目</span><strong>${repos.length.toLocaleString("zh-CN")}</strong></div>
        <div><span>新入榜</span><strong>${repos.filter((item) => item.isNewToday).length.toLocaleString("zh-CN")}</strong></div>
        <div><span>最高日增星</span><strong>${Math.max(...repos.map((item) => item.starsToday), 0).toLocaleString("zh-CN")}</strong></div>
      </section>

      <section class="rising-section">
        <div class="section-head">
          <div>
            <h2>星数飙升前五</h2>
            <p>今天最值得先扫一眼的五个项目。</p>
          </div>
          <span>按今日新增星数排序</span>
        </div>
        <div class="rising-grid">${topRising.map((item, index) => risingCard(item, index, summaries)).join("")}</div>
      </section>

      <section class="ranking-section">
        <div class="section-head">
          <div>
            <h2>当天排名前十</h2>
            <p>每个项目都补了一句中文用途概括，先看它能解决什么问题。</p>
          </div>
          <span>GitHub Trending Daily</span>
        </div>
        <div class="rank-table">${topTen.map((item) => tableRow(item, summaries)).join("")}</div>
      </section>

      <section class="history-panel">
        <div class="section-head">
          <div>
            <h2>每日记录</h2>
            <p>后续会按日期积累，方便观察项目热度和创意方向的变化。</p>
          </div>
          <span>${index.snapshots.length.toLocaleString("zh-CN")} 天</span>
        </div>
        <div class="history">${index.snapshots.slice().reverse().map((item) => `<span class="history-item ${item.date === snapshot.date ? "active" : ""}">${escapeHtml(item.date)}</span>`).join("")}</div>
      </section>

      <footer class="report-footer">
        <p>*报告生成时间：${escapeHtml(formatDateTime(new Date()))}*</p>
      </footer>
    </main>
  </body>
</html>`;

  await writeFile(datedReportFile, html, "utf8");
  await writeFile(REPORT_FILE, html, "utf8");
  console.log(`Built ${datedReportFile}`);
  console.log(`Updated ${REPORT_FILE}`);

  // 生成前端用的规则快照
  const docsDataDir = resolve(ROOT, "docs", "data");
  await mkdir(docsDataDir, { recursive: true });
  const engineJSON = generateBrowserEngineJSON();
  await writeFile(
    resolve(docsDataDir, "summaries-engine.json"),
    JSON.stringify(engineJSON, null, 2),
    "utf8"
  );
  console.log(`Generated docs/data/summaries-engine.json (${engineJSON.categoryRules.length} rules)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
