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
const browser=await chromium.launch({executablePath:process.env.NOTEPLUS_BROWSER||"C:/Program Files (x86)\Microsoft\Edge\Application\msedge.exe".replace("\\Microsoft","/Microsoft").replaceAll("\\","/"),headless:true});
try{
  const page=await browser.newPage();const hostileRequests=[];page.on("request",request=>{if(request.url().includes("evil.invalid"))hostileRequests.push(request.url());});
  await page.addInitScript(()=>{window.__hostileExecuted=0;});
  await page.goto(`http://127.0.0.1:${server.address().port}/노트앱_v16.html?hostile-rotation=${Date.now()}`,{waitUntil:"networkidle"});
  const result=await page.evaluate(()=>{
    const blocked=/<(?:script|img|iframe|object|embed|style|link|meta|svg|math|form|video|audio|source)\b|\son[a-z]+\s*=|(?:javascript|vbscript)\s*:|\bsrc(?:set)?\s*=|url\s*\(/i;
    const failures=[];const host=document.createElement("div");document.body.appendChild(host);
    for(let index=0;index<50;index++){
      const marker=`safe-${index}`;
      const hostile=`<div onclick="__hostileExecuted=1" style="color:red;background:url(https://evil.invalid/${index})"><strong>${marker}</strong></div><img src="https://evil.invalid/i${index}"><svg onload="__hostileExecuted=2"><a href="javascript:__hostileExecuted=3">x</a></svg><math><mtext href="vbscript:bad">x</mtext></math><iframe srcdoc="<script>__hostileExecuted=4<\/script>"></iframe><form action="https://evil.invalid/f"><input formaction="javascript:bad"></form><video poster="https://evil.invalid/p"><source src="https://evil.invalid/v"></video>`;
      const direct=sanitizeExternalHtml(hostile);const enml=enmlToRich(`<en-note>${hostile}</en-note>`,index%2?"javascript:bad":"https://safe.example/note",{}).html;
      host.innerHTML=direct+enml;
      if(blocked.test(direct)||blocked.test(enml)||!direct.includes(marker)||!enml.includes(marker))failures.push(index);
    }
    return {personas:50,failures,executed:window.__hostileExecuted,stored:host.innerHTML.slice(0,300)};
  });
  await page.waitForTimeout(200);
  assert.deepEqual(result.failures,[]);
  assert.equal(result.executed,0);
  assert.deepEqual(hostileRequests,[]);
  console.log(JSON.stringify({ok:true,contract:"enex-hostile-html-rotation-v1",personas:result.personas,blockedPayloads:50,executed:result.executed,externalRequests:hostileRequests.length},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
