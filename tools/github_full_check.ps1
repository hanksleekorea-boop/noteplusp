[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dirtyBefore = & git -C $root status --porcelain
if (-not [string]::IsNullOrWhiteSpace(($dirtyBefore -join "`n"))) {
    throw "전체 검사는 깨끗한 작업 폴더에서만 실행합니다."
}

$runtimeCandidates = @(@(
    $env:NOTEPLUS_PLAYWRIGHT,
    (Join-Path $env:USERPROFILE ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) })
if ($runtimeCandidates.Count -eq 0) { throw "playwright-core 경로를 찾지 못했습니다. NOTEPLUS_PLAYWRIGHT를 지정하세요." }
$env:NOTEPLUS_PLAYWRIGHT = $runtimeCandidates[0]

$tests = @(
    "tests/test_cloud_manifest_10000_v1.mjs",
    "tests/test_cloud_restore_preflight_v1.mjs",
    "tests/test_enex_duplicate_attachment_protection_v1.mjs",
    "tests/test_enex_hashless_attachment_v1.mjs",
    "tests/test_enex_streaming_parser_v1.mjs",
    "tests/test_enex_streaming_memory_boundary_v1.mjs",
    "tests/test_enex_abort_retry_cleanup_v1.mjs",
    "tests/test_enex_hostile_html_rotation_v1.mjs",
    "tests/test_firebase_activation_packet_v1.mjs",
    "tests/test_firebase_config_v17_v1.mjs",
    "tests/test_google_cloud_security_static_v1.mjs",
    "tests/test_google_cloud_v16_static_v1.mjs",
    "tests/test_google_mobile_login_v1.mjs",
    "tests/test_google_pc_backup_no_loss_v1.mjs",
    "tests/test_google_pc_restore_no_loss_v1.mjs",
    "tests/test_harness_runtime_resolution_v1.mjs",
    "tests/test_restore_manifest_corruption_guard_v1.mjs",
    "tests/test_v17_versioned_loader_v1.mjs",
    "tests/test_v18_google_drive_static_v1.mjs",
    "tests/test_v19_drive_resumable_candidate_v1.mjs",
    "tests/test_v19_drive_upload_protocol_v1.mjs",
    "tests/test_v20_parallel_progress_v1.mjs",
    "tests/test_v20_parallel_upload_execution_v1.mjs",
    "tests/test_v20_resumable_retry_v1.mjs",
    "tests/test_v21_drive_recovery_policy_v1.mjs",
    "tests/test_v21_drive_disconnect_resume_v1.mjs",
    "tests/test_v21_existing_user_upgrade_v1.mjs",
    "tests/test_v21_loader_failure_safety_v1.mjs",
    "tests/test_v21_worker_cache_isolation_v1.mjs",
    "tests/test_v21_release_contract_v1.mjs",
    "tests/test_v21_responsive_layout_v1.mjs",
    "tests/test_v21_pc_mobile_browser_matrix_v1.mjs",
    "tests/test_v21_offline_save_idempotency_v1.mjs",
    "tests/test_virtual_persona_snapshot_safety_v1.mjs",
    "tests/test_v22_release_contract_v1.mjs",
    "tests/test_v22_release_browser_v1.mjs",
    "tests/test_v22_onboarding_first_value_v1.mjs",
    "tests/test_v22_existing_user_onboarding_guard_v1.mjs",
    "tests/test_v22_existing_personas_v1.mjs",
    "tests/test_v22_sync_status_v1.mjs",
    "tests/test_v22_restore_conflict_v1.mjs",
    "tests/test_v22_cloud_vault_roundtrip_v1.mjs",
    "tests/test_v22_migration_certificate_v1.mjs",
    "tests/test_v22_import_commit_barrier_v1.mjs",
    "tests/test_v22_portable_roundtrip_v1.mjs",
    "tests/test_v22_large_stream_v1.mjs",
    "tests/test_v22_library_10000_v1.mjs",
    "tests/test_v22_attachment_stream_v1.mjs",
    "tests/test_v22_safety_boundaries_v1.mjs",
    "tests/test_v22_accessibility_v1.mjs",
    "tests/test_v22_commercial_pages_v1.mjs",
    "tests/test_v22_release_gate_v1.mjs",
    "tests/test_v22_device_compare_v1.mjs"
)
$generated = @(
    "artifacts/cloud_restore_preflight_v16.png",
    "artifacts/google_mobile_login_v15.png",
    "artifacts/google_pc_backup_no_loss_v1.png",
    "artifacts/google_pc_restore_connected_v1.png",
    "artifacts/google_pc_restore_no_loss_v1.png"
)

$node = (Get-Command node -ErrorAction Stop).Source
$failed = 0
try {
    foreach ($relative in $tests) {
        $path = Join-Path $root $relative
        if (-not (Test-Path -LiteralPath $path)) { throw "검사 파일이 없습니다: $relative" }
        Write-Output "RUN $relative"
        & $node $path
        if ($LASTEXITCODE -ne 0) { $failed += 1 }
    }
} finally {
    & git -C $root restore --source=HEAD -- $generated
}

$dirtyAfter = & git -C $root status --porcelain
if (-not [string]::IsNullOrWhiteSpace(($dirtyAfter -join "`n"))) {
    throw "검사 뒤 작업 폴더가 깨끗하지 않습니다."
}
Write-Output "FULL_RESULT tests=$($tests.Count) failed=$failed"
if ($failed -ne 0) { exit 1 }
