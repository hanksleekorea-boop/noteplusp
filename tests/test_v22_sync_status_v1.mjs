import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{
 const context=await h.browser.newContext();const page=await context.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();
 await page.locator('#v22StatusOpen').click();await page.locator('#v22StatusDialog[open]').waitFor();
 assert.match(await page.locator('#v22BackupTime').innerText(),/확인된 기록 없음/);
 const boundaries=await page.evaluate(()=>{
  setCloudUi({phase:'ready',message:'백업 완료 노트 401개 첨부 503개'});const noNumericError=v22StatusView().errorCode===null&&v22Status.lastBackupAt===0;
  setCloudUi({phase:'error',message:'알 수 없는 연결 실패'});const unknown=v22StatusView().errorCode==='UNKNOWN';
  setCloudUi({phase:'ready',message:'취소 — 기존 자료 유지'});const cancelNoCompletion=v22Status.lastBackupAt===0;
  const previous=v22Status.pendingCount;v22Status.pendingCount=-12;const negative=v22StatusView().pendingCount===0;v22Status.pendingCount=NaN;const nan=v22StatusView().pendingCount===0;v22Status.pendingCount=previous;
  const id='s5_'+'a'.repeat(40),at=Date.now()-1000;v22RecordBackup({snapshotId:id,committedAt:new Date(at).toISOString()},id);let rejected=0;
  for(const pointer of [{snapshotId:id,committedAt:'bad'},{snapshotId:id,committedAt:new Date(at-1000).toISOString()},{snapshotId:id,committedAt:new Date(Date.now()+86400000).toISOString()},{snapshotId:'s5_'+'b'.repeat(40),committedAt:new Date(at).toISOString()}])try{v22RecordBackup(pointer,id);}catch{rejected++;}
  const preserved=v22Status.lastBackupAt===at&&v22Status.lastBackupId===id;
  v22Status.localState='error';v22RenderStatus();const errorVisible=document.getElementById('v22LocalStatus').textContent.includes('저장 실패');v22Status.localState='saved';v22Status.lastBackupAt=0;v22Status.lastBackupId=null;v22SaveStatus();
  return {noNumericError,unknown,cancelNoCompletion,negative,nan,rejected,preserved,errorVisible};
 });assert.deepEqual(boundaries,{noNumericError:true,unknown:true,cancelNoCompletion:true,negative:true,nan:true,rejected:4,preserved:true,errorVisible:true});
 for(const [message,code] of [['HTTP 401','AUTH'],['HTTP 403','PERMISSION'],['HTTP 429','RATE_LIMIT'],['HTTP 507','QUOTA'],['HTTP 503','SERVICE']]){
  const s=await page.evaluate(message=>{setCloudUi({phase:'error',message});return v22StatusView();},message);assert.equal(s.errorCode,code);assert.ok(s.action.length>10);assert.equal(s.lastBackupAt,0);
 }
 await context.setOffline(true);assert.equal(await page.evaluate(()=>v22StatusView().cloudState),'offline');
 const local=await page.evaluate(async()=>{await persist();return v22StatusView();});assert.ok(local.lastLocalSaveAt>0);assert.equal(local.pendingCount,0);
 await context.setOffline(false);await page.locator('#v22StatusClose').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'v22StatusOpen');
 await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>storageReady);assert.ok(await page.evaluate(()=>v22Status.lastLocalSaveAt>0));assert.equal(await page.evaluate(()=>v22Status.lastBackupAt),0);
 await page.evaluate(()=>localStorage.setItem('noteplusp_v22_sync_status',JSON.stringify({lastLocalSaveAt:Date.now()+86400000,lastBackupAt:Date.now()+86400000,lastBackupId:'s5_'+'a'.repeat(40)})));await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>v22Status.lastBackupAt),0);assert.equal(await page.evaluate(()=>v22Status.lastBackupId),null);
 await context.close();console.log('PASS v22 status errors, false events, numeric text, past/future timestamps, negative/NaN counts, cancellation and preserved confirmed backup');
}finally{await h.close();}
