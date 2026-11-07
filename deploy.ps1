# WePlatform Studio — GitHub Pages 배포 스크립트
# 실행: powershell -ExecutionPolicy Bypass -File .\deploy.ps1
# 하는 일: GitHub 저장소 생성(없으면) → main 푸시 → Pages 활성화 → 공개 URL 확인
# 비공개 저장소에서 Pages가 지원되지 않는 요금제면 저장소를 공개로 전환하고 다시 시도합니다.

$ErrorActionPreference = "Continue"
$owner = "tonibae1004"
$repo  = "weplatform-studio"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }
Set-Location $PSScriptRoot

Write-Host "== 1/4 GitHub 로그인 확인" -ForegroundColor Cyan
& $gh auth status
if ($LASTEXITCODE -ne 0) { Write-Host "gh auth login 으로 먼저 로그인하세요." -ForegroundColor Red; exit 1 }

Write-Host "== 2/4 저장소 생성 및 푸시" -ForegroundColor Cyan
$null = & $gh repo view "$owner/$repo" --json name 2>&1
if ($LASTEXITCODE -ne 0) {
  & $gh repo create $repo --private --description "WePlatform Studio - Instagram/Reels/Shorts content automation (internal)" --source=. --remote=origin --push
  if ($LASTEXITCODE -ne 0) { Write-Host "저장소 생성 실패" -ForegroundColor Red; exit 1 }
} else {
  $hasRemote = git remote get-url origin 2>$null
  if (-not $hasRemote) { git remote add origin "https://github.com/$owner/$repo.git" }
  git push -u origin main
}

Write-Host "== 3/4 GitHub Pages 활성화" -ForegroundColor Cyan
$null = & $gh api "repos/$owner/$repo/pages" 2>&1
if ($LASTEXITCODE -ne 0) {
  & $gh api -X POST "repos/$owner/$repo/pages" -f "source[branch]=main" -f "source[path]=/" --silent 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "비공개 저장소에서는 Pages를 켤 수 없는 요금제입니다. 저장소를 공개로 전환합니다." -ForegroundColor Yellow
    & $gh repo edit "$owner/$repo" --visibility public --accept-visibility-change-consequences
    & $gh api -X POST "repos/$owner/$repo/pages" -f "source[branch]=main" -f "source[path]=/" --silent
    if ($LASTEXITCODE -ne 0) { Write-Host "Pages 활성화 실패" -ForegroundColor Red; exit 1 }
  }
}

Write-Host "== 4/4 배포 완료 대기" -ForegroundColor Cyan
$url = "https://$owner.github.io/$repo/"
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 10
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -eq 200 -and $r.Content -like "*WePlatform*") { Write-Host ""; Write-Host "배포 완료: $url" -ForegroundColor Green; Start-Process $url; exit 0 }
  } catch { Write-Host "  빌드 중... ($(($i+1)*10)초)" }
}
Write-Host "아직 응답이 없습니다. 1~2분 뒤 $url 로 접속해 보세요. 상태: https://github.com/$owner/$repo/settings/pages" -ForegroundColor Yellow
