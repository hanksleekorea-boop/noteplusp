import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {harness,ready} from './v22_test_harness.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),moduleText=fs.readFileSync(path.join(root,'noteplus-telemetry-v1.js'),'utf8'),worker=fs.readFileSync(path.join(root,'sw-v22.js'),'utf8'),core=fs.readFileSync(path.join(root,'노트앱_core_v22.html'),'utf8');
for(const primitive of [/\bfetch\s*\(/,/XMLHttpRequest/,/sendBeacon/,/WebSocket/])assert.doesNotMatch(moduleText,primitive);
assert.match(worker,/noteplus-telemetry-v1\.js/);assert.match(core,/<script src="noteplus-telemetry-v1\.js"><\/script>/);

const h=await harness();
try{
 const context=await h.browser.newContext(),page=await context.newPage();await ready(page,h.origin+'/노트앱_v22.html');
 const result=await page.evaluate(()=>{var api=window.noteplusTelemetry,before=stateSignature(state),defaults=api.getSettings(),offRecord=api.record({event:'local_save',stage:'success',status:'ok',body:'비밀본문'}),offPreview=api.preview();api.setEnabled(true);var accepted=api.record({event:'drive_backup',stage:'error',status:'error',errorCode:'quota_full',durationMs:712,count:42,body:'절대남지않을본문',searchTerm:'은밀한검색어',attachmentName:'주민등록증.pdf',url:'https://example.test/private?token=SECRET',apiKey:'AIza-SECRET',location:'집주소'}),preview=api.preview(),serialized=JSON.stringify(preview),keys=Object.keys(preview[0]||{}).sort(),afterRecord=stateSignature(state);api.setEnabled(false);var rejectedAfterOptOut=api.record({event:'local_save',stage:'success',status:'ok'}),afterOptOut=stateSignature(state);api.setEnabled(true);api.record({event:'import',stage:'success',status:'ok',durationMs:10,count:1});api.clear();var cleared=api.preview();localStorage.setItem(api.storageKey,'{broken');var corrupt=api.reload();v22RenderTelemetry();var dialogText=document.getElementById('v22TelemetryDialog').textContent;return {before,defaults,offRecord,offPreview,accepted,preview,serialized,keys,afterRecord,rejectedAfterOptOut,afterOptOut,cleared,corrupt,dialogText,buckets:[api.durationBucket(99),api.durationBucket(500),api.countBucket(0),api.countBucket(42)]};});
 assert.deepEqual(result.defaults,{enabled:false,eventCount:0});assert.equal(result.offRecord,false);assert.deepEqual(result.offPreview,[]);assert.equal(result.accepted,true);assert.equal(result.preview.length,1);assert.deepEqual(result.keys,['countBucket','durationBucket','errorCode','event','schema','stage','status']);assert.deepEqual(result.preview[0],{schema:1,event:'drive_backup',stage:'error',status:'error',errorCode:'QUOTA_FULL',durationBucket:'500_1999ms',countBucket:'11_100'});
 for(const forbidden of ['절대남지않을본문','은밀한검색어','주민등록증.pdf','example.test','SECRET','AIza','집주소'])assert.doesNotMatch(result.serialized,new RegExp(forbidden));
 assert.equal(result.before,result.afterRecord);assert.equal(result.rejectedAfterOptOut,false);assert.equal(result.before,result.afterOptOut);assert.deepEqual(result.cleared,[]);assert.deepEqual(result.corrupt,{enabled:false,eventCount:0});assert.match(result.dialogText,/기본값은 꺼짐/);assert.match(result.dialogText,/어떤 기록도 전송하지 않습니다/);assert.deepEqual(result.buckets,['under_100ms','500_1999ms','0','11_100']);
 await context.close();console.log(JSON.stringify({ok:true,card:'S2-006',defaultOff:true,networkTransmission:false,allowedFields:result.keys,forbiddenSamples:0,optOutFeatureDifference:0,localDelete:true,corruptFallback:true},null,2));
}finally{await h.close();}
