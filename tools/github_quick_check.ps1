[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tests = @(
    "tools/check_plan_v12_adopted.mjs",
    "tests/test_v22_release_contract_v1.mjs",
    "tests/test_v22_release_gate_v1.mjs",
    "tests/test_v22_commercial_pages_v1.mjs",
    "tests/test_v22_release_evidence_audit_v1.mjs",
    "tests/test_firebase_activation_packet_v1.mjs",
    "tests/test_v21_release_contract_v1.mjs",
    "tests/test_v21_drive_recovery_policy_v1.mjs",
    "tests/test_v20_parallel_upload_execution_v1.mjs",
    "tests/test_v19_drive_upload_protocol_v1.mjs"
)

if ($tests.Count -eq 0) { throw "Test list is empty." }
$node = (Get-Command node -ErrorAction Stop).Source
$failed = 0
foreach ($relative in $tests) {
    $path = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $path)) { throw "Test file is missing: $relative" }
    Write-Output "RUN $relative"
    & $node $path
    if ($LASTEXITCODE -ne 0) { $failed += 1 }
}

Write-Output "QUICK_RESULT tests=$($tests.Count) failed=$failed"
if ($failed -ne 0) { exit 1 }
