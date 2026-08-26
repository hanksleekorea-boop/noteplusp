import assert from 'node:assert/strict';
import path from 'node:path';
import {harness,ready,root} from './v22_test_harness.mjs';
const h=await harness();
try{const a=await h.browser.newContext(),page=await a.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();
 await page.locator('#enexFile').setInputFiles(path.join(root,'pilot-assets/노트플러스P_파일럿_샘플.enex'));await page.locator('#importPreviewConfirm').click();await page.waitForFunction(async()=>(await v22BuildCertificate()).status==='일치');
 const exported=await page.evaluate(async()=>{const note=state.notes.find(n=>n.attachmentIds.length);state.notes=state.notes.filter(n=>n.id!==note.id);note.deletedAt=Date.now();state.trash.push(note);state.preferences.futureSetting={retained:true};await persist();const original=stateSignature(state),expected=migrateState(cloneState(state));sanitizeAllNoteHtml(expected);const jsonAttachments=await collectExportAttachments();const zip=await v22ExportPortable();window.exportedZip=zip;return {bytes:Array.from(new Uint8Array(await zip.arrayBuffer())),signature:stateSignature(expected),sourceUnchanged:original===stateSignature(state),jsonAttachmentCount:jsonAttachments.length,attachmentIds:note.attachmentIds};});assert.equal(exported.jsonAttachmentCount,1);assert.equal(exported.sourceUnchanged,true);
 const b=await h.browser.newContext(),destination=await b.newPage();await ready(destination,h.origin+'/노트앱_v22.html');await destination.locator('#v22SkipWelcome').click();
 const restored=await destination.evaluate(async bytes=>{const prepared=await v22ReadPortable(new Blob([new Uint8Array(bytes)]));await v22ApplyPortable(prepared,stateSignature(state));const id=prepared.items[0].meta.id,item=await getAttachmentRecord(id);return {signature:stateSignature(state),blobSize:item.blob.size};},exported.bytes);assert.equal(restored.signature,exported.signature);assert.equal(restored.blobSize,69);
 await ready(destination,h.origin+'/노트앱_v22.html');assert.equal(await destination.evaluate(()=>stateSignature(state)),exported.signature);
 assert.equal(await destination.evaluate(async bytes=>{const before=stateSignature(state);try{await v22ApplyPortable(await v22ReadPortable(new Blob([new Uint8Array(bytes)])),before);return false;}catch{ return before===stateSignature(state);}},exported.bytes),true);
 const negatives=await page.evaluate(async()=>{let blocked=0;for(const paths of [['../evil'],['x','x'],['/absolute'],['C:/escape']]){try{await noteplusPortable.encode(paths.map(path=>({path,blob:new Blob(['a'])})));}catch{blocked++;}}const data=new Uint8Array(await exportedZip.arrayBuffer());data[100]^=1;try{await v22ReadPortable(new Blob([data]));}catch{blocked++;}return blocked;});assert.equal(negatives,5);
 // Cancelling permanent deletion must preserve both note state and its PDF.
 await destination.evaluate(()=>{ui.trash=true;ui.selectedId=state.trash[0].id;render();});destination.on('dialog',dialog=>dialog.dismiss());
 await destination.locator('#delBtn').click();await destination.locator('#delBtn').click();assert.equal(await destination.evaluate(()=>stateSignature(state)),exported.signature);
 await a.close();await b.close();console.log('PASS v22 ZIP Markdown+metadata+trash PDF roundtrip, settings, reload, nonempty guard, traversal/duplicates/corruption and delete cancel');
}finally{await h.close();}
