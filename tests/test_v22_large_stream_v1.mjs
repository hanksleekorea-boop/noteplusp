import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{const page=await h.browser.newPage();await ready(page,h.origin+'/노트앱_v22.html');
 const result=await page.evaluate(async()=>{
  const padding=new Blob([' '.repeat(1024*1024)]),parts=['<en-export>'];for(let i=0;i<1024;i++)parts.push(padding);
  for(let i=0;i<10000;i++)parts.push(`<note><title>대량 ${i}</title><content><![CDATA[<en-note>노트 ${i}</en-note>]]></content><created>20260801T000000Z</created></note>`);parts.push('</en-export>');
  const file=new File(parts,'synthetic-padded-1GiB.enex'),job={cancelled:false,readers:[]};let maxSlice=0,beats=0,maxGap=0,last=performance.now();const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;beats++;},20);const before=stateSignature(state),started=performance.now();
  try{const parsed=await parseEnexFileStreaming({size:file.size,slice(a,b){maxSlice=Math.max(maxSlice,b-a);return file.slice(a,b);}},'대량',file.name,null,job);
  const cancelled={cancelled:false,readers:[]};const cancelTimer=setTimeout(()=>{cancelled.cancelled=true;},20);let abort=false;try{await parseEnexFileStreaming(file,'대량',file.name,null,cancelled);}catch(e){abort=/abort/.test(e.message);}finally{clearTimeout(cancelTimer);}
  return {bytes:file.size,notes:parsed.notes.length,maxSlice,beats,maxGap:Math.round(maxGap),durationMs:Math.round(performance.now()-started),readers:job.readers.length,cancelReaders:cancelled.readers.length,abort,unchanged:stateSignature(state)===before,scope:'1GiB mostly XML whitespace plus 10,000 small notes; not a representative 1GiB attachment library'};
  }finally{clearInterval(timer);}
 });
 assert.ok(result.bytes>=1024**3);assert.equal(result.notes,10000);assert.ok(result.maxSlice<=2*1024**2);assert.equal(result.readers,0);assert.equal(result.cancelReaders,0);assert.equal(result.abort,true);assert.equal(result.unchanged,true);assert.ok(result.beats>20);assert.ok(result.maxGap<2000);
 console.log(JSON.stringify({ok:true,contract:'v22-large-stream',...result},null,2));
}finally{await h.close();}
