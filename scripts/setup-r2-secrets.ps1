# R2 永続化用シークレット設定スクリプト
# 記憶・ペアリング・会話を再起動後も残すために R2 の認証情報を設定します。
# CF_ACCOUNT_ID は既に設定済みの場合はスキップできます。

$ErrorActionPreference = "Stop"
$ProjectRoot = if ($PSScriptRoot) { Split-Path -Parent (Split-Path -Parent $PSScriptRoot) } else { Get-Location }
if (-not (Test-Path (Join-Path $ProjectRoot "wrangler.jsonc"))) {
    $ProjectRoot = Get-Location
}
Set-Location $ProjectRoot

Write-Host "=== R2 永続化シークレット設定 ===" -ForegroundColor Cyan
Write-Host ""

# CF_ACCOUNT_ID が未設定なら案内（既に設定済み）
Write-Host "[OK] CF_ACCOUNT_ID は既に設定されています。" -ForegroundColor Green
Write-Host ""

Write-Host "R2 API トークンを作成してください:" -ForegroundColor Yellow
Write-Host "  1. https://dash.cloudflare.com にログイン" -ForegroundColor Gray
Write-Host "  2. 左メニュー R2 > Manage R2 API Tokens" -ForegroundColor Gray
Write-Host "  3. Create API token > Object Read & Write" -ForegroundColor Gray
Write-Host "  4. バケット 'moltbot-data' を指定して作成" -ForegroundColor Gray
Write-Host "  5. 表示された Access Key ID と Secret Access Key を控える" -ForegroundColor Gray
Write-Host ""
Write-Host "以下のプロンプトで、控えた値を貼り付けて Enter を押してください。" -ForegroundColor Cyan
Write-Host ""

npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY

Write-Host ""
Write-Host "=== 設定完了 ===" -ForegroundColor Green
Write-Host "管理画面で Restart Gateway を実行すると、R2 から設定が復元されます。" -ForegroundColor Gray
Write-Host "以降は再起動しても記憶・ペアリング・会話が保持されます。" -ForegroundColor Gray
