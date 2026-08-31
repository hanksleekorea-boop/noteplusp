import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{const page=await h.browser.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();
 const result=await page.evaluate(async()=>{const old=cloneState(state);state.notes=Array.from({length:10000},(_,i)=>({id:'large_'+i,title:'노트 '+i,body:'검색 표본 '+i+' '+(i%2?'alpha':'beta'),bodyHtml:'검색 표본 '+i,tags:['분류'+i%8],notebook:'업무',created:1,updated:i+1,favorite:false,history:[],attachmentIds:[]}));state.notebooks=['업무'];ui.selectedId=state.notes[0].id;ui.notebook='all';ui.query='';const start=performance.now();render();const readyMs=performance.now()-start,initialRows=document.querySelectorAll('#listScroll [role=option]').length,times=[];
 for(let i=0;i<40;i++){ui.query=i%2?'alpha':'검색';const t=performance.now();renderList();times.push(performance.now()-t);await new Promise(r=>setTimeout(r,0));}times.sort((a,b)=>a-b);ui.query='';renderList();window.largeOriginal=old;return {notes:state.notes.length,readyMs,p95:times[Math.ceil(times.length*.95)-1],initialRows,pages:document.querySelector('#v22ListPager [role=status]').textContent};});
 assert.equal(result.notes,10000);assert.equal(result.initialRows,100);assert.ok(result.readyMs<10000);assert.ok(result.p95<500);assert.match(result.pages,/100쪽/);
 await page.getByRole('button',{name:'다음 100개',exact:true}).click();assert.match(await page.locator('#v22ListPager').innerText(),/2 \/ 100쪽/);assert.equal(await page.locator('#listScroll [role=option]').count(),100);
 await page.evaluate(()=>{state=largeOriginal;render();});console.log(JSON.stringify({ok:true,...result,scope:'synthetic 10,000-note rendering/search; no real-user/device performance claim'},null,2));
}finally{await h.close();}
