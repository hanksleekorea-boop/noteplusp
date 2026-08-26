import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{
 const context=await h.browser.newContext();const page=await context.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();
 const rotations=await page.evaluate(()=>{
  for(let i=0;i<100;i++){let local=cloneState(state),remote=cloneState(state);remote.notes[0].body='REMOTE '+i;let before=JSON.stringify(local),diff=v22MergeConflicts(local,remote,'both');if(diff.changed.length!==1||remote.notes[0].body!==local.notes[0].body||remote.preferences.conflictVaultV1[0].remoteCopy.body!=='REMOTE '+i||JSON.stringify(local)!==before)throw new Error('conflict preservation failed');}return 100;
 });assert.equal(rotations,100);
 await page.evaluate(async()=>{window.testPrior=cloneState(state);state.notes[0].body='remote backup';state.notes[0].bodyHtml='remote backup';const payload=await prepareCloudSnapshot();state=cloneState(testPrior);await persist();window.noteplusCloud={status:()=>({user:{uid:'test'}})};window.testPreview=validateCloudRestorePreview({manifest:JSON.parse(payload.manifestText),accountUid:'test'});});
 assert.equal(await page.evaluate(async()=>{try{await restoreVerifiedCloudSnapshot(testPreview);return false;}catch(e){return /승인/.test(e.message);}}),true);
 await page.evaluate(()=>{window.choicePromise=v22ChooseRestore(testPreview);});await page.locator('[data-v22-restore="cancel"]').click();assert.equal(await page.evaluate(()=>choicePromise),null);
 assert.equal(await page.evaluate(()=>stateSignature(state)===stateSignature(testPrior)),true);
 await page.evaluate(()=>{window.choicePromise=v22ChooseRestore(testPreview);});await page.locator('[data-v22-restore="both"]').click();
 await page.evaluate(async()=>{testPreview.v22Authorization=await choicePromise;await restoreVerifiedCloudSnapshot(testPreview);});
 assert.equal(await page.evaluate(()=>state.notes[0].body===testPrior.notes[0].body),true);
 assert.equal(await page.evaluate(()=>state.preferences.conflictVaultV1[0].remoteCopy.body),'remote backup');
 await ready(page,h.origin+'/노트앱_v22.html');assert.equal(await page.evaluate(()=>state.preferences.conflictVaultV1.length),1);
 await page.evaluate(()=>v22OpenConflicts());assert.match(await page.locator('#v22ConflictItems').innerText(),/remote backup/);
 await page.evaluate(async()=>{await v22ResolveConflict(state.preferences.conflictVaultV1[0].conflictId,'remote');});
 assert.equal(await page.evaluate(()=>state.notes[0].body),'remote backup');
 assert.equal(await page.evaluate(()=>state.preferences.conflictVaultV1.some(c=>c.localCopy.body!=='remote backup'&&c.remoteCopy.body==='remote backup')),true);
 await ready(page,h.origin+'/노트앱_v22.html');assert.equal(await page.evaluate(()=>state.notes[0].body),'remote backup');
 await context.close();console.log('PASS v22 100 conflict pairs, explicit authorization, cancel unchanged, durable both versions and vault UI');
}finally{await h.close();}
