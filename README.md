# GitHub 黑马监测 🚀

每日自动抓取 GitHub Trending 数据，识别黑马项目（新入榜或排名飙升），生成中文报告。

## 在线使用

👉 **[点击查看最新报告](https://gitjeffleo.github.io/github-trending-monitor/)**

> 首次使用请手动开启 GitHub Actions（见下方部署说明）

## 功能特性

- 📈 **每日自动更新**：GitHub Actions 每天自动抓取并部署
- 🔥 **黑马识别**：自动标记新入榜和排名飙升的项目
- 🇨🇳 **中文概括**：AI 生成的项目中文描述
- 📊 **历史对比**：支持查看历史日期的数据快照
- 🌐 **纯前端**：无需安装，浏览器直接打开

## 本地运行

```bash
# 安装依赖
npm install

# 抓取今日数据
npm run fetch

# 生成报告
npm run build

# 启动本地服务
npm run serve
```

## 数据结构

```
data/
  ├── index.json          # 所有日期索引
  └── YYYY-MM-DD.json    # 每日快照
```

## 部署到 GitHub Pages

1. Fork 或推送此仓库到你的 GitHub
2. 进入仓库 Settings → Pages
3. Source 选择 "GitHub Actions"
4. 每天自动运行，或手动触发：Actions → Fetch GitHub Trending → Run workflow

## License

MIT
