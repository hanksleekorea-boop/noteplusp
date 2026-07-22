# 노트플러스P Firebase 실제 활성화 패킷 v1

기준: 공개 앱 v16. 이 문서는 실제 Google 로그인·PC 백업·휴대폰 복원을 시작하기 전의 **운영자용** 준비 절차다. 앱의 로컬 IndexedDB 데이터, 기존 ENEX, 이전 클라우드 백업을 삭제하거나 변경하지 않는다.

## Codex가 이미 준비한 것

- `firebase.storage.rules`: 사용자 UID별 읽기·쓰기만 허용하고, 삭제는 금지한다.
- `firebase.json`: Firebase CLI가 위 Storage 규칙만 대상으로 삼게 한다. GitHub Pages 호스팅은 건드리지 않는다.
- `tools/firebase-activation-diagnostics-v1.mjs`: 읽기 전용 형식·규칙 점검이다. Firebase에 로그인하거나 설정을 게시하지 않는다.

## 소유자 계정에서 한 번만 할 일

1. Firebase Console에서 새 프로젝트를 만들고 **Web App**을 추가한다.
2. Authentication → Sign-in method에서 **Google** 공급자를 활성화한다.
3. Authentication → Settings → Authorized domains에 `hanksleekorea-boop.github.io`를 넣는다.
4. Storage를 활성화하고, 대용량 Evernote 첨부 백업에 필요한 요금제/한도를 확인한다.
5. Console의 공개 Web 설정 값을 `firebase-config.js`의 `null` 자리에 넣는다. 이 값은 비밀키가 아니며, 실제 데이터 접근 통제는 Storage Rules가 담당한다.
6. Firebase CLI를 로그인한 소유자 계정에서 실행해 `firebase deploy --only storage`로 규칙을 게시한다. 이 단계는 외부 프로젝트 권한을 바꾸므로 Codex가 대신 실행하지 않는다.

## 설정 직후의 읽기 전용 점검

```powershell
$node = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node .\tools\firebase-activation-diagnostics-v1.mjs
```

`readyForFirebaseConsole: true`은 **로컬 설정 파일과 규칙 파일의 형식만** 맞는다는 뜻이다. Google 공급자, 승인 도메인, Storage 활성화, 게시된 규칙, 실제 계정 백업 성공을 대신 증명하지 않는다.

## 실제 데이터 검증 순서

1. PC에서 실제 노트 전체를 연 뒤 Google 로그인 → 백업을 실행한다.
2. 화면의 완료 수량과 첨부 수량, 생성된 snapshot의 SHA-256 검증 결과를 보관한다.
3. 휴대폰에서 같은 Google 계정으로 로그인 → 복원 미리보기 → 명시 복원을 실행한다.
4. 복원 완료 뒤 앱을 닫았다 다시 열고 노트·첨부·검색을 확인한다.
5. 다른 Google 계정에서 같은 백업을 열 수 없는지 확인한다.

어느 단계든 실패하면 로컬 데이터와 이미 완료된 이전 백업은 유지되어야 하며, 오류 문구와 시각만 기록하고 재시도한다.
