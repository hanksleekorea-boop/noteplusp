import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';
const h=await harness();
try{for(const width of [390,1280]){
 const context=await h.browser.newContext({viewport:{width,height:850}});const page=await context.newPage();
 await ready(page,h.origin+'/노트앱_v22.html');await page.locator('#v22Welcome[open]').waitFor();
 const before=await page.evaluate(()=>state.notes.length);await page.locator('#v22StartNote').click();
 await page.waitForFunction(()=>!v22Welcome.open&&!v22WelcomeBusy);
 await page.locator('#edTitle').fill('첫 메모');await page.locator('#edContent').fill('안전한 첫 기록');await page.evaluate(()=>persist());
 assert.equal(await page.evaluate(()=>state.notes.length),before+1);
 assert.equal(await page.evaluate(()=>state.preferences.primaryIntent),'capture');
 await ready(page,h.origin+'/노트앱_v22.html');assert.equal(await page.locator('#v22Welcome').evaluate(x=>x.open),false);
 assert.equal(await page.evaluate(()=>state.notes.some(n=>n.title==='첫 메모')),true);
 await page.evaluate(()=>document.getElementById('v22WelcomeAgain').click());await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.getElementById('v22Welcome').open);assert.equal(await page.evaluate(()=>state.preferences.primaryIntent),'skip');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await context.close();
}console.log('PASS v22 first value mobile+PC, persistence, skip/Escape and opt-in replay');}finally{await h.close();}
