[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tests = @(
    "tools/check_project_history.mjs",
    "tools/check_plan_v12_adopted.mjs",
    "tests/test_v22_account_boundary_v1.mjs",
    "tests/test_v22_content_stage1_v1.mjs",
    "tests/test_v22_advanced_workspace_v1.mjs",
    "tests/test_v22_advanced_recovery_v1.mjs",
    "tests/test_v22_stage3_contracts_v1.mjs",
    "tests/test_v22_quick_capture_v1.mjs",
    "tests/test_v22_personal_workspace_v1.mjs",
    "tests/test_v22_search_explanation_v1.mjs",
    "tests/test_v22_backlink_discovery_v1.mjs",
    "tests/test_v22_performance_budget_v1.mjs",
    "tests/test_v22_telemetry_privacy_v1.mjs",
    "tests/test_v22_release_contract_v1.mjs",
    "tests/test_v22_release_gate_v1.mjs",
    "tests/test_v22_commercial_pages_v1.mjs",
    "tests/test_v22_release_evidence_audit_v1.mjs",
    "tests/test_v22_android_talkback_preflight_v1.mjs",
    "tests/test_v22_cross_device_drive_preflight_v1.mjs",
    "tests/test_physical_cross_device_v22_drive_real_contract_v1.mjs",
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
