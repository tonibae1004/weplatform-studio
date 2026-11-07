# WePlatform Studio - GitHub Pages deploy script (ASCII only, safe for Windows PowerShell 5.1)
# Run: powershell -ExecutionPolicy Bypass -File .\deploy.ps1
# Steps: create repo (if missing) -> push main -> enable Pages -> wait for the public URL

$ErrorActionPreference = "Continue"
$owner = "tonibae1004"
$repo  = "weplatform-studio"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }
Set-Location $PSScriptRoot

Write-Host "== 1/4 Check GitHub login" -ForegroundColor Cyan
& $gh auth status
if ($LASTEXITCODE -ne 0) { Write-Host "Run 'gh auth login' first." -ForegroundColor Red; exit 1 }

Write-Host "== 2/4 Create repository and push" -ForegroundColor Cyan
$null = & $gh repo view "$owner/$repo" --json name 2>&1
if ($LASTEXITCODE -ne 0) {
  & $gh repo create $repo --private --description "WePlatform Studio - Instagram/Reels/Shorts content automation (internal)"
  if ($LASTEXITCODE -ne 0) { Write-Host "Repository creation failed." -ForegroundColor Red; exit 1 }
}
$hasRemote = git remote get-url origin 2>$null
if (-not $hasRemote) { git remote add origin "https://github.com/$owner/$repo.git" }
git push -u origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Push failed." -ForegroundColor Red; exit 1 }

Write-Host "== 3/4 Enable GitHub Pages" -ForegroundColor Cyan
$null = & $gh api "repos/$owner/$repo/pages" 2>&1
if ($LASTEXITCODE -ne 0) {
  $null = & $gh api -X POST "repos/$owner/$repo/pages" -f "source[branch]=main" -f "source[path]=/" 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Pages is not available for private repos on this plan. Switching the repository to public." -ForegroundColor Yellow
    & $gh repo edit "$owner/$repo" --visibility public --accept-visibility-change-consequences
    $null = & $gh api -X POST "repos/$owner/$repo/pages" -f "source[branch]=main" -f "source[path]=/" 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "Enabling Pages failed." -ForegroundColor Red; exit 1 }
  }
}

Write-Host "== 4/4 Waiting for the site to go live" -ForegroundColor Cyan
$url = "https://$owner.github.io/$repo/"
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 10
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -eq 200 -and $r.Content -like "*WePlatform*") { Write-Host ""; Write-Host "DEPLOYED: $url" -ForegroundColor Green; Start-Process $url; exit 0 }
  } catch { Write-Host "  building... ($(($i+1)*10)s)" }
}
Write-Host "No response yet. Try $url in a minute or two. Status: https://github.com/$owner/$repo/settings/pages" -ForegroundColor Yellow
