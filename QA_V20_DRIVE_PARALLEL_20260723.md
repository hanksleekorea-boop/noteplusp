# NotePlusP v20 Drive 병렬 백업 QA 기록

작성일: 2026-07-23  
후보: `노트앱_v20.html` / commit `5d67aca`  
공개 URL: `https://hanksleekorea-boop.github.io/noteplusp/%EB%85%B8%ED%8A%B8%EC%95%B1_v20.html`

## 변경 범위

- v19의 무손실 순서(첨부 업로드·SHA-256 재다운로드 검증 → manifest 검증 → current pointer 확정)를 유지한다.
- 첨부만 최대 두 건씩 병렬로 전송·검증한다. 두 개를 넘는 동시 전송은 하지 않는다.
- 진행 표시에는 완료 수, 경과 시간, 평균 처리량 기반의 대략적인 남은 시간, 동시 처리 수를 표시한다.
- 한 첨부라도 실패하면 남은 작업이 정리될 때까지 기다린 뒤 실패를 반환하며 manifest/current pointer를 쓰지 않는다.

## 검증 결과

| 구분 | 결과 | 근거 |
|---|---|---|
| 정적 구문 | PASS | v20 loader, Drive module, service worker `new Function` 검사 |
| Drive 요청 안전성 | PASS | multipart/related, 5MB 초과 resumable, Content-Range, 수동 Content-Length 없음 |
| 병렬 상한·확정 순서 | PASS | 모의 실행에서 최대 동시 첨부 2개, 모든 첨부 완료 뒤 manifest/pointer만 실행 |
| 실패 시 current pointer 보호 | PASS | 모의 첨부 실패 시 manifest/pointer 호출 0회 |
| 로컬 모바일 핵심 여정 | PASS | IDB 저장·새로고침 복구, 저장소 차단 시 메모리 유지·고지·입력 유지 |
| 공개 v20 모바일 핵심 여정 | PASS | GitHub Pages URL, SHA-256 일치, IDB 및 차단 fallback 통과 |

공개 응답 해시:

- loader `4D25FDEA6BD95B6D7667F5D56A2FAE7619E2055C2BA1CFA81E78DEC8A54B4A93`
- Drive module `A93CDED8400A5C7C0962E1A4B5C3733ED21D5D06C5DA85112655DEF7A5149584`
- service worker `617E8DF529ACA7DFD84FC60B7758CDC299CB218CF61850CE1402DFE08BEF9A0F`
- web manifest `C6B0805C9454B1CB619854CB9BF5BC704FDDA281058AB50298ED3C2BD97C6814`

스크린샷은 기존 증빙을 덮어쓰지 않고 아래의 버전 전용 파일로 보존했다.

- `artifacts/v20_local_mobile_persist_20260723.png`
- `artifacts/v20_local_mobile_storage_blocked_20260723.png`
- `artifacts/v20_public_20260723_public_alpha_mobile_persist_v4.png`
- `artifacts/v20_public_20260723_public_alpha_mobile_storage_blocked_v4.png`

## 미검증 및 안전 제한

- 이 QA는 실제 사용자의 Google Drive에 쓰지 않았다. 1,914 노트/2,250 첨부 실전송 시간·성공·PC→휴대폰 복원은 별도 실제 증거가 필요하다.
- 사용자가 현재 진행 중인 v19 백업에는 v20이 적용되지 않는다. 해당 탭을 새로고침·닫기·버전 전환하지 않고 완료 또는 실패 상태를 먼저 확인한다.
- Samsung SM-G996N에서 v20 URL을 연 실제 기기 검증은 아직 하지 않았다.
