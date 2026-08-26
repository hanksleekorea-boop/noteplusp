import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';

const h=await harness();
try{
 const context=await h.browser.newContext();
 const page=await context.newPage();
 await ready(page,h.origin+'/노트앱_v22.html');
 await page.locator('#v22SkipWelcome').click();
 const result=await page.evaluate(async()=>{
  const before=stateSignature(state),originalPrompt=window.prompt,originalDownload=window.downloadBlob;
  let captured=null;
  try{
   window.prompt=()=> 'v22 synthetic password only';window.downloadBlob=blob=>{captured=blob;};
   await encryptedBackup();
   if(!(captured instanceof Blob))throw new Error('encrypted download missing');
   const envelope=JSON.parse(await captured.text()),ciphertext=envelope.ciphertext;
   const decoded=await decryptBackupBundle(envelope),correct=stateSignature(decoded)===before;
   window.prompt=()=> 'wrong synthetic password';let wrongRejected=false;
   try{await decryptBackupBundle(envelope);}catch{wrongRejected=true;}
   let invalidRejected=false;try{await decryptBackupBundle({format:'wrong'});}catch{invalidRejected=true;}
   return {before,after:stateSignature(state),format:envelope.format,kdf:envelope.kdf,iterations:envelope.iterations,cipherLength:ciphertext.length,plaintextLeaked:ciphertext.includes(String(state.notes[0]?.title||'')),correct,wrongRejected,invalidRejected,health:{...v22ExportHealth},status:document.getElementById('backupStatus').textContent};
  }finally{window.prompt=originalPrompt;window.downloadBlob=originalDownload;}
 });
 assert.equal(result.before,result.after);assert.equal(result.format,'noteplusp-encrypted-v1');assert.equal(result.kdf,'PBKDF2-SHA-256');assert.equal(result.iterations,210000);assert.ok(result.cipherLength>40);assert.equal(result.plaintextLeaked,false);assert.equal(result.correct,true);assert.equal(result.wrongRejected,true);assert.equal(result.invalidRejected,true);assert.equal(result.health.type,'encrypted-json');assert.ok(result.health.bytes>0);assert.match(result.status,/암호화 백업을 만들었습니다/);
 await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>storageReady);
 assert.equal(await page.evaluate(()=>v22ExportHealth.type),'encrypted-json');
 await context.close();
 console.log('PASS v22 encrypted full backup decrypts with the right password, rejects wrong/invalid input, records export health and preserves notes');
}finally{await h.close();}
