import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let chromium;
try { ({chromium}=require('playwright-core')); }
catch { ({chromium}=require(process.env.NOTEPLUS_PLAYWRIGHT||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'))); }
export async function harness({browserPath,route,persistentPath}={}) {
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(route?.(pathname,req,res))return;
    const target=path.resolve(root,'.'+(pathname==='/'?'/노트앱_v22.html':pathname));
    if(!target.startsWith(root+path.sep))return res.writeHead(403).end();
    fs.readFile(target,(err,data)=>{
      if(err)return res.writeHead(404).end();
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
      res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const options={executablePath:browserPath||process.env.NOTEPLUS_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true};
  const persistent=persistentPath?await chromium.launchPersistentContext(persistentPath,options):null;
  const browser=persistent?{newContext:async()=>persistent,newPage:()=>persistent.newPage(),close:()=>persistent.close()}:await chromium.launch(options);
  const origin=`http://127.0.0.1:${server.address().port}`;
  return {browser,origin,async close(){await browser.close();await new Promise(resolve=>server.close(resolve));}};
}
export async function ready(page,url){
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.storageReady&&window.noteplusCloud);
  await page.evaluate(()=>window.storageReady);
}
