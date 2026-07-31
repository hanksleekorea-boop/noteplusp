# 노트플러스P 전담 개발 제어 대시보드 v7

기준일: 2026-07-31 (Asia/Bangkok)

제품 목표 → [ENEX·첨부·schema 5·공개 후보] → **▶ v21 공개 직접 후보 검증 완료 ◀** → [실제 Drive 전체 백업·현행 휴대폰 복원·파일럿] → 제한 알파 완료

## 현재 앱과 사용 가능 범위

- 공개 v21: https://hanksleekorea-boop.github.io/noteplusp/%EB%85%B8%ED%8A%B8%EC%95%B1_v21.html
- 다운로드·PWA 설치 진입점: 공개 v21과 동일
- 공개 QR: https://hanksleekorea-boop.github.io/noteplusp/artifacts/noteplusp_v21_qr.png
- 롤백 v20: https://hanksleekorea-boop.github.io/noteplusp/%EB%85%B8%ED%8A%B8%EC%95%B1_v20.html
- 기본 공개 루트는 v16 유지: https://hanksleekorea-boop.github.io/noteplusp/

v21에서는 Drive가 반복 지연될 때 같은 데이터를 건너뛰지 않고 최대 5회 재개하며, 실패하면 무한 대기 대신 안전하게 멈추고 기존 완료 백업 보존을 알린다. 실제 사용자 Drive 전체 전송과 휴대폰 복원은 아직 검증되지 않았다.

## [중요 병목]

```text
병목: 실제 PC v21 전체 백업, 현행 Android 복원, 비개발자 3명 결과가 없음
등급: BLOCKED
원인 계층: 구조적 — 계정 데이터·실기기·사람 참가자라는 단일 외부 경로
사용자 영향: PC 데이터가 휴대폰에서도 안전하게 복원된다고 아직 말할 수 없음
이번 우회: 공개·오류·무손실·QR·하네스 검증은 완료했지만 D/U로 승격하지 않음
근본 해소: 실제 v21 백업 완료 → 같은 계정 휴대폰 복원 → 3명 파일럿
재검증: manifest/current/SHA/수량, 휴대폰 재접속, 파일럿 과업 기록
```

공개 렌더와 QR 해독도 각각 live 실패 영역 1개라 구조적 검증 채널 병목이다.

## 릴리스 열차

| 릴리스 | 사용자가 처음 보는 것 | 상태 | 예산 실측/한도 | 공개 검증 |
|---|---|---|---|---|
| v21 direct | Drive 지연 5회 제한·backoff·동일 offset 재개·정직 고지 | P PASS | 셸 25,008바이트 / 한도 미설정 | 5자원×3회 HTTP·SHA, 정확한 v21 Chrome PASS |
| 기본 루트 v21 | 모든 방문자가 v21 사용 | BLOCKED | 동일 / 한도 미설정 | 실제 Drive·현행 휴대폰 미검증 |

## 진척 대시보드

현재 v21 후보 증거만 센다. 과거 v15 Samsung 증거는 역사로 보존하지만 v21 D로 재사용하지 않는다.

| 분야 | 현재 | 근거 | 남은 일 |
|---|---:|---|---|
| 제한 알파 관문 | **2/5 = 40%** | 공개 링크·저장 안전 PASS | 현행 모바일·파일럿·종료 |
| 공개·배포 | 4/4 = 100% | entrypoint·모듈 묶음·무로그인 렌더·QR | 기본 루트 승격은 별도 |
| Drive 오류 안전 | 5/5 = 100% | 429·5xx·network·no-Range·상한 | 실제 공급자 오류 관찰 |
| 저장·복구 | 3/4 = 75% | IDB·memory fallback·pointer 보호 | 실제 PC→폰 |
| 목표 환경 | 0/3 = 0% | 격리 자동 Chrome은 P 렌더 증거로만 사용 | 실제 PC 사용자·Android·교차기기 |
| Evernote 이전 가치 | 2/4 = 50% | ENEX·첨부 구현 | Drive 전체 백업·폰 복원 |
| 접근성 | 2/3 = 67% | 모바일 폭·기존 키보드 계약 | 현행 실기기 화면낭독기 |
| 성능·대용량 | 2/3 = 67% | 10,000노트·bounded upload | 실제 1,914/2,250 시간 |
| 보안·권리 | 3/4 = 75% | sanitizer·drive.appdata·token memory | 실제 타계정 거부 |
| 실제 파일럿 | 0/3 = 0% | 없음 | 비개발자 최소 3명 |

## 일정·처리량

| 지표 | 값 | 설명 |
|---|---:|---|
| 개발 시작 | 2026-07-18 | 최초 공개 커밋 |
| 최초 조건부 ETA | 2026-07-25 | 2026-07-22 계획의 1~3일 최장값 |
| 현재 일정 편차 | +6일 이상 | 2026-07-31 기준, 외부 D/U 증거 미확보 |
| 현재 ETA | 달력일 UNKNOWN | 기기·참가자 가용성 미정. 증거 확보 후 1~3일 계획 |
| 전체 TTFV | 측정 없음 | 계획 채택 시작 시각이 영구 기록되지 않음 |
| commit→P | 26분 21초 | v21 commit 09:23:02 → 공개 Chrome 09:49:23 |
| THROUGHPUT_ACTUAL | 1 릴리스 칸 | 사용자 대면 v21 direct 공개 완료 |
| THROUGHPUT_INFRA | 4칸 | H-01·H-02·H-03·공개 자동검사 이관 |
| THROUGHPUT_BLOCKED_EXIT | 3칸 | 실제 Drive·현행 휴대폰·파일럿 |
| 5배 달성 | 측정 없음 | 동일 정의의 5회 기준선 없음 |
| BUDGET_MEASURED | 25,008바이트 | loader+module+worker+manifest |
| BUDGET_LIMIT | 미설정 | 절단 기준을 사후 생성하지 않음 |

## 증거 등급

**이번 실행이 올린 증거 등급: v21을 I→L→K→P까지 올렸다. D와 U는 올리지 않았다.**

| 등급 | 현재 상태 | 근거 | 뜻하지 않는 것 |
|---|---|---|---|
| I 구현 | VERIFIED_IMPLEMENTED | v21 별도 산출물 | 공개 성공 아님 |
| L 로컬 | VERIFIED_TESTED | 표적·음성 대조·회귀 | 공급자·기기 성공 아님 |
| B 빌드 | not-applicable | 정적 HTML/PWA | P 아님 |
| K 패키지 | VERIFIED_TESTED | 버전·SHA·QR | 실행 성공 아님 |
| P 공개 | VERIFIED_TESTED | 15회 HTTP·SHA + 정확한 v21 Chrome | D/U 아님 |
| D 대상 환경 | UNKNOWN | ADB 기기 0 | 과거 v15를 재사용하지 않음 |
| U 실제 사용자 | UNKNOWN | 파일럿 0명 | 합성 세션은 U 아님 |

## 전체 개발 우선순위 Top 30

| 순위 | 작업 | 쉬운 설명 | 상태 | 완료 증거 |
|---:|---|---|---|---|
| 1 | PC v21 전체 백업 | 실제 내 노트·첨부를 Drive에 끝까지 올림 | BLOCKED | 완료 화면·시간 |
| 2 | 수량 대조 | 1,914노트·2,250첨부 일치 | BLOCKED | manifest counts |
| 3 | pointer/SHA | 완성본만 current인지 확인 | BLOCKED | 재다운로드 SHA |
| 4 | Android v21 진입 | 실제 폰에서 정확한 v21 열기 | BLOCKED | serial·URL·화면 |
| 5 | 같은 계정 로그인 | PC 백업 계정 연결 | BLOCKED | 계정 일치 판정 |
| 6 | 복원 미리보기 | 쓰기 전에 수량 확인 | BLOCKED | preview counts |
| 7 | 저장공간 점검 | 폰 공간 부족이면 쓰지 않음 | BLOCKED | preflight 결과 |
| 8 | 명시 복원 | 사용자 승인 뒤 실제 복원 | BLOCKED | restore 완료 |
| 9 | 복원 수량 | PC와 폰 데이터 일치 | BLOCKED | counts·SHA |
| 10 | 첨부 표본 | 이미지·PDF·녹음 실제 열기 | BLOCKED | 3종 화면 |
| 11 | 재접속 | 브라우저 재진입 뒤 유지 | BLOCKED | 같은 note 확인 |
| 12 | 완전 재시작 | 승인된 브라우저 재시작 복구 | BLOCKED | 재실행 증거 |
| 13 | 타계정 거부 | 다른 계정에서 백업 비노출 | BLOCKED | 거부 메시지 |
| 14 | 실패 원상복구 | 중단해도 폰 기존 데이터 보존 | BLOCKED | signature 동일 |
| 15 | PWA 설치 | QR→홈 화면→v21 재진입 | BLOCKED | start_url v21 |
| 16 | 화면낭독기 | 핵심 버튼·상태 읽기 | BLOCKED | TalkBack/VoiceOver |
| 17 | 첫 파일럿 버전 고정 | 첫인상 표본을 v21+로 고정 | PLANNED | 버전 카드 |
| 18 | 파일럿 3명 모집 | 실제 비개발자 참여 | BLOCKED | 동의 3명 |
| 19 | 파일럿 과업 | ENEX 안내·가져오기·검색 | BLOCKED | 3개 결과 |
| 20 | 파일럿 지표 | 완료율·시간·막힘 | BLOCKED | 익명 결과표 |
| 21 | P0 수정 | 데이터손실·진입불가 즉시 수정 | PLANNED | 새 후보 P |
| 22 | P1 수정 | 두 환경 재현 항목만 수정 | PLANNED | 새 후보 P |
| 23 | 기본 루트 승격 | 모든 방문자를 검증 후보로 연결 | BLOCKED | root 3회+화면 |
| 24 | root 롤백 검증 | 실패 시 v16/v20로 복귀 | PLANNED | hash·화면 |
| 25 | 현행 실기기 재회귀 | 승격본을 다시 폰에서 확인 | BLOCKED | D PASS |
| 26 | 잔여 P1 기록 | 고치지 않은 한계 공개 | PLANNED | 종료 표 |
| 27 | 데이터 한계 기록 | Drive·ENEX 범위 명시 | PLANNED | 한계 표 |
| 28 | 베타 분리 | P2·고도화는 알파에서 제외 | PLANNED | beta backlog |
| 29 | 종료 보고 | P0 0·P1·D/U 증거 통합 | BLOCKED | 종료 문서 |
| 30 | 알파 판정 | 다섯 관문 모두 통과해야 선언 | BLOCKED | 5/5 |

## 사용자 없이 가능한 자율 작업 Top 30

외부 계정·기기·사람이 필요한 일은 제외했다. `yes`는 지금 실행 가능한 항목이다.

| 순위 | 작업 | 지금 실행 | 상태/완료 증거 |
|---:|---|---|---|
| 1 | v21 bounded recovery 구현 | no | 완료 I |
| 2 | 429 회복 검사 | no | 완료 L·음성 대조 |
| 3 | 지속 500 종료 검사 | no | 완료 L·12호출 |
| 4 | no-Range 무건너뛰기 | no | 완료 L·음성 대조 |
| 5 | 오류 정직 고지 | no | 완료 L/P |
| 6 | 최신 버전 연결 검사 | no | 완료 L·음성 대조 |
| 7 | 최신 QR 자동 생성 | no | 완료 K |
| 8 | 외부 QR 디코딩 | no | 완료 P 보조 |
| 9 | 공개 5자원 3회 검사 | no | 완료 P |
| 10 | 정확한 후보 URL 하네스 | no | 완료 H-01 |
| 11 | cloud runtime marker | no | 완료 P |
| 12 | 공개 모바일 저장 | no | 완료 P |
| 13 | 저장 차단 무손실 | no | 완료 P |
| 14 | 10,000노트 하네스 종료 | no | 완료 H-02 |
| 15 | JSON 증거 선기록 | no | 완료 H-03 |
| 16 | 최신 복원 manifest 손상 차단 | yes | L 계약 확장 |
| 17 | 최신 누락 첨부 preflight | yes | L 계약 확장 |
| 18 | 최신 타계정 restore 거부 | yes | L 계약 확장 |
| 19 | 401/403 pointer 미변경 | yes | L 계약 확장 |
| 20 | 네트워크 예외 5회 상한 | yes | L 계약 확장 |
| 21 | Retry-After 30초 상한 | yes | L 계약 확장 |
| 22 | zero-byte resumable | yes | L 계약 확장 |
| 23 | 서비스워커 캐시 소비 검사 | yes | L/K |
| 24 | 공개 HTTPS·보안 헤더 관찰 | yes | P 관찰 |
| 25 | favicon P2 후보 | yes, Q1=no | 알파 비차단 |
| 26 | root 승격 dry-run 계약 | yes | 실제 승격은 BLOCKED |
| 27 | rollback URL·해시 자동검사 | yes | K/P |
| 28 | 테스트 cycle time 원장 | yes | 처리량 기준선 |
| 29 | 종료 보고 자동 집계 | yes | 문서, 진척 아님 |
| 30 | 베타 후보 분류 | yes | 문서, 진척 아님 |

## 마지막 확인과 다음 방향

지금은 누구나 v21 직접 링크를 열어 노트를 저장할 수 있고, 반복 Drive 오류가 무한 대기로 이어지지 않도록 구현·공개 검증됐다. 그러나 실제 1,914노트·2,250첨부가 Drive에 완주하고 같은 계정 휴대폰에 복원됐다는 말은 할 수 없으며, 연결 기기와 파일럿 결과가 없기 때문이다. 개발 측은 실제 결과가 들어오면 즉시 대조·최소 수정하고, 사용자 측의 가장 작은 다음 행동은 PC v21에서 실제 백업을 한 번 끝까지 완료한 상태를 유지하는 것이다.

- QR_STATUS=PASS
- DOWNLOAD_STATUS=PASS
- ANON_ACCESS=PASS
- D=UNKNOWN, U=UNKNOWN
- 이번 열차에서 잘라낸 항목: favicon P2, 화면낭독기 고도화, 베타 기능. 알파 임계 경로가 아니므로 후행.
- 다음 릴리스: 실제 결과에서 관찰된 P0 또는 두 환경 재현 P1의 최소 수정. 결함이 없으면 기본 루트 승격.
- 예상 공개 시점: 외부 증거 확보 뒤 1~3일. 기기·파일럿 일정은 UNKNOWN.
- 병목 Top 3: **실제 Drive 백업 완료(대행동)**, **현행 휴대폰 연결·복원(대행동)**, **파일럿 3명 동의·실행(대행동)**.
- 개발 측 집중: 실제 결과가 들어오면 manifest/current/SHA 자동 대조.
- 사용자 측 집중: PC v21 실제 백업 완료 상태 확보.
- 최속 완성 점검: v21 반복 지연을 먼저 제거한 뒤 외부 D/U 한 번으로 결론 내리는 경로가 재전송·재작업을 가장 줄이며, 더 많은 기능 추가는 Q1/Q2를 통과하지 못한다.
