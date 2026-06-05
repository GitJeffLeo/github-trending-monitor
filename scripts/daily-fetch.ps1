$ErrorActionPreference = "Stop"
Set-Location "D:\AIWorkSpace\github监测demo"
# WorkBuddy 管理的 Node，如不存在则回退到系统 PATH
$BundledNode = "C:\Users\133\.workbuddy\binaries\node\versions\22.22.2\node.exe"
$Node = if (Test-Path $BundledNode) { $BundledNode } else { "node" }
& $Node scripts/fetch-github-trending.mjs
& $Node scripts/build-report.mjs
