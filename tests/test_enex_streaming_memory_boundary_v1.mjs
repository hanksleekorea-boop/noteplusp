import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const require=createRequire(import.meta.url);
const runtime=process.env.NOTEPLUS_PLAYWRIGHT||"C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core";
let chromium;try{({chromium}=require("playwright-core"));}catch{({chromium}=require(runtime));}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const server=http.createServer((request,response)=>{const pathname=decodeURIComponent(new URL(request.url,"http://127.0.0.1").pathname);const target=path.resolve(root,"."+(pathname==="/"?"/노트앱_v16.html":pathname));if(!target.startsWith(root+path.sep)&&target!==root)return response.writeHead(403).end();fs.readFile(target,(error,bytes)=>{if(error)return response.writeHead(404).end();response.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});response.end(bytes);});});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const browser=await chromium.launch({executablePath:process.env.NOTEPLUS_BROWSER||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true});
try{
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/노트앱_v16.html?stream-memory=${Date.now()}`,{waitUntil:"networkidle"});
  await page.evaluate(()=>window.storageReady);
  const result=await page.evaluate(async()=>{
    const noteCount=48,bodySize=256*1024;
    const notes=Array.from({length:noteCount},(_,index)=>`<note><title>대용량 ${index}</title><content><![CDATA[<en-note><div>${String(index).padStart(2,"0")}:${"가".repeat(bodySize)}</div></en-note>]]></content><created>20260719T000000Z</created></note>`).join("");
    const backing=new File([`<?xml version="1.0"?><en-export>${notes}</en-export>`],"large-stream.enex",{type:"application/xml"});
    const slices=[];const wrapped={size:backing.size,slice(start,end){slices.push({start,end,size:end-start});return backing.slice(start,end);}};
    const progress=[];const job={cancelled:false,readers:[]};
    const parsed=await parseEnexFileStreaming(wrapped,"대용량",backing.name,(loaded,total)=>progress.push({loaded,total}),job);
    return {fileBytes:backing.size,chunkBytes:ENEX_STREAM_CHUNK_BYTES,noteCount:parsed.notes.length,sliceCount:slices.length,maxSliceBytes:Math.max(...slices.map(item=>item.size)),progressFinal:progress.at(-1),readersRemaining:job.readers.length,firstBody:parsed.notes[0].body.slice(0,6),lastTitle:parsed.notes.at(-1).title};
  });
  assert.equal(result.noteCount,48);
  assert.ok(result.fileBytes>12*1024*1024);
  assert.ok(result.sliceCount>=6,"large ENEX must be read in multiple bounded chunks");
  assert.ok(result.maxSliceBytes<=result.chunkBytes,"no individual read may exceed the streaming chunk bound");
  assert.equal(result.progressFinal.loaded,result.fileBytes);
  assert.equal(result.progressFinal.total,result.fileBytes);
  assert.equal(result.readersRemaining,0);
  assert.equal(result.lastTitle,"대용량 47");
  console.log(JSON.stringify({ok:true,contract:"enex-streaming-memory-boundary-v1",...result},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
