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
const browsers=[
  {name:"edge",path:process.env.NOTEPLUS_BROWSER||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"},
  {name:"chrome",path:"C:/Program Files/Google/Chrome/Application/chrome.exe"}
];
for(const item of browsers)assert.equal(fs.existsSync(item.path),true,`${item.name} executable is required for the PC/mobile browser matrix`);
const server=http.createServer((request,response)=>{const pathname=decodeURIComponent(new URL(request.url,"http://127.0.0.1").pathname);const target=path.resolve(root,"."+(pathname==="/"?"/노트앱_v21.html":pathname));if(!target.startsWith(root+path.sep)&&target!==root)return response.writeHead(403).end();fs.readFile(target,(error,bytes)=>{if(error)return response.writeHead(404).end();const ext=path.extname(target).toLowerCase();const contentType=ext===".js"?"text/javascript; charset=utf-8":ext===".json"?"application/json; charset=utf-8":"text/html; charset=utf-8";response.writeHead(200,{"content-type":contentType,"cache-control":"no-store"});response.end(bytes);});});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const appUrl=`http://127.0.0.1:${server.address().port}/노트앱_v21.html?matrix=${Date.now()}`;
async function ready(page){await page.goto(appUrl,{waitUntil:"networkidle"});await page.waitForFunction(()=>window.storageReady&&typeof window.storageReady.then==="function");await page.evaluate(()=>window.storageReady);}
async function desktopJourney(browser,name){
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:"ko-KR"});const page=await context.newPage();
  try{await ready(page);const title=`PC ${name} 보존`;const before=await page.evaluate(()=>window.state.notes.length);await page.locator("#newBtn").click();await page.locator("#edTitle").fill(title);await page.locator("#edContent").fill("PC 웹에서도 저장 후 다시 열립니다.");await page.evaluate(()=>window.persist());await page.reload({waitUntil:"networkidle"});await page.waitForFunction(()=>window.storageReady);await page.evaluate(()=>window.storageReady);const result=await page.evaluate(title=>({saved:window.state.notes.some(note=>note.title===title),overflowFree:document.documentElement.scrollWidth<=innerWidth+1,columns:[".sidebar",".list",".editor"].filter(selector=>{const node=document.querySelector(selector);return node&&getComputedStyle(node).display!=="none"&&node.getBoundingClientRect().width>0;}).length,manifest:document.querySelector('link[rel="manifest"]')?.getAttribute("href")}),title);assert.equal(result.saved,true);assert.equal(result.overflowFree,true);assert.equal(result.columns,3);assert.equal(result.manifest,"noteplus-v21.webmanifest");return {initialNotes:before,...result};}finally{await context.close();}
}
async function mobileJourney(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:"ko-KR"});const page=await context.newPage();
  try{await ready(page);let result=await page.evaluate(()=>{const visible=node=>Boolean(node&&(node.offsetWidth||node.offsetHeight||node.getClientRects().length));const buttons=[...document.querySelectorAll("#mobileNav button")].filter(visible).map(button=>{const rect=button.getBoundingClientRect();return {width:Math.round(rect.width),height:Math.round(rect.height),right:Math.round(rect.right)};});return {overflowFree:document.documentElement.scrollWidth<=innerWidth+1,mobileNavVisible:visible(document.getElementById("mobileNav")),buttons,manifest:document.querySelector('link[rel="manifest"]')?.getAttribute("href"),liveRegions:document.querySelectorAll('[aria-live="polite"]').length};});assert.equal(result.overflowFree,true);assert.equal(result.mobileNavVisible,true);assert.equal(result.buttons.length,4);assert.ok(result.buttons.every(button=>button.width>=40&&button.height>=40&&button.right<=391));assert.equal(result.manifest,"noteplus-v21.webmanifest");assert.ok(result.liveRegions>=3);await page.locator('[data-mobile-view="side"]').click();result.installVisible=await page.locator("#installAppBtn").isVisible();assert.equal(result.installVisible,true);await page.locator('[data-mobile-view="editor"]').click();assert.match(await page.locator("#main").getAttribute("class"),/mobile-editor/);return result;}finally{await context.close();}
}
try{const results=[];for(const item of browsers){const browser=await chromium.launch({executablePath:item.path,headless:true});try{results.push({browser:item.name,desktop:await desktopJourney(browser,item.name),mobile:await mobileJourney(browser)});}finally{await browser.close();}}console.log(JSON.stringify({ok:true,contract:"v21-pc-mobile-browser-matrix-v1",results,syntheticEvidenceOnly:true},null,2));}finally{await new Promise(resolve=>server.close(resolve));}
