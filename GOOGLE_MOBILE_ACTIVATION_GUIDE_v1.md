# 노트플러스P 휴대폰 Google 로그인 활성화 안내 v1

현재 앱 코드는 PC·Android·iPhone 로그인을 지원하지만 `firebase-config.js`가 null이라 실제 Google 버튼은 아직 비활성이다.

## 운영자 설정

1. Firebase Console에서 프로젝트와 Web App을 만든다.
2. Authentication → Sign-in method에서 Google을 활성화한다.
3. Authentication → Settings → Authorized domains에 `hanksleekorea-boop.github.io`를 추가한다.
4. Web App 공개 설정을 `firebase-config.js`에 입력한다. GitHub Pages에서는 `mobileAuthMode: "popup"`을 유지한다.
5. 첨부 백업이 필요하므로 Cloud Storage를 활성화하고 현재 요금제 요구사항을 확인한다.
6. `firebase.storage.rules`의 UID별 규칙을 게시한다. 삭제는 계속 금지한다.
7. 공개 v15에서 실제 계정 로그인·로그아웃·재접속·타계정 거부를 검증한다.

## 사용자가 PC 데이터를 휴대폰으로 옮기는 순서

1. PC 공개 v15에서 Google 로그인한다.
2. `이 PC 데이터 백업`을 누르고 완료 수량을 확인한다.
3. 휴대폰에서 같은 공개 v15를 열거나 홈 화면에 추가한다.
4. `정리` → `Google 로그인 (휴대폰)`을 누르고 PC와 같은 계정을 선택한다.
5. `클라우드 백업 확인`을 눌러 노트·첨부 수량을 먼저 확인한다.
6. 수량이 맞을 때만 `검증된 백업 복원`을 다시 눌러 명시적으로 복원한다.
7. 앱을 닫았다 다시 열어 노트와 첨부가 유지되는지 확인한다.

로그인만으로는 노트가 자동 전송되거나 덮어써지지 않는다. 복원 전 휴대폰의 기존 로컬 상태는 자동 보관되며, 첨부 충돌은 새 ID로 재매핑한다.

## GitHub Pages에서 redirect를 기본으로 쓰지 않는 이유

Firebase 공식 문서는 모바일에서 redirect를 권장하지만, Firebase 외부 호스팅은 최신 브라우저의 제3자 저장소 차단을 피하기 위한 인증 프록시·동일 도메인 구성이 필요하다. 현재 GitHub Pages 공개본은 사용자 클릭으로 팝업을 여는 방식을 기본값으로 사용한다. Firebase Hosting 또는 공식 권장 프록시를 구성한 뒤에만 `mobileAuthMode: "redirect"`를 선택한다.
