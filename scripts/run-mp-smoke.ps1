$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root "apps/api"
$stdout = Join-Path $root "api-smoke.log"
$stderr = Join-Path $root "api-smoke.err"

$api = Start-Process -FilePath "node" -ArgumentList "dist/server.js" `
  -WorkingDirectory $apiDir -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $stdout -RedirectStandardError $stderr

try {
  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $null = Invoke-WebRequest -Uri "http://127.0.0.1:3000/docs" -TimeoutSec 2
      $ready = $true
      break
    } catch {
      # 服务尚未就绪
    }
  }
  if (-not $ready) {
    Write-Error "API 未能在 10 秒内就绪，请先执行 pnpm build"
  }

  node (Join-Path $root "scripts/miniprogram-smoke.mjs")
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
}
