// Deliberately separate from routine checks: creates 1GiB of synthetic binary data
// in a disposable browser profile. No external accounts or personal data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {harness,ready,root} from './v22_test_harness.mjs';
if(process.env.NOTEPLUS_LARGE_E2E!=='1')throw new Error('Set NOTEPLUS_LARGE_E2E=1 after checking at least 3GiB free RAM and 5GiB free disk.');
const proofRoot=path.resolve(root,'../.project-continuity/local/v22-20260826');fs.mkdirSync(proofRoot,{recursive:true});const persistentPath=fs.mkdtempSync(path.join(proofRoot,'large-profile-'));
const h=await harness({persistentPath});
try{const context=await h.browser.newContext(),page=await context.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();await page.waitForFunction(()=>!v22WelcomeBusy&&!v22Welcome.open);
 const fixture=await page.evaluate(async()=>{
  window.largeOriginal=cloneState(state);window.largeStarted=performance.now();window.largeGap=0;window.largeBeat=performance.now();window.largeTimer=setInterval(()=>{const t=performance.now();largeGap=Math.max(largeGap,t-largeBeat);largeBeat=t;},20);
  window.largeBase64=btoa('A'.repeat(1024*1024));window.largeExpectedHash=await sha256Blob(new Blob(['A'.repeat(1024*1024)]));return {files:16,encodedBytes:0,decodedBytes:1024**3,notes:10000,attachments:1024,storage:await navigator.storage.estimate(),inputMode:'16 sequential files generated one at a time, not simultaneous selection'};
 });console.log(JSON.stringify({step:'fixture',...fixture}));
 for(let b=0;b<16;b++){
  fixture.encodedBytes+=await page.evaluate(b=>{const parts=['<en-export>'];for(let j=0;j<625;j++){const i=b*625+j;parts.push(`<note><title>durable-${i}</title><content><![CDATA[<en-note>fixture body ${i}</en-note>]]></content><created>20260801T000000Z</created><updated>20260801T010000Z</updated><tag>synthetic-only</tag>`);if(j<64)parts.push(`<resource><data encoding="base64">${largeBase64}</data><mime>application/octet-stream</mime><resource-attributes><file-name>binary-${i}.bin</file-name></resource-attributes></resource>`);parts.push('</note>');}parts.push('</en-export>');const file=new File(parts,`durable-${String(b).padStart(2,'0')}.enex`);document.getElementById('enexFile').onchange({target:{files:[file],value:''}});return file.size;},b);
  await page.waitForFunction(()=>!!window.pendingEnexImport,{},{timeout:120000}).catch(async error=>{throw new Error(error.message+' status='+await page.locator('#enexStatus').innerText());});
  await page.locator('#importPreviewSelectAll').click();await page.locator('#importPreviewConfirm').click();
  await page.waitForFunction(count=>state.notes.length===count&&state.lastImportReport?.importedNoteCount===625&&!v22ImportCommitPending,1+(b+1)*625,{timeout:120000});
  console.log(JSON.stringify({step:'batch-stored',batch:b+1,notes:(b+1)*625}));
 }
 const imported=await page.evaluate(async()=>{await persist();clearInterval(largeTimer);return {notes:state.notes.length,unchangedOriginal:JSON.stringify(state.notes.find(n=>n.id===largeOriginal.notes[0].id))===JSON.stringify(largeOriginal.notes[0]),maxGap:Math.round(largeGap),durationMs:Math.round(performance.now()-largeStarted),expectedHash:largeExpectedHash,report:state.lastImportReport.outcome,persistenceLimited:state.lastImportReport.persistenceLimited,attachmentErrors:state.lastImportReport.attachmentErrorCount,storage:await navigator.storage.estimate()};});
 await ready(page,h.origin+'/노트앱_v22.html');
 const stored=await page.evaluate(async expected=>{let count=0,bytes=0,mismatches=0;for(const n of state.notes)for(const id of n.attachmentIds||[]){const item=await getAttachmentRecord(id);if(!item){mismatches++;continue;}count++;bytes+=item.blob.size;if(item.blob.size!==1024*1024||await sha256Blob(item.blob)!==expected)mismatches++;}return {notes:state.notes.length,attachments:count,bytes,mismatches,readers:activeEnexJob?.readers.length||0,mode:persistenceMode};},imported.expectedHash);
 console.log(JSON.stringify({step:'post-reload-diagnostics',imported,stored,persistentProfile:true,profileDirectory:path.basename(persistentPath)}));
 assert.equal(imported.notes,10001);assert.equal(imported.unchangedOriginal,true);assert.equal(imported.report,'completed');assert.equal(stored.notes,10001);assert.equal(stored.attachments,1024);assert.equal(stored.bytes,1024**3);assert.equal(stored.mismatches,0);assert.equal(stored.mode,'idb');assert.ok(imported.maxGap<2000);
 await context.close();console.log(JSON.stringify({ok:true,fixture,imported,stored,scope:'real UI import and IndexedDB reload of synthetic 1GiB binary data; desktop Edge only, no Android or diverse attachment formats'},null,2));
}finally{await h.close();}
