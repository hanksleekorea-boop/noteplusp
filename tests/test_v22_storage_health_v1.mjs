import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';

const h=await harness();
try{
 const context=await h.browser.newContext();
 const page=await context.newPage();
 await ready(page,h.origin+'/노트앱_v22.html');
 await page.locator('#v22SkipWelcome').click();
 const result=await page.evaluate(async()=>{
  const before=stateSignature(state),originalStorage=navigator.storage,originalMode=persistenceMode;
  const setStorage=(usage,quota,persisted)=>Object.defineProperty(navigator,'storage',{configurable:true,value:{estimate:async()=>({usage,quota}),persisted:async()=>persisted}});
  localStorage.removeItem('noteplusp_v22_export_health');v22ExportHealth={at:0,type:null,bytes:0,attachments:0};
  persistenceMode='idb';setStorage(10,100,true);const missingExport=await v22StorageHealthView();
  const recorded=v22RecordFullExport('portable-zip',321,7);const healthy=await v22StorageHealthView();
  setStorage(10,100,false);const notPersistent=await v22StorageHealthView();
  setStorage(90,100,true);const highUsage=await v22StorageHealthView();
  setStorage(10,0,true);const unknownQuota=await v22StorageHealthView();
  persistenceMode='memory';setStorage(10,100,true);const memory=await v22StorageHealthView();
  let invalidType=false;try{v22RecordFullExport('unknown',1,0);}catch{invalidType=true;}
  persistenceMode=originalMode;Object.defineProperty(navigator,'storage',{configurable:true,value:originalStorage});
  await document.getElementById('storageBtn').onclick();
  return {before,after:stateSignature(state),missingExport,recorded,healthy,notPersistent,highUsage,unknownQuota,memory,invalidType,message:document.getElementById('backupStatus').textContent};
 });
 assert.equal(result.before,result.after);
 assert.equal(result.missingExport.risk,'warning');assert.ok(result.missingExport.reasons.some(value=>value.includes('전체 반출')));
 assert.equal(result.recorded.type,'portable-zip');assert.equal(result.recorded.bytes,321);assert.equal(result.recorded.attachments,7);
 assert.equal(result.healthy.risk,'ok');assert.equal(result.healthy.lastExportType,'portable-zip');
 assert.equal(result.notPersistent.risk,'warning');assert.equal(result.highUsage.risk,'blocked');assert.equal(result.unknownQuota.risk,'warning');assert.equal(result.memory.risk,'blocked');assert.equal(result.invalidType,true);
 assert.match(result.message,/저장 건강|최근 전체 반출/);
 await page.evaluate(()=>localStorage.setItem('noteplusp_v22_export_health',JSON.stringify({at:Date.now()+86400000,type:'portable-zip',bytes:123,attachments:1})));
 await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>storageReady);
 assert.equal(await page.evaluate(()=>v22ExportHealth.at),0);
 await context.close();
 console.log('PASS v22 storage health covers persistence, quota, full-export evidence and invalid future records without changing notes');
}finally{await h.close();}
