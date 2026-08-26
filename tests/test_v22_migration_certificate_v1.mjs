import assert from 'node:assert/strict';
import path from 'node:path';
import {harness,ready,root} from './v22_test_harness.mjs';
const h=await harness();
try{const context=await h.browser.newContext();const page=await context.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();
 assert.equal((await page.evaluate(()=>v22BuildCertificate())).status,'검사 불가');
 await page.locator('#enexFile').setInputFiles(path.join(root,'pilot-assets/노트플러스P_파일럿_샘플.enex'));
 await page.locator('#importPreview').waitFor({state:'visible'});await page.locator('#importPreviewConfirm').click();
 await page.waitForFunction(()=>state.lastImportReport?.completedAt&&state.lastImportUndo&&persistenceMode==='idb');
 await page.waitForFunction(async()=>{const c=await v22BuildCertificate();return c.attachmentsChecked===1&&c.status==='일치';});
 const result=await page.evaluate(async()=>{const before=stateSignature(state),c=await v22BuildCertificate();return {c,unchanged:before===stateSignature(state)};});
 assert.equal(result.c.status,'일치');assert.equal(result.c.imported,1);assert.equal(result.c.attachmentsChecked,1);assert.equal(result.unchanged,true);assert.equal(JSON.stringify(result.c).includes('가져오기가 정상적으로 끝났습니다'),false);
 await page.evaluate(async()=>{const id=state.lastImportUndo.attachmentIds[0],item=await getAttachmentRecord(id);item.blob=new Blob(['corrupt'],{type:item.meta.mime});await writeAttachmentBatch([item]);volatileAttachments[id]=item;});
 const broken=await page.evaluate(()=>v22BuildCertificate());assert.equal(broken.status,'주의 필요');assert.equal(broken.hashMismatches,1);assert.equal(broken.sizeMismatches,1);
 assert.equal(await page.evaluate(async()=>{try{await collectExportAttachments();return false;}catch(e){return true;}}),true);
 await context.close();console.log('PASS v22 actual ENEX+PDF certificate, read-only result, corruption detection and export fail-closed');
}finally{await h.close();}
