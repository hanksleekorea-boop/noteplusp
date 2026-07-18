Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ToolVersion = '1.13.1'
$ToolUrl = 'https://github.com/vzhd1701/evernote-backup/releases/download/1.13.1/bin_evernote_backup_1.13.1_win_x64.zip'
$ToolSha256 = '2C1DAA36FADF5720419826B0809617029D14941E4EADFFA31049457D413B81B5'
$PublicApp = 'https://hanksleekorea-boop.github.io/noteplusp/'
$Documents = [Environment]::GetFolderPath('MyDocuments')
$BackupRoot = Join-Path $Documents 'NotePlusP-Evernote-Backup'
$ToolRoot = Join-Path $BackupRoot ('tool-' + $ToolVersion)
$ZipPath = Join-Path $BackupRoot ('evernote-backup-' + $ToolVersion + '.zip')
$DatabasePath = Join-Path $BackupRoot 'en_backup.db'
$OutputRoot = Join-Path $BackupRoot 'ENEX'

function Show-Step([string]$Text) {
  Write-Host ''
  Write-Host ('▶ ' + $Text) -ForegroundColor Green
}

function Stop-Safely([string]$Message) {
  Write-Host ''
  Write-Host $Message -ForegroundColor Red
  Write-Host '기존 Evernote 데이터와 이미 만든 백업은 변경하거나 삭제하지 않았습니다.' -ForegroundColor Yellow
  Read-Host 'Enter를 누르면 닫힙니다'
  exit 1
}

Write-Host '노트플러스P · Evernote 전체 자동 백업 도우미' -ForegroundColor Green
Write-Host '표준 노트·노트북·태그·첨부를 PC로 동기화한 뒤 노트북별 ENEX를 만듭니다.'
Write-Host '이 고급 경로는 오픈소스 evernote-backup을 사용하며 Evernote 공식 기능이 아닙니다.' -ForegroundColor Yellow
Write-Host 'Evernote 작업·알림은 공개 API 제한으로 완전하지 않을 수 있으므로 중요한 항목은 Evernote 앱에서도 별도 확인하세요.' -ForegroundColor Yellow
Write-Host 'Evernote 비밀번호는 이 스크립트에 입력하거나 저장하지 않습니다. 로그인은 브라우저 OAuth 화면에서 진행됩니다.'

$Consent = Read-Host '계속하려면 전체백업 이라고 입력하세요'
if ($Consent -ne '전체백업') { Stop-Safely '사용자가 취소했습니다.' }

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

$Exe = Get-ChildItem -LiteralPath $ToolRoot -Filter 'evernote-backup.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $Exe) {
  Show-Step '검증된 Windows 백업 도구를 내려받습니다.'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $ToolUrl -OutFile $ZipPath -UseBasicParsing
  $ActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ZipPath).Hash.ToUpperInvariant()
  if ($ActualHash -ne $ToolSha256) {
    Remove-Item -LiteralPath $ZipPath -Force -ErrorAction SilentlyContinue
    Stop-Safely ('다운로드 무결성 확인에 실패했습니다. 실행하지 않았습니다. 실제 SHA-256: ' + $ActualHash)
  }
  New-Item -ItemType Directory -Path $ToolRoot -Force | Out-Null
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $ToolRoot -Force
  Remove-Item -LiteralPath $ZipPath -Force
  $Exe = Get-ChildItem -LiteralPath $ToolRoot -Filter 'evernote-backup.exe' -Recurse | Select-Object -First 1
}
if (-not $Exe) { Stop-Safely 'evernote-backup.exe를 준비하지 못했습니다.' }

Push-Location $BackupRoot
try {
  if (-not (Test-Path -LiteralPath $DatabasePath)) {
    Show-Step '처음 한 번만 Evernote 계정을 연결합니다. 브라우저 로그인 화면을 완료하세요.'
    & $Exe.FullName init-db
    if ($LASTEXITCODE -ne 0) { Stop-Safely 'Evernote 계정 연결을 완료하지 못했습니다.' }
  }

  Show-Step 'Evernote의 최신 노트와 첨부를 PC의 로컬 백업 DB로 동기화합니다.'
  & $Exe.FullName sync
  if ($LASTEXITCODE -ne 0) { Stop-Safely '동기화가 완료되지 않았습니다. 다시 실행하면 중단 지점부터 이어갈 수 있습니다.' }

  $Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $ExportDir = Join-Path $OutputRoot $Stamp
  New-Item -ItemType Directory -Path $ExportDir -Force | Out-Null
  Show-Step '모든 노트북을 ENEX 파일로 내보냅니다.'
  & $Exe.FullName export --include-trash $ExportDir
  if ($LASTEXITCODE -ne 0) { Stop-Safely 'ENEX 생성이 완료되지 않았습니다. 로컬 백업 DB는 그대로 보존됩니다.' }

  $EnexFiles = @(Get-ChildItem -LiteralPath $ExportDir -Filter '*.enex' -File)
  if ($EnexFiles.Count -eq 0) { Stop-Safely '생성된 ENEX 파일이 없습니다. 동기화 결과를 확인하세요.' }
  $TotalBytes = ($EnexFiles | Measure-Object -Property Length -Sum).Sum
  $Report = @(
    '노트플러스P Evernote 전체 백업 결과'
    ('완료 시각: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
    ('도구 버전: evernote-backup ' + $ToolVersion)
    ('ENEX 파일 수: ' + $EnexFiles.Count)
    ('ENEX 전체 크기: ' + $TotalBytes + ' bytes')
    ('로컬 백업 DB: ' + $DatabasePath)
    ('ENEX 폴더: ' + $ExportDir)
    ''
    '주의: Evernote 작업·알림은 공개 API 제한으로 완전하지 않을 수 있습니다.'
    '확인이 끝날 때까지 Evernote 원본, en_backup.db, ENEX 폴더를 삭제하지 마세요.'
  )
  $ReportPath = Join-Path $ExportDir '백업결과.txt'
  $Report | Set-Content -LiteralPath $ReportPath -Encoding UTF8

  Write-Host ''
  Write-Host ('완료: ENEX ' + $EnexFiles.Count + '개를 만들었습니다.') -ForegroundColor Green
  Write-Host ('저장 위치: ' + $ExportDir)
  Write-Host '노트플러스P에서 “전체 이전 시작 → 백업 폴더 전체 선택”을 누르세요.'
  Start-Process explorer.exe -ArgumentList ('"' + $ExportDir + '"')
  Start-Process $PublicApp
  Read-Host 'Enter를 누르면 닫힙니다'
}
finally {
  Pop-Location
}
