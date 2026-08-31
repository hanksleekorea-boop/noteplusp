import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{
 const context=await h.browser.newContext(),page=await context.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();
 const result=await page.evaluate(async()=>{
  const original=cloneState(state),signature=stateSignature(state);let persisted=0;
  for(let i=0;i<1000;i++){
   const raw={schema:i%5+1,notes:[{id:'persona_'+i,title:'보존 '+i,body:'본문 😀 '+i,notebook:'업무',tags:['태그'],created:100+i,updated:200+i,extra:{value:i}}],trash:[],notebooks:['업무'],preferences:{future:{i}},extraRoot:i};
   const prior=JSON.stringify(raw),next=migrateState(cloneState(raw));
   if(next.notes[0].body!==raw.notes[0].body||next.notes[0].extra.value!==i||next.preferences.future.i!==i||next.extraRoot!==i||JSON.stringify(raw)!==prior)throw new Error('persona '+i);
   if(i<50){state=next;await persist();if(stateSignature(migrateState(await idbGet('app_state','root')))!==stateSignature(next))throw new Error('durable persona '+i);persisted++;}
  }
  state=original;await persist();if(stateSignature(state)!==signature)throw new Error('fixture rollback');
  const expected=stateSignature(state),changed=cloneState(state);changed.notes[0].body='other tab';await new Promise((resolve,reject)=>{const tx=noteDb.transaction('app_state','readwrite');tx.objectStore('app_state').put(changed,'root');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
  let casBlocked=false;try{await v22SwapState(expected,original);}catch{casBlocked=true;}
  const preserved=(await idbGet('app_state','root')).notes[0].body==='other tab';await persist();
  return {syntheticPersonas:1000,durableRotations:persisted,casBlocked,preserved,realUsers:0};
 });assert.equal(result.syntheticPersonas,1000);assert.equal(result.durableRotations,50);assert.equal(result.casBlocked,true);assert.equal(result.preserved,true);
 await context.close();console.log(JSON.stringify({ok:true,...result,scope:'synthetic state rotation; not 1000 browser profiles or human user research'},null,2));
}finally{await h.close();}
