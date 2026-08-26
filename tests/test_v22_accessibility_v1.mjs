import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {harness,ready,root} from './v22_test_harness.mjs';
const h=await harness();
async function audit(page){return page.evaluate(()=>{
 const ids=[...document.querySelectorAll('[id]')].map(n=>n.id),duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i),visible=n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
 const name=n=>n.getAttribute('aria-label')||(n.getAttribute('aria-labelledby')||'').split(' ').map(id=>document.getElementById(id)?.textContent||'').join('')||n.labels?.[0]?.textContent||n.title||n.textContent;
 const unnamed=[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,[contenteditable=true]')].filter(visible).filter(n=>!(name(n)||'').trim()).map(n=>n.id||n.outerHTML.slice(0,60));
 return {duplicates,unnamed,overflow:document.documentElement.scrollWidth>innerWidth+1};
});}
try{const results=[];for(const width of [360,390,640,1280,1920]){
 const context=await h.browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22SkipWelcome').click();
 await page.waitForFunction(()=>!v22Welcome.open&&!v22WelcomeBusy);
 let result=await audit(page);assert.deepEqual(result.duplicates,[]);assert.deepEqual(result.unnamed,[]);assert.equal(result.overflow,false);
 await page.locator('#v22StatusOpen').focus();await page.keyboard.press('Enter');await page.locator('#v22StatusDialog[open]').waitFor();
 for(let i=0;i<6;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#v22StatusDialog')),true);}
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'v22StatusOpen');
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});assert.equal((await audit(page)).overflow,false);
 await page.evaluate(()=>document.documentElement.style.fontSize='');
 if(width===390&&process.env.NOTEPLUS_WRITE_ARTIFACTS==='1'){await page.locator('#v22StatusOpen').click();fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'artifacts/v22-status-mobile.png')});await page.keyboard.press('Escape');}
 if(width===1280&&process.env.NOTEPLUS_WRITE_ARTIFACTS==='1'){await page.screenshot({path:path.join(root,'artifacts/v22-desktop.png')});}
 results.push({width,...result});await context.close();
 }
 console.log(JSON.stringify({ok:true,results,scope:'semantic names, no duplicate IDs, dialog keyboard, reduced-motion and responsive checks; not a full WCAG audit or TalkBack test'},null,2));
}finally{await h.close();}
