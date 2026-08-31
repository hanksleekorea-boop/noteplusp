import assert from 'node:assert/strict';
import {harness,ready} from './v22_test_harness.mjs';

const h=await harness();
try{
  const context=await h.browser.newContext(),page=await context.newPage();
  await ready(page,h.origin+'/노트앱_v22.html');
  if(await page.locator('#v22Welcome').evaluate(dialog=>dialog.open)){await page.locator('#v22SkipWelcome').click();await page.locator('#v22Welcome').waitFor({state:'hidden'});}
  const baseline=await page.evaluate(()=>({signature:stateSignature(state),settings:v22ReadWorkspace(),homeOpen:document.getElementById('v22WorkspaceHomeDialog').open}));
  assert.deepEqual(baseline.settings,{schema:1,mode:'classic',showOnOpen:false,explicit:false});assert.equal(baseline.homeOpen,false);
  await page.locator('#v22WorkspaceSettingsOpen').click();
  await page.locator('input[name="v22WorkspaceMode"][value="capture"]').check();
  await page.locator('#v22WorkspaceShowOnOpen').check();
  await page.locator('#v22WorkspaceSave').click();
  assert.match(await page.locator('#v22WorkspaceSettingsResult').innerText(),/저장/);
  assert.equal(await page.evaluate(()=>stateSignature(state)),baseline.signature);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.storageReady&&window.noteplusCloud);await page.evaluate(()=>window.storageReady);await page.locator('#v22WorkspaceHomeDialog').waitFor({state:'visible'});
  const restored=await page.evaluate(()=>({settings:v22ReadWorkspace(),summary:document.getElementById('v22WorkspaceModeSummary').textContent,recent:document.querySelectorAll('#v22WorkspaceRecent button').length,signature:stateSignature(state)}));
  assert.deepEqual(restored.settings,{schema:1,mode:'capture',showOnOpen:true,explicit:true});assert.match(restored.summary,/빠른 기록/);assert.ok(restored.recent>=1);assert.equal(restored.signature,baseline.signature);
  await page.locator('#v22WorkspaceOpenSettings').click();await page.locator('#v22WorkspaceReset').click();
  assert.deepEqual(await page.evaluate(()=>v22ReadWorkspace()),{schema:1,mode:'classic',showOnOpen:false,explicit:false});assert.equal(await page.evaluate(()=>localStorage.getItem(V22_WORKSPACE_KEY)),null);
  await context.close();

  const corrupt=await h.browser.newContext();await corrupt.addInitScript(()=>localStorage.setItem('noteplusp-v22-personal-workspace-v1','{"mode":'));const damaged=await corrupt.newPage();await ready(damaged,h.origin+'/노트앱_v22.html');const damagedResult=await damaged.evaluate(()=>({settings:v22ReadWorkspace(),homeOpen:document.getElementById('v22WorkspaceHomeDialog').open}));assert.deepEqual(damagedResult,{settings:{schema:1,mode:'classic',showOnOpen:false,explicit:false},homeOpen:false});await corrupt.close();
  console.log(JSON.stringify({ok:true,card:'S2-002',explicitChoice:true,reload:true,reset:true,corruptPrefsSafe:true,existingDefaultUnchanged:true,localOnly:true},null,2));
} finally {await h.close();}
