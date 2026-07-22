# 노트플러스P PC Google 계정 보호 설계 v1

기준일: 2026-07-22

## 1. 범위

- PC Chrome·Edge에서 Google 계정으로 로그인한다.
- 현재 IndexedDB schema 5를 계속 유일한 편집 원본으로 사용한다.
- 사용자가 명시적으로 누를 때만 계정 전용 Cloud Storage에 버전형 백업을 만든다.
- 로그인·SDK·네트워크·업로드가 실패해도 로컬 노트와 첨부를 변경하지 않는다.
- 이 단계에서는 자동 양방향 동기화, 폰 복원, 공동 편집을 구현하지 않는다.

## 2. 데이터 안전 불변조건

1. 로그인만으로 로컬 데이터를 전송하지 않는다.
2. 클라우드 백업 전에 참조된 첨부의 메타·Blob·MIME·크기·SHA-256을 검증한다.
3. 첨부는 `users/{uid}/snapshots/{snapshotId}/attachments/{attachmentId}`에 먼저 업로드한다.
4. 상태와 첨부 목록 manifest는 모든 첨부 업로드가 검증된 뒤 기록한다.
5. `users/{uid}/current.json` 포인터는 manifest 검증 뒤 마지막에 갱신한다.
6. 중간 실패 시 포인터를 바꾸지 않아 이전 완성 백업이 계속 현재 백업이다.
7. 같은 로컬 상태를 다시 시도하면 내용 SHA에서 만든 같은 snapshot 경로를 사용해 실패 재시도가 중복 백업을 늘리지 않는다.
8. 로컬 IndexedDB, localStorage schema 4 원본, ENEX 원본은 자동 삭제하지 않는다.
9. 클라우드에서 내려받은 HTML은 복원 기능이 추가될 때도 기존 화이트리스트 새니타이저를 통과한다.
10. 앱은 사용자 제목·본문·첨부 이름을 콘솔·결과 보고서에 기록하지 않는다.

## 3. v13 산출 범위

- `노트앱_v13.html`: PC Google 계정 보호 UI와 로컬 백업 준비·검증 흐름
- `firebase-config.js`: 기본 `null`; 실제 프로젝트 설정 전에는 Google 기능을 정직하게 비활성화
- `firebase-config.example.js`: 필요한 공개 Firebase Web 설정 키 예시
- `noteplus-cloud-v1.js`: Firebase Auth·Storage 선택 로더와 버전형 업로드 어댑터
- `firebase.storage.rules`: UID 격리·크기·MIME·경로 제한 규칙
- 무설정·로그인 실패·업로드 실패·성공 모의 회귀

## 4. 클라우드 형식

```text
users/{uid}/
  current.json
  snapshots/{snapshotId}/
    manifest.json
    attachments/{attachmentId}
```

`manifest.json`은 schema, 생성시각, 앱 버전, 상태, 첨부 메타·SHA, 노트·첨부 수량을 포함한다. 첨부 바이너리는 포함하지 않는다.

ENEX 또는 백업 묶음 전체에 300MB 같은 고정 합계 제한을 두지 않는다. Cloud Storage 객체별 안전 규칙과 실제 브라우저·계정 저장공간이 현실 한계이며, 한도를 넘기거나 공간이 부족하면 로컬 원본과 이전 완성 백업을 그대로 둔 채 실패를 고지한다.

## 5. 외부 준비가 필요한 항목

- Firebase 프로젝트와 Web App 등록
- Google 로그인 공급자 활성화
- `hanksleekorea-boop.github.io` 승인 도메인 추가
- Cloud Storage 사용을 위한 Blaze 결제 연결
- 제공된 Storage Security Rules 배포
- Firebase Web 설정을 `firebase-config.js`에 입력

위 항목은 외부 프로젝트·결제·권한 변경이므로 Codex가 사용자 승인 없이 생성하거나 활성화하지 않는다.

## 6. 후속 단계

v13 실제 계정 백업이 성공한 뒤에만 다음 버전에서 PC 복원 미리보기, 폰 읽기 전용 복원, 변경 대기열, 양방향 동기화, 충돌 사본을 순서대로 추가한다.
