import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{
 const context=await h.browser.newContext();const page=await context.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();
 await page.locator('#v22StatusOpen').click();await page.locator('#v22StatusDialog[open]').waitFor();
 assert.match(await page.locator('#v22BackupTime').innerText(),/확인된 기록 없음/);
 for(const [message,code] of [['HTTP 401','AUTH'],['HTTP 403','PERMISSION'],['HTTP 429','RATE_LIMIT'],['HTTP 507','QUOTA'],['HTTP 503','SERVICE']]){
  const s=await page.evaluate(message=>{setCloudUi({phase:'error',message});return v22StatusView();},message);assert.equal(s.errorCode,code);assert.ok(s.action.length>10);assert.equal(s.lastBackupAt,0);
 }
 await context.setOffline(true);assert.equal(await page.evaluate(()=>v22StatusView().cloudState),'offline');
 const local=await page.evaluate(async()=>{await persist();return v22StatusView();});assert.ok(local.lastLocalSaveAt>0);assert.equal(local.pendingCount,0);
 await context.setOffline(false);await page.locator('#v22StatusClose').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'v22StatusOpen');
 await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>storageReady);assert.ok(await page.evaluate(()=>v22Status.lastLocalSaveAt>0));assert.equal(await page.evaluate(()=>v22Status.lastBackupAt),0);
 await context.close();console.log('PASS v22 local/Drive status, 401/403/429/507/503, offline, focus and non-fabricated backup time');
}finally{await h.close();}
