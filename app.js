const dateSelect = document.querySelector("#dateSelect");
const subtitle = document.querySelector("#subtitle");
const repoCount = document.querySelector("#repoCount");
const newCount = document.querySelector("#newCount");
const maxStarsToday = document.querySelector("#maxStarsToday");
const risingList = document.querySelector("#risingList");
const topTenList = document.querySelector("#topTenList");
const historyList = document.querySelector("#historyList");
const historyCount = document.querySelector("#historyCount");

const formatter = new Intl.NumberFormat("zh-CN");
let summaries = {};

async function getJson(path, fallback = null) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    if (fallback !== null) return fallback;
    throw new Error(`Cannot load ${path}`);
  }
  return response.json();
}

function formatRankChange(item) {
  if (item.isNewToday) return "新入榜";
  if (item.rankChange === 0) return "排名持平";
  if (item.rankChange > 0) return `上升 ${item.rankChange}`;
  if (item.rankChange < 0) return `下降 ${Math.abs(item.rankChange)}`;
  return "暂无昨日对比";
}

function summarizeUse(item) {
  if (summaries[item.repo]) return summaries[item.repo];

  const text = `${item.name} ${item.description}`.toLowerCase();
  if (text.includes("markdown")) return "这个项目主要用于把文件或内容转换成 Markdown，方便后续整理、检索和交给 AI 处理。";
  if (text.includes("pdf")) return "这个项目围绕 PDF 解析和内容抽取，适合把文档资料整理成更适合自动化处理的数据。";
  if (text.includes("agent")) return "这个项目围绕 AI Agent 构建，可能用于自动完成任务、增强代理能力或提供更自然的交互体验。";
  if (text.includes("scrap") || text.includes("crawl")) return "这个项目主要用于网页抓取和数据采集，适合把网站内容批量整理成可分析的数据。";
  if (text.includes("security") || text.includes("vulnerab")) return "这个项目偏安全工具方向，用来发现漏洞、配置风险或代码与基础设施中的安全问题。";
  if (text.includes("llm") || text.includes("model")) return "这个项目服务于大模型应用，可能用于模型调用、推理优化、上下文处理或交互体验改进。";
  if (text.includes("business") || text.includes("crm")) return "这个项目偏业务系统方向，适合支撑企业管理、销售、客户关系或内部流程。";

  return `这个 ${item.language || "开源"} 项目正在获得关注，主题与「${item.name}」相关；建议点开仓库进一步确认具体使用场景。`;
}

function metaPills(item) {
  const meta = [
    item.language || "Unknown",
    `${formatter.format(item.stars)} stars`,
    `今日 +${formatter.format(item.starsToday)}`,
    formatRankChange(item)
  ];

  return meta.map((value) => `<span>${value}</span>`).join("");
}

function createRisingCard(item, index) {
  const node = document.createElement("a");
  node.className = `rising-card${index === 0 ? " primary" : ""}`;
  node.href = item.url;
  node.target = "_blank";
  node.rel = "noreferrer";
  node.innerHTML = `
    <div class="rising-topline">
      <span class="rank-badge">#${index + 1}</span>
      <strong>+${formatter.format(item.starsToday)}</strong>
    </div>
    <h3></h3>
    <p></p>
    <div class="repo-meta">${metaPills(item)}</div>
  `;
  node.querySelector("h3").textContent = item.repo;
  node.querySelector("p").textContent = summarizeUse(item);
  return node;
}

function createRankRow(item) {
  const node = document.createElement("a");
  node.className = `rank-row${item.isNewToday ? " is-new" : ""}`;
  node.href = item.url;
  node.target = "_blank";
  node.rel = "noreferrer";
  node.innerHTML = `
    <div class="rank-num">#${item.rank}</div>
    <div class="rank-main">
      <div class="repo-title"></div>
      <p class="use-case"></p>
      <p class="repo-desc"></p>
    </div>
    <div class="rank-stats">
      <strong>${formatter.format(item.starsToday)}</strong>
      <span>今日增星</span>
    </div>
    <div class="rank-stats">
      <strong>${formatter.format(item.stars)}</strong>
      <span>总星数</span>
    </div>
    <div class="rank-change">${formatRankChange(item)}</div>
  `;
  node.querySelector(".repo-title").textContent = item.repo;
  node.querySelector(".use-case").textContent = summarizeUse(item);
  node.querySelector(".repo-desc").textContent = item.description || "暂无英文简介";
  return node;
}

function renderHistory(index, selectedDate) {
  historyCount.textContent = `${formatter.format(index.snapshots.length)} 天`;
  historyList.replaceChildren(...index.snapshots.slice().reverse().map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = item.date === selectedDate ? "history-item active" : "history-item";
    button.textContent = item.date;
    button.addEventListener("click", () => {
      dateSelect.value = item.date;
      loadSnapshot(item.date, index);
    });
    return button;
  }));
}

async function loadSnapshot(date, index) {
  const snapshot = await getJson(`./data/${date}.json`);
  const repos = snapshot.repositories ?? [];
  const newest = index.snapshots.at(-1)?.date;

  subtitle.textContent = `${snapshot.date} 采集自 GitHub Trending Daily，重点观察今天突然冒头的项目和创意方向${date === newest ? "，当前最新" : ""}。`;
  repoCount.textContent = formatter.format(repos.length);
  newCount.textContent = formatter.format(repos.filter((item) => item.isNewToday).length);
  maxStarsToday.textContent = formatter.format(Math.max(...repos.map((item) => item.starsToday), 0));

  risingList.replaceChildren(...(snapshot.topRising ?? []).map((item, index) => createRisingCard(item, index)));
  topTenList.replaceChildren(...(snapshot.topTen ?? []).map((item) => createRankRow(item)));
  renderHistory(index, date);
}

async function init() {
  try {
    const index = await getJson("./data/index.json");
    summaries = await getJson("./data/summaries.zh.json", {});
    const snapshots = index.snapshots ?? [];

    if (snapshots.length === 0) {
      subtitle.textContent = "还没有记录，先运行一次采集。";
      dateSelect.innerHTML = "<option>暂无数据</option>";
      return;
    }

    dateSelect.replaceChildren(...snapshots.map((item) => {
      const option = document.createElement("option");
      option.value = item.date;
      option.textContent = item.date;
      return option;
    }));

    const latest = snapshots.at(-1).date;
    dateSelect.value = latest;
    dateSelect.addEventListener("change", () => loadSnapshot(dateSelect.value, index));
    await loadSnapshot(latest, index);
  } catch (error) {
    subtitle.textContent = "读取记录失败，请确认已经采集过数据。";
    console.error(error);
  }
}

init();
