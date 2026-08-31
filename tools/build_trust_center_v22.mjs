import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const owner=JSON.parse(fs.readFileSync(path.join(root,'commercial-owner-v22.json'),'utf8'));
const escape=s=>String(s??'운영자 확인 필요').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages={
 'pricing.html':['가격과 무료 권리',['1단계는 무료 공개판입니다. 결제를 받지 않으며 자동 유료 전환도 없습니다.','로컬 편집·검색·전체 내보내기·복원·삭제·기본 접근성을 무료로 유지합니다.','현재 결제가 없으므로 환불 대상 결제도 없습니다. 향후 유료 기능은 별도 선택과 가격·취소·환불 안내를 통과한 뒤에만 제공합니다.']],
 'data-rights.html':['자료 권리와 이동',['노트·첨부는 브라우저의 이 기기 저장소에 보관됩니다. 브라우저 데이터 삭제·기기 분실·저장공간 회수에 대비해 별도 백업하세요.','전체 JSON 또는 Markdown·첨부·원본 정보 ZIP으로 내보낼 수 있습니다. 일반 ZIP은 암호화되지 않습니다. 별도 암호화 백업 기능에서는 비밀번호를 보관하지 않습니다.','휴지통은 사용자 삭제 전까지, 복원점은 최근 5개, 노트 수정 기록은 최근 20개를 보관합니다. 미해결 충돌 금고는 자동 정리하지 않습니다.','Google 연결 해제는 이미 완료된 Drive 백업 삭제가 아닙니다. 서비스 중단 시에도 내려받은 표준 자료를 이용할 수 있도록 원본 내보내기를 제공합니다.']],
 'privacy.html':['개인정보 안내 초안',['이 문서는 운영자 검토 전 초안이며 법률 준수 인증이 아닙니다. 운영 주체·문의 경로·관할을 확정하기 전 상용 공개하지 않습니다.','로컬 노트와 첨부는 기본적으로 서버에 전송하지 않습니다. 사용자가 Google 로그인과 백업·복원 버튼을 선택하면 Google Drive 앱 전용 폴더를 사용합니다.','Google 연결은 계정 식별과 앱 전용 폴더 권한을 사용합니다. 인증 열쇠 문자열은 메모리에만 두며 노트와 별도로 취급합니다.','앱의 노트 본문·검색어·첨부 내용 수집 기능은 추가하지 않았습니다. 웹 호스팅·Google 등 제공자는 자체 정책에 따라 요청 정보를 처리할 수 있습니다.','문의할 때 노트 본문·첨부·비밀번호·인증정보를 공개 게시판에 올리지 마세요. 삭제·내보내기·Google 연결 해제 방법은 자료 권리 화면에서 안내합니다.']],
 'terms.html':['이용 조건 초안',['운영자와 적용 관할의 검토가 끝나지 않은 초안입니다. 정식 약관으로 확정되지 않았습니다.','무료 범위는 가격 페이지와 같습니다. 서비스는 개인 메모 이관·열람·편집·백업·복원을 목적으로 합니다.','사용자는 자신이 처리할 권한이 있는 자료를 사용하고, 중요한 자료는 별도로 내보내 보관하세요.','서비스 변경·장애·중단 때 자료 이동 경로와 상태 공지를 유지하는 것을 운영 원칙으로 합니다. 책임 범위·분쟁 처리·관할 문구는 운영자가 검토해 확정해야 합니다.']],
 'support.html':['지원 안내',['지원 연락처와 응답 목표는 아래 운영자 확인 항목이 확정된 뒤 제공됩니다. 임의의 연락처나 응답 보장을 만들지 않았습니다.','문의 자료에는 앱 버전, 기기/브라우저 종류, 발생 단계, 개인정보를 제거한 오류 코드만 포함하세요. 노트 원문·첨부·인증정보는 보내지 마세요.','저장 문제라면 탭을 닫기 전 전체 내보내기를 먼저 시도하고, Drive 문제라면 로컬 상태와 마지막 완료 백업을 구분해 확인하세요.']],
 'status.html':['서비스 상태',['v22 상태: 미공개 개발 후보. 1단계 상용화 완료를 선언하지 않습니다.','운영 기록 항목: 장애 시작 시각, 영향, 안전한 대안, 다음 갱신 시각, 복구 시각, 담당자. 실제 장애가 확인되면 기록하며 가짜 정상 운영 시간을 표시하지 않습니다.','현재 공개판 v21 주소는 유지됩니다. v22와 Google 실제 교차기기·TalkBack·실사용자·운영 정보 확인은 별도 통과 조건입니다.']]
};
const nav=Object.entries(pages).map(([file,[title]])=>`<a href="${file}">${escape(title)}</a>`).join(' · ');
const fields=[['운영 주체','operator'],['지원 연락','supportContact'],['개인정보 문의','privacyContact'],['적용 관할','jurisdiction'],['지원 응답 목표(시간)','supportResponseHours'],['장애 담당','incidentOwner'],['운영자 확인일','reviewedAt']];
for(const [file,[title,paragraphs]]of Object.entries(pages)){
 const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} — 노트플러스P</title><style>body{max-width:820px;margin:32px auto;padding:0 18px;font:17px/1.75 system-ui,sans-serif;color:#20352a}nav{line-height:2}a{color:#075929}a:focus-visible{outline:3px solid #176cb8}.notice{padding:16px;border:2px solid #935b00;background:#fff8e8}dt{font-weight:700}dd{margin:0 0 12px;overflow-wrap:anywhere}</style><body data-release-state="blocked"><header><h1>${escape(title)}</h1><p class="notice">운영자 확인 전 초안 · 상용 공개 준비 미완료</p><nav aria-label="신뢰 센터">${nav}</nav></header><main>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}<h2>운영자 확인 항목</h2><dl>${fields.map(([label,key])=>`<dt>${label}</dt><dd>${escape(owner[key])}</dd>`).join('')}</dl><p>문서 작성일: 2026-08-26 · 약관 검토: ${owner.termsReviewed?'기록 확인 필요':'미완료'}</p></main><footer><a href="노트앱_v22.html">v22 후보로 돌아가기</a> · <a href="노트앱_v21.html">현재 v21 열기</a></footer></body></html>\n`;
 fs.writeFileSync(path.join(root,file),html);
}
console.log('TRUST_CENTER_BUILT pages=6 status=DRAFT_BLOCKED');
