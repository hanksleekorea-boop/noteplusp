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

## 47. 2026-07-19 · 모든 앱 프로젝트용 자율개발 총괄 프롬프트 v4
- 노트플러스P 전용 v3을 보존하고 `모든앱_처음부터끝까지_자율개발_총괄프롬프트_v4.md`를 새로 추가했다.
- 프로젝트 이름·루트·제품 유형·정본·버전·배포·저장·외부 API·실데이터·검사 명령을 자동 발견하는 프로젝트 어댑터를 추가해 정적 웹, PWA, 웹+API, 모바일, 데스크톱, 확장 프로그램, AI·데이터 앱에 적용할 수 있게 했다.
- 노트플러스·Evernote·ENEX·IndexedDB 고유 규칙은 범용 본문에서 제거하고, 제품별 데이터·보안·배포 규칙을 자동 적용하도록 일반화했다.
- 10단계 생애주기, 5개 제한 알파 관문, 앱 개발 상태 대시보드, 전체/즉시 실행 우선순위 각 20, 인터랙티브 사용자 카드, `ㅇㅋ`·`0`·`j`·`ㄱ` FULL-RUN 연속 실행은 유지했다.
- 단일 파일 앱은 새 vN 산출물, 다중 파일 Git 앱은 커밋·태그·릴리스 버전을 사용하도록 버전 원칙을 프로젝트 구조에 맞게 조정했다.

## 48. 2026-07-19 · 공개 ENEX 미리보기·가져오기·재접속 회귀 v1
- 첨부된 범용 v4의 즉시 실행 규칙에 따라 현재 최상위 안전 작업을 수행했다.
- 새 `tests/test_public_enex_import_v1.mjs`는 합성 ENEX 안에 노트·태그·노트북·PDF resource를 메모리에서 만들고 공개 앱 파일 선택기에 전달한다.
- 미리보기에서 파일 1·노트 1·첨부 1, 확인 전 기존 상태 불변, 선택 가져오기 뒤 IndexedDB 상태·첨부 메타·PDF Blob 저장, 새로고침 뒤 전 항목 복원을 실제 Microsoft Edge에서 확인했다.
- 공개 정본 HTTP 200·SHA-256·정적 구문도 같은 검사에서 확인했다. 캡처는 `artifacts/public_enex_preview_v1.png`, `artifacts/public_enex_reloaded_v1.png`다.
- 앱 코드는 변경하지 않았다. 합성 자료는 공개 기술 회귀 전용이며 실제 사용자 ENEX·실기기·파일럿 증거로 사용하지 않는다. 다음 즉시 실행은 공개 외부 콘텐츠 보안 회귀 v1이다.

## 49. 2026-07-19 · v6 외부 HTML 저장 경계 P0 수정·공개 검증
- `tests/test_public_external_content_security_v2.mjs`로 공개 v5의 ENEX, JSON 활성 노트, JSON 휴지통, 붙여넣기 저장 경계를 검사했다. JSON 휴지통 `bodyHtml`이 화면 표시 때는 정화되지만 IndexedDB에는 스크립트·외부 이미지·이벤트·위험 URL을 포함한 원문으로 남는 P0 보안 경계 위반을 재현했다.
- 기존 `노트앱_v5.html`은 보존하고 새 정본 `노트앱_v6.html`을 만들었다. `sanitizeStoredNoteHtml()`과 `sanitizeSnapshotNoteHtml()`을 추가하고 `sanitizeAllNoteHtml()`을 활성 노트·휴지통·변경 이력·템플릿·복구 지점 전체에 적용했다. 저장된 원문 HTML을 신뢰하지 않는 기존 첨부 렌더와 Blob URL 해제 원칙은 유지했다.
- 배포 포인터 `index.html`, `noteplus.webmanifest`, `sw.js`를 v6로 올렸고 캐시는 `noteplusp-v6-shell-1`이다. 앱 빌드 커밋은 `57c56f6`, 정본 SHA-256은 `A7173ACA0DD1DC44017D4C4FA289E2E96C7690D5245A38AB3D016C42A8F6E108`이다.
- 공개 주소에서 `test_public_alpha_journey_v2.mjs`, `test_public_enex_import_v2.mjs`, `test_public_external_content_security_v2.mjs`를 모두 통과했다. IndexedDB 재접속 저장, 전체 저장 차단 시 입력 유지·정직 고지, PDF Blob 복원, ENEX/JSON/휴지통/붙여넣기 정화, 외부 요청 0건, 코드 실행 0건을 확인했다.
- 캡처는 `artifacts/public_alpha_mobile_persist_v2.png`, `artifacts/public_alpha_mobile_storage_blocked_v2.png`, `artifacts/public_enex_preview_v2.png`, `artifacts/public_enex_reloaded_v2.png`, `artifacts/public_external_content_security_v2.png`다.
- 제한 알파 관문은 2/5를 유지한다. 자동 공개 범위의 미해결 P0은 없고, 실제 한국어 ENEX·실제 Android/iPhone·비개발자 파일럿 3~5명은 외부 의존성이다. 다음 즉시 실행은 빈 ENEX·0KB·파싱 0건 경고 회귀다.

## 50. 2026-07-19 · v7 빈 ENEX·파싱 0건 실패 경계
- 공개 v6에서 0바이트 ENEX가 FileReader까지 들어가고 `가져오기 실패 — 파일명`만 표시되며, 공백·노트 0건 파일을 성공 처리 파일로 세어 보고서가 완료가 될 수 있는 P1을 재현했다. 기존 노트는 변하지 않았지만 원인·다음 행동·완전성 판정이 부족했다.
- v6를 보존하고 `노트앱_v7.html`을 생성했다. `planEnexFiles()`가 0바이트를 별도 제외하며, 공백·파싱 0건은 파일명과 `(노트 0개)` 사유를 포함한 실패로 기록한다. 사용자에게 Evernote 데스크톱 앱에서 노트가 들어 있는 노트북을 ENEX로 다시 내보내도록 안내한다.
- 새 `tests/test_public_enex_empty_warning_v1.mjs`는 0바이트 FileReader 사전 차단, 공백 파일, 노트 없는 정상 ENEX, 미리보기 미노출, 활성·휴지통 무변경, 실패 보고서와 파일명을 검증한다.
- 누락됐던 마이그레이션 자동증거를 `tests/test_public_schema4_migration_v1.mjs`로 복구했다. schema 4 localStorage 원문 바이트 보존, schema 5 검증 기록, 악성 HTML 정화, 재접속 멱등성, 이전 후 수정본 우선 복원을 공개 환경에서 확인했다.
- v3 공개 회귀는 모바일 IDB·저장 차단 폴백, 합성 ENEX PDF Blob, 외부 HTML, 빈 ENEX, schema 4→5 이전까지 전부 통과했다. 공개 정본은 HTTP 200, 226,646바이트, SHA-256 `6D8F20F73896DA3F94EFAFE9291CEB51E53D4BD84560430583F9F0EFFCE633A0`이다.
- 서비스 워커는 `noteplusp-v7-shell-1`, 앱 빌드 커밋은 `42a1cbb`다. 자동 공개 범위의 미해결 P0·P1은 없고, 실제 한국어 ENEX·실기기·비개발자 파일럿은 여전히 외부 의존성이다.
- 캡처는 v3 핵심 회귀 5개, `public_enex_empty_warning_v1.png`, `public_enex_zero_notes_warning_v1.png`, `public_schema4_migration_v1.png`다. 다음 즉시 실행은 파일별 노트·첨부·실패 합계 대시보드다.

## 51. 2026-07-19 · 실제 Samsung Android 제한 알파 핵심 여정 통과
- 사용자의 무선 연결 신호에 따라 설치돼 있던 Android Platform-Tools를 찾아 mDNS ADB로 Samsung SM-G996N(Android 15, Chrome 150)에 연결했다. 물리 화면은 1080×2400, 앱 CSS viewport는 411×781, DPR 2.625다.
- 새 Chrome 탭에서만 공개 v7을 실행했다. 모바일 `정리 → 홈 화면에 추가` 경로, PWA 설치 프롬프트 준비, IndexedDB 노트 저장·재접속, 합성 ENEX 노트·태그·노트북·PDF Blob 재접속, 서비스워커 활성·제어·오프라인 재진입, 수평 넘침 없음을 통과했다.
- 테스트 전 상태 JSON과 `stateSignature`를 보존했다. QA 노트와 첨부를 검사한 뒤 원래 상태를 다시 기록하고 첨부 Blob을 삭제했으며, 재접속 후 QA 노트 0개·ENEX 노트 0개·시작 상태 서명 일치를 확인했다. 실제 사용자 데이터는 삭제하지 않았다.
- 첫 실기기 하네스는 모바일 설치 버튼이 첫 화면에 직접 보여야 한다는 잘못된 가정으로 중단됐다. 제품의 실제 경로인 하단 `정리` 패널을 반영해 수정했다. 이후 무선 전달 경로 단절과 CDP 연결 유지로 인한 종료 지연을 mDNS 고정 전달·명시 프로세스 종료로 해결했다.
- `tests/test_physical_android_alpha_v1.mjs`, `artifacts/physical_android_alpha_v1.png`, `artifacts/physical_android_alpha_v1.json`을 추가했다. 공개 자동회귀 5종도 전부 재통과했다.
- 실제 모바일 관문을 통과로 올려 제한 알파는 통과 3/5, 부분 1, 미통과 1, 공식 60%다. 실제 한국어 ENEX와 비개발자 파일럿 3~5명은 남아 있다. 다음 즉시 실행은 파일별 노트·첨부·실패 합계 대시보드다.

## 52. 2026-07-19 · 공개 v8 파일별 완전성 판정과 Android 재검증
- v7을 보존하고 `노트앱_v8.html`을 만들었다. ENEX 미리보기에 파일별 파일명·크기·노트·첨부·분석 상태를 코드 통제 DOM으로 표시하며 사용자 파일명은 HTML로 해석하지 않는다.
- 결과 보고서에 `fileResults`와 `completenessVerdict`를 하위 호환 방식으로 추가했다. 노트 본문·첨부 내용은 보고서에 넣지 않는다.
- 모든 파일이 분석되고 Evernote에서 확인한 전체 노트·노트북 수가 정확히 일치할 때만 완료 판정을 낸다. 수량 미입력, 빈/0노트/실패 파일, 첨부 오류, 저장 제한은 `확인 필요`로 남긴다.
- 정적 검사, 로컬·공개 Edge 7종, 실제 Samsung Chrome의 IDB·재접속·ENEX PDF Blob·오프라인·설치 경로·원상복구가 통과했다. 첫 실기기 시도는 YouTube가 전면이라 자동 터치가 실패했고, Chrome 전면 전환 후 동일 검사 통과로 제품 결함이 아님을 확인했다.
- 공개 v8은 HTTP 200, 238,434바이트, SHA-256 `931DCD4EED4FE128A3A549D018795BEF130442B2FAD00A41E35853D3DE24F460`, 서비스워커 `noteplusp-v8-shell-1`, 앱 커밋 `21e54d1`이다.
- 시험 뒤 QA·ENEX 노트는 0건이고 시작 상태 서명이 일치한다. 관문은 3/5 통과, 부분 1, 미통과 1이며 최신 대시보드는 `ALPHA_READINESS_v5.md`다.

## 53. 2026-07-19 · v8 공개 데이터 안전 회귀 4종 추가
- 중단→동일 ENEX 재시도→재접속→중복 재선택을 한 흐름으로 검증했다. 중단·중복 취소는 상태와 첨부 참조를 바꾸지 않았고 재시도 결과는 노트·PDF 각각 1건이었다.
- JSON 백업을 만든 뒤 격리 상태를 초기화하고 노트·노트북·태그·즐겨찾기·PDF를 복원했다. 재접속 뒤 정확히 1건이었고 Blob 크기도 일치했다.
- PNG·PDF·MP3 ENEX 3종은 미리보기와 재접속 뒤 파일명·MIME·메타 크기·Blob 크기가 모두 일치했다.
- IndexedDB만 차단한 환경에서는 노트가 localStorage 보조 저장으로 재접속 후 유지됐다. 첨부는 이번 세션에만 유지된다는 경고가 표시됐다.
- 네 검사 모두 공개 v8 SHA를 먼저 확인했고 종료 시 시험 상태를 제거했다. 다음 즉시 실행은 키보드·포커스·ARIA 검사다.

## 54. 2026-07-19 · 공개 v8 10종·실제 Android 전수 재검증
- 현재 v8 대상 공개 회귀 10종을 전부 다시 실행했다. 모바일 저장·완전 차단, ENEX PDF, 외부 HTML, 빈 ENEX, schema 4→5, 파일별 완전성, 취소·재시도·중복, JSON 복원, PNG·PDF·MP3, IDB 단독 차단이 모두 통과했다. 과거 v1~v3 고정 검사는 이전 앱 버전의 불변 증거이므로 최신 전수 집계에서 제외했다.
- Samsung SM-G996N(Android 15, Chrome 150.0.7871.124)의 실제 Chrome 엔진에서 IDB 저장·재접속, ENEX PDF Blob 재접속, 서비스 워커 활성·제어, 오프라인 재진입, 설치 경로, 수평 넘침 없음과 원상복구를 재검증했다. CSS viewport는 411×781, DPR 2.625다.
- Chrome에 기존 탭이 수백 개 있어 브라우저 전체 대상 열거가 불안정했고, 전면 앱이 YouTube·알림창으로 바뀌어 일반 터치 actionability도 불안정했다. `tests/test_physical_android_cdp_v5.mjs`는 기존 HTTP 탭 하나에 직접 연결하고 종료 시 원래 URL을 복원하도록 구성했다. 데이터 판정 통과 뒤 ADB로 실제 모바일 화면을 별도 캡처했다.
- 이전 중단 시험에서 남은 QA 노트 2개·첨부 1개를 소유관계로 식별해 제거한 뒤 시작 상태를 다시 잡았다. 최종 종료 상태는 QA 노트 0개, ENEX 시험 노트 0개, 시작 상태 서명 일치다. 원래 사용자 노트 1개는 유지했다.
- 공개 정본은 v8, 238,434바이트, SHA-256 `931DCD4EED4FE128A3A549D018795BEF130442B2FAD00A41E35853D3DE24F460`, 캐시 `noteplusp-v8-shell-1`로 변함없다. 앱 코드는 변경하지 않았다.
- 최신 대시보드는 `ALPHA_READINESS_v6.md`, 기계 판정은 `artifacts/physical_android_alpha_v5.json`, 화면 증거는 `artifacts/physical_android_alpha_v5.png`다. 제한 알파는 통과 3/5, 부분 1, 미통과 1이며 현재 검증 범위 P0·P1은 0건이다.
- 다음 즉시 실행은 키보드·포커스·ARIA 핵심 자동 검사다. 실제 한국어 ENEX나 파일럿 참여자가 준비되면 그 외부 의존 임계 경로를 우선한다.

## 55. 2026-07-19 · v9 키보드·포커스·ARIA P1 수정·공개 회귀
- 공개 v8에서 노트 목록, 노트북·태그 접기, 노트북 추가가 마우스 전용이고 저장·가져오기 상태가 화면낭독기에 전달되지 않는 P1을 재현했다.
- v8을 보존하고 `노트앱_v9.html`을 만들었다. Enter·Space 조작, listbox/option 선택 상태, 본문 textbox 이름, 상태 live region, ENEX progressbar 값, 대화상자 초점 순환·복귀와 명확한 키보드 초점 표시를 추가했다.
- `tests/test_public_accessibility_v1.mjs`는 중복 ID·이름 없는 컨트롤·마우스 전용 컨트롤·상태 알림·목록·본문·진행률 의미와 Ctrl+K/Ctrl+N, 노트 선택, 접기/펼치기, 대화상자 Escape·초점 복귀를 검사한다.
- 로컬 접근성·핵심 회귀 5종과 공개 최신 회귀 11종을 통과했다. ENEX 재시도 검사는 첨부 Blob 비동기 저장 완료를 기다리도록 보강했다. 접근성 최초 공개 실행의 일시적 서비스 워커 콘솔 오류는 독립 재실행에서 재현되지 않았다.
- 공개 v9는 HTTP 200, 240,752바이트, SHA-256 `7CFFB092375878B282C161FFA3D103BE607FDA67C81CD66E756C4A7525D587BA`, 캐시 `noteplusp-v9-shell-1`, 앱 커밋 `53c1ff0`이다.
- v9 배포 뒤 휴대폰은 ADB·mDNS에서 발견되지 않았다. 현재 공개 버전의 실기기 증거가 없으므로 관문은 통과 2/5, 부분 2, 미통과 1로 정직하게 조정했다. 최신 대시보드는 `ALPHA_READINESS_v7.md`다.
- 다음 즉시 실행은 390px·360px 모바일 화면 넘침·초점 표시 검사다. 휴대폰이 재연결되면 v9 실기기 재검증을 우선한다.

## 56. 2026-07-19 · 공개 v9 390px·360px 모바일 시각 회귀
- 단독 실행 신호 `ㅋ`에 따라 `tests/test_public_mobile_viewports_v1.mjs`를 추가하고 공개 v9를 390×844와 360×800에서 검사했다.
- 각 화면에서 목록·편집기·정리·Evernote 안내 대화상자를 실제 조작했다. 모든 단계의 문서 너비는 viewport와 정확히 일치하고 화면 밖으로 나간 가시 요소는 0개였다.
- 하단 모바일 탐색 버튼 4개는 모두 58×40px로 화면 안에 유지됐다. 새 노트 버튼의 키보드 초점은 3px 파란 실선이며, `홈 화면에 추가`는 정리 화면에서 도달 가능했다.
- Evernote 안내 대화상자는 가로·세로 화면 안에 유지되고 Escape로 닫혔다. 시각 증거는 `artifacts/public_mobile_390_v1.png`, `artifacts/public_mobile_360_v1.png`다.
- 앱 결함은 발견되지 않아 앱 코드는 변경하지 않았다. 공개 정본은 v9, SHA-256 `7CFFB092375878B282C161FFA3D103BE607FDA67C81CD66E756C4A7525D587BA`, 캐시 `noteplusp-v9-shell-1`을 유지한다.
- 최신 대시보드는 `ALPHA_READINESS_v8.md`다. 휴대폰 미연결 때문에 관문은 통과 2/5, 부분 2, 미통과 1을 유지한다. 다음 즉시 실행은 비개발자용 10분 파일럿 과업 카드 작성이다.

## 57. 2026-07-19 · 비개발자 10분 파일럿 카드·샘플 ENEX
- 단독 실행 신호 `ㅋ`에 따라 `PILOT_10MIN_TASK_CARD_v1.md`를 작성했다. 참가자는 설명 없이 공개 v9 진입, 노트 저장·새로고침, Evernote 이전 핵심 3문항, ENEX·PDF 가져오기, 홈 화면 추가 찾기와 자신감 응답을 10분 안에 수행한다.
- 관찰자는 H0~H3 힌트 수준, 과업별 시간·성공·발화를 익명 코드로 기록한다. P0/P1/P2 판정 기준과 InPrivate/시크릿 창·개인정보·다운로드 정리 절차를 포함했다.
- 실제 개인 데이터를 요구하지 않도록 `pilot-assets/노트플러스P_파일럿_샘플.enex`를 추가했다. 샘플은 노트 1개, 태그 1개, PDF 1개이며 개인정보를 포함하지 않는다.
- `tests/test_pilot_fixture_v1.mjs`로 공개 v9에서 미리보기 파일 1·노트 1·첨부 1, 샘플 노트 정확히 1개, PDF 이름·MIME·Blob 69바이트를 통과했다. 첫 검사 실패는 테스트가 메타데이터를 상태 객체에서 찾은 오류였고 실제 저장소 조회로 수정했다. 제품 결함은 아니다.
- 시각 증거는 `artifacts/pilot_10min_sample_import_v1.png`, 샘플 SHA-256은 `0E64DCDE24CDEF0981A0CE283C7E998A542B1C3CD08B4AA85D2B918758EACC2A`다. 앱 코드는 변경하지 않아 공개 정본은 v9 그대로다.
- 준비물 완성은 실제 참가자 결과가 아니므로 관문은 통과 2/5, 부분 2, 미통과 1을 유지한다. 최신 대시보드는 `ALPHA_READINESS_v9.md`, 다음 즉시 실행은 파일럿 결과 입력·P0/P1/P2 판정표다.

## 58. 2026-07-19 · v10 ENEX 고정 용량 제한 제거
- v9 원본을 보존하고 `노트앱_v10.html`을 만들었다. 앱과 안내에서 300MB 권장 분할, 단일 350MB 거부, 선택 합계 500MB 차단을 제거했다.
- ENEX는 고정 크기로 제외하지 않고 순차 묶음으로 처리한다. 300MB·351MB·800MB 가상 파일이 모두 수용되는 경계 검사를 추가했다. 실제 브라우저 남은 저장공간이 부족할 때 기존 데이터를 바꾸기 전에 중단하는 안전장치는 유지했다.
- `new Function`, 핵심 로컬 5종, 공개 최신 14종이 통과했다. 공개 v10은 239,806바이트, SHA-256 `856D5FFA793210347E4647CCCDB4731810F729D08AF2AB0812666F389435D9E1`, 캐시 `noteplusp-v10-shell-1`, 앱 커밋 `ab80f5d`다.
- 실제 800MB 바이너리를 가져온 증거는 아니다. 단일 대형 파일의 실사용 상한은 기기 메모리·브라우저·남은 IndexedDB 공간에 좌우되므로 실제 대형 ENEX 성능 검증이 남았다.
- 최신 대시보드는 `ALPHA_READINESS_v10.md`다. 관문은 통과 2/5, 부분 2, 미통과 1을 유지하며 다음 즉시 실행은 파일럿 결과 입력·P0/P1/P2 판정표다.

## 59. 2026-07-19 · 알파 링크·분야별 진척도 상시 표시 기준
- 이후 모든 진행·완료 보고 첫 부분에는 공개 알파 앱 링크, 현재 앱 버전·SHA, 5개 관문 진척도와 차단 요인을 고정 표시한다.
- 진척도는 공개 접근·기본 노트 여정·Evernote 가져오기·저장 안전·대용량 ENEX·보안/접근성/모바일·파일럿·종료 판정으로 나눈다. 각 분야는 자동 검증, 공개 검증, 실제 실기기, 실제 사용자 증거를 구분해 근거와 남은 조건을 함께 기록한다.
- 최신 상세 표는 `ALPHA_READINESS_v10.md`의 `2-1. 항상 표시할 분야별 알파 진척도`다. 자동 회귀 통과를 실제 사용자 통과로 과장하지 않는다.

## 60. 2026-07-19 · v11 실제 766MB Evernote ENEX 스트리밍 수정
- 사용자 화면의 `노트 0개` 실패를 조사해 실제 Evernote 11.25.6 ENEX가 비어 있지 않고 766,432,192바이트임을 확인했다. v10의 전체 XML DOM 파싱이 대형 파일에서 실패한 것이 원인이며, 기존 노트는 확인 전이라 변경되지 않았다.
- v10을 보존하고 `노트앱_v11.html`에서 16MB 이상 ENEX를 2MB UTF-8 조각과 `<note>` 단위로 읽는 스트리밍 파서를 추가했다. 전체 XML DOM을 만들지 않으며, 취소·미리보기·확정 전 무변경·새니타이저·첨부 Blob 분리는 유지했다.
- 실제 파일은 공개 v11에서 미리보기까지 도달했고 기존 노트·휴지통은 무변경, 페이지 오류는 0건이었다. 개인정보 보호를 위해 테스트는 미리보기에서 취소했다.
- 공개 v11은 244,593바이트, SHA-256 `AEB1CE08F4064331C1AF5A7E5907AFAE2FAFCBE80B4686C276EECF974A7036C9`, 캐시 `noteplusp-v11-shell-1`, 앱 커밋 `03a411e`다. 최신 대시보드는 `ALPHA_READINESS_v11.md`다.

## 61. 2026-07-22 · v12 표준 Evernote 첨부 전수 보존
- 실제 ENEX 구조 감사에서 노트 1,950개·첨부 2,272개를 확인했다. 원본은 UTF-8·XML·노트 경계·Base64에서 이상이 없었으나, v11은 표준 `<data encoding="base64">`에 hash 속성이 없다는 이유로 첨부 전부를 제외했다.
- v12는 유효 MIME·Base64 첨부를 모두 Blob으로 보존한다. 이미지·오디오·PDF만 코드 통제 DOM으로 미리보기/열기를 제공하며, HTML·Office·ZIP·연락처 등은 실행하지 않고 다운로드 전용으로 제공한다.
- 공개 v12 실제 미리보기에서 노트 1,950개·첨부 2,272개·첨부 오류 0개, 기존 상태 무변경, 페이지 오류 0건을 확인했다. 해시 없는 PDF 저장·IDB Blob, HTML 첨부 스크립트 미실행, 기존 ENEX·첨부·취소·schema·보안 회귀도 통과했다.
- 공개 v12는 245,093바이트, SHA-256 `9B92306737ED0E97726DB05183F884C94A5AC5D514B7279613A4BB820D2746F3`, 캐시 `noteplusp-v12-shell-1`, 앱 커밋 `de4995e`다. 최신 대시보드는 `ALPHA_READINESS_v12.md`다.

## 62. 2026-07-22 · 제한 알파 최대 처리량 임계 경로 재설계
- 현행 우선순위를 최소 달력시간 기준으로 감사했다. 실제 ENEX 최종 저장, 현재 v12 실제 Android, 비개발자 파일럿 3명, P0/P1 최소 수정, 공개 RC만 알파 임계 경로로 남겼다.
- iPhone 교차 확인, 10,000노트, 전체 브라우저 전수, 노트북 매핑·태그 정규화·추가 형식·Windows 자동 백업 도우미 실계정 종단은 P0/P1이 관찰되지 않는 한 베타로 이동했다.
- 사용자 개입은 실제 가져오기와 Android 연결을 묶은 20~40분 창, 참가자 3명 병렬 파일럿 조율 창으로 압축했다. 대기 중에는 별도 자율 작업열을 소진하고 외부 입력이 도착하면 임계 경로가 선점한다.
- `ALPHA_ACCELERATION_PLAN_v1.md`와 `노트플러스P_알파가속_무중단_자율개발_총괄프롬프트_v4.md`를 추가했다. 앱 코드는 변경하지 않았으며 공개 정본은 v12 그대로다.
- `tests/test_post_import_integrity_v1.mjs`를 추가했다. 공개 앱 탭의 CDP에 읽기 전용으로 연결해 제목·본문·파일명을 출력하지 않고 마지막 가져오기 1,950/2,272, IDB 모드, 첨부 메타·Blob 누락, 고아 수량과 MIME 합계만 감사한다. 실제 최종 가져오기 전이므로 구문검사만 수행하고 실데이터 통과로 기록하지 않는다.

## 63. 2026-07-22 · v13 PC Google 계정 보호 후보

- v12 원본을 보존하고 `노트앱_v13.html`을 만들었다. IndexedDB schema 5가 계속 유일한 편집 원본이며 Google 로그인만으로는 전송하지 않는다.
- `noteplus-cloud-v1.js`는 Firebase Web SDK 12.16.0을 설정이 있을 때만 불러온다. 첨부를 UID 전용 snapshot 경로에 먼저 올려 크기·SHA-256을 검사하고 manifest를 검증한 뒤 `current.json`을 마지막에 갱신한다. 실패 시 로컬과 이전 완성 백업을 변경·삭제하지 않는다.
- 기본 `firebase-config.js`는 null이라 외부 SDK도 불러오지 않고 로컬 앱을 그대로 사용한다. 실제 활성화에는 사용자 소유 Firebase 프로젝트, Google 공급자, 승인 도메인, Blaze·Storage, 보안 규칙 게시가 필요하다.
- `firebase.storage.rules`는 UID 격리, 다른 모든 경로 거부, 삭제 금지, JSON·첨부 형식 제한을 둔다. 복원·자동 동기화·폰 로그인은 v13 범위가 아니다.
- 정적 구문·규칙 검사, Google 무설정, 모의 업로드 실패·성공 무손실, 기존 IDB·schema·ENEX·JSON·첨부·보안·완전성·취소·고정 제한 제거 회귀 12종이 로컬 후보에서 통과했다. 실제 Firebase 계정 업로드 통과로 과장하지 않는다.
- 설계는 `PC_GOOGLE_BACKUP_DESIGN_v1.md`, 활성화 절차는 `GOOGLE_PC_ACTIVATION_GUIDE_v1.md`, 대시보드는 `ALPHA_READINESS_v13.md`다.

## 64. 2026-07-22 · v13 공개 배포·핵심 회귀

- GitHub Pages 배포가 성공했다. 직접 링크는 HTTP 200, 253,318바이트, SHA-256 `991EE96B4148CD100F830A3D9579418280EF42B5D665333101BF8314D8A2FE0A`, 캐시는 `noteplusp-v13-shell-1`, 앱 빌드 커밋은 `f1b7bb5`다.
- 공개 v13에서 Google 무설정, 업로드 실패 무손실, 동일 상태 재시도 동일 snapshot, 모의 성공 manifest, IDB 저장·재접속, 저장소 완전 차단 입력 유지, schema 4 원본 보존·멱등 이전, 외부 HTML·이미지 차단이 통과했다.
- 추가 공개 ENEX·JSON·첨부·대용량 병렬 묶음은 브라우저 종료가 실행 제한을 넘어 결과 집계가 중단됐다. 같은 SHA의 로컬 v13에서 해당 8종은 통과했으므로 제품 실패로 기록하지 않되 공개 전수 통과로도 과장하지 않는다.
- 기본 `firebase-config.js`는 계속 null이다. 실제 Google 로그인·Cloud Storage 백업은 사용자 소유 프로젝트 설정과 Blaze 승인이 있어야 다음 검증으로 진행할 수 있다.

## 65. 2026-07-22 · v14 PC Google 무손실 복원·중복 첨부 P1 수정

- v13을 보존하고 `노트앱_v14.html`, `noteplus-cloud-v2.js`를 만들었다. Google 현재 백업 확인과 두 단계 명시 복원을 추가했다.
- pointer·manifest·계정 UID·수량·첨부 참조·SHA를 읽기 전용으로 검사한 뒤에만 복원 버튼이 활성화된다. 첨부를 먼저 검증하고 상태를 마지막에 커밋한다.
- 로컬과 같은 attachment id의 내용이 다르면 cloud id로 재매핑해 기존 Blob을 보존한다. 복원 전 상태를 새 상태의 복구 지점에 포함하고, 고아 첨부 정리도 복구 지점 참조를 보존한다.
- 계정 전환·오프라인·다운로드 실패·상태 검증 실패는 로컬 상태를 유지하거나 검증된 이전 상태로 롤백한다. 로그인 취소·팝업 차단·권한·용량 오류를 한국어로 구분한다.
- 중복 지문에 노트북·태그·생성시각을 추가했다. 첨부가 있는 중복 후보는 기본 선택·별도 추가로 바꿔 제목·본문 동일만으로 첨부가 빠지지 않는다.
- 신규 복원·중복·정적 보안·10,000노트 manifest와 기존 핵심 11종이 로컬 v14에서 통과했다. 실제 Firebase·실사용자 데이터는 사용하지 않았다.
- 설계는 `PC_GOOGLE_RESTORE_DESIGN_v1.md`, 대시보드는 `ALPHA_READINESS_v14.md`, 파일럿 판정표는 `PILOT_RESULTS_AND_DEFECT_TRIAGE_v1.md`다.

## 2026-07-22 · v14 공개 검증 인수인계 추가

- 현재 공개 정본: `노트앱_v14.html`
- 공개 직접 링크: `https://hanksleekorea-boop.github.io/noteplusp/%EB%85%B8%ED%8A%B8%EC%95%B1_v14.html`
- 공개 검증값: HTTP 200, 264,076바이트, SHA-256 `08961F3DCBF2651BBC9E5FA4A44F6C4AB6EE6C55B31AB21EDA3CFF22CB64768F`
- 공개 회귀 7개 묶음 통과: Google 백업, Google 복원 무손실, 기본 저장·저장 차단, 외부 HTML 보안, ENEX 첨부 중복 보호, 접근성, 390/360px 모바일 UI.
- Samsung SM-G996N은 무선 ADB로 보였으나 Chrome DevTools 소켓 부재로 공개 v14 실기기 자동화가 시작되지 못했다. 앱 데이터 변경은 없었다. `tests/test_physical_android_cdp_v6.mjs`로 재실행한다.
- Google 실제 기능은 `firebase-config.js`가 null인 한 비활성이다. Firebase 계정·결제·규칙 게시 없이는 실제 로그인/백업/복원을 통과로 기록하지 않는다.

## 2026-07-22 · v15 모바일 Google 로그인 인수인계 추가

- v14를 보존하고 `노트앱_v15.html`, `noteplus-cloud-v3.js`를 만들었다.
- GitHub Pages에서는 모바일도 사용자 클릭 기반 popup을 기본으로 사용한다. `mobileAuthMode: "redirect"`는 Firebase 공식 인증 프록시·동일 도메인 구성을 완료한 경우에만 사용한다.
- redirect를 선택하면 `getRedirectResult`를 처리하며, 인증 중 중복 클릭·승인 도메인·브라우저 저장소·오프라인 오류를 무손실로 고지한다.
- 인증 전후 앱 상태 서명은 동일했다. 360/390px 패널, PC 백업·복원, 10,000노트, schema·보안·ENEX·JSON·첨부·접근성 회귀가 통과했다.
- `firebase-config.js`는 계속 null이다. 실제 계정 활성화 절차는 `GOOGLE_MOBILE_ACTIVATION_GUIDE_v1.md`, 대시보드는 `ALPHA_READINESS_v15.md`다.

## 2026-07-22 · v15 공개 배포 인수인계 추가

- 공개 v15는 HTTP 200, 264,544바이트, SHA-256 `A298F4132170378C4BC8E095BCE0F090CDB4E540D50A6E1DEB53D2DC67F666C3`다.
- 공개 URL에서 모바일 로그인·PC 백업·복원·첨부 중복 보호와 핵심 저장·보안·접근성·360/390px UI 8개 묶음이 통과했다.
- 공개 루트·manifest·서비스워커는 v15를 가리킨다. 실제 Google 로그인 활성화에는 Firebase 외부 설정이 필요하다.

## 2026-07-23 · Samsung 실기기·v16 복원 보호 인수인계 추가

- Samsung SM-G996N 공개 v15에서 IDB 저장·재접속, ENEX PDF, 서비스워커 오프라인 재개, 홈 화면 추가 경로와 원상복구 서명이 통과했다. 시작 데이터는 환영 노트 1개였고 PC의 1,915개 데이터는 없었다.
- v15를 보존하고 `노트앱_v16.html`을 만들었다. manifest 첨부 총량과 브라우저 남은 공간을 비교해 부족하면 다운로드 전에 차단한다.
- 여유분은 `max(64MB, 첨부 총량의 15%)`다. 저장공간 확인 불가·데이터 절약·2G·3G를 구분하고 복원 첨부 수·바이트 진행률을 표시한다.
- 800MB 합성 복원은 필요 920MB·남음 124MB 환경에서 다운로드 0회·상태 무변경으로 차단됐다. v16 대시보드는 `ALPHA_READINESS_v16.md`다.

## 2026-07-23 · 공개 v16 검증 추가

- 공개 v16은 HTTP 200, 267,916바이트, SHA-256 `64832DEDEB76D7A469B6238F274042A27C894BCBAFD56E4B36B526FDBAE2E520`다.
- 공개 저장공간 사전차단·복원 무손실·기본 저장·360/390px UI가 통과했다.
- Samsung v16은 CDP 탭이 `Page.enable`에 응답하지 않아 앱 접근 전에 세 번 중단됐다. 데이터 변경은 없다. `tests/test_physical_android_cdp_v8.mjs`는 응답 탭 최대 8개·각 3초로 제한했다.
- 실제 모바일 통과 근거는 v15이며, 실제 Google 계정·v16 실기기·파일럿은 미검증이다.

## 2026-07-23 · Firebase 실제 활성화 준비 패킷 (추가)

- 현행 공개 정본 v16과 로컬 앱 코드는 변경하지 않았다. `firebase-config.js`는 계속 `null`이며, 실제 Google 로그인·전송도 비활성 상태다.
- `firebase.json`은 Storage 규칙만 가리키며 GitHub Pages 호스팅을 변경하지 않는다. `.firebaserc.example`에는 예시 프로젝트 ID만 들어 있다.
- `tools/firebase-activation-diagnostics-v1.mjs`는 설정 형식과 규칙의 최소 안전 계약을 읽기 전용으로 검사한다. Firebase 로그인·전송·규칙 게시·사용자 데이터 접근을 하지 않는다.
- 형식 회귀는 유효 설정 모의값과 실제 rules 파일로 통과했다. 현재 null 설정은 의도대로 `readyForFirebaseConsole: false`로 정직하게 보고한다.
- 실제 활성화에는 소유자 Firebase 프로젝트, Google 공급자, 승인 도메인, Storage 요금제, 규칙 게시 권한이 필요하다. 이 외부 권한 없이는 실제 동기화 통과로 기록하지 않는다.
- 운영자 절차와 실제 PC→휴대폰 검증 순서는 `FIREBASE_ACTIVATION_PACKET_v1.md`에 고정했다.

## 2026-07-23 · Samsung 공개 v16 실기기 재검증 통과 (추가)

- Samsung SM-G996N에서 공개 v16 해시를 확인한 뒤 IDB 저장·재접속, ENEX PDF, 오프라인 재개, PWA 설치 경로를 실제로 통과했다.
- 시험 노트·첨부를 제거한 뒤 시작 상태 서명이 일치했다. 실제 PC 1,915노트는 이 기기에 없었으며, 실데이터 동기화 통과로 과장하지 않는다.
- CDP 화면 캡처만 시간 내 응답하지 않았다. 이 오류는 보조 증빙 제한으로 기록했고, 핵심 데이터 여정·원상복구를 실패로 바꾸지 않는다.
- 현행 v16 공식 알파 관문은 `3/5`다. 실제 Firebase 활성화, PC 실제 백업→휴대폰 실제 복원, 3~5명 파일럿, 종료 보고가 남았다.

## 2026-07-23 · 개인정보 안전형 v16 실기기 화면 증빙 통과 (추가)

- 원상복구 서명 확인 뒤 화면 DOM을 무해한 QA 카드로만 교체해 노트·첨부·계정 정보를 캡처하지 않았다.
- Samsung SM-G996N의 새 무선 ADB 연결에서 CDP 화면 캡처가 통과했다. CDP 실패 때만 ADB 캡처를 제한 시간의 대체 수단으로 쓴다.
- `artifacts/physical_android_alpha_v16.png`는 실제 데이터가 없는 검증 카드만 담는다.

## 2026-07-23 · 현행 v16 자동 회귀 최신화 (추가)

- Firebase 설정 오류, UID Storage Rules, Google 백업·복원 롤백, 대용량 복원 경계값을 자동 회귀로 확대했고 모두 통과했다.
- 해시 없는 ENEX 첨부·청크 경계 스트리밍 하네스는 고정된 옛 localhost/v11·v12를 버리고 임시 서버의 v16을 기본으로 쓰게 했다.
- 공개 첨부 3종, 고정 ENEX 용량 제한 제거, 외부 HTML 차단, IDB 차단 시 고지·입력 유지, schema 4→5 마이그레이션 하네스도 공개 v16 SHA 기준으로 갱신해 통과했다.
- `test_post_import_integrity_v1.mjs`는 실제 PC Chrome 원격 디버깅과 약 1,950개 실데이터를 전제로 하므로 현재 휴대폰 연결에서는 실행하지 않았다. 제품 실패나 실데이터 검증 통과로 기록하지 않는다.
