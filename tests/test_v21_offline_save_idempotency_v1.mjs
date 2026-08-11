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
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,"http://127.0.0.1").pathname);
  const target=path.resolve(root,"."+(pathname==="/"?"/노트앱_v16.html":pathname));
  if(!target.startsWith(root+path.sep)&&target!==root)return response.writeHead(403).end();
  fs.readFile(target,(error,bytes)=>{if(error)return response.writeHead(404).end();response.writeHead(200,{"content-type":path.extname(target)===".js"?"text/javascript; charset=utf-8":"text/html; charset=utf-8","cache-control":"no-store"});response.end(bytes);});
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.NOTEPLUS_BROWSER||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true});
try{
  const page=await browser.newPage();
  await page.goto(`${origin}/노트앱_v16.html?offline-idempotency=${Date.now()}`,{waitUntil:"networkidle"});
  await page.evaluate(()=>window.storageReady);
  const result=await page.evaluate(async()=>{
    const before=state.notes.length;
    const marker=`offline_${Date.now()}`;
    const personas=Array.from({length:40},(_,index)=>({id:`${marker}_${index}`,title:`오프라인 회전 사용자 ${index+1}`,body:`중복 없는 본문 ${index+1}`,bodyHtml:`<p>중복 없는 본문 ${index+1}</p>`,notebook:state.notebooks[0],tags:[`group-${index%4}`],attachmentIds:[],favorite:false,history:[],created:Date.now()+index,updated:Date.now()+index}));
    state.notes.unshift(...personas);
    window.dispatchEvent(new Event("offline"));
    const writes=await Promise.all([persist(),persist(),persist(),persist()]);
    window.dispatchEvent(new Event("online"));
    await persist();
    return {before,marker,writes,signature:stateSignature(state),status:document.querySelector("#cloudStatus")?.textContent||""};
  });
  await page.reload({waitUntil:"networkidle"});
  const after=await page.evaluate(marker=>({matching:state.notes.filter(note=>note.id.startsWith(marker)).map(note=>note.id),signature:stateSignature(state),count:state.notes.length}),result.marker);
  assert.equal(result.writes.every(Boolean),true);
  assert.equal(after.matching.length,40);
  assert.equal(new Set(after.matching).size,40,"repeated offline saves must not duplicate note IDs");
  assert.equal(after.count,result.before+40);
  assert.equal(after.signature,result.signature,"reconnect and reload must preserve the exact saved state");
  console.log(JSON.stringify({ok:true,contract:"v21-offline-save-idempotency-v1",rotatingPersonas:40,concurrentWrites:4,uniqueAfterReload:40,stateSignaturePreserved:true},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
