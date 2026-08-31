import assert from 'node:assert/strict';
import fs from 'node:fs';
import {harness,ready} from './v22_test_harness.mjs';

const manifest=JSON.parse(fs.readFileSync('noteplus-v22.webmanifest','utf8'));
assert.equal(manifest.scope,'./');
assert.equal(manifest.shortcuts?.[0]?.url,'./노트앱_v22.html?action=new');
assert.deepEqual(manifest.share_target,{action:'./share-target-v22',method:'POST',enctype:'multipart/form-data',params:{title:'title',text:'text',url:'url'}});
const worker=fs.readFileSync('sw-v22.js','utf8');
assert.match(worker,/request\.method==="POST"&&event\.request\.url===shareTargetURL/);
assert.match(worker,/text:\s*cleanShareText\(form\.get\("text"\),20000\)/);
assert.match(worker,/cache-control":"no-store/);
assert.doesNotMatch(worker,/innerHTML|eval\(|new Function/);
const loader=fs.readFileSync('노트앱_v22.html','utf8');
assert.match(loader,/sw-v22\.js",\{scope:"\.\/"\}/);

const h=await harness();
try{
  const context=await h.browser.newContext();
  const page=await context.newPage();
  await ready(page,h.origin+'/노트앱_v22.html');
  const before=await page.evaluate(()=>({count:state.notes.length,signature:stateSignature(state)}));
  const preview=await page.evaluate(()=>{window.quickCaptureExecuted=0;const payload=v22OpenQuickCapture({title:'공유 제목',text:'<img src=x onerror="quickCaptureExecuted=1">\n둘째 줄',url:'javascript:alert(1)'});return {payload,open:document.getElementById('v22QuickCaptureDialog').open,title:document.getElementById('v22QuickCapturePreviewTitle').textContent,text:document.getElementById('v22QuickCapturePreviewText').textContent,url:document.getElementById('v22QuickCapturePreviewURL').textContent,executed:window.quickCaptureExecuted,signature:stateSignature(state)};});
  assert.equal(preview.open,true);assert.equal(preview.title,'공유 제목');assert.match(preview.text,/<img/);assert.equal(preview.url,'주소 없음');assert.equal(preview.executed,0);assert.equal(preview.signature,before.signature);
  await page.locator('#v22QuickCaptureSave').click();
  await page.waitForFunction(count=>state.notes.length===count+1,before.count);
  const saved=await page.evaluate(()=>{const note=state.notes[0];return {note,count:state.notes.length,executed:window.quickCaptureExecuted};});
  assert.equal(saved.count,before.count+1);assert.match(saved.note.body,/<img/);assert.doesNotMatch(saved.note.bodyHtml,/<img\b/i);assert.equal(saved.executed,0);
  const duplicate=await page.evaluate(async()=>{const count=state.notes.length,result=await v22CommitQuickCapture({title:'공유 제목',text:'<img src=x onerror="quickCaptureExecuted=1">\n둘째 줄',url:'javascript:alert(1)'});return {countBefore:count,countAfter:state.notes.length,result};});
  assert.equal(duplicate.result.duplicate,true);assert.equal(duplicate.countAfter,duplicate.countBefore);
  const invalid=await page.evaluate(async()=>{let blank=false;try{await v22CommitQuickCapture({});}catch{blank=true;}const normalized=v22NormalizeQuickCapture({title:'T'.repeat(500),text:'X'.repeat(25000),url:'file:///secret'});return {blank,title:normalized.title.length,text:normalized.text.length,url:normalized.url};});
  assert.deepEqual(invalid,{blank:true,title:300,text:20000,url:''});
  await context.close();

  const shortcutContext=await h.browser.newContext();
  const shortcut=await shortcutContext.newPage();
  await ready(shortcut,h.origin+'/노트앱_v22.html?action=new');
  await shortcut.waitForFunction(()=>new URL(location.href).search===''&&document.activeElement?.id==='edTitle');
  const shortcutResult=await shortcut.evaluate(()=>({welcome:document.getElementById('v22Welcome').open,selected:!!byId(ui.selectedId),titleFocused:document.activeElement?.id==='edTitle',query:location.search}));
  assert.deepEqual(shortcutResult,{welcome:false,selected:true,titleFocused:true,query:''});
  await shortcutContext.close();
  console.log(JSON.stringify({ok:true,card:'S2-001',shortcut:true,sharePreview:true,explicitSave:true,duplicateBlocked:true,hostileHtmlExecuted:0,blankBlocked:true,largeInputBounded:true,offlineContract:'service-worker POST inbox; physical Android share sheet still required'},null,2));
} finally { await h.close(); }
