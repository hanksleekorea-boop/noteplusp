# 노트플러스P 실제 기기 미러 QA v19 재개 기록 · 2026-07-23

## 공개 후보

- URL: `https://hanksleekorea-boop.github.io/noteplusp/%EB%85%B8%ED%8A%B8%EC%95%B1_v19.html`
- 공개 응답: HTTP 200
- v19 loader SHA-256: `D77E2D357162A74C4EFB219781609DD96375036ECE8C6B1D51CEA7C17B5DD4DF`
- v19 Drive module SHA-256: `C9DB4B4ABE2FB19E0A75609A45932F62E4936812F2FDA90218EF600D0FD3E4E9`
- v19 worker SHA-256: `973094E8F5C91755863DC571539D18A3061BDDAABAB8C9A95D3D5C26357E1F93`

## 자동 검증

- PASS: v18/v19 module·loader·worker `new Function` 구문 검사
- PASS: v18 기존 정적 안전 계약
- PASS: v19 versioned loader·resumable 경로 정적 계약
- PASS: 3바이트 multipart-related와 6MiB resumable 세션/chunk의 브라우저 Fetch 모의 프로토콜
- 이 결과는 실제 Google Drive 파일 쓰기, PC의 실데이터 백업, 휴대폰 복원 증거가 아니다.

## 실제 기기 재개 시도

- 이전 wireless ADB 연결 기기 SM-G996N에 대응하는 scrcpy 미러 창이 현재 목록에 없었다.
- 기존 `scrcpy.exe` 재실행을 시도했으나 Computer Use가 `system cursor manager did not become ready`를 반환했다.
- 기기 화면 캡처·URL 입력·Google 로그인·Drive 권한·백업·복원은 하지 않았다.
- 분류: 기기 미러/Windows 자동화 환경 PARTIAL. 앱 결함·Drive 결함으로 확정하지 않는다.

## 다음 재개 지점

1. SM-G996N scrcpy 창이 정상 표시될 때 공개 v19 URL을 연다.
2. Google 계정 화면·권한 화면이면 사용자에게 넘긴다.
3. PC에서 원본 데이터 백업이 완료된 후, 휴대폰에서는 `클라우드 백업 확인` 1회만 실행해 읽기 전용 미리보기를 확인한다.
4. 노트·첨부 수와 기기 저장공간이 맞을 때만 두 번째 복원을 실행한다.
