import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{const p=await h.browser.newPage();await ready(p,h.origin+'/노트앱_v22.html');await p.locator('#v22SkipWelcome').click();await p.waitForFunction(()=>!v22WelcomeBusy&&!v22Welcome.open);
 const result=await p.evaluate(async()=>{
  const localId='att_vault_local',remoteId='att_vault_remote',noteId=state.notes[0].id;
  async function item(id,body){const blob=new Blob([body],{type:'text/plain'});return {meta:{id,noteId,name:id+'.txt',mime:'text/plain',size:blob.size,created:1,sha256:await sha256Blob(blob)},blob};}
  const a=await item(localId,'AAA'),b=await item(remoteId,'BBB');state.notes[0].attachmentIds=[localId];await writeStateAndAttachments([a,b],[],null);const original=cloneState(state),remote=cloneState(state);remote.notes[0].body='remote with PDF substitute';remote.notes[0].bodyHtml='remote with PDF substitute';remote.notes[0].attachmentIds=[remoteId];remote.preferences.conflictVaultV1=[{conflictId:'preserved-conflict',noteId,localCopy:cloneState(original.notes[0]),remoteCopy:cloneState(remote.notes[0]),resolution:'both',resolvedAt:null}];
  state=remote;await persist();const payload=await prepareCloudSnapshot(),manifest=JSON.parse(payload.manifestText);if(payload.attachments.length!==2)throw new Error('vault-only attachment omitted');
  state=original;await writeStateAndAttachments([await item(remoteId,'CCC')],[],null);const preview=validateCloudRestorePreview({manifest,accountUid:'qa'}),before=stateSignature(state);preview.v22Authorization={signature:before,policy:'both'};let corrupted=true;
  window.noteplusCloud={status:()=>({user:{uid:'qa'}}),downloadAttachment:async(_snapshot,d)=>corrupted?new Blob(['bad']):payload.attachments.find(x=>x.id===d.id).blob};
  let corruptionBlocked=false;try{await restoreVerifiedCloudSnapshot(preview);}catch(e){corruptionBlocked=/지문값/.test(e.message);}if(stateSignature(state)!==before)throw new Error('corruption changed original');corrupted=false;await restoreVerifiedCloudSnapshot(preview);
  const ids=Object.keys(referencedAttachmentIdsIncludingSnapshots());let missing=0;for(const id of ids)if(!await getAttachmentRecord(id))missing++;
  const remoteCopy=state.preferences.conflictVaultV1.find(c=>c.conflictId==='preserved-conflict').remoteCopy,restoredId=remoteCopy.attachmentIds[0];
  return {attachmentsInBackup:payload.attachments.length,corruptionBlocked,missing,originalBlob:await (await getAttachmentRecord(localId)).blob.text(),collisionBlob:await (await getAttachmentRecord(remoteId)).blob.text(),vaultBlob:await (await getAttachmentRecord(restoredId)).blob.text(),remapped:restoredId!==remoteId,localActive:state.notes[0].attachmentIds[0]===localId};
 });assert.equal(result.attachmentsInBackup,2);assert.equal(result.corruptionBlocked,true);assert.equal(result.missing,0);assert.equal(result.originalBlob,'AAA');assert.equal(result.collisionBlob,'CCC');assert.equal(result.vaultBlob,'BBB');assert.equal(result.remapped,true);assert.equal(result.localActive,true);console.log(JSON.stringify({ok:true,...result,realDrive:false},null,2));
}finally{await h.close();}
