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
 for(const [message,code] of [['origin_mismatch','OAUTH_ORIGIN'],['HTTP 401','AUTH'],['HTTP 403','PERMISSION'],['HTTP 429','RATE_LIMIT'],['HTTP 507','QUOTA'],['HTTP 503','SERVICE']]){
  const s=await page.evaluate(message=>{setCloudUi({phase:'error',message});return v22StatusView();},message);assert.equal(s.errorCode,code);assert.ok(s.action.length>10);assert.equal(s.lastBackupAt,0);
 }
 const oauthOriginAction=await page.evaluate(()=>{setCloudUi({phase:'error',message:'origin_mismatch'});return v22StatusView().action;});assert.match(oauthOriginAction,/등록된 HTTPS 주소/);assert.match(oauthOriginAction,/로컬 자료와 이전 완료 백업은 그대로/);
 const moduleRetry=await page.evaluate(async()=>{
  const hooks=window.noteplusDriveTestV22,beforeState=stateSignature(state),events=[],ranges=[],delays=[];
  if(!hooks)throw new Error('local Drive test hooks missing');
  const oldId='s5_'+'a'.repeat(40),newId='s5_'+'b'.repeat(40),oldAt=Date.now()-5000,newAt=Date.now()-1000;
  v22RecordBackup({snapshotId:oldId,committedAt:new Date(oldAt).toISOString()},oldId);
  let calls=0;
  hooks.setTransport(async(url,options={})=>{
   calls++;const range=new Headers(options.headers||{}).get('Content-Range');if(range)ranges.push(range);
   if(calls===1)return new Response('',{status:200,headers:{Location:'https://upload.test/session'}});
   if(calls===2)return new Response('rate limited',{status:429,headers:{'Retry-After':'0'}});
   if(calls===3)return new Response('',{status:308});
   if(calls===4)return new Response('',{status:308,headers:{Range:'bytes=0-8388607'}});
   return new Response(JSON.stringify({id:'uploaded-file'}),{status:200,headers:{'Content-Type':'application/json'}});
  },async milliseconds=>{delays.push(milliseconds);});
  window.addEventListener('noteplus-cloud-state',event=>events.push(event.detail.phase));
  try{
   const saved=await hooks.uploadResumable('synthetic.bin',new Blob([new Uint8Array(8*1024*1024+1)]),{name:'synthetic.bin'});
   const unchangedBeforeCommit=v22Status.lastBackupId===oldId&&v22Status.lastBackupAt===oldAt;
   const firstCommit=v22RecordBackup({snapshotId:newId,committedAt:new Date(newAt).toISOString()},newId);
   const duplicateCommit=v22RecordBackup({snapshotId:newId,committedAt:new Date(newAt).toISOString()},newId);
   return {savedId:saved.id,calls,ranges,delays,events,unchangedBeforeCommit,firstCommit,duplicateCommit,finalId:v22Status.lastBackupId,stateUnchanged:beforeState===stateSignature(state),view:v22StatusView()};
  }finally{hooks.resetTransport();v22Status.lastBackupAt=0;v22Status.lastBackupId=null;v22SaveStatus();}
 });
 assert.equal(moduleRetry.savedId,'uploaded-file');assert.equal(moduleRetry.calls,5);assert.deepEqual(moduleRetry.ranges,[`bytes 0-${8*1024*1024-1}/${8*1024*1024+1}`,`bytes */${8*1024*1024+1}`,`bytes 0-${8*1024*1024-1}/${8*1024*1024+1}`,`bytes ${8*1024*1024}-${8*1024*1024}/${8*1024*1024+1}`]);
 assert.equal(moduleRetry.events.includes('retrying'),true);assert.equal(moduleRetry.unchangedBeforeCommit,true);assert.equal(moduleRetry.firstCommit,true);assert.equal(moduleRetry.duplicateCommit,false);assert.equal(moduleRetry.finalId,'s5_'+'b'.repeat(40));assert.equal(moduleRetry.stateUnchanged,true);
 const loginCancel=await page.evaluate(async()=>{
  const hooks=window.noteplusDriveTestV22,before=stateSignature(state),backupAt=v22Status.lastBackupAt;
  hooks.setLoadGis(async()=>{window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({error:'access_denied'})})}}};});
  try{let rejected=false;try{await window.noteplusCloud.signIn();}catch{rejected=true;}return {rejected,phase:window.noteplusCloud.status().phase,user:window.noteplusCloud.status().user||null,backupUnchanged:v22Status.lastBackupAt===backupAt,stateUnchanged:before===stateSignature(state)};}finally{hooks.resetLoadGis();}
 });
 assert.deepEqual(loginCancel,{rejected:true,phase:'ready',user:null,backupUnchanged:true,stateUnchanged:true});
 await page.evaluate(()=>{const hooks=window.noteplusDriveTestV22,user={uid:'synthetic-user'};hooks.setSession({user,token:'synthetic-token',tokenExpiry:Date.now()+60000});hooks.emit({phase:'uploading',configured:true,user,message:'합성 업로드 중'});});
 await context.setOffline(true);assert.equal(await page.evaluate(()=>v22StatusView().cloudState),'offline');
 assert.equal(await page.evaluate(()=>window.noteplusCloud.status().phase),'offline');
 const offlineBackup=await page.evaluate(()=>({id:v22Status.lastBackupId,at:v22Status.lastBackupAt,state:stateSignature(state)}));
 const local=await page.evaluate(async()=>{await persist();return v22StatusView();});assert.ok(local.lastLocalSaveAt>0);assert.equal(local.pendingCount,0);
 await context.setOffline(false);assert.equal(await page.evaluate(()=>window.noteplusCloud.status().phase),'ready');assert.deepEqual(await page.evaluate(before=>({sameBackup:v22Status.lastBackupId===before.id&&v22Status.lastBackupAt===before.at,sameState:stateSignature(state)===before.state}),offlineBackup),{sameBackup:true,sameState:true});
 await page.evaluate(()=>{const hooks=window.noteplusDriveTestV22;hooks.setSession(null);hooks.emit({phase:'ready',configured:true,user:null,message:'합성 검사 종료'});});await page.locator('#v22StatusClose').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'v22StatusOpen');
 await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>storageReady);assert.ok(await page.evaluate(()=>v22Status.lastLocalSaveAt>0));assert.equal(await page.evaluate(()=>v22Status.lastBackupAt),0);
 await page.evaluate(()=>localStorage.setItem('noteplusp_v22_sync_status',JSON.stringify({lastLocalSaveAt:Date.now()+86400000,lastBackupAt:Date.now()+86400000,lastBackupId:'s5_'+'a'.repeat(40)})));await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>v22Status.lastBackupAt),0);assert.equal(await page.evaluate(()=>v22Status.lastBackupId),null);
 await context.close();console.log('PASS v22 status errors plus real Drive module 429 same-offset retry, single completion, login cancellation, offline/reconnect and preserved confirmed backup');
}finally{await h.close();}
