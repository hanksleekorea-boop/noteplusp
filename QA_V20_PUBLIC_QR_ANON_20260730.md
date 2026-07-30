# 노트플러스P v20 공개·QR·저장 회귀 증거

기준일: 2026-07-30

## 대상

- 공개 앱: https://hanksleekorea-boop.github.io/noteplusp/%EB%85%B8%ED%8A%B8%EC%95%B1_v20.html
- loader SHA-256: `4D25FDEA6BD95B6D7667F5D56A2FAE7619E2055C2BA1CFA81E78DEC8A54B4A93`
- 검증 커밋: `9611113`
- 브라우저: Windows Google Chrome, Playwright 새 컨텍스트, 쿠키·로그인 상태 없음
- 뷰포트: 390×844, mobile/touch 모드

## 결과

| 검사 | 상태 | 관찰 |
|---|---|---|
| 공개 loader 무쿠키 HTTP | PASS | HTTP 200, 2,329바이트, 로컬 SHA 일치 |
| 실제 격리 브라우저 렌더 | PASS | 공개 v20 로드·모바일 UI 표시 |
| 새 노트 저장 | PASS | `persistenceMode=idb`, 저장됨 고지 |
| 새로고침 지속성 | PASS | 생성한 제목·본문을 `window.state.notes`에서 재확인 |
| 모바일 폭 | PASS | `scrollWidth <= innerWidth + 1` |
| 영속저장 완전 차단 | PASS | `persistenceMode=memory`, 실패 배너 표시 |
| 저장 실패 중 입력 유지 | PASS | 제목·본문이 현재 화면에 유지되고 이번 세션 고지 표시 |
| QR 내용 | PASS | 독립 디코더가 공개 v20 URL과 바이트 단위 동일한 문자열을 반환 |
| 실제 Android v20 | UNVERIFIED | `adb devices -l`에 연결 기기 없음 |
| 실제 Drive 전체 전송 | UNVERIFIED | 사용자 1,914노트·2,250첨부 완료 결과 없음 |
| 실제 PC→휴대폰 복원 | UNVERIFIED | 동일 계정 교차기기 복원 결과 없음 |

## 자동 검사

- `test_public_alpha_journey_v4.mjs`: PASS, 102초, cleanup warning 0.
- `test_v20_public_qr_v1.mjs`: PASS, QR 45 modules.
- `test_v20_resumable_retry_v1.mjs`: PASS, HTTP 500 뒤 8MiB 인정 offset부터 재개.
- `test_v20_parallel_progress_v1.mjs`: PASS, 동시 처리 상한 2·ETA 계약.
- `test_v20_parallel_upload_execution_v1.mjs`: PASS, 첨부 전부 완료 뒤 manifest/current 확정.
- `test_harness_runtime_resolution_v1.mjs`: PASS, 설치 버전 고정 경로 0개.
- v20 loader inline `new Function`: PASS, inline script 1개.
- `node --check noteplus-drive-v20.js`: PASS.

## 산출물 무결성

| 파일 | 바이트 | SHA-256 |
|---|---:|---|
| `artifacts/noteplusp_v20_qr_20260730.png` | 1,879 | `80770AB8DE2CA507BC411648AA93EB4460CFE42D232B2AB717D594E5C8BC7270` |
| `artifacts/noteplusp_v20_qr_20260730.svg` | 9,712 | `48E88CCF2FD31F42CCA6D3A6C61CFC9627A39D117B420A8E80075D12CBC7FA9A` |
| `artifacts/v20_public_20260730_final_public_alpha_mobile_persist_v4.png` | 94,980 | `913B623BBF09ABBA307D29719F752A7456AE4E449A1447001437AA541483065F` |
| `artifacts/v20_public_20260730_final_public_alpha_mobile_storage_blocked_v4.png` | 75,999 | `BA30411470EBD9BB0DB76CB0C108DDE14CA8350217FCF05DE9D7780434A8FAAC` |

## 결함·제한

- P0: 확인 범위 0.
- P1: 확인 범위 0.
- P2: favicon 404. 핵심 여정에는 영향 없음.
- 최초 브라우저 실행은 기능 단언과 화면 저장 후 Playwright 종료를 기다리며 시간 초과했다. 컨텍스트·브라우저 정리를 5초 상한으로 보정한 뒤 동일 검사가 cleanup warning 없이 PASS했다.
- 공개 QR 파일은 커밋 직후 Pages 전파 전 첫 요청에서 404였다. 전파 완료 후 HTTP·SHA를 별도 append-only 기록한다.
- 이 문서는 실제 Google Drive 쓰기, 실제 휴대폰, 실제 사람 파일럿의 증거가 아니다.

## 2026-07-30 · 공개 QR 전파 재검증 (append-only)

- 공개 QR: https://hanksleekorea-boop.github.io/noteplusp/artifacts/noteplusp_v20_qr_20260730.png
- 첫 404 뒤 Pages 전파를 기다려 다시 요청했고 HTTP 200·1,879바이트·SHA-256 `80770AB8DE2CA507BC411648AA93EB4460CFE42D232B2AB717D594E5C8BC7270`으로 로컬 PNG와 일치했다.
- `QR_PUBLIC_STATUS=PASS`, `DOWNLOAD_STATUS=PASS`, `ANON_BROWSER_STATUS=PASS`.
