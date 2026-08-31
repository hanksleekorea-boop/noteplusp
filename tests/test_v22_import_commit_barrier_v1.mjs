import assert from 'node:assert/strict';
import path from 'node:path';
import {harness,ready,root} from './v22_test_harness.mjs';
const h=await harness();
try{const page=await h.browser.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();await page.waitForFunction(()=>!v22WelcomeBusy&&!v22Welcome.open);
 await page.locator('#enexFile').setInputFiles(path.join(root,'pilot-assets/노트플러스P_파일럿_샘플.enex'));
 await page.evaluate(()=>{window.beforeImport=stateSignature(state);window.realEnsureHashes=ensureAttachmentHashes;window.hashGate=new Promise(resolve=>{window.releaseHashes=resolve;});ensureAttachmentHashes=items=>hashGate.then(()=>realEnsureHashes(items));});
 await page.locator('#importPreviewConfirm').click();
 const pending=await page.evaluate(async()=>{window.earlyPersist=persist();return {pending:!!v22ImportCommitPending,durableUnchanged:stateSignature(migrateState(await idbGet('app_state','root')))===beforeImport,status:v22StatusView().pendingCount,certificate:(await v22BuildCertificate()).status};});assert.equal(pending.pending,true);assert.equal(pending.durableUnchanged,true);assert.ok(pending.status>0);assert.equal(pending.certificate,'검사 불가');
 await page.evaluate(async()=>{releaseHashes();await earlyPersist;ensureAttachmentHashes=realEnsureHashes;});await ready(page,h.origin+'/노트앱_v22.html');const result=await page.evaluate(async()=>{const n=state.notes.find(n=>n.attachmentIds.length);return {note:!!n,blobSize:n?(await getAttachmentRecord(n.attachmentIds[0]))?.blob.size:0};});assert.equal(result.note,true);assert.equal(result.blobSize,69);console.log(JSON.stringify({ok:true,pending,result,scope:'autosave waits for attachment hash+atomic write; reload preserves PDF'},null,2));
}finally{await h.close();}
