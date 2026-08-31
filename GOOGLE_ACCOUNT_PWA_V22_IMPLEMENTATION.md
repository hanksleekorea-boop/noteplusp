# v22 Google 로그인·내 계정·PWA 구현 기록

기준: 2026-08-27, 후보 판 v22. 이 문서는 공개 v21을 바꾸지 않는 개발 브랜치 기록이다.

## 자동 감지 결과

| 항목 | 확인값 | 근거 | 상태 |
|---|---|---|---|
| 프로젝트 경계 | `noteplusp`의 `codex/v22-stage1` | Git 원격·현재 브랜치 | 확인 |
| 앱 형태 | 정적 HTML PWA | `노트앱_v22.html`, `노트앱_core_v22.html` | 확인 |
| 인증 제공자 | Google Identity Services + Drive appDataFolder 최소 권한 | `noteplus-drive-v22.js` | 확인 |
| 데이터 저장소 | 브라우저 IndexedDB, 명시적 Drive 백업 | v22 core·Drive 어댑터 | 확인 |
| PWA·캐시 | v22 manifest, `noteplusp-v22-shell-2` | manifest·service worker | 확인 |
| 대표 공개 URL | 기존 Pages v21 주소 | 공개 HTTP 확인 | 확인 |
| QR 원본 위치 | `artifacts/noteplusp_v21_qr.png` | 기존 공개 QR 자산 | 확인 |
| 배포 통로 | GitHub Pages | 저장소 설정·기존 공개 주소 | 확인 |
| 외부 OAuth 설정 권한 | 기존 OAuth 클라이언트 프로젝트 접근 확인 불가 | Cloud CLI 안전 조회 | 미확인 |
| 비용 변화 | 새 자원·결제·도메인 변경 없음 | 구현 범위 | 확인 |

## 구현 내용

- 상단 `내 계정` 진입점은 비로그인일 때 `Google로 로그인·무료 가입`, 로그인 뒤에는 마스킹된 계정·로그아웃으로 바뀐다.
- 로그인은 기존 `noteplusCloud.signIn()`만 호출한다. 토큰을 새로 읽거나 저장하지 않고, 비밀번호·별도 가입·새 인증 제공자를 만들지 않는다.
- 이 앱의 표시 이름과 하루 목표(5/10/15/20/30분)는 `noteplusp-v22-account-settings-v1`에만 저장한다. Google 계정 이름·이메일·노트·첨부는 바꾸지 않는다.
- 수동 백업·복원은 기존 전체 자료 이동 화면을 연다. 로그인·설정 저장만으로 Drive 업로드·복원·병합·삭제가 일어나지 않는다.
- 화면에 보이는 Google 계정 식별값은 마스킹한다.
- service worker 캐시 판을 `noteplusp-v22-shell-2`로 올렸다. 이전 v22 소유 캐시만 정리하며 OAuth·Drive·사용자별 응답은 가로채거나 캐시하지 않는다.

## 데이터 흐름

| 데이터 | 출처 | 저장 위치 | 전송 조건 | 사용자 동작 |
|---|---|---|---|---|
| 인증 상태 | Google 공식 SDK | SDK 메모리 세션 | Google 로그인 시 | 로그인·로그아웃 |
| 이 앱의 표시 이름 | 사용자 입력 | 이 기기 localStorage | 전송 안 함 | 이름 저장 |
| 하루 목표 | 사용자 선택 | 이 기기 localStorage | 전송 안 함 | 목표 저장 |
| 노트·첨부 | 기존 앱 | IndexedDB | 백업 또는 복원을 직접 누를 때만 | 기존 백업·복원 |

## 관문

| 관문 | 상태 | 근거 |
|---|---|---|
| G0 프로젝트 확정 | 통과 | 현재 저장소·브랜치·변경 파일 확인 |
| G1 구조 확정 | 통과 | 정적 PWA·기존 Google Drive OAuth·Pages 확인 |
| G2 안전 설계 | 통과 | 토큰 신규 저장·자동 전송·자동 복원·계정 삭제 없음 |
| G3 로컬 구현 | 통과 | 계정 진입점·로컬 설정·마스킹·PWA 캐시 판 구현 |
| G4 로컬 검증 | 통과 | 빠른 14/14, 전체 62/62, GitHub Actions quick 통과 |
| G5 외부 인증 설정 준비 | 보류 | 실제 OAuth 프로젝트 접근권과 등록 origin 확인 불가 |
| G6 공개 전 확인 | 보류 | G5, 실제 Drive·Android·운영 증거가 남음 |
| G7 공개 후 검증 | 보류 | v22는 아직 Pages 공개 승격하지 않음 |

## 실제 검증과 분리한 항목

- 자동: 계정 경계 정적 검사, PWA 소유 캐시·OAuth/Drive 제외 규칙, 빠른 14/14, 전체 62/62, GitHub Actions quick 통과.
- 실제 사용자 동작 필요: Google 로그인, 실제 표시 이름이 아닌 앱 로컬 설정 확인, Android/iPhone 카메라 QR 스캔, PC↔Android Drive 왕복.
- 외부 설정 병목: `OAUTH_CONFIGURATION_REQUIRED`. 현재 Cloud CLI 활성 계정이 요청에 적힌 계정과 다르며, 기존 OAuth 클라이언트 프로젝트의 설정 변경 권한을 확인하지 못했다. 다른 Cloud 프로젝트는 변경하지 않았다.
