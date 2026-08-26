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
 const edges=await page.evaluate(()=>{
  const result={};let local=cloneState(state),remote=cloneState(state),id=local.notes[0].id;
  const localNote=local.notes.shift();localNote.deletedAt=Date.now();local.trash.push(localNote);remote.notes[0].body='remote modified against local trash';remote.notes[0].bodyHtml=remote.notes[0].body;remote.notes[0].updated+=1;
  let diff=v22MergeConflicts(local,remote,'both'),vault=remote.preferences.conflictVaultV1.at(-1);result.localTrash=diff.changed.length===1&&vault.localTrash===true&&vault.remoteTrash===false&&remote.trash.some(n=>n.id===id)&&!remote.notes.some(n=>n.id===id);
  local=cloneState(state);remote=cloneState(state);id=local.notes[0].id;const remoteNote=remote.notes.shift();remoteNote.body='remote trash copy';remoteNote.bodyHtml=remoteNote.body;remoteNote.updated+=2;remoteNote.deletedAt=Date.now();remote.trash.push(remoteNote);
  diff=v22MergeConflicts(local,remote,'both');vault=remote.preferences.conflictVaultV1.at(-1);result.remoteTrash=diff.changed.length===1&&vault.localTrash===false&&vault.remoteTrash===true&&remote.notes.some(n=>n.id===id)&&!remote.trash.some(n=>n.id===id);
  local=cloneState(state);remote=cloneState(state);local.notes[0].safeExtension={side:'local'};remote.notes[0].safeExtension={side:'remote'};diff=v22MergeConflicts(local,remote,'both');vault=remote.preferences.conflictVaultV1.at(-1);result.unknownField=diff.changed.length===1&&vault.localCopy.safeExtension.side==='local'&&vault.remoteCopy.safeExtension.side==='remote';
  const invalids=[];
  for(const mutate of [
   data=>{data.notes[0].id='';},
   data=>{data.trash.push(cloneState(data.notes[0]));},
   data=>{data.notes[0].updated=Date.now()+3600000;}
  ]){local=cloneState(state);remote=cloneState(state);mutate(remote);const before=JSON.stringify(local);try{v22MergeConflicts(local,remote,'both');invalids.push(false);}catch{invalids.push(JSON.stringify(local)===before);}}
  result.invalidRejected=invalids.every(Boolean);return result;
 });
 assert.deepEqual(edges,{localTrash:true,remoteTrash:true,unknownField:true,invalidRejected:true});
 await context.close();console.log('PASS v22 100 conflict pairs, trash-vs-edit, unknown fields, invalid input rejection, explicit authorization, durable vault UI');
}finally{await h.close();}
