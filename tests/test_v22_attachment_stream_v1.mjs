import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{const page=await h.browser.newPage();await ready(page,h.origin+'/노트앱_v22.html');
 const result=await page.evaluate(async()=>{
  const original=stateSignature(state),payload=new Uint8Array(1024*1024);payload.fill(65);const blob=new Blob([payload]),expected=await sha256Blob(blob),base64=btoa('A'.repeat(payload.length));
  const notes=[];for(let i=0;i<32;i++)notes.push(`<note><title>synthetic resource ${i}</title><content><![CDATA[<en-note>resource ${i}</en-note>]]></content><resource><data encoding="base64">${base64}</data><mime>application/octet-stream</mime><resource-attributes><file-name>fixture-${i}.bin</file-name></resource-attributes></resource></note>`);
  const file=new File(['<en-export>',...notes,'</en-export>'],'resource-32MiB.enex'),job={readers:[],cancelled:false};let gap=0,last=performance.now();const timer=setInterval(()=>{const t=performance.now();gap=Math.max(gap,t-last);last=t;},20);const started=performance.now();
  try{const parsed=await parseEnexFileStreaming(file,'fixture',file.name,null,job);let hashesMatch=true;for(const a of parsed.attachments)if(a.blob.size!==payload.length||await sha256Blob(a.blob)!==expected)hashesMatch=false;return {bytes:file.size,decodedBytes:payload.length*parsed.attachments.length,notes:parsed.notes.length,attachments:parsed.attachments.length,hashesMatch,readers:job.readers.length,maxGap:Math.round(gap),durationMs:Math.round(performance.now()-started),unchanged:original===stateSignature(state),scope:'32MiB binary attachments parsed and hashed; not 1GiB durable import'};}finally{clearInterval(timer);}
 });assert.equal(result.notes,32);assert.equal(result.attachments,32);assert.equal(result.hashesMatch,true);assert.equal(result.readers,0);assert.equal(result.unchanged,true);assert.ok(result.maxGap<2000);console.log(JSON.stringify({ok:true,...result},null,2));
}finally{await h.close();}
