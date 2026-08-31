import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
let broken=false;
const h=await harness({route:(url,req,res)=>{if(broken&&url==='/노트앱_core_v22.html'){res.writeHead(503).end();return true;}}});
try {
  const context=await h.browser.newContext();const page=await context.newPage();
  await ready(page,h.origin+'/노트앱_v21.html');
  const before=await page.evaluate(async()=>{state.notes.push({id:'v22_guard',title:'원본 보존',body:'original',bodyHtml:'original',tags:[],notebook:state.notebooks[0]||'',created:1,updated:2,attachmentIds:[],favorite:false,history:[]});state.preferences.futureSafe={x:42};await persist();return JSON.stringify(state);});
  await page.evaluate(()=>caches.open('noteplusp-v21-keep'));
  await ready(page,h.origin+'/노트앱_v22.html');
  assert.equal(await page.title(),'노트플러스P v22');
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/sw-v22.js'));
  assert.ok(await page.evaluate(()=>caches.has('noteplusp-v21-keep')));
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.storageReady);await page.evaluate(()=>storageReady);
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await context.setOffline(false);await ready(page,h.origin+'/노트앱_v21.html');
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await context.close();broken=true;
  const failure=await h.browser.newContext({serviceWorkers:'block'});const failPage=await failure.newPage();
  await failPage.addInitScript(()=>localStorage.setItem('guard','preserve'));
  await failPage.goto(h.origin+'/노트앱_v22.html');await failPage.getByText('v22 준비에 실패했습니다.').waitFor();
  assert.equal(await failPage.evaluate(()=>localStorage.getItem('guard')),'preserve');
  assert.equal(await failPage.locator('a[href="노트앱_v21.html"]').count(),1);await failure.close();
  console.log('PASS v22 browser upgrade, old cache, offline, v21 return, loader failure data preservation');
}finally{await h.close();}
