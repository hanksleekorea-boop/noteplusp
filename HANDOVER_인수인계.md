# 노트플러스P — 개발 인수인계 문서 (HANDOVER)

> **이 문서 하나로 100% 이어받기.** 새 개발 환경(PC Codex, ChatGPT, Claude, 사람 개발자 누구든)이 이 문서만 읽으면 프로젝트를 그대로 이어서 개발할 수 있도록 작성됨. 아래 "0. 30초 요약"부터 읽고, 이어받을 땐 "12. 이어받기 절차"를 따를 것.
>
> 최종 갱신: 2026-07-16 · 현재 정본 버전: **노트앱_v5.html** · 프레임워크: **v7.2**

---

## 0. 30초 요약 (먼저 읽기)
- **무엇**: Evernote를 비롯한 노트앱 데이터를 하나로 통합하는 **웹 노트 앱**. 백엔드 없는 **단일 HTML 파일**(오프라인 동작, 브라우저 localStorage 저장).
- **지금 상태**: v5까지 완성. 기본 노트(작성·노트북·태그·검색·삭제) + 리치텍스트 편집기 + JSON 백업 + **Evernote(.enex) 가져오기(서식·링크·표·체크박스·웹클립주소 보존)** + XSS 새니타이저. 실행코드 준비도 **약 97%**.
- **실증**: 실제 Evernote 내보내기 파일 121개(노트 160개)로 가져오기 100% 검증 완료. XSS 공격 6종 무력화 검증 완료.
- **다음 큰 조각**: 첨부파일(이미지·PDF) 가져오기 → **저장소를 localStorage→IndexedDB로 전환해야 함**(구조 변경). 그 외 다크모드·타 브라우저 검증은 폴리시.
- **이어받는 법**: 최신 `노트앱_v5.html`을 열어 그대로 편집. 테스트는 Playwright(헤드리스 Chromium). 아래 12장 참고.

---

## 1. 프로젝트 정체 & 목표
- 프로젝트명: **노트플러스P** (claude.ai 프로젝트)
- 한 줄 목표: "에버노트를 비롯한 모든 사용중인 노트앱의 데이터를 하나의 앱으로 통합하는 앱"
- 성격: **자기용/학습**(사업 아님). 초기 "사업용"으로 시작했으나 사용자가 "일단 내가 만들어 굴려보기"를 택해 자기용으로 재확정됨 → 시장·수익 고려 제거. 성공 기준 = "내가 실제로 쓰게 되는가".
- 벤치마크: Evernote 10.x의 실제 UX(3분할 레이아웃, 초록 톤, 서식 툴바, 태그 하단 배치).

## 2. 현재 상태
| 축 | 값 | 근거 |
|---|---|---|
| 설계·데이터 준비도 | 100% | 씨앗·경로·MVP·와이어프레임·기능 전부 확정 |
| 실행코드 준비도 | ~97% | 자동테스트(합성+실파일121+보안+회귀) 통과. 미완: 첨부파일, 한국어 실계정 파일, 타 브라우저 |
| 검증 | 자동화 광범위 | Playwright 헤드리스. 사람 손 실사용은 사용자 몫으로 남음 |

## 3. 파일 인벤토리 (★ = 정본/최신)
| 파일 | 역할 | 상태 |
|---|---|---|
| **노트앱_v5.html** ★ | 현재 정본 앱. 이걸 편집해서 이어감 | 최신 |
| 노트앱_v4.html | v5 직전(리치편집기·UX). 롤백 참고용 | 보존 |
| 노트앱_v3.html | Evernote 평문 가져오기 도입판 | 보존 |
| 노트앱_v2.html | JSON 백업(내보내기/가져오기) 도입판 | 보존 |
| 노트앱_v1.html | 최초 MVP(5기능) | 보존 |
| 노트앱_와이어프레임_v1.html | 5막 화면구조 설계도 | 참고 |
| 살아있는_앱창작_프레임워크_v7.2.md ★ | 이 프로젝트를 굴리는 메타 프레임워크 정본 | 최신 |
| 살아있는_앱창작_프레임워크_v7.1.md | v7.2 직전 스냅샷(롤백용) | 보존 |
| 진행문서_앱창작.md ★ | 세션 로그·판정·버그로그·큐가 누적된 살아있는 문서 | 최신 |
| HANDOVER_인수인계.md (이 문서) | 인수인계 종합 | 이 파일 |
| NEXT_PRIORITIES.md | 다음 작업 큐(짧은 액션 리스트) | 동반 |

> **버전 관리 방식**: 파괴적 덮어쓰기 대신 v1→v5로 파일을 늘려왔다. 각 구버전은 스냅샷으로 보존(롤백 가능). 이어받을 땐 최신 vN만 편집하되, 필요 시 vN+1로 올려도 됨(팀 관례에 맞게 선택).

## 4. 아키텍처
- **단일 HTML 파일**. 외부 의존성 0, 빌드 과정 0, 서버 0. 파일을 브라우저로 열면 바로 동작.
- 3분할 레이아웃: 사이드바(노트북·태그·가져오기/백업) | 노트 목록 | 편집기.
- **저장**: 브라우저 `localStorage` 키 `notes_app_v1`. 접근 실패(미리보기 샌드박스 등) 시 try/catch로 감싸 **인메모리로 계속 동작 + 상단 배너로 정직 고지**(프레임워크 v7.2 "데이터 지속성 원칙").
- **자동저장**: 편집 입력 400ms 디바운스 후 저장. 상태표시 "모든 변경 사항 저장됨 ✓".
- 편집기는 `contenteditable` 리치텍스트. 서식은 `document.execCommand`(굵게·기울임·밑줄·취소선·H1/H2/H3·목록·체크리스트·형광펜·구분선). 붙여넣기는 평문만 허용(위생).

## 5. 데이터 스키마 (localStorage JSON, schema 4)
```
{
  "schema": 4,
  "notebooks": ["업무","개인", ...],           // 문자열 배열
  "notes": [
    {
      "id": "enex_abc123",                      // 고유 id
      "title": "제목",
      "body": "검색·목록용 평문 (bodyHtml에서 파생)",
      "bodyHtml": "<div>서식 포함 HTML</div>",   // 편집기 렌더 소스 (v4부터)
      "notebook": "업무",
      "tags": ["태그1","태그2"],
      "created": 1750000000000,                 // epoch ms
      "updated": 1750000000000
    }
  ],
  "evernoteBannerDismissed": false
}
```
- **마이그레이션**: 로드 시 `migrateState()`가 구버전(v1~v3, bodyHtml 없음) 데이터를 자동 변환 — `body`(평문)를 이스케이프+`<br>`로 `bodyHtml` 생성, `created` 없으면 `updated`로 채움. XSS 안전(이스케이프) 확인됨. JSON 백업 가져오기에도 동일 적용(구버전 백업 무손실 수용).

## 6. 기능 매트릭스
| 기능 | 도입 | 비고 |
|---|---|---|
| 노트 작성/목록/삭제 | v1 | |
| 노트북 + 태그 정리, 필터 | v1 | |
| 검색(제목+본문) | v1 | |
| JSON 내보내기/가져오기(병합·무손실) | v2 | 다운로드 실패 시 수동복사 폴백 |
| Evernote(.enex) 가져오기 — 평문 | v3 | 다중파일, 파일명=노트북명 |
| 리치텍스트 편집기 + 서식 툴바 | v4 | 태그 하단 배치, 정렬, 노트 메타(생성/수정/글자수) |
| 데이터 무손실 마이그레이션 | v4 | 구버전→schema4 |
| **.enex 서식·링크·표·체크박스·웹클립주소 보존** | **v5** | 화이트리스트 새니타이저 |

## 7. Evernote 가져오기 상세 (핵심 기능)
- 입력: Evernote 공식 내보내기 **.enex**(ENML=XHTML 기반). 여러 파일 동시 선택 → 파일명이 노트북명.
- **왜 API 아님**: Evernote 계정에서 자동으로 "긁어오는" 건 불가(개발자 토큰 승인·서버 필요, 브라우저 직접호출 차단). .enex 가져오기가 백엔드 없는 앱에서 유일하게 작동하는 정직한 경로.
- 파서 2단:
  1. `parseEnex()` — 표준 `DOMParser(text/xml)`.
  2. `parseEnexLenient()` — 표준 실패 시(예: **Evernote 10.19+가 만드는 중첩 CDATA**) 정규식으로 `<note>` 단위 구출. `<note>` 없는 진짜 쓰레기 파일만 거절.
- 노트 콘텐츠(ENML) → 리치 HTML 변환: `enmlToRich()`.
  - self-closing 커스텀 태그(`<en-todo/>`,`<en-media/>`)를 사전 정규식으로 `<input>`·placeholder 치환 후 `text/html` 파싱(엔티티·messy 마크업 관대 처리).
  - `appendSafe()`가 **화이트리스트**로 재구성(8장).
- **보존**: 제목·본문·태그·생성/수정일·서식(굵게/기울임/밑줄/취소선/색/형광펜)·링크(URL)·표·체크박스·제목(h1~h3)·목록·인용·코드·웹클립 원본주소(하단 링크).
- **유실(고지됨)**: 첨부파일(이미지·PDF·녹음)은 `en-media`를 "📎 첨부(미지원)" 자리표시로 대체, 실데이터 버림. 노트북 구조는 ENEX에 정보 없어 파일명 추정. 암호화 노트는 "🔒" 표시.

## 8. 보안 모델 (새니타이저 — 절대 약화 금지)
외부 ENML을 편집기에 주입 = XSS 표면. 방어:
- 원문은 `DOMParser`로 **비활성 파싱**(스크립트 미실행, 리소스 미로드).
- 재구성은 **화이트리스트 태그만** `createElement`로 다시 지음: `ENML_ALLOW`(div,p,br,strong,em,u,s,h1-3,ul,ol,li,table/tr/td/th,a,span,hr,blockquote,code,pre,sup,sub,input).
- 속성: `a[href]`는 `http/https/mailto`만 통과(그 외 href 제거→클릭 무력), `td/th[colspan/rowspan]` 숫자만, `style`은 `STYLE_OK`(color,background-color,font-weight,font-style,text-decoration,text-align)만 + `url()/expression/javascript:/@import/<>` 값 차단. `on*` 핸들러·`script/style/iframe/object/embed/img/link/meta`는 전부 드롭.
- 검증됨: `javascript:` 링크 / `img onerror` / `onclick` / `<script>` / `style url()` / 등 6종 공격 픽스처 → dialog 0회, href 제거 확인.
- ⚠️ **이어받는 이가 지켜야 할 것**: 가져오기·붙여넣기에서 나온 HTML을 `innerHTML`에 넣기 전 반드시 이 화이트리스트를 통과시킬 것. 태그/속성 추가 시 화이트리스트도 같이 갱신.

## 9. 테스트 하네스
- 도구: **Playwright + 헤드리스 Chromium**(`/opt/pw-browsers/chromium`). Node ESM 스크립트.
- 실행 예: `node test_v5.mjs` (보안+서식+실파일), `node test_v5_regress.mjs`(편집기·마이그레이션·백업 회귀), `node test_real_enex.mjs`(실파일 카운트 무결성).
- 실파일 픽스처 출처(무료·공개): GitHub `akosbalasko/yarle`(test/data), `wormi4ok/evernote2md`(encoding/enex/testdata). 합계 121개 .enex / 160 노트. 웹클립·이미지·PDF첨부·암호화·표·중첩CDATA·1.4MB 대형 포함.
- 표준 절차(권장): 산출 후 ① `new Function(scriptText)`로 **정적 구문검사** ② 헤드리스로 기능·보안 테스트 ③ 스크린샷으로 시각 확인. (버그 #8이 정적 구문검사로 잡혔음.)

## 10. 버그 로그 & 교훈 (누적, 삭제 금지)
1. 미리보기 샌드박스 localStorage 차단 → try/catch+인메모리+배너(v7.2 원칙화의 근거).
2. `SendUserFile`→`device_commit_files` UUID 타이밍 실수(반복) → 반드시 순차 실행.
3. 사이드바 flex-shrink로 텍스트 겹침 → `.sidebar > *{flex-shrink:0}`.
4. 데스크톱 브리지 세션 중 끊김 → 이중 저장으로 무손실.
5. `.backup-btn` flex:1 상속으로 버튼 세로 늘어남 → flex:none.
6. 브리지 도구가 턴 중간 사라졌다 복귀 → 재시도로 흡수.
7. **중첩 CDATA(Evernote 10.19+)를 표준 XML 파서가 거부 → 노트 유실.** 실파일로만 발견됨. → lenient 파서 추가. 교훈: **합성 테스트 통과 ≠ 실물 무결성**.
8. **삽입 주석에 `*/` 포함 → 블록주석 조기종료 → 스크립트 전체 SyntaxError → 앱 먹통.** 정적 구문검사로 포착. 교훈: 주석에 `*/` 금지, `new Function` 검사 표준화.
9. `text/html` 파서가 커스텀 self-closing 태그의 형제노드를 자식으로 삼킴 → 사전 정규식 치환으로 회피.

## 11. 알려진 갭 & 다음 우선순위
- **A(완료·v5)**: 서식·링크·표·웹클립주소 보존.
- **B(다음 큰 조각)**: 첨부파일(이미지·PDF·녹음) 가져오기. **localStorage 5MB 한계 → IndexedDB 전환 필수**(구조 변경, 착수 전 설계 권장). en-media의 base64 리소스를 IndexedDB에 저장하고 편집기엔 참조로 렌더.
- **C**: 대용량 파일 가드(크기 경고·진행률).
- **D**: 다크모드(Evernote 다크테마).
- **E**: 타 브라우저(Firefox/Edge) contenteditable 산출 차이 검증.
- **F**: 클라우드 동기화(Drive/백엔드).
- **G**: 사용자 본인 한국어 실계정 .enex 최종 확인.

## 12. 이어받기 절차 (Codex / 새 AI / 개발자)
1. 이 문서 + `진행문서_앱창작.md` + `살아있는_앱창작_프레임워크_v7.2.md` + 최신 `노트앱_v5.html`을 확보(같은 폴더/드라이브에 있음).
2. `노트앱_v5.html`을 브라우저로 열어 현재 동작 확인(구버전 데이터 있으면 자동 이전됨).
3. 개발은 v5 HTML을 직접 편집(단일 파일). 서버/빌드 불필요.
4. 변경 후: 위 9장 "표준 절차"(정적 구문검사 → 헤드리스 테스트 → 스크린샷)로 검증.
5. 다음 작업은 11장 우선순위 또는 `NEXT_PRIORITIES.md` 참고. **B(첨부/IndexedDB)** 착수 전 설계안 먼저.
6. 보안 새니타이저(8장)는 절대 우회/약화 금지.
7. 진행 상황은 `진행문서_앱창작.md`에 이어서 기록(세션 로그·버그로그는 삭제 금지, 추가만).

## 13. "살아있는 프레임워크" 메타 규칙 (v7.2 요약)
이 프로젝트는 개발과 동시에 **프레임워크 자체도 진화**시킨다(원하면 승계, 아니면 무시 가능).
- 매 응답 말미 `[프롬프트 개선: 있음/없음]` 표시. 실측 마찰 있을 때만 "있음".
- 사용자가 `+` 입력 → 대기 중 개정 제안을 새 버전 파일로 산출(Z 삼중판정 통과분).
- 큐 신호: 사용자가 `0`/`ㅋ`/`ㅇ`/`j` 입력 → 우선순위 0 큐의 다음 항목(0-1부터) 즉시 실행. 사용자 실행 필요 항목은 S-1, S-2…
- 골든 세트 14케이스(회귀 기준, 수정 불가·확장만), 단조성 게이트(개정이 통과 수 낮추면 거부), 개정 원장 불변. 상세는 v7.2 정본 참고.

## 14. 저장소 지도 (3중, 개발 지속성 보장)
- **로컬 폴더**(PC): `C:\Users\User\Desktop\클로드프로젝트들\에버노트&앱개발프롬프트` — v1~v5 + 프레임워크 + 문서. PC Codex가 여기서 직접 읽고 씀.
- **claude.ai 프로젝트 지식**("노트플러스P"): 같은 파일 세트. 웹·모바일 어디서든, 기기 전원 무관 접근.
- **Google Drive**: 이 인수인계 번들 폴더(이 문서 상단/전달 메시지의 링크). 클라우드 백업 + 링크 공유용.
- 셋 중 하나가 끊겨도 나머지로 무손실(실제로 세션 중 로컬 브리지 끊김을 이 이중화가 방어함 — 버그 #4).

---
*이 문서는 프로젝트가 진행되면 갱신됨. 최신본은 위 저장소 3곳에 동기화.*

## 15. 2026-07-17 · 0-1 완료 갱신 (앞선 첨부 미지원 상태를 대체)
- 정본 파일명은 계속 **`노트앱_v5.html`**이며 앱 schema는 **5**로 상승했다. SHA-256: `09510607204C0E955F70C5FE85E0BED37D81671EBCD6EB1BFAFB2BA46B235D36`.
- 저장은 IndexedDB `noteplusp_schema5`를 주 저장소로 사용한다. `app_state`, `attachment_meta`, `attachment_blob`, `migration_meta`를 분리했다.
- 기존 localStorage `notes_app_v1`은 무손실·멱등 이전 후 검증 기록을 남기며 자동 삭제하거나 덮어쓰지 않는다. IDB 실패 시 `notes_app_v1_schema5_fallback` 또는 세션 메모리로 계속 동작하고 화면에 저장 한계를 고지한다.
- Evernote ENEX의 이미지·PDF·녹음을 base64에서 Blob으로 변환해 저장한다. 외부 HTML은 기존 화이트리스트를 통과하고, 본문에는 실행 가능한 원문 미디어를 넣지 않는다. 렌더는 노트 소유 관계가 검증된 attachment ID와 Blob URL로 코드가 직접 만든 DOM만 사용하며 화면 전환·삭제 시 URL을 해제한다.
- JSON 백업/복원에도 첨부를 base64로 포함한다. 지원하지 않거나 손상된 첨부와 100MB 초과 단일 첨부는 제외하고 개수를 고지한다.
- 재구성 테스트: `tests/test_noteplus_regress.mjs`. 정적 구문, 기본 편집, schema 4→5 이전·재실행, localStorage 원본 보존, ENML/JSON XSS, 중첩 CDATA, 이미지·PDF·오디오 저장·렌더·백업·삭제, Object URL 해제, IDB/localStorage 실패 폴백을 검증한다.
- 시각 검증 캡처: `artifacts/noteplus_schema5_attachments.png`. 다음 큐는 0-2 다크모드다.

## 16. 2026-07-17 · 0-2 다크모드 완료 갱신
- 정본은 계속 `노트앱_v5.html`, schema 5다. 현재 SHA-256: `387DDA3F69B229B267AD8B9BECB9DDD1A500B0488A64375F12B6C49855695C49`.
- 밝은 테마를 기존 기본값으로 유지하면서 사이드바 하단의 `다크 모드` 토글을 추가했다. 어두운 배경·패널·목록 선택·툴바·편집기·첨부 카드·상태 배너를 Evernote 계열의 차분한 검정/초록 톤으로 맞췄다.
- 선택은 `state.theme`(`light`/`dark`)으로 schema 5 `app_state`에 함께 저장된다. 재실행 시 복원되고 언제든 라이트 모드로 되돌릴 수 있으며 토글은 `aria-pressed` 상태를 제공한다.
- 회귀 하네스에 토글, IDB 저장, 재실행 복원, 라이트 롤백, 실제 계산 색상 검사를 추가했다. 다크 화면 캡처는 `artifacts/noteplus_dark_mode.png`다.
- 다음 큐는 0-3 Firefox/Edge contenteditable 산출 차이 자동 검증이다.

## 17. 2026-07-17 · 0-2 시각 QA 최종 보정
- 다크모드 시각 캡처에서 제목 입력칸에 남은 브라우저 기본 입력 배경을 발견해 투명 배경으로 통일했다. 기능·데이터 변경은 없다.
- 전체 정적·브라우저·보안·마이그레이션·첨부·테마 회귀를 다시 실행해 전부 통과하고 `artifacts/noteplus_dark_mode.png`를 재생성·확인했다.
- 최종 SHA-256은 `6479A15AF42D3DFA1403A1528392248C49A6BE317EE233AC0FB2A6206A38975F`이며, 이 값이 16장의 구현 직후 해시보다 최신이다.

## 18. 2026-07-17 · 0-3 Edge/Firefox contenteditable 검증 완료
- 앱 정본 코드는 변경하지 않았다. SHA-256은 계속 `6479A15AF42D3DFA1403A1528392248C49A6BE317EE233AC0FB2A6206A38975F`다.
- `tests/test_contenteditable_browsers.mjs`를 추가해 실제 Microsoft Edge와 Playwright Firefox에서 굵게·기울임·H1·글머리 목록·체크리스트·Enter 줄바꿈을 생성하고 schema 5 저장·페이지 재로드까지 검증한다.
- `tests/check_contenteditable_reports.mjs`가 두 브라우저 보고서의 텍스트·strong/em/h1/ul/li/checkbox·위험 태그 수와 재로드 결과를 자동 비교한다.
- 원시 HTML 차이는 2건이다: 목록에서 Edge는 `<div><ul>…`, Firefox는 `<ul>…`; Enter에서 Edge는 `첫째 줄<div>둘째 줄</div>`, Firefox는 `<div>첫째 줄</div><div>둘째 줄</div>`. 저장 평문과 렌더 텍스트, 서식 의미는 동일하므로 앱 정규화 변경은 하지 않았다.
- 산출물: `artifacts/contenteditable_edge_report.json`, `contenteditable_firefox_report.json`, `contenteditable_comparison.json`, Edge/Firefox 화면 PNG.
- Firefox 실행 파일은 Playwright Firefox 151.0(v1532)으로 설치했다. 관리 샌드박스에서는 SWGL 프레임버퍼 제한으로 시작이 막혔으나 실제 Firefox 프로세스로 실행하면 전 항목 통과했다. 제품 실패가 아닌 검증 환경 제한이다.
- 기존 `tests/test_noteplus_regress.mjs` 전체도 다시 통과했다. 다음 큐는 0-4 대용량 ENEX 가드다.

## 19. 2026-07-17 · 0-4 대용량 ENEX 가드 완료
- 정본 `노트앱_v5.html` SHA-256: `35732AD7ECD637B0735817415C9D4B064894D3D9D36F6479AD18E8064E9D859C`.
- 파일 하나가 50MB를 초과하거나 처리 대상 합계가 150MB를 초과하면 선택 용량과 함께 큰 파일 경고를 표시하되 자동으로 계속 처리한다.
- 단일 파일이 250MB를 초과하면 해당 파일만 읽지 않고 제외하며, 한 번에 선택한 합계가 500MB를 초과하면 전체를 읽기 전에 중단하고 여러 번으로 나눠 가져오도록 안내한다. 어떤 경우에도 기존 노트는 변경하지 않는다.
- 다중 파일 읽기 진행량, 현재 파일명, 읽기/분석/처리 완료 단계, 성공 파일 수를 상단 진행 막대와 `aria-live` 상태로 표시한다. 파일 읽기에 파일별 90%, 분석 완료에 나머지 10%를 배정해 분석 중 100%로 보이는 오해를 막았다.
- 성공 결과는 2.5초 동안 완료율 100%와 함께 보인 뒤 기존 동작대로 Evernote 안내를 접는다. 손상 파일만 선택한 경우 성공 0건과 기존 노트 보존을 명시한다.
- 자동검증: `tests/test_enex_progress.mjs`. 경고/차단 경계값, 다중파일 2개 실제 가져오기, 진행률 100%, 손상 ENEX 무손실을 검증한다. 화면 캡처: `artifacts/enex_progress_complete.png`.
- 기존 정적·schema 5·첨부·보안·마이그레이션·저장 실패 전체 회귀도 다시 통과했다. 우선순위 0은 모두 완료됐으며 다음은 사용자 본인 ENEX가 필요한 S-1이다.

## 20. 2026-07-17 · Evernote ENEX 추출 튜토리얼 완료
- 정본 `노트앱_v5.html` SHA-256: `1D4E5AB46A5F3A6E3490B9F0691B0E25ED49725CA219C53E554CEAC9FCFF77E8`.
- 상단 Evernote 안내와 사이드바에 `ENEX 추출 방법` 진입 버튼을 추가하고 6단계 앱 내 튜토리얼을 구현했다.
- 공식 Evernote 도움말(2025-03-12 갱신) 기준으로 Windows/Mac 데스크톱 앱에서 노트북 또는 노트를 선택→우클릭→Export…→ENEX→속성 선택→저장하는 절차를 안내한다. Evernote 웹에서는 내보내기가 불가능하다는 점, 개별 노트 최대 100개 또는 노트북 전체 내보내기가 가능하다는 점을 포함했다.
- 노트플러스P의 250MB 단일 파일 한도와 연결해 큰 파일은 노트 선택 범위를 줄여 여러 ENEX로 나누도록 설명한다. 공식 원문 링크: `https://help.evernote.com/hc/en-us/articles/209005557-Export-Notes-and-Notebooks-as-ENEX-or-HTML`.
- 튜토리얼은 라이트/다크 테마, 모바일 하단 시트형 레이아웃, `role=dialog`, `aria-modal`, 포커스 순환, Escape 닫기, 호출 버튼으로 포커스 복귀, 파일 선택 연결을 지원한다.
- 재열 때 이전 스크롤 위치가 남아 첫 단계가 가려지는 시각 QA 문제를 발견해 매번 최상단으로 초기화했다.
- 자동검증: `tests/test_enex_tutorial.mjs`. 콘텐츠·공식 링크·포커스·파일 선택·다크모드·모바일 통과. 캡처: `artifacts/enex_tutorial_dark.png`, `enex_tutorial_mobile.png`.
- 기존 `test_noteplus_regress.mjs`와 `test_enex_progress.mjs`도 다시 통과했다. 후속 개발 우선순위 10개를 `NEXT_PRIORITIES.md`에 정본화했다.

## 21. 2026-07-17 · ENEX 가져오기 선택 미리보기 완료
- 정본 `노트앱_v5.html` SHA-256: `48ECE88CCC8678679451606C71C09FBD6AE1E6896D465ABBD5004121A01C995B`.
- ENEX 파일 분석 결과를 즉시 `state`에 넣지 않고 메모리의 대기 묶음으로 보관한다. 미리보기에서 제목·노트북·태그·본문 요약·첨부 이름/크기를 확인하고 전체 선택·전체 해제·개별 선택할 수 있다.
- 확인 전에는 노트·노트북·첨부 Blob·IndexedDB가 변경되지 않는다. 확인 시 선택 노트와 그 노트에 속한 첨부만 추려 schema 5 상태/메타/Blob 단일 트랜잭션으로 저장하며, 선택하지 않은 첨부 Blob은 저장하지 않는다.
- 닫기·취소·Escape·바깥 영역 클릭은 모두 대기 묶음을 폐기하고 기존 노트와 첨부가 그대로임을 고지한다. 저장 실패 시 기존 IDB→전용 localStorage→세션 메모리 폴백과 정직 고지를 그대로 사용한다.
- 미리보기는 외부 HTML을 삽입하지 않고 `textContent`와 코드 통제 DOM만 사용한다. ENEX 본문은 기존 화이트리스트 새니타이저 결과의 평문 요약만 보여준다.
- 접근성/화면: modal dialog, 제목·설명 연결, 포커스 순환, Esc 취소, 선택 수 `aria-live`, 0개 선택 시 확인 비활성, 다크 테마와 390px 모바일 레이아웃을 지원한다.
- 자동검증: `tests/test_enex_preview.mjs`에서 확인 전 상태 불변, 2개 중 1개 선택 저장, 제외 노트의 PDF Blob 미저장, 전체 해제 시 확인 비활성, Esc 취소 상태 동일성, 다크·모바일, page error 0을 통과했다. `test_enex_progress.mjs`, `test_enex_tutorial.mjs`, `test_noteplus_regress.mjs`도 재통과했다.
- 캡처: `artifacts/enex_import_preview.png`, `artifacts/enex_import_preview_dark_mobile.png`, 갱신된 `artifacts/enex_progress_complete.png`.
- 다음 자동 개발 항목은 가져오기 진행 중 중단과 완료 묶음 되돌리기다. 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 22. 2026-07-17 · ENEX 가져오기 중단 및 최신 묶음 되돌리기 완료
- 정본 `노트앱_v5.html` SHA-256: `277629B831754049B450D22F2F53E13A16645E30E5D32DACD573C5A7B177C771`.
- 파일을 읽는 동안 상단 진행 영역의 `가져오기 중단`으로 활성 FileReader를 `abort()`한다. 중단 시 분석 대기 노트·첨부 Blob을 버리고 상태·IndexedDB·기존 노트를 건드리지 않으며, 변경 없음 상태를 명시한다.
- 확인 저장된 최신 ENEX 묶음은 state의 `lastImportUndo` 메타(노트 ID·첨부 ID·새 노트북·원래 배너 상태·노트 수정 시각)로 기록한다. 앱 재시작 뒤에도 `방금 가져온 묶음 되돌리기`가 유지된다.
- 되돌리기는 실수 방지를 위해 3초 안에 두 번 눌러야 실행한다. 해당 노트·첨부 메타·Blob을 함께 삭제하고, 그 묶음이 새로 만든 빈 노트북만 제거한다. IndexedDB 실패 시 기존 localStorage/메모리 폴백과 저장 한계 고지를 사용한다.
- 가져온 뒤 노트를 수정한 경우 수정 시각을 대조해 일괄 삭제를 거부한다. 사용자의 후속 편집을 보존하기 위한 안전 장치다.
- 자동검증: `tests/test_enex_cancel_undo.mjs`에서 실제 FileReader abort, 상태 불변, 저장 후 재시작·일괄 되돌리기, PDF Blob 삭제, 수정 노트 보호, page error 0을 통과했다. 기존 `test_noteplus_regress.mjs`, `test_enex_preview.mjs`, `test_enex_progress.mjs`, `test_enex_tutorial.mjs`도 재통과했다.
- 캡처: `artifacts/enex_import_cancelled.png`, `artifacts/enex_import_undo.png`.
- 다음 자동 개발 항목은 중복 노트 판별과 선택적 병합이다. 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 23. 2026-07-17 · ENEX 중복 판별 및 선택 병합 완료
- 정본 `노트앱_v5.html` SHA-256: `A705331056EE2DC7C9508A5B17EAD2027A824FC57ABBE505126105465CC251C1`.
- 가져오기 미리보기에서 제목과 정규화된 본문이 같은 기존 노트, 같은 ENEX 안의 후속 중복 후보를 표시한다. 외부 HTML은 표시하지 않으며 기존 `textContent` 기반 미리보기만 사용한다.
- 기존 노트와의 중복은 기본 `건너뛰기`이며, 사용자가 `기존 노트에 태그·첨부 병합` 또는 `별도 노트로 추가`를 고를 수 있다. 병합은 원래 제목/본문을 덮어쓰지 않고 태그 합집합과 검증된 첨부 Blob만 대상 노트에 더한다.
- 같은 ENEX 안의 중복은 자동 병합하지 않는다. 기본 건너뛰기 또는 별도 추가만 제공해 어느 원본이 기준이 될지 사용자가 모르는 상태에서 데이터가 합쳐지는 일을 막는다.
- 최신 가져오기 되돌리기 메타에 병합 대상의 원래 태그·첨부 ID·수정 시각과 병합 직후 수정 시각을 추가했다. 되돌리면 새 Blob을 삭제하고 기존 태그·첨부 참조를 복구한다. 대상 노트가 이후 수정되면 전체 되돌리기를 중단한다.
- 자동검증: `tests/test_enex_duplicates.mjs`에서 기본 건너뛰기, 기존 노트 병합, PDF Blob 소유권 변경, 병합 되돌리기, 별도 추가, 파일 내부 중복 표시, 수정 대상 보호를 통과했다. `test_noteplus_regress.mjs`, `test_enex_preview.mjs`, `test_enex_progress.mjs`, `test_enex_cancel_undo.mjs`, `test_enex_tutorial.mjs`도 재통과했다.
- 캡처: `artifacts/enex_duplicate_merge.png`.
- 다음 자동 개발 항목은 이미지·PDF·녹음의 직접 추가·삭제·이름 변경이다. 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 24. 2026-07-17 · 이미지·PDF·녹음 직접 관리 완료
- 정본 `노트앱_v5.html` SHA-256: `CA2560E46EF7B1F6B3F0DC4354A05DA39914151E305AC9EF3CB33CFEDB46E5F9`.
- 편집기 첨부 영역에 `파일 추가`를 넣어 이미지(PNG/JPEG/GIF/WebP/BMP/AVIF/HEIC), PDF, 녹음 형식 파일을 여러 개 직접 추가할 수 있다. 단일 100MB 초과 또는 지원하지 않는 MIME은 기존 노트를 바꾸지 않고 제외 사실을 고지한다.
- 첨부 카드에서 이미지 미리보기, 오디오 컨트롤, PDF/원본 저장 링크를 기존 검증된 Blob URL 렌더 경계 안에서 제공한다. 파일명은 안전한 문자로 정규화한 뒤 메타만 변경하며 HTML 본문을 신뢰하지 않는다.
- 삭제는 3초 내 두 번 클릭으로 확정하며 노트의 attachment ID, IndexedDB 메타·Blob, 세션 첨부, Object URL을 함께 정리한다. 이름 변경·추가·삭제 모두 노트 수정 시각을 갱신해 최신 가져오기 되돌리기가 사용자의 후속 편집을 보호하도록 한다.
- IndexedDB 실패 시 파일은 세션 메모리에서 계속 열리고 상태를 전용 localStorage에 보조 저장하되, 재시작 뒤 첨부가 유지되지 않을 수 있음을 화면에 고지한다.
- 자동검증: `tests/test_manual_attachments.mjs`에서 이미지·PDF·오디오 추가, PDF 이름 변경, 두 번 클릭 삭제, IDB Blob 삭제, 비지원 형식 무변경, IndexedDB 실패 세션 유지·정직 고지를 통과했다. 기존 `test_noteplus_regress.mjs` 전체도 재통과했다.
- 캡처: `artifacts/manual_attachments.png`.
- 다음 자동 개발 항목은 휴지통과 삭제 노트 복원이다. 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 25. 2026-07-17 · 휴지통 및 삭제 노트 복원 완료
- 정본 `노트앱_v5.html` SHA-256: `1C028A281BD7997CACDBB216535ABECB5854CD4BECA5910CC71ED599F1ED170F`.
- schema 5 상태에 `trash`를 추가해 일반 삭제는 노트와 attachment ID를 휴지통으로 옮긴다. 첨부 메타·Blob·세션 객체를 보존하므로 이미지·PDF·녹음을 온전히 복원할 수 있다.
- 사이드바 `휴지통`에서 삭제 노트를 읽기 전용으로 열며, 복원 또는 영구 삭제만 제공한다. 복원은 원래 노트북과 첨부 참조를 유지하며, 없는 노트북은 다시 만든다.
- 영구 삭제는 3초 내 두 번 클릭으로 확정하고 그때만 attachment_meta, attachment_blob, 세션 첨부, Object URL을 함께 정리한다. 일반 삭제 뒤 최신 ENEX 묶음 되돌리기는 무효화해 참조가 엇갈리지 않게 했다.
- JSON 내보내기에는 휴지통도 포함되고, 가져오기 시 ID 충돌이 없는 휴지통 노트와 첨부를 복원한다. localStorage/메모리 폴백에서도 상태는 계속 유지되고 한계를 고지한다.
- 자동검증: `tests/test_trash_restore.mjs`에서 휴지통 이동, IDB Blob 보존, 재시작 후 유지, 읽기 전용, 복원, 영구 삭제 Blob 정리를 통과했다. `test_noteplus_regress.mjs` 전체도 새 휴지통 보존 의미로 재통과했다.
- 캡처: `artifacts/trash_restore.png`.
- 다음 자동 개발 항목은 노트북·태그 이름 변경·병합·삭제다. 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 26. 2026-07-17 · 노트북·태그 이름 변경·병합·삭제 완료
- 정본 `노트앱_v5.html` SHA-256: `1A4AD63C384EB81B5141046609C021D369DAA28F1830D3B84EFB15BF2DF9CCC8`.
- 사이드바 사용자 노트북과 태그에 이름 변경(✎), 병합(⇄), 삭제(×) 제어를 추가했다. 이름은 제어 문자를 제거하고 80자 이내로 정규화하며, 이미 존재하는 이름으로 바꾸는 일은 막는다.
- 노트북 변경·병합·삭제는 활성·휴지통 노트 모두에 적용한다. 삭제는 두 번 눌러 확정하며 노트·첨부 Blob을 지우지 않고 남은 첫 노트북으로 옮긴다. 마지막 노트북은 삭제할 수 없다.
- 태그 변경·병합·삭제도 활성·휴지통 노트 전체에 적용한다. 병합은 중복 태그를 하나로 정리하고, 삭제는 두 번 눌러 확정해 노트 내용·첨부·다른 태그를 보존한다.
- 자동검증: 새 `tests/test_notebook_tag_management.mjs`가 이름 변경, 병합, 2단계 삭제, 휴지통 포함 무손실 보존, page error 0을 통과했다. 기존 `tests/test_noteplus_regress.mjs` 전체도 재통과했다.
- 화면 검증: `artifacts/notebook_tag_management.png`를 직접 확인했다.
- 다음 자동 개발 항목은 모바일 화면 탐색 구조 개선이다. 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 41. 2026-07-19 · Evernote 5단계 전체 이전 온보딩 재설계 완료
- `ONBOARDING_REDESIGN_PLAN.md`에 사용자 사실, 기존 실측 문제, 5단계 흐름, 보안·저장 원칙, 완료 조건, 검증·되돌리기를 정본화한 뒤 구현했다.
- 기존 6단계 장문 모달을 `범위 확인 → PC 준비 → ENEX 저장 → 반복 체크 → 폴더 선택` 5단계 마법사로 교체했다. 한 번에 한 패널만 보이고 이전·다음·직접 단계 이동, `aria-current`, 제목 포커스, Escape·포커스 트랩을 지원한다.
- 첫 단계는 `Evernote에서는 노트북별 / 노트플러스P에서는 폴더 한 번`을 크게 표시하고 PC 전용 제약, 가져오는 핵심 데이터, 작업·기록·공유 권한 등 별도 확인 대상을 구분한다. 모바일에서는 PC에서 계속해야 한다는 고지를 강화했다.
- 실제 Windows 화면 2장은 기존 로컬 자산만 사용한다. 버전별 차이를 고려해 점 3개가 없을 때 노트북 우클릭 대체 경로를 함께 제공하며 외부 `img src`는 0개다.
- 노트북 이름을 쉼표·줄바꿈으로 붙여 넣으면 최대 200개를 중복 제거한 체크리스트로 만든다. 입력은 `textContent`로만 렌더하고 완료 수를 표시하며, 체크리스트 수를 기대 노트북 수 기본값에 연결한다. 체크 상태는 현재 탭에서만 유지된다고 고지한다.
- schema 5, IndexedDB 상태/Blob 분리, localStorage 원본, 새니타이저, 350MB/500MB 가드, 미리보기·취소·되돌리기·결과 보고서는 변경하지 않았다. 서비스워커는 `noteplusp-v5-shell-11`이다.
- 검증: `test_enex_tutorial.mjs`, `test_productivity_mobile.mjs`, `test_noteplus_regress.mjs`, ENEX 진행률·미리보기·중단·되돌리기·중복·재시도 회귀 전부 통과. 캡처: `evernote_onboarding_scope_desktop.png`, `evernote_visual_tutorial_desktop.png`, `evernote_onboarding_checklist_desktop.png`, `evernote_visual_tutorial_mobile.png`.
- 정본 SHA-256: `B357704EA1769E1426327C7E5CF9DE12379A070E66499F842319A7339CA6F48A`. 다음 즉시 실행 항목은 첨부 SHA-256 무결성 검사다.

## 40. 2026-07-19 · ENEX 중단·재시도·중복 방지 회귀 확대
- 새 `tests/test_enex_retry_dedupe.mjs`는 활성 FileReader 중단 뒤 노트·첨부·되돌리기 메타가 바뀌지 않는지 확인하고, 같은 ENEX를 다시 선택해 노트 1개와 PDF Blob 1개만 저장되는지 검증한다.
- 앱을 다시 시작한 뒤 정확히 같은 ENEX를 또 선택하면 기존 노트 중복 후보 1개로 표시되고, 기본 처리 `건너뛰기`, 선택 `0 / 1개`, 확인 버튼 비활성 상태가 되는지 검증한다. 미리보기를 취소한 뒤 노트 수, 첨부 ID, IndexedDB 메타·Blob이 첫 저장과 동일하며 대기 가져오기와 활성 작업 참조가 남지 않는 것도 확인한다.
- 직접 관련 회귀 `test_enex_cancel_undo.mjs`, `test_enex_duplicates.mjs`, 새 재시도 회귀가 모두 통과했다. 전체 `test_noteplus_regress.mjs`도 정적 구문, schema 4→5 무손실·멱등 이전, ENML/JSON 새니타이저, 이미지·PDF·녹음 Blob, IndexedDB/localStorage/세션 폴백까지 전부 통과했다.
- 시각 검증: `artifacts/enex_retry_duplicate_guard.png`. 앱 코드는 변경하지 않았고 공개 정본 SHA-256은 `936CD84FB798FCBEA4D06A4DF082338EC33947876B9861A954C6D895B1D5689D` 그대로다.
- 다음 단독 실행 신호에서는 즉시 실행 목록 2번인 첨부 SHA-256 무결성 검사를 진행한다. 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 39. 2026-07-18 · 실제 Evernote 화면 기반 전체 이전 튜토리얼
- 앱의 최우선 온보딩 제목을 `Evernote 모든 파일 가져오기 — 그대로 따라 하기`로 바꾸고, 목표를 `모든 노트북의 ENEX를 한 폴더에 모은 뒤 백업 폴더 전체 선택을 한 번 누르기`로 고정했다.
- 실제 Windows Evernote 화면 2장을 로컬 정적 자산으로 포함했다. `Notebooks → 노트북 행 점 3개 → Export notebook…`과 `ENEX format + 모든 속성 → Export` 화면이며, 앱 안에 실제 화면·출처 링크를 명시했다. 이 PC에는 Evernote 데스크톱 앱이 노출되지 않아 사용자 계정 화면을 캡처하지 않았고, 공개된 실제 화면 예시를 사용했다.
- 화면 자료는 `assets/evernote-guide/evernote-windows-notebook-menu.png`, `assets/evernote-guide/evernote-windows-enex-settings.png`이다. 노트 HTML이나 외부 URL에서 이미지를 불러오지 않으며 서비스 워커 셸에도 로컬 경로로만 포함한다.
- 가장 흔한 실패인 `Notes → 전체 선택 → Export Notes…`는 최대 100개 제한에 걸릴 수 있다고 실제 화면 바로 아래에서 경고한다. 공식 성공 경로는 노트북 이름의 메뉴를 여는 것이다.
- Evernote 공식 도움말의 ENEX 분할 범위가 300MB~2GB인데 기존 앱은 250MB 초과를 거부해 안내와 구현이 충돌했다. 단일 ENEX 허용 한도를 350MB로 올리고 사용자에게는 Evernote에서 300MB로 분할하도록 안내했다. 총 500MB 자동 묶음·저장공간 사전 점검·무변경 차단은 유지한다.
- 보안 경계는 그대로다. 가져온 HTML은 기존 화이트리스트 새니타이저를 거치고, 첨부는 검증된 id와 Blob URL로 코드가 만든 DOM에만 렌더하며 Object URL 해제·저장 실패 폴백·정직 고지를 유지한다.
- 검증: `new Function`, `test_enex_tutorial.mjs`, `test_productivity_mobile.mjs`, `test_enex_progress.mjs`, `test_enex_preview.mjs`, `test_noteplus_regress.mjs` 통과. 실제 300MB 계획 파일 수용, 로컬 이미지 2개 로드·alt·외부 이미지 src 0개, 모바일·다크모드를 확인했다.
- 시각 증빙: `artifacts/evernote_visual_tutorial_desktop.png`, `artifacts/evernote_visual_tutorial_mobile.png`. 서비스 워커 캐시 `noteplusp-v5-shell-10`. 정본 SHA-256: `936CD84FB798FCBEA4D06A4DF082338EC33947876B9861A954C6D895B1D5689D`.

## 29. 2026-07-18 · 심화 생산성·검증 묶음
- `test_productivity_mobile.mjs`가 암호화 백업 복호화, PWA 등록·오프라인 재시작, 모바일 회전, 1,000노트 검색, 표 행 조작, 이력 비교, 역링크, 템플릿, 저장 검색, 색인 재구축과 고아 첨부 안전 정리까지 커버한다.
- 구현 보완: PWA 개발용 신뢰 origin에 `127.0.0.1`도 포함했다. 서비스 워커가 제어하는 뒤에만 오프라인 회귀를 실행한다.
- 복구 지점은 상태 메타데이터만 복사하며 첨부 Blob은 같은 IndexedDB 보존본을 참조한다. 고아 첨부 정리는 활성·휴지통의 attachment id를 전부 모은 뒤에만 실행하며, 실패 시 삭제하지 않는다.
- 공유는 Markdown, 텍스트, 새니타이즈된 HTML 내보내기를 지원한다. 암호화 백업 비밀번호·평문은 저장하지 않는다.

## 30. 2026-07-18 · 공개 배포 및 홈 화면 바로가기
- 공개 주소: `https://hanksleekorea-boop.github.io/noteplusp/`. GitHub Pages build `0e41c9e`는 built 상태이고, 공개 URL HTTP 200을 확인했다.
- 배포 저장소는 `https://github.com/hanksleekorea-boop/noteplusp`이며, 정본을 변경하면 이 저장소의 `main`에 커밋·push하여 Pages 반영을 확인한다.
- `index.html`은 정본 `노트앱_v5.html`로 이동시킨다. 앱의 홈 화면 추가 버튼은 지원되는 브라우저의 설치 프롬프트를 열며, 지원되지 않는 브라우저에는 정확한 수동 설치 경로를 안내한다.
- PWA는 HTTPS 공개 주소에서만 설치된다. 이 앱의 데이터 저장은 여전히 사용자 브라우저의 IndexedDB/localStorage에만 있고, Pages는 정적 앱 파일만 제공한다.

## 31. 2026-07-18 · Evernote 전체 이전 온보딩
- 공개 앱 상단의 주 CTA는 `전체 이전 시작`이며, 사이드바에는 `Evernote 전체 이전 도우미`가 있다.
- 공식 제약: Evernote 내보내기는 Windows/Mac 데스크톱 앱에서만 가능하며 개별 선택은 최대 100개, 노트북 전체는 한 번에 1개다. 따라서 모든 노트북을 같은 폴더에 각각 ENEX로 저장한 뒤 폴더 전체를 노트플러스P에서 선택하는 흐름을 권장한다.
- `enexFolder`는 폴더 안의 `.enex`만 골라 기존 `enexFile` 파이프라인으로 전달한다. ENEX 외 파일은 저장·파싱하지 않는다.
- 사용자가 기대 노트 수와 노트북 수를 입력하면 미리보기와 완료 상태에서 발견 수를 비교한다. 수량 차이는 누락 가능성으로만 경고하며 자동으로 데이터를 삭제하거나 가져오기를 막지 않는다.
- 서비스 워커 캐시는 `noteplusp-v5-shell-3`으로 올려 기존 설치형 앱도 새 온보딩을 받는다.

## 32. 2026-07-18 · Windows PC 전체 자동 백업 도우미
- 앱의 `PC 전체 자동 백업(고급)`은 `노트플러스P_Evernote_전체백업_PC.zip`을 다운로드한다. 구성은 `START_EVERNOTE_BACKUP.cmd`, `evernote_full_backup.ps1`, `먼저읽기.txt`다.
- 도우미는 `evernote-backup` 1.13.1 Windows x64 portable ZIP만 사용하며 SHA-256 `2C1DAA36FADF5720419826B0809617029D14941E4EADFFA31049457D413B81B5` 일치 후에만 압축을 푼다.
- 실행 순서: 사용자 명시 동의 → 도구 무결성 확인 → 최초 OAuth/DB 초기화 → 증분 sync → `export --include-trash` → 결과 보고서 → ENEX 폴더와 공개 노트플러스P 열기.
- 저장 위치는 `%USERPROFILE%\Documents\NotePlusP-Evernote-Backup`이며 DB·ENEX를 자동 삭제하지 않는다. 중단된 sync는 재실행으로 이어갈 수 있다.
- 작업·알림은 Evernote 공개 API가 제공하지 않아 완전하지 않을 수 있다. 토큰 추출이나 비밀번호 수집 방식은 구현하지 않았다.
- PWA 캐시는 `noteplusp-v5-shell-4`; ZIP도 오프라인 셸 자산에 포함된다.

## 33. 2026-07-18 · 500MB 초과 ENEX 자동 분할
- `splitEnexIntoBatches()`는 단일 250MB 초과 파일을 먼저 제외하고 나머지를 묶음당 최대 500MB로 나눈다. 전체 선택이 500MB를 넘더라도 정상 파일은 차단하지 않는다.
- `enexBatchSession`은 배치 큐, 현재/전체 번호, 누적 발견·가져온 수, 제외 파일, 영속 저장 제한 여부만 메모리에 보관한다. schema 변경은 없으며 재시작 가능한 작업 큐로 저장하지 않는다.
- 각 묶음은 기존 `enexFile.onchange` 파이프라인과 확인 모달을 재사용한다. 확인 저장이 끝나면 다음 묶음으로 자동 이동하고, 마지막 묶음에서 전체 파일·노트·수량 대조·제외·저장 제한을 합산해 알린다.
- 중단·취소는 남은 큐까지 폐기하며 기존 데이터는 유지한다. 마지막 묶음 되돌리기는 기존 `lastImportUndo` 의미를 유지하므로 자동 분할 전체가 아니라 가장 최근 저장 묶음만 되돌린다.
- 서비스 워커 캐시는 `noteplusp-v5-shell-5`, 정본 SHA-256은 `1495FD3C9E72CC8B4E33DA624AB958897B99678F333AECF6CB8F4F1B01C84EFB`이다.
- 검증: 정적 구문, 자동 분할 브라우저 회귀, schema 4→5 무손실·멱등 이전, ENML/JSON XSS, 첨부 Blob, IndexedDB/localStorage/메모리 폴백, 노트북·태그 무손실 관리가 모두 통과했다.

## 34. 2026-07-18 · 자동 분할 전체 묶음 일괄 되돌리기
- 33장의 “마지막 저장 묶음만 되돌림” 제한은 이번 변경으로 해소됐다. 자동 분할 세션은 `undoBatch`에 각 확인 저장의 undo 메타를 누적하고 `state.lastImportUndo`에도 매 묶음 저장 시 반영한다.
- `normalizeImportUndo()`는 이전 데이터와 호환되는 `batchCount`, `importedFileCount`를 정규화한다. 이전 단일 묶음 undo는 자동으로 `batchCount: 1`로 해석된다.
- `mergeImportUndoBatches()`는 새 노트·첨부·새 노트북을 중복 없이 합친다. 기존 노트 다중 병합은 최초 스냅샷과 최종 `undoUpdated`를 유지하며, 누적 새 노트가 이후 병합 대상이면 `noteUpdated`를 최종 시각으로 갱신한다.
- 전체 되돌리기는 재시작 뒤에도 가능하고 두 번 클릭을 요구한다. 누적 대상 중 하나라도 이후 수정되거나 사라졌으면 아무것도 삭제하지 않는다. 성공 시 모든 누적 첨부 메타·Blob과 새 노트를 제거하고 기존 병합 대상·배너·빈 새 노트북을 복원한다.
- 자동 분할 중 선택 결과가 전부 건너뛰기여도 모달을 닫고 다음 큐를 계속 처리한다. 이 묶음은 변경이 없으므로 undo 묶음 수에는 포함하지 않는다.
- 서비스 워커 캐시는 `noteplusp-v5-shell-6`, 정본 SHA-256은 `705561E247C66588A3346471236655BA4869C08747D9E00D9539F6C1588CA82D`이다.

## 35. 2026-07-18 · 가져오기 결과 HTML·JSON 보고서
- `state.lastImportReport`는 `normalizeImportReport()`를 거치는 schema 5 상태 메타데이터다. DB 버전이나 object store 변경은 없다. 형식 식별자는 `noteplusp-import-report-v1`이다.
- 최상위 ENEX 선택 시 `activeEnexReport`를 만들고 자동 분할에서는 `enexBatchSession.report`와 공유한다. 각 확인 저장 또는 무변경·실패 묶음이 누적되며, 매 확인 저장 트랜잭션에 현재 보고서가 함께 들어간다.
- 보고서는 수량·시각·파일명·노트북명·오류·저장 제한만 보관한다. 노트 제목·본문·본문 HTML·첨부 Blob/내용은 저장하거나 내보내지 않는다. 텍스트는 제어 문자 제거, 길이 제한, 중복 제거를 적용한다.
- HTML 생성은 `escHtml()`만 사용하고 CSP `default-src 'none'; style-src 'unsafe-inline'`을 넣는다. JSON은 정규화된 보고서 객체만 직렬화한다. 두 버튼은 보고서가 있을 때만 표시된다.
- undo 메타에는 `reportId`를 연결한다. 이후 실패 시도가 새 보고서를 만든 상태에서 이전 가져오기를 되돌려도 잘못된 보고서를 `undone`으로 표시하지 않는다.
- 서비스 워커 캐시는 `noteplusp-v5-shell-7`, 정본 SHA-256은 `556D8121EEF3822B93E6319585128D627F6B6CA5B429FE92E52F8F48FFED81A8`이다.

## 36. 2026-07-18 · ENEX 저장공간 사전 점검
- `assessEnexStoragePreflight(inputFiles, estimate, mode)`는 순수 판정 함수다. 선택 총용량 × 1.25 + 16MB를 예상 필요 공간으로 삼아 `ok`, `warning`, `blocked`, `unavailable`, `session-only` 중 하나를 반환한다.
- quota가 확인되고 IndexedDB를 쓰는 환경에서만 `reserveBytes > quota - usage`를 `blocked`로 판정한다. 이 경우 `enexFile.onchange`는 FileReader·parseEnex·state 변경 전에 종료한다. 85% 이상 예상은 `warning`이며 기능을 막지 않는다.
- top-level ENEX 선택은 먼저 비동기 `navigator.storage.estimate()`를 실행한다. 토큰으로 뒤늦은 이전 선택 결과를 무시하고, 자동 분할의 다음 묶음은 처음 측정한 결과를 재사용한다.
- `lastImportReport.storagePreflight`는 시각·상태·usage/quota/incoming/reserve/remaining/message만 보관한다. HTML 보고서는 이 값을 수량 행으로 보여주며, 노트 제목·본문·첨부 내용은 계속 내보내지 않는다.
- `test_productivity_mobile.mjs`는 다섯 판정 상태, 부족 상태의 사전 차단·무변경, 자동 분할 보고서 기록을 검증한다. `test_enex_progress.mjs`는 기존 510MB 선택 기대를 현재 정책인 `[2,1]` 자동 분할로 고쳐 진행률 회귀를 유지한다.
- 서비스 워커 캐시는 `noteplusp-v5-shell-8`, 정본 SHA-256은 `4F34A32E5E61CCDD77D33D134574CC6151BDDB7F847FCA88D7F5CD06F5437BAC`이다.

## 37. 2026-07-18 · 손상 ENEX·첨부 상세 제외 보고서
- `parseResourceElements()`는 `{attachments, mediaMap, failed, issues}`를 반환한다. `issues`는 sourceFile, notebook, noteTitle, attachmentName, mime, reason만 포함하며 base64·해시·본문은 포함하지 않는다.
- 사유는 `attachmentIssueReason()`의 제한된 한국어 메시지로만 정규화한다: 데이터 없음, 해시 형식 오류, 비지원 형식, resource XML 오류, base64 인코딩 오류, 100MB 초과, 기타 읽기 오류.
- `parseEnex()`과 `parseEnexLenient()`는 `sourceFileName`을 선택적으로 받고 attachmentIssues를 누적한다. 기존 두 인자 호출은 계속 호환된다. UI 파일 처리 경로는 실제 `f.name`을 세 번째 인자로 넘긴다.
- `normalizeImportReport()`는 attachmentIssues를 최대 1,000개, 각 필드 120~300자로 제어문자 제거·중복 제거한다. `recordEnexReportResult()`가 배치별 issues를 누적하며 HTML 보고서는 표로 출력한다.
- 미리보기의 `importPreviewIssues`는 `textContent`로 최대 30개만 표시한다. 데이터형 앱 저장 전 취소 때 `enexPreflightPreviousBanner`를 복원해 사전 점검 안내가 상태 불변 검사를 훼손하지 않게 했다.
- 서비스 워커 캐시는 `noteplusp-v5-shell-9`, 정본 SHA-256은 `692A5F16A205585691CD34D40FEAFE0B2EA30165745C9743A5A2C7729443ECB7`이다.

## 28. 2026-07-18 · 즉시 실행 가능 20개 일괄 구현
- 사용자 지시에 따라 즉시 실행 가능 목록 20개를 묶어 구현했다. 정본 SHA-256: `A5E9E3798457425A714811BE86ED379D8DCE552C129853BAD496A9EA07E28AAA`.
- 모바일 탐색, IME·단축키, 복구 지점, 조건 검색·저장 검색·전문 캐시, 즐겨찾기, 내부 링크, Markdown·표, 인쇄, PWA, 암호화 백업/복호화 가져오기, 저장소 사용량, sync 메타, 템플릿, 외부 링크 확인, 변경 이력, Markdown 공유를 추가했다.
- 저장은 schema 5 IndexedDB·기존 localStorage 폴백을 유지한다. 새 상태 필드(preferences, snapshots, history, favorite, sync)는 마이그레이션에서 정규화하며 기존 저장을 삭제하지 않는다.
- 자동검증: `tests/test_noteplus_regress.mjs` 전체 통과, 새 `tests/test_productivity_mobile.mjs` 통과, 정적 `new Function` 통과. 생성 캡처: `artifacts/productivity_desktop.png`, `artifacts/productivity_mobile.png`.
- PWA는 HTTPS 또는 localhost에서 service worker를 등록한다. 파일 직접 열기 환경에서는 앱을 그대로 사용하고 PWA 설치만 지원하지 않는다는 브라우저 제약이 있다.
- 다음 자동 개발 항목은 새 심화 검증 목록의 1번이며, 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 27. 2026-07-18 · 구버전 ZIP 분석 및 UX 회귀 반영
- 사용자 제공 구버전 `노트플러스P_인수인계.zip`을 읽기 전용으로 대조했다. UX 미리보기의 3단 구조, Evernote 안내, 노트북 선택기, 태그, 글자 수 메타는 현재 정본에 이미 존재한다.
- 구버전의 localStorage 단일 저장을 현재로 되돌리지 않았다. 현재의 schema 5 IndexedDB 상태/메타/Blob 분리, 저장 실패 폴백·정직 고지, 휴지통, 새니타이저가 안전성 면에서 우선한다.
- 구버전에서 유효했던 편집기 노트북 이동 UX를 회귀로 보존했다. `tests/test_notebook_tag_management.mjs`는 선택기의 표시와 프로젝트→보관→프로젝트 이동, 이름 변경·병합·2단계 삭제, 휴지통 포함 보존을 검증한다.
- 검증: 새 브라우저 회귀와 `new Function` 정적 검사를 통과했다. 정본 앱 코드는 변경되지 않았으며 SHA-256은 `1A4AD63C384EB81B5141046609C021D369DAA28F1830D3B84EFB15BF2DF9CCC8`이다.
- 참고 캡처: `artifacts/old_ux_preview_reference.png`, `artifacts/current_editor_reference.png`.
- 다음 자동 개발 항목은 모바일 화면 탐색 구조 개선이다. 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 42. 2026-07-19 · 첨부 SHA-256 무결성 검사 완료
- 새 ENEX·JSON·직접 추가 첨부는 Blob 저장 전에 Web Crypto SHA-256을 계산해 선택적 `attachment_meta.sha256` 기준값으로 저장한다. schema 5와 IndexedDB 버전은 올리지 않았고 기존 메타·Blob 분리 구조를 유지한다.
- 기존 첨부는 첫 검사에서 기준값을 생성하고 이후 검사에서 실제 Blob을 다시 해시해 일치, 해시 불일치, Blob 누락, 크기 불일치, 노트 소유 관계 불일치, 비지원 MIME, 해시 API 오류를 구분한다. 검사는 활성·휴지통 노트가 참조하는 첨부를 대상으로 하며 문제를 발견해도 노트나 Blob을 삭제하지 않는다.
- 상단 Evernote 바와 항상 접근 가능한 사이드바에 `첨부 무결성 검사`를 추가했다. 검사 중 진행 수를 표시하고 결과 뒤 개인정보 최소화 JSON 보고서를 내려받을 수 있다.
- 보고서는 노트 제목·본문·첨부 내용·파일 이름을 포함하지 않고 첨부 ID, MIME, 크기, 기대/실제 SHA-256, 상태와 합계만 기록한다.
- IndexedDB에 새 기준을 저장하지 못하면 Blob과 노트 기능을 유지하고 `새 기준은 현재 세션에만 유지됨`을 고지한다. SHA-256 API 실패도 앱을 멈추지 않고 `hash-error`로 보고한다.
- 자동검증: 새 `tests/test_attachment_integrity.mjs`에서 새 기준 저장, 기존 기준 생성·재검증, 같은 크기 Blob 변조, Blob 누락, 세션 전용 기준, 해시 API 실패, 보고서 개인정보 제외를 통과했다. `test_noteplus_regress.mjs`, 직접 첨부, 중복 병합, 재시도, 생산성/PWA·모바일 회귀도 통과했다.
- 시각 검증: `artifacts/attachment_integrity_mismatch.png`. 서비스워커 `noteplusp-v5-shell-12`, 정본 SHA-256 `F9DC9C17B415FB8817FE2439A293E51B93075C75C2BDA4A06435D31FD3202CDA`.
- 다음 즉시 실행 항목은 파일별 노트·첨부 합계 대시보드다. 사용자 실제 한국어 ENEX 검증(S-1)은 파일을 받는 즉시 최우선 수행한다.

## 43. 2026-07-19 · 알파 진척도·종료 우선순위 정본화
- `ALPHA_READINESS.md`를 추가해 가중 알파 개발 진척도를 83%로 산정했다. 산식은 핵심 노트, 저장·이전, ENEX·보안, 안전장치, 온보딩, 복구·무결성, 완전성 확인, 플랫폼, 성능, 실사용 RC의 10영역 100점이다.
- 알파 종료 게이트는 통과 5, 부분 통과 3, 미통과 2다. 가장 큰 차단은 실제 한국어 전체 계정 종단 이전, 10,000노트·대형 첨부 성능, 파일별 완전성 판정, 최신 Evernote 화면 대조, 접근성·브라우저·PWA RC다.
- 알파 완료용 전체 우선순위 20과 ChatGPT/Codex 즉시 실행 20을 별도 정본으로 관리한다. 단독 실행 신호에서는 사용자 파일·계정이 필요한 항목을 건너뛰고 즉시 실행 목록의 최상단 미완료 항목을 수행한다.
- 앞으로 모든 보고에는 현재 공개 앱 링크, 가중 진척도, 종료 게이트, 차단 항목, 수정 전체 우선순위 20, 즉시 실행 20, 검사·배포·SHA를 포함한다.

## 44. 2026-07-19 · 제한 알파 최단 경로·공개 핵심 회귀 v1
- 사용자 검증 중심의 `LIMITED_ALPHA_PLAN_v1.md`를 추가했다. 알파 관문은 공개 릴리스, 실제 모바일 핵심 여정, 저장·데이터 안전, 파일럿 3~5명, 종료 품질의 5개로 축소했다.
- 현재 관문은 통과 2, 부분 통과 2, 미통과 1이다. 기존 83%는 기능 구현량 참고치이며 앞으로 공식 알파 진척도는 5개 관문 통과 수로 보고한다.
- 현재 저장소에 과거 문서가 언급한 테스트·아티팩트가 남아 있지 않은 사실을 확인했다. 새 `tests/test_public_alpha_journey_v1.mjs`로 공개 SHA·정적 구문·모바일 생성/편집/재접속·저장소 완전 차단 폴백을 재실행 가능하게 복구했다.
- Microsoft Edge 공개 URL에서 IndexedDB 저장 후 재접속 복원, IDB/localStorage 동시 차단 시 현재 화면 입력 유지·무중단·세션 한정 정직 고지가 통과했다. 캡처는 `artifacts/public_alpha_mobile_persist_v1.png`, `artifacts/public_alpha_mobile_storage_blocked_v1.png`다.
- P0은 현재 자동 범위에서 발견되지 않았다. P2로 `/favicon.ico` HTTP 404를 기록했다. 실제 Android/iPhone, 실제 한국어 ENEX, 비개발자 3~5명은 아직 필요하다.

## 45. 2026-07-19 · 인터랙티브 제한 알파 총괄 프롬프트 v2
- 원본 전달 프롬프트는 보존하고 `제한알파_인터랙티브_총괄프롬프트_v2.md`를 새로 추가했다.
- v2는 현재 schema 5·공개 제한 알파 5관문을 기준으로 하며, 개발 모든 단계에서 Codex가 사용자에게 필요한 행동을 먼저 찾아 한 번에 하나씩 안내하도록 한다.
- 사용자 행동 카드에는 지금 단계, 목적, 준비물, 정확한 1~3단계, 성공 모습, 받을 증거, 막힐 때 안전한 대안을 포함한다.
- 실제 ENEX 준비, 실제 휴대폰 재접속, 파일럿 3~5명, P0/P1 수정과 종료까지 단계별 가이드를 포함하며 일반적인 진행 승인 질문은 금지한다.

## 46. 2026-07-19 · 처음부터 끝까지 자율개발 총괄 프롬프트 v3
- v2 원본과 사용자 첨부본을 보존하고 `노트플러스P_처음부터끝까지_자율개발_총괄프롬프트_v3.md`를 새로 추가했다.
- v3는 복구·사용자 문제·알파 범위·UX·데이터 설계·구현·로컬 QA·공개 배포·실데이터/파일럿·종료의 10단계로 앱 개발 전체를 안내한다.
- 매 응답에 공개 링크, 버전, 생애주기, 5관문, P0/P1/P2, 실제 데이터, 차단, 자동 실행 큐, 사용자/코덱스 다음 행동을 포함한 앱 개발 상태 대시보드를 먼저 표시한다.
- `ㅇㅋ`, `0`, `j`, `ㄱ` 단독 신호는 FULL-RUN 모드를 시작한다. 한 작업 후 멈추지 않고 현재 권한으로 가능한 즉시 실행 작업 전체를 오류 해결·회귀·스크린샷·버전 갱신·커밋·배포·공개 검증까지 연속 수행한다.
- FULL-RUN은 삭제·결제·권한 확대의 포괄 승인이 아니며, 실제 ENEX·실기기·파일럿·API 키·계약·중대한 선택처럼 Codex가 대신할 수 없는 조건에서만 사용자 행동 카드 하나를 제시한다.
