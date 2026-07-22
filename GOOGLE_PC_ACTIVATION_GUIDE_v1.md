# 노트플러스P Google PC 백업 1회 활성화 안내 v1

기준일: 2026-07-22

이 작업은 Google 계정 소유자만 한 번 수행한다. 완료 전에도 노트플러스P의 IndexedDB 저장·편집은 그대로 작동하며, 앱은 어떤 노트도 Google로 보내지 않는다.

## 1. Firebase 프로젝트와 Web App

1. [Firebase Console](https://console.firebase.google.com/)을 연다.
2. `프로젝트 추가`로 노트플러스P 전용 프로젝트를 만든다.
3. 프로젝트 개요의 Web 아이콘 `</>`을 눌러 Web App을 등록한다.
4. 표시되는 `firebaseConfig`에서 `apiKey`, `authDomain`, `projectId`, `storageBucket`, `appId`만 복사한다.
5. 이 저장소의 `firebase-config.example.js`를 참고해 `firebase-config.js`의 `null`을 해당 객체로 바꾼다. Web 설정은 공개 값이며 비밀번호를 넣으면 안 된다.

## 2. Google 로그인

1. Firebase Console → Build → Authentication → 시작하기.
2. Sign-in method → Google → 사용 설정 → 지원 이메일 선택 → 저장.
3. Authentication → Settings → Authorized domains에 `hanksleekorea-boop.github.io`를 추가한다.

## 3. Cloud Storage와 과금 경계

1. Firebase Console → Build → Storage → 시작하기.
2. 사용자와 가까운 리전을 선택한다. 만든 뒤 리전 변경은 어렵다.
3. 2026-07 현재 Cloud Storage 사용에는 Blaze 요금제가 필요하다. 결제 연결은 사용자가 비용·한도를 확인한 뒤 직접 승인한다.
4. 예산 알림과 사용량 알림을 먼저 설정한다. Blaze는 상한선이 아니므로 콘솔 사용량도 정기 확인한다.

## 4. 보안 규칙

1. Storage → Rules를 연다.
2. 이 저장소의 `firebase.storage.rules` 전체를 붙여 넣고 게시한다.
3. 규칙은 로그인 UID와 경로 UID가 같은 사용자만 읽기·쓰기를 허용하며 삭제는 거부한다.
4. `allow read, write: if true` 또는 단순 `request.auth != null` 규칙으로 바꾸지 않는다.

## 5. 공개 검증 순서

1. `firebase-config.js` 변경을 새 커밋으로 공개한다.
2. PC Chrome/Edge에서 공개 v13을 연다.
3. `Google 로그인`을 누르고 계정을 선택한다. 로그인만으로는 데이터가 전송되지 않는지 확인한다.
4. 먼저 `첨부 검사`를 실행해 문제 0인지 확인한다.
5. `이 PC 데이터 백업`을 누른다. 완료 수량이 현재 노트·첨부 수와 일치해야 한다.
6. Firebase Storage에서 `users/{내 uid}/current.json`과 `snapshots/{snapshotId}`가 생겼는지 확인한다.
7. 실패하면 로컬 노트 수와 첨부가 그대로인지 확인하고 오류 문구를 보존한다. 성공으로 간주하거나 다시 가져오기를 하지 않는다.

## 완료 판정

- 공개 v13에서 Google 로그인 성공
- 로그인만으로 업로드 0건
- 명시적 백업 뒤 노트·첨부 수량 일치
- manifest와 `current.json` SHA-256 검증 성공
- 실패 주입 뒤 로컬 상태 서명·첨부 Blob 유지
- 다른 계정으로 첫 계정 경로 읽기 거부

공식 참고: [Firebase Web 설정](https://firebase.google.com/docs/web/setup), [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [Cloud Storage 업로드](https://firebase.google.com/docs/storage/web/upload-files), [Storage 보안 규칙](https://firebase.google.com/docs/storage/security/rules-conditions)
