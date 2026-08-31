import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{const page=await h.browser.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();await page.waitForFunction(()=>!v22WelcomeBusy&&!v22Welcome.open);
 const result=await page.evaluate(async()=>{
  const before=stateSignature(state);let blocked=0;
  const zip=await v22ExportPortable(),entries=await noteplusPortable.decode(zip),base=JSON.parse(await entries.get('metadata.json').text());
  for(const mutate of [m=>m.state.notes.push(cloneState(m.state.notes[0])),m=>{m.state.preferences.conflictVaultV1={invalid:true};},m=>{m.state.notes[0].attachmentIds=['att_missing_proof'];},m=>{m.schema=99;}]){
   const copy=cloneState(base);mutate(copy);const files=Array.from(entries,([path,blob])=>({path,blob:path==='metadata.json'?new Blob([JSON.stringify(copy)]):blob}));try{await v22ReadPortable(await noteplusPortable.encode(files));}catch{blocked++;}
  }
  let unsafe=0;for(let i=0;i<50;i++){const note=cloneState(state.notes[0]);note.bodyHtml='<img src="https://evil.invalid/x" onerror="window.v22Bad=1"><script>window.v22Bad=1</'+'script><a href="javascript:alert(1)">bad</a><div>safe'+i+'</div>';sanitizeStoredNoteHtml(note);const host=document.createElement('div');host.innerHTML=note.bodyHtml;if(host.querySelector('script,[onerror],a[href^="javascript:"]')||window.v22Bad)unsafe++;}
  const priorLimit=V22_MAX_NOTE_XML_CHARS;V22_MAX_NOTE_XML_CHARS=1024;let oversizedBlocked=false;try{await parseEnexFileStreaming(new File(['<en-export><note>'+('x'.repeat(2048))],'large-note.enex'),'test','test',null,{readers:[],cancelled:false});}catch{oversizedBlocked=true;}finally{V22_MAX_NOTE_XML_CHARS=priorLimit;}
  let brokenBlocked=false;try{await parseEnexFileStreaming(new File(['<en-export><note><title>broken'],'broken.enex'),'test','test',null,{readers:[],cancelled:false});}catch{brokenBlocked=true;}
  const report=await v22BuildCertificate();return {blocked,hostileRotations:50,unsafe,oversizedBlocked,brokenBlocked,unchanged:before===stateSignature(state),reportContainsBody:JSON.stringify(report).includes(state.notes[0].body)};
 });assert.equal(result.blocked,4);assert.equal(result.unsafe,0);assert.equal(result.oversizedBlocked,true);assert.equal(result.brokenBlocked,true);assert.equal(result.unchanged,true);assert.equal(result.reportContainsBody,false);console.log(JSON.stringify({ok:true,...result},null,2));
}finally{await h.close();}
