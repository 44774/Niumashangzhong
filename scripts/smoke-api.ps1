param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root "apps/api"
$stdout = Join-Path $root "api-smoke.log"
$stderr = Join-Path $root "api-smoke.err"

$built = Join-Path $apiDir "dist/server.js"
if (Test-Path $built) {
  $proc = Start-Process -FilePath "node" -ArgumentList "dist/server.js" `
    -WorkingDirectory $apiDir -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr
} else {
  $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "pnpm dev:api" `
    -WorkingDirectory $apiDir -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr
}

try {
  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $null = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/docs" -TimeoutSec 2
      $ready = $true
      break
    } catch {
      # 服务尚未就绪
    }
  }
  if (-not $ready) {
    Write-Error "API 未能在 10 秒内就绪"
  }

  $login = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/api/v1/auth/dev" `
    -ContentType "application/json" -Body '{"displayName":"冒烟测试"}' -TimeoutSec 10
  Write-Output "登录: $($login.user.displayName)"

  $headers = @{
    Authorization = "Bearer $($login.accessToken)"
    "X-Workspace-Id" = $login.workspace.id
  }
  $schedules = Invoke-RestMethod -Method Get `
    -Uri "http://127.0.0.1:$Port/api/v1/schedules?from=2026-08-01&to=2026-08-31" `
    -Headers $headers -TimeoutSec 10
  Write-Output "本月排班数量: $($schedules.Count)"
  Write-Output "冒烟测试通过"
} finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
