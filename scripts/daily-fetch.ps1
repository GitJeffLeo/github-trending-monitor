# daily-fetch.ps1 — 每日自动抓取 GitHub Trending 并生成报告
# 用法：
#   手动运行：  powershell -ExecutionPolicy Bypass -File "D:\AIWorkSpace\github监测demo\scripts\daily-fetch.ps1"
#   定时任务：  在 Windows 任务计划器中创建每日触发任务即可
#
# 输出：
#   data/YYYY-MM-DD.json          — 每日快照
#   report.html                   — 最新静态报告
#   YYYY.MM.DD飙升N⭐️Report.html  — 带日期的归档报告
#   docs/                         — 同步部署目录

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$DataDir = Join-Path $ProjectRoot "data"
$DocsDataDir = Join-Path $ProjectRoot "docs\data"
$LogFile = Join-Path $ProjectRoot "fetch.log"

# 查找 node 可执行文件
$NodeExe = $null
$KnownPaths = @(
    "node",                                                                   # PATH 中的 node
    "C:\Users\133\.workbuddy\binaries\node\versions\22.22.2\node.exe",       # WorkBuddy
    "$env:LOCALAPPDATA\fnm_multishells\default\node.exe",                     # fnm
    "$env:APPDATA\nvm\current\node.exe",                                      # nvm-windows
    "$env:USERPROFILE\.nvm\versions\node\default\node.exe",                   # nvm
    "C:\Program Files\nodejs\node.exe"                                        # 系统安装
)

foreach ($p in $KnownPaths) {
    try {
        $null = & $p --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            $NodeExe = $p
            break
        }
    } catch { }
}

if (-not $NodeExe) {
    $msg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: Cannot find Node.js"
    Write-Error $msg
    Add-Content -Path $LogFile -Value $msg -Encoding utf8
    exit 1
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logLines = @()
$logLines += "=" * 50
$logLines += "[$timestamp] 开始每日抓取（Node: $NodeExe）"

Push-Location $ProjectRoot
try {
    # 步骤 1：抓取今日数据
    $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 步骤 1/3：抓取 GitHub Trending..."
    $fetchResult = & $NodeExe scripts/fetch-github-trending.mjs 2>&1
    if ($LASTEXITCODE -ne 0) {
        $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] FAIL 抓取失败：$fetchResult"
        throw "Fetch failed"
    }
    $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] OK 抓取完成：$fetchResult"

    # 步骤 2：生成报告
    $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 步骤 2/3：生成 HTML 报告..."
    $buildResult = & $NodeExe scripts/build-report.mjs 2>&1
    if ($LASTEXITCODE -ne 0) {
        $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] WARN 报告生成警告：$buildResult"
    } else {
        $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] OK 报告生成完成：$buildResult"
    }

    # 步骤 3：同步到 docs 目录
    $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 步骤 3/3：同步 docs/ 目录..."
    if (Test-Path $DocsDataDir) {
        Copy-Item "$DataDir\*.json" $DocsDataDir -Force -ErrorAction SilentlyContinue
        Copy-Item "$ProjectRoot\github-trending-standalone.html" "$ProjectRoot\docs\index.html" -Force -ErrorAction SilentlyContinue
        Copy-Item "$ProjectRoot\report.html" "$ProjectRoot\docs\report.html" -Force -ErrorAction SilentlyContinue
        $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] OK docs/ 同步完成"
    }

    $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] SUCCESS 全部完成！"
}
catch {
    $logLines += "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] FAIL 任务中断：$_"
}
finally {
    Pop-Location
}

$output = $logLines -join "`n"
Write-Output $output
Add-Content -Path $LogFile -Value $output -Encoding utf8
