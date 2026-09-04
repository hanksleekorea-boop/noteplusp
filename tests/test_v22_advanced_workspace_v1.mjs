import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{
 const context=await h.browser.newContext(),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page,h.origin+'/노트앱_v22.html');await page.waitForFunction(()=>window.noteplusAdvanced?.ready);
 const result=await page.evaluate(async()=>{
  const api=noteplusAdvanced,before=stateSignature(state),original=cloneState(state);let personas=0;
  for(let i=0;i<1000;i++){const p=api.normalize({purpose:['record','migration','research','work','archive','invalid'][i%6],level:['beginner','familiar','advanced','invalid'][i%4],cards:['batch','batch','unknown','capture'],tips:i%2===0});if(p.schema===1&&p.cards.join(',')==='batch,capture')personas++;}
  api.writeSettings({purpose:'research',level:'advanced',cards:['batch','capture'],tips:false});const settings=api.readSettings(),afterSettings=stateSignature(state);
  const now=Date.now(),note={id:'advanced-fixture',title:'연구 주제',body:'private-body@example.test',bodyHtml:'<div>private-body@example.test</div>',notebook:'개인',tags:[],attachmentIds:[],created:now,updated:now,history:[]};
  let next=cloneState(state);next.notes.push(note,{...note,id:'advanced-mention',title:'다른 노트',body:'연구 주제에 대한 문자 언급',bodyHtml:'연구 주제에 대한 문자 언급'});await v22SwapState(stateSignature(state),next);state=next;
  const preview=api.batchPreview([note.id,'missing-id'],'tag','시험'),beforePreview=stateSignature(state);const applied=await api.applyBatch(preview);const tagged=state.notes.find(n=>n.id===note.id).tags.includes('시험');
  let staleBlocked=false;try{await api.applyBatch(preview);}catch{staleBlocked=true;}
  const failurePlan=api.batchPreview([note.id],'notebook','실패대상'),beforeFailure=stateSignature(state),swap=v22SwapState;v22SwapState=async()=>{throw Error('simulated storage failure');};let failureBlocked=false;try{await api.applyBatch(failurePlan);}catch{failureBlocked=true;}finally{v22SwapState=swap;}
  const unchangedFailure=beforeFailure===stateSignature(state),diag=JSON.stringify(api.diagnostic()),mentions=api.mentions(note.id),support=api.attachmentSupport({meta:{mime:'image/png'},blob:new Blob(['x'],{type:'image/png'})});
  const templateCount=DEFAULT_TEMPLATES.length,missing=api.attachmentSupport(null),future=api.evidenceAge(Date.now()+100000),old=api.evidenceAge(Date.now()-8*86400000);
  await v22SwapState(stateSignature(state),original);state=original;render();return {personas,before,afterSettings,settings,previewCount:preview.ids.length,applied,tagged,staleBlocked,failureBlocked,unchangedFailure,diag,mentions,support,missing,future,old,templateCount,restored:stateSignature(state)===before,beforePreview};
 });
 assert.equal(result.personas,1000);assert.equal(result.before,result.afterSettings);assert.deepEqual(result.settings.cards,['batch','capture']);assert.equal(result.applied.applied,1);assert.equal(result.applied.skipped,1);assert.ok(result.tagged&&result.staleBlocked&&result.failureBlocked&&result.unchangedFailure&&result.restored);assert.equal(result.templateCount,15);assert.equal(result.mentions.length,1);assert.equal(result.support.preview,true);assert.equal(result.missing.original,'missing');assert.equal(result.future,'잘못된 미래 시각');assert.equal(result.old,'7일 이상 지난 기록');assert.ok(!result.diag.includes('private-body')&&!result.diag.includes('example.test')&&!result.diag.includes('연구 주제'));
 await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 for(const width of [360,390,640,1280,1920]){await page.setViewportSize({width,height:850});await page.evaluate(()=>noteplusAdvanced.openBatch());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);await page.keyboard.press('Escape');}
 await page.goto(h.origin+'/help.html');await page.waitForFunction(()=>document.querySelectorAll('#errors article').length===20);assert.equal(await page.locator('#coreJourneys article').count(),6);assert.equal(await page.locator('#terms article').count(),5);await page.locator('#helpSearch').fill('암호');assert.ok(await page.locator('article.card:visible').count()>0);await page.locator('#helpSearch').fill('없는문구XYZ');assert.equal(await page.locator('article.card:visible').count(),0);await page.locator('#helpClear').click();assert.equal(await page.locator('article.card:visible').count(),49);
 for(const width of [360,640,1280]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`help overflow ${width}`);}
 assert.deepEqual(errors,[]);await context.close();console.log(JSON.stringify({ok:true,syntheticSettingsCases:1000,actualUsers:0,templates:15,helpCards:49,batchAtomic:true,staleBlocked:true,storageFailurePreserved:true,diagnosticPrivateContent:0,widths:[360,390,640,1280,1920],actualAndroid:false}));
}finally{await h.close();}
