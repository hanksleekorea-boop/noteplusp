import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const productPath=path.join(root,'PRODUCT_PLAN_v12_ADOPTED.md');
const developmentPath=path.join(root,'DEVELOPMENT_PLAN_v12_3STAGE.md');
const legacyProductPath=path.join(root,'PRODUCT_PLAN_v11_ADOPTED.md');
const product=fs.readFileSync(productPath,'utf8');
const development=fs.readFileSync(developmentPath,'utf8');
const legacy=fs.readFileSync(legacyProductPath,'utf8');

function unique(values){return [...new Set(values)];}
function inspect(p=product,d=development,l=legacy){
  const errors=[];
  const expect=(condition,message)=>{if(!condition)errors.push(message);};
  expect(/^> 상태: \*\*ADOPTED — 다음 개발의 유일한 제품 정본\*\*/m.test(p),'v12 제품 ADOPTED 상태');
  expect(/^> 상태: \*\*ADOPTED EXECUTION PLAN\*\*/m.test(d),'v12 개발 ADOPTED 상태');
  expect(l.includes('SUPERSEDED BY `PRODUCT_PLAN_v12_ADOPTED.md`'),'v11 SUPERSEDED 표식');
  expect(!p.includes('채택 검토용'),'검토용 문구 제거');

  const expectedFields=Array.from({length:27},(_,i)=>`F${String(i+1).padStart(2,'0')}`);
  const fields=[...p.matchAll(/^### (F\d{2}) /gm)].map(x=>x[1]);
  expect(JSON.stringify(fields)===JSON.stringify(expectedFields),'F01~F27 순서·누락');
  for(const id of expectedFields){
    const start=p.indexOf(`### ${id} `);
    const next=p.indexOf('\n### F',start+8);
    const section=p.slice(start,next<0?p.indexOf('\n## 5.',start):next);
    for(const marker of ['현재 격차:','혁신안:','화면 흐름:','자료:','완료 증거:','연결:'])expect(section.includes(marker),`${id} ${marker}`);
  }

  const gx=unique([...p.matchAll(/\| GX-(\d{2}) /g)].map(x=>x[1]));
  const journeys=unique([...p.matchAll(/\| J-(\d{2}) /g)].map(x=>x[1]));
  const bundles=unique([...p.matchAll(/^\d+\. \*\*B12-(\d{2}) /gm)].map(x=>x[1]));
  const integratedImprovements=unique([...p.matchAll(/^\| P11-IMP-(\d{3}) /gm)].map(x=>x[1]));
  expect(gx.length===9,'GX 9개');
  expect(journeys.length===6,'J 6개');
  expect(bundles.length===12,'B12 12개');
  expect(integratedImprovements.length===15,'v11 개선안 15개 통합');

  const tasks=[...d.matchAll(/^### (S([123])-\d{3}) — /gm)].map(x=>({id:x[1],stage:Number(x[2]),index:x.index}));
  expect(tasks.length===28,'기존 작업 카드 28개');
  expect(tasks.filter(x=>x.stage===1).length===12,'1단계 카드 12개');
  expect(tasks.filter(x=>x.stage===2).length===8,'2단계 카드 8개');
  expect(tasks.filter(x=>x.stage===3).length===8,'3단계 카드 8개');
  for(let i=0;i<tasks.length;i++){
    const section=d.slice(tasks[i].index,tasks[i+1]?.index??d.length);
    for(const label of ['상태:','요구사항:','선행 작업:','다음 작업:'])expect(section.includes(`- ${label}`),`${tasks[i].id} ${label}`);
    expect(/^- 완료(?: 증거| 조건| 기준)?:/m.test(section),`${tasks[i].id} 완료 기준`);
  }

  const atomic=[...d.matchAll(/^### (E1-\d{3}) — /gm)].map(x=>x[1]);
  expect(atomic.length===22,'1단계 원자 작업 22개');
  expect(new Set(atomic).size===22,'원자 작업 ID 중복 없음');
  for(const marker of [
    '판단력이 낮은 AI를 위한 절대 실행 규약','공통 자료 계약','공통 화면·오류 계약','원자 작업 산출물',
    '즉시 중단하고 기록할 조건','1단계 상용 출시 계약','2단계 세부 실행 순서','3단계 세부 실행 순서',
    'AI 실행용 카드 양식','완료 증거 파일 규격','현재 정확한 다음 행동','실제 Android','TalkBack',
    '무료 권리','출시 금지 조건','releaseAllowed:true','운영자·실사용자 정보가 없는 상태에서 S1-012를 DONE으로 바꾸지 않는다.'
  ])expect(p.includes(marker)||d.includes(marker),`필수 경계 ${marker}`);

  const fieldMappings=unique([...d.matchAll(/^\| (F\d{2}) /gm)].map(x=>x[1]));
  expect(fieldMappings.length===27,'개발계획 F01~F27 책임 연결');
  for(const file of [productPath,developmentPath]){
    const body=fs.readFileSync(file,'utf8');
    for(const link of body.matchAll(/`([^`]+\.md)`/g)){
      const value=link[1];
      if(value.includes('*')||value.includes(' '))continue;
      const projectContext=value.startsWith('../')||value.startsWith('.project-continuity/')||['AGENTS.md','HISTORY.md','TEST_EVIDENCE.md','LOCK.json'].includes(value);
      if(projectContext)continue;
      expect(fs.existsSync(path.resolve(root,value)),`저장소 내부 링크 없음 ${value}`);
    }
  }
  return {fields:fields.length,gx:gx.length,journeys:journeys.length,bundles:bundles.length,integratedImprovements:integratedImprovements.length,tasks:tasks.length,stages:`${tasks.filter(x=>x.stage===1).length}/${tasks.filter(x=>x.stage===2).length}/${tasks.filter(x=>x.stage===3).length}`,atomic:atomic.length,errors};
}

const result=inspect();
const negativeControls={
  adoptionRejected:inspect(product.replace('ADOPTED — 다음 개발의 유일한 제품 정본','DRAFT'),development,legacy).errors.includes('v12 제품 ADOPTED 상태'),
  fieldRejected:inspect(product.replace(/^### F01 .*$/m,'### X01 누락 표본'),development,legacy).errors.includes('F01~F27 순서·누락'),
  atomicRejected:inspect(product,development.replace(/^### E1-001 .*$/m,'### X1-001 누락 표본'),legacy).errors.includes('1단계 원자 작업 22개'),
  legacyBoundaryRejected:inspect(product,development,legacy.replace('SUPERSEDED BY `PRODUCT_PLAN_v12_ADOPTED.md`','ADOPTED')).errors.includes('v11 SUPERSEDED 표식')
};
if(Object.values(negativeControls).some(x=>!x))result.errors.push('일부러 틀린 표본 거부 실패');
console.log(JSON.stringify({status:result.errors.length?'FAIL':'PASS',...result,negativeControls,scope:'기획 문서 구조·통합·누락 검사; 제품 구현이나 실제 상용 품질 증거가 아님'},null,2));
if(result.errors.length)process.exitCode=1;
