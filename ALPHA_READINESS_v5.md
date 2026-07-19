# 노트플러스P 제한 알파 상태 대시보드 v5

기준일: 2026-07-19

공개 앱: https://hanksleekorea-boop.github.io/noteplusp/

현재 정본: `노트앱_v8.html`

앱 SHA-256: `931DCD4EED4FE128A3A549D018795BEF130442B2FAD00A41E35853D3DE24F460`

서비스 워커: `noteplusp-v8-shell-1`

앱 빌드 커밋: `21e54d1`

이 문서는 v8 파일별 완전성 판정과 실제 Android 재검증 이후의 제한 알파 상태 정본이다. 이전 대시보드는 당시 증거로 보존한다.

## 1. 현재 사실·제한

- 공개 v8은 HTTP 200, 238,434바이트이며 로컬·공개 SHA-256이 일치한다.
- ENEX마다 파일명·크기·노트·첨부·첨부 경고·상태를 코드가 통제한 DOM으로 표시한다.
- 빈 파일, 노트 0개, 읽기/분석 실패, 용량 초과, 첨부 제외, 저장 제한, 수량 미입력·불일치는 `확인 필요`로 남긴다.
- 모든 파일 분석 통과와 Evernote 전체 노트·노트북 수의 정확한 일치가 함께 있을 때만 `완전 이전 수량 확인`을 표시한다.
- 결과 JSON·HTML 보고서에도 파일별 결과와 완전성 판정이 남으며 노트 본문·첨부 내용은 포함하지 않는다.
- 공개 Edge 회귀 7종과 실제 Samsung Chrome에서 저장·재접속·PDF Blob·오프라인·설치 경로·원상복구가 통과했다.
- 현재 자동·실기기 범위 미해결 P0·P1은 0건이다. `/favicon.ico` 404는 P2다.
- 실제 한국어 사용자 ENEX 1세트, iPhone, 비개발자 파일럿 3~5명은 아직 외부 의존성이다.

## 2. 제한 알파 관문

| 관문 | 상태 | 근거와 남은 일 |
|---|---|---|
| 1. 누구나 여는 공개 릴리스 | 통과 | 공개 v8 HTTP 200, 로컬·공개 SHA 일치 |
| 2. 실제 모바일 핵심 여정 | 통과 | Samsung Chrome에서 저장·재접속·ENEX PDF·오프라인·설치 경로·원상복구 |
| 3. 저장·데이터 안전 | 통과 | IDB·저장 차단 폴백·schema 4→5·외부 HTML·파일별 완전성 경계 |
| 4. 비개발자 파일럿 3~5명 | 미통과 | 실제 참여자 필요 |
| 5. 종료 품질 판정 | 부분 | 자동·Android 범위 P0/P1=0. 실제 ENEX·파일럿 종료 보고 필요 |

**현재 공식 진척도: 통과 3/5, 부분 통과 1, 미통과 1. 공식 통과율 60%.**

## 3. 최단 임계 경로

`공개 v8` → `실제 한국어 ENEX 완전성 대조` → `iPhone 보조 확인` → `비개발자 3~5명` → `재현 P0/P1 최소 수정` → `종료 보고`

## 4. 알파 완료까지 전체 우선순위 20

1. [완료] 공개 v8 릴리스·SHA·서비스워커 무결성
2. [완료] 실제 Samsung Android 핵심 여정·원상복구
3. [완료] 저장 차단·schema 4→5 무손실·멱등 이전
4. [완료] 합성 ENEX·PDF Blob·재접속·오프라인 회귀
5. [완료] 외부 HTML·빈 ENEX 보안·실패 경계
6. [완료] 파일별 노트·첨부·실패 대시보드와 완전성 판정
7. [사용자] 개인정보를 정리한 실제 한국어 ENEX 1세트 제공 또는 감독 세션
8. [공동] 실제 ENEX 파일·노트·첨부·노트북 수량 대조
9. [사용자] iPhone 핵심 여정 교차 확인
10. [공동] 실제 백업→초기화→복원 훈련
11. [Codex] 10분 파일럿 과업 카드·관찰표·개인정보 안내
12. [사용자] 비개발자 파일럿 1명 실행
13. [Codex] 파일럿 1의 P0 즉시 수정·P1 두 번째 환경 재현
14. [사용자] 파일럿 2~3명 실행
15. [Codex] 반복 P1 최소 수정과 회귀 추가
16. [사용자] 필요 시 파일럿 4~5명 실행
17. [Codex] 실제 파일 기준 누락·중복·첨부 오류 종료 대조
18. [Codex] 키보드·초점·오류 고지 핵심 접근성 검사
19. [Codex] 공개 RC 파일·자산·업데이트 무결성 검사
20. [공동] P0=0과 남은 P1·데이터 한계가 포함된 제한 알파 종료 판정

## 5. ChatGPT/Codex 즉시 실행 가능 20

1. [완료] 공개 모바일 생성·편집·재접속·저장 차단 회귀 v4
2. [완료] 합성 ENEX 미리보기→가져오기→재접속 회귀 v4
3. [완료] ENEX·JSON·휴지통·붙여넣기 외부 HTML 보안 회귀 v4
4. [완료] 빈 ENEX·0KB·파싱 0건 경고 회귀 v2
5. [완료] schema 4→5 원본 보존·멱등 이전 회귀 v2
6. [완료] 파일별 노트·첨부·실패 합계 대시보드
7. [완료] 수량·파일·첨부 기반 완료/확인 필요 판정
8. [완료] 가져오기 취소·재시도·중복 무변경 v8 회귀
9. [완료] JSON 백업→초기화→복원 합성 훈련
10. [완료] 이미지·PDF·오디오 저장·재접속 회귀
11. [완료] IndexedDB만 차단/localStorage 보조 저장 회귀
12. [다음] 키보드·포커스·ARIA 핵심 자동 검사
13. 390px·360px 모바일 화면 넘침 검사
14. [완료] Edge 자동·실제 Android Chrome 핵심 여정 교차 검사
15. 파일럿 10분 과업 카드 작성
16. 파일럿 결과 입력·P0/P1/P2 판정표 작성
17. 개인정보 제거 ENEX 제출 안내 작성
18. 실제 계정 수량 대조 체크리스트 작성
19. RC 공개 파일·자산·SHA 자동 검사
20. 5관문 상태 자동 보고서 생성

## 6. 이번 증거

- `tests/test_public_import_completeness_v1.mjs`
- `tests/test_public_alpha_journey_v4.mjs`
- `tests/test_public_enex_import_v4.mjs`
- `tests/test_public_external_content_security_v4.mjs`
- `tests/test_public_enex_empty_warning_v2.mjs`
- `tests/test_public_schema4_migration_v2.mjs`
- `tests/test_physical_android_alpha_v2.mjs`
- `tests/test_public_enex_cancel_retry_dedupe_v1.mjs`
- `tests/test_public_json_backup_restore_v1.mjs`
- `tests/test_public_attachment_types_v1.mjs`
- `tests/test_public_idb_blocked_fallback_v1.mjs`
- `artifacts/public_import_completeness_review_v1.png`
- `artifacts/public_import_completeness_complete_mobile_v1.png`
- `artifacts/physical_android_alpha_v2.png`
- `artifacts/physical_android_alpha_v2.json`
- `artifacts/public_enex_cancel_retry_dedupe_v1.png`
- `artifacts/public_json_backup_restore_v1.png`
- `artifacts/public_attachment_types_v1.png`
- `artifacts/public_idb_blocked_fallback_v1.png`

## 7. 다음 실행

사용자 승인 없이 가능한 최상위 작업은 키보드·포커스·ARIA 핵심 자동 검사다. 실제 한국어 ENEX가 준비되면 외부 의존 임계 경로를 즉시 우선한다.
