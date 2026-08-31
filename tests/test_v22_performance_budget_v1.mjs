import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {harness,ready} from './v22_test_harness.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fullRunner=fs.readFileSync(path.join(root,'tools/github_full_check.ps1'),'utf8');
assert.match(fullRunner,/test_v22_library_10000_v1\.mjs/);
assert.match(fullRunner,/test_v22_large_stream_v1\.mjs/);

const h=await harness();
try{
 const context=await h.browser.newContext(),page=await context.newPage();await ready(page,h.origin+'/노트앱_v22.html');
 const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:3});
 const result=await page.evaluate(async()=>{
  var original=cloneState(state),originalUi=Object.assign({},ui),now=Date.now();state.notes=Array.from({length:10000},function(_,i){return {id:'perf_'+i,title:i%20===0?'한글 기준 '+i:'노트 '+i,body:i%20===0?'찾을 내용 '+i:'일반 본문',bodyHtml:i%20===0?'찾을 내용 '+i:'일반 본문',notebook:'대형',tags:['t'+i%7],attachmentIds:[],favorite:false,updated:now-i,created:now-i};});state.trash=[];state.notebooks=['대형'];ui.trash=false;ui.notebook='all';ui.tag=null;ui.query='한글';ui.selectedId='perf_0';
  v22PerformanceSamples={search:[],open:[],save:[],longTask:[]};
  for(var i=0;i<20;i++)v22MeasurePerformance('search',function(){return state.notes.filter(function(note){return v22SearchReasons(note,'한글 tag:t1').matched;});});
  for(var j=0;j<20;j++){ui.selectedId='perf_'+j;renderEditor();}
  for(var k=0;k<8;k++)await v22MeasurePerformanceAsync('save',function(){return Promise.resolve(persist());});
  var longStarted=performance.now();v22BuildLinkIndex(state);v22RecordPerformance('longTask',performance.now()-longStarted);
  var snapshot=v22PerformanceSnapshot();v22RenderPerformance();var uiText=document.getElementById('v22PerformanceSummary').textContent,stateAfter=stateSignature(state);state=original;Object.assign(ui,originalUi);render();return {snapshot,uiText,stateAfter};
 });
 for(const name of ['search','open','save','longTask']){assert.ok(result.snapshot[name].samples>0,`${name} samples`);assert.equal(result.snapshot[name].pass,true,`${name} P95 ${result.snapshot[name].p95}ms exceeded ${result.snapshot[name].budget}ms`);}
 assert.match(result.uiText,/P95/);assert.equal(result.snapshot.search.budget,500);assert.equal(result.snapshot.open.budget,300);assert.equal(result.snapshot.save.budget,500);assert.equal(result.snapshot.longTask.budget,2000);
 const second=await context.newPage();await ready(second,h.origin+'/노트앱_v22.html');const secondSnapshot=await second.evaluate(()=>v22PerformanceSnapshot());assert.equal(secondSnapshot.search.samples,1);assert.ok(secondSnapshot.open.samples>=1);await second.close();
 await context.close();console.log(JSON.stringify({ok:true,card:'S2-005',cpuThrottle:'3x',library:10000,oneGiBContract:true,multiTab:true,budgets:Object.fromEntries(Object.entries(result.snapshot).map(([key,value])=>[key,{p95:Math.round(value.p95),budget:value.budget,pass:value.pass}]))},null,2));
}finally{await h.close();}
