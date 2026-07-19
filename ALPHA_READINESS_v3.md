# 노트플러스P 제한 알파 상태 대시보드 v3

기준일: 2026-07-19

공개 앱: https://hanksleekorea-boop.github.io/noteplusp/

현재 정본: `노트앱_v7.html`

앱 SHA-256: `6D8F20F73896DA3F94EFAFE9291CEB51E53D4BD84560430583F9F0EFFCE633A0`

서비스 워커: `noteplusp-v7-shell-1`

앱 빌드 커밋: `42a1cbb`

이 문서는 v7 이후의 제한 알파 상태 정본이다. `ALPHA_READINESS.md`, `ALPHA_READINESS_v2.md`, `LIMITED_ALPHA_PLAN_v1.md`는 이전 공개 버전의 역사적 기준으로 보존한다.

## 1. 사실·추정·외부 의존성

- 사실: 공개 v7 HTTP 200, 226,646바이트, 로컬·공개 SHA-256 일치.
- 사실: Edge 모바일 에뮬레이션에서 생성·편집·재접속 저장과 저장소 전체 차단 시 입력 유지·무정지·정직 고지 통과.
- 사실: 합성 ENEX의 미리보기, 확인 전 무변경, 노트·노트북·태그·PDF Blob 저장과 재접속 복원 통과.
- 사실: ENEX·JSON 활성 노트·JSON 휴지통·붙여넣기에서 차단 요소·이벤트·위험 URL·외부 `src`가 저장·실행되지 않았고 외부 요청은 0건.
- 사실: 0바이트 ENEX는 FileReader 전에 제외되고, 공백·파싱 0건은 파일명과 `노트 0개` 사유를 포함한 실패로 기록되며 기존 상태는 변하지 않는다.
- 사실: schema 4 localStorage 원문은 바이트 단위로 보존되고, 검증된 schema 5 이전·재접속·멱등성·이전 후 수정 복원이 통과했다.
- 사실: v5 저장 경계 P0과 v6 빈 ENEX 안내·보고 P1을 수정했으며 현재 자동 공개 범위의 미해결 P0·P1은 0건.
- 추정 금지: 자동 에뮬레이션 결과를 실제 Android/iPhone 또는 비개발자 사용성 증거로 간주하지 않는다.
- 외부 의존성: 개인정보를 안전하게 처리한 실제 한국어 ENEX 1세트, 실제 Android/iPhone, 비개발자 파일럿 3~5명.
- 비차단 결함: `/favicon.ico` HTTP 404(P2).

## 2. 제한 알파 관문

| 관문 | 상태 | 근거와 남은 일 |
|---|---|---|
| 1. 누구나 여는 공개 릴리스 | 통과 | 공개 v7 HTTP 200, 로컬·공개 SHA 일치 |
| 2. 실제 모바일 핵심 여정 | 부분 | 390×844 Edge 자동 여정 통과. 실제 Android/iPhone 필요 |
| 3. 저장·데이터 안전 | 통과 | IDB 저장·차단 폴백, schema 4→5 무손실·멱등 이전, 외부 HTML 경계, PDF Blob, 빈 ENEX 무변경 통과 |
| 4. 비개발자 파일럿 3~5명 | 미통과 | 참여자와 실제 이전 자료 필요 |
| 5. 종료 품질 판정 | 부분 | 자동 공개 범위 P0=0. 실제 ENEX·파일럿 후 P0/P1·데이터 한계 종료 보고 필요 |

**현재 공식 진척도: 통과 2/5, 부분 통과 2, 미통과 1. 공식 통과율 40%.**

## 3. 최단 임계 경로

`공개 v7 무결성` → `실제 한국어 ENEX 1계정 이전` → `실제 휴대폰 찾기·수정·재접속` → `파일럿 3~5명` → `P0 즉시 수정·재현된 P1 최소 수정` → `종료 보고`

Codex는 외부 의존성을 기다리는 동안 빈 파일 경고, 완전성 판정, 취소·재시도, 백업 복원, 첨부·오프라인·접근성·브라우저 회귀를 계속 수행한다.

## 4. 알파 완료까지 전체 우선순위 20

1. [완료] 공개 v7 모바일 저장·저장 차단 핵심 회귀
2. [완료] 공개 합성 ENEX·PDF Blob·재접속 회귀
3. [완료] 외부 HTML 저장 경계 보안 회귀와 v6 P0 수정
4. [완료] 빈 ENEX·0바이트·파싱 0건 차단과 실패 보고
5. [사용자] 개인정보를 정리한 실제 한국어 ENEX 1세트 제공 또는 감독 세션
6. [공동] 실제 ENEX 노트·첨부·노트북 수량과 실패 대조
7. [사용자] 실제 Android 또는 iPhone에서 찾기·수정·재접속
8. [Codex] 파일별 노트·첨부·실패 합계와 최종 완료 판정
9. [공동] 실제 백업→초기화→복원 훈련
10. [Codex] 10분 파일럿 과업 카드·관찰표·개인정보 안내
11. [사용자] 비개발자 파일럿 1명 실행
12. [Codex] 파일럿 1의 P0 즉시 수정·P1 두 번째 환경 재현
13. [사용자] 파일럿 2~3명 실행
14. [Codex] 반복 P1 최소 수정과 회귀 추가
15. [사용자] 필요 시 파일럿 4~5명 실행
16. [Codex] 실제 파일 기준 누락·중복·첨부 오류 종료 대조
17. [Codex] Android·iPhone·PWA 재진입 막힘 정리
18. [Codex] 키보드·초점·오류 고지 핵심 접근성 검사
19. [Codex] 공개 RC 파일·서비스워커·자산 무결성 검사
20. [공동] P0=0과 남은 P1·데이터 한계가 포함된 제한 알파 종료 판정

## 5. ChatGPT/Codex 즉시 실행 가능 20

1. [완료] 공개 모바일 생성·편집·재접속·저장 차단 회귀 v3
2. [완료] 합성 ENEX 미리보기→가져오기→재접속 회귀 v3
3. [완료] ENEX·JSON·휴지통·붙여넣기 외부 HTML 보안 회귀 v3
4. [완료] 빈 ENEX·0KB·파싱 0건 경고 회귀
5. [다음] 파일별 노트·첨부·실패 합계 대시보드
6. 수량·파일·첨부 기반 최종 완료/확인 필요 판정
7. 가져오기 취소·재시도·중복 무변경 회귀
8. JSON 백업→초기화→복원 합성 훈련
9. 이미지·PDF·오디오 저장·재접속 회귀
10. IndexedDB만 차단/localStorage 보조 저장 회귀
11. 서비스 워커 설치·오프라인 재접속 검사
12. 키보드·포커스·ARIA 핵심 자동 검사
13. 390px·360px 모바일 화면 넘침 검사
14. Chrome·Edge 공개 핵심 여정 교차 검사
15. 파일럿 10분 과업 카드 작성
16. 파일럿 결과 입력·P0/P1/P2 판정표 작성
17. 개인정보 제거 ENEX 제출 안내 작성
18. 실제 계정 수량 대조 체크리스트 작성
19. RC 공개 파일·자산·SHA 자동 검사
20. 5관문 상태 자동 보고서 생성

## 6. 이번 공개 증거

- `tests/test_public_alpha_journey_v3.mjs`
- `tests/test_public_enex_import_v3.mjs`
- `tests/test_public_external_content_security_v3.mjs`
- `tests/test_public_enex_empty_warning_v1.mjs`
- `tests/test_public_schema4_migration_v1.mjs`
- `artifacts/public_alpha_mobile_persist_v3.png`
- `artifacts/public_alpha_mobile_storage_blocked_v3.png`
- `artifacts/public_enex_preview_v3.png`
- `artifacts/public_enex_reloaded_v3.png`
- `artifacts/public_external_content_security_v3.png`
- `artifacts/public_enex_empty_warning_v1.png`
- `artifacts/public_enex_zero_notes_warning_v1.png`
- `artifacts/public_schema4_migration_v1.png`

## 7. 다음 실행

사용자 승인 없이 가능한 최상위 작업은 파일별 노트·첨부·실패 합계 대시보드다. 실제 ENEX나 실기기가 준비되면 외부 의존 임계 경로를 즉시 우선한다.
