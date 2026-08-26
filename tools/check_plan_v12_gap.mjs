import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'PRODUCT_PLAN_v12_GAP_BREAKTHROUGH_PROPOSED.md');
const text=fs.readFileSync(file,'utf8');

function check(body){
  const errors=[];
  const fields=[...body.matchAll(/^### (F\d{2}) /gm)].map(x=>x[1]);
  const expected=Array.from({length:27},(_,i)=>`F${String(i+1).padStart(2,'0')}`);
  if(JSON.stringify(fields)!==JSON.stringify(expected))errors.push('F01-F27 순서/누락');
  for(const id of expected){
    const start=body.indexOf(`### ${id} `),next=body.indexOf('\n### F',start+8),section=body.slice(start,next<0?body.indexOf('\n## 5.',start):next);
    for(const marker of ['현재 격차:','혁신안:','화면 흐름:','자료:','완료 증거:','연결:'])if(!section.includes(marker))errors.push(`${id} ${marker}`);
  }
  const gx=[...body.matchAll(/\| GX-(\d{2}) /g)].map(x=>x[1]);
  if(new Set(gx).size!==9)errors.push('GX 9개');
  const journeys=[...body.matchAll(/\| J-(\d{2}) /g)].map(x=>x[1]);
  if(new Set(journeys).size!==6)errors.push('J 6개');
  const bundles=[...body.matchAll(/^\d+\. \*\*B12-(\d{2}) /gm)].map(x=>x[1]);
  if(new Set(bundles).size!==12)errors.push('B12 12개');
  for(const marker of ['PROPOSED','기존 v11 정본을 아직 대체하지 않음','공개 v21 보존','실제 Android','TalkBack','무료 권리','출시 금지 조건','기존 v11과의 관계'])if(!body.includes(marker))errors.push(`필수 경계 ${marker}`);
  const localLinks=[...body.matchAll(/`([^`]+\.md)`/g)].map(x=>x[1]).filter(x=>x.includes('/')||x.startsWith('..'));
  for(const link of localLinks){const target=path.resolve(root,link);if(!fs.existsSync(target))errors.push(`링크 없음 ${link}`);}
  return {fields:fields.length,gx:new Set(gx).size,journeys:new Set(journeys).size,bundles:new Set(bundles).size,errors};
}

const result=check(text);
const negativeControls={
  missingFieldRejected:check(text.replace(/^### F01 .*$/m,'### X01 삭제 표본')).errors.includes('F01-F27 순서/누락'),
  missingEvidenceRejected:check(text.replace('- **완료 증거:**','- **검사 삭제:**')).errors.some(x=>x==='F01 완료 증거:'),
  adoptionBoundaryRejected:check(text.replaceAll('PROPOSED','DRAFT')).errors.some(x=>x.includes('PROPOSED'))
};
if(Object.values(negativeControls).some(v=>!v))result.errors.push('일부러 틀린 표본 거부 실패');
console.log(JSON.stringify({status:result.errors.length?'FAIL':'PASS',...result,negativeControls,scope:'문서 구조·로컬 링크 검사; 제품 구현·실제 품질 인증 아님'},null,2));
if(result.errors.length)process.exitCode=1;
