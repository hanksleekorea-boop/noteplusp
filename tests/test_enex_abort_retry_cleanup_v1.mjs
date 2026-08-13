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
  await page.goto(`http://127.0.0.1:${server.address().port}/노트앱_v16.html?abort-retry=${Date.now()}`,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>window.storageReady);
  const result=await page.evaluate(async()=>{
    const before=stateSignature(state),body="가".repeat(256*1024);
    const notes=Array.from({length:48},(_,index)=>`<note><title>중단 ${index}</title><content><![CDATA[<en-note>${body}</en-note>]]></content><created>20260719T000000Z</created></note>`).join("");
    const large=new File([`<?xml version="1.0"?><en-export>${notes}</en-export>`],"cancel-large.enex",{type:"application/xml"});
    const job={cancelled:false,readers:[]},progress=[];
    const pending=parseEnexFileStreaming(large,"중단","cancel-large.enex",loaded=>progress.push(loaded),job).then(()=>"resolved",error=>error.message);
    await new Promise(resolve=>setTimeout(resolve,0));
    job.cancelled=true;releaseEnexJob(job);
    const cancelled=await pending;
    await new Promise(resolve=>setTimeout(resolve,0));
    const retryFile=new File(["<?xml version=\"1.0\"?><en-export><note><title>재시도</title><content><![CDATA[<en-note>안전</en-note>]]></content><created>20260719T000000Z</created></note></en-export>"],"retry.enex",{type:"application/xml"});
    const retryJob={cancelled:false,readers:[]};
    const retry=await parseEnexFileStreaming(retryFile,"재시도",retryFile.name,()=>{},retryJob);
    return {cancelled,progressCount:progress.length,oldReaders:job.readers.length,activeCleared:activeEnexJob===null,stateUnchanged:stateSignature(state)===before,retryNotes:retry.notes.length,retryTitle:retry.notes[0].title,retryReaders:retryJob.readers.length};
  });
  assert.equal(result.cancelled,"read abort");
  assert.equal(result.oldReaders,0);
  assert.equal(result.activeCleared,true);
  assert.equal(result.stateUnchanged,true);
  assert.equal(result.retryNotes,1);
  assert.equal(result.retryTitle,"재시도");
  assert.equal(result.retryReaders,0);
  console.log(JSON.stringify({ok:true,contract:"enex-abort-retry-cleanup-v1",...result},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
