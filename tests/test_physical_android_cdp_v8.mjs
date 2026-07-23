import assert from "node:assert/strict";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const artifacts = path.join(root, "artifacts");
const cdpHttp = process.env.NOTEPLUS_ANDROID_CDP || "http://127.0.0.1:9222";
const publicUrl = process.env.NOTEPLUS_PUBLIC_URL || "https://hanksleekorea-boop.github.io/noteplusp/";
const version = process.env.NOTEPLUS_VERSION || "v16";
const appUrl = new URL(`${encodeURIComponent(`노트앱_${version}.html`)}?physical=${Date.now()}`, publicUrl).href;
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "64832DEDEB76D7A469B6238F274042A27C894BCBAFD56E4B36B526FDBAE2E520";
const adbPath = process.env.NOTEPLUS_ADB_PATH || "";
const adbSerial = process.env.NOTEPLUS_ANDROID_SERIAL || "";
const marker = `physical-cdp-${Date.now()}`;
const qaTitle = `실기기 저장 확인 ${marker}`;
const enexTitle = `실기기 ENEX 확인 ${marker}`;
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function poll(check, timeout = 30000, interval = 250) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { last = await check(); if (last) return last; } catch (error) { last = error; }
    await delay(interval);
  }
  throw last instanceof Error ? last : new Error("poll timeout");
}

class CdpTarget {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
    };
    await new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
  }
  send(method, params = {}, timeout = 30000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method}: response timeout`)); }, timeout);
      this.pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); }, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Runtime evaluation failed");
    return response.result?.value;
  }
  close() { try { this.ws?.close(); } catch {} }
}

function buildEnex() {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "utf8");
  const hash = crypto.createHash("md5").update(pdf).digest("hex");
  const body = `실제 Android ENEX 본문 ${marker}`;
  const enml = `<?xml version="1.0"?><en-note><div>${body}</div><en-media type="application/pdf" hash="${hash}"/></en-note>`;
  const xml = `<?xml version="1.0"?><en-export><note><title>${enexTitle}</title><content><![CDATA[${enml}]]></content><created>20260719T000000Z</created><updated>20260719T000100Z</updated><tag>실기기검증</tag><resource><data encoding="base64" hash="${hash}">${pdf.toString("base64")}</data><mime>application/pdf</mime><resource-attributes><file-name>physical-alpha-proof.pdf</file-name></resource-attributes></resource></note></en-export>`;
  return { xml, pdfBytes: pdf.length };
}

const releaseResponse = await fetch(appUrl, { cache: "no-store" });
assert.equal(releaseResponse.status, 200);
const releaseBytes = Buffer.from(await releaseResponse.arrayBuffer());
assert.equal(sha256(releaseBytes), expectedSha);
for (const match of releaseBytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);

const targetListResponse = await fetch(cdpHttp + "/json/list");
assert.equal(targetListResponse.ok, true, "Android Chrome target list must be readable");
const targetList = await targetListResponse.json();
const candidates = targetList.filter(target => target.type === "page" && /^https?:/i.test(target.url) && target.webSocketDebuggerUrl).sort((a,b) => Number(/noteplusp/i.test(b.url)) - Number(/noteplusp/i.test(a.url))).slice(0,8);
let targetInfo = null;
let cdp = null;
for (const candidate of candidates) {
  const probe = new CdpTarget(candidate.webSocketDebuggerUrl);
  try {
    await probe.connect();
    await probe.send("Page.enable", {}, 3000);
    await probe.send("Runtime.enable", {}, 3000);
    await probe.send("Network.enable", {}, 3000);
    targetInfo = candidate;
    cdp = probe;
    break;
  } catch { probe.close(); }
}
assert.ok(targetInfo && cdp, "Android Chrome responsive HTTP page must exist");
const originalTargetUrl = targetInfo.url;
console.log("STEP target-connected", targetInfo.id);

let originalStateJson = "";
let originalSignature = "";
let createdAttachmentIds = [];
let cleaned = false;
try {
  await cdp.send("Page.navigate", { url: appUrl });
  await poll(() => cdp.evaluate("document.readyState === 'interactive' || document.readyState === 'complete'"), 90000);
  await poll(() => cdp.evaluate("Boolean(window.storageReady && typeof window.storageReady.then === 'function')"));
  await cdp.evaluate("window.storageReady");
  const staleCleanup = await cdp.evaluate(`(async()=>{const stale=window.state.notes.filter(note=>/실기기 (저장|ENEX) 확인 physical-cdp-/.test(note.title||''));const ids=stale.flatMap(note=>note.attachmentIds||[]);if(stale.length){const drop=new Set(stale.map(note=>note.id));window.state.notes=window.state.notes.filter(note=>!drop.has(note.id));if(window.noteDb)await window.writeStateAndAttachments([],ids,null);else await window.persist();window.render();}return {notes:stale.length,attachments:ids.length};})()`);
  console.log("STEP app-ready", JSON.stringify(staleCleanup));
  const initial = await cdp.evaluate(`(() => ({stateJson:JSON.stringify(window.state),signature:window.stateSignature(window.state),notes:window.state.notes.length,trash:window.state.trash.length,persistenceMode:window.persistenceMode,viewport:{innerWidth:innerWidth,innerHeight:innerHeight,screenWidth:screen.width,screenHeight:screen.height,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth},userAgent:navigator.userAgent,mobileNavVisible:getComputedStyle(document.querySelector('#mobileNav')).display!=='none',installButtonExists:Boolean(document.querySelector('#installAppBtn')),manifest:document.querySelector('link[rel="manifest"]')?.href||''}))()`);
  originalStateJson = initial.stateJson;
  originalSignature = initial.signature;
  assert.equal(initial.persistenceMode, "idb");
  assert.equal(initial.mobileNavVisible, true);
  assert.equal(initial.installButtonExists, true);
  assert.match(initial.manifest, /noteplus\.webmanifest/);
  assert.ok(initial.viewport.innerWidth < 700);
  assert.ok(initial.viewport.scrollWidth <= initial.viewport.innerWidth + 1);
  console.log("STEP initial-verified", initial.notes, initial.trash);

  const installPath = await cdp.evaluate(`(() => {document.querySelector('#mobileNav [data-mobile-view="side"]').click();const b=document.querySelector('#installAppBtn');const out={text:b.textContent,visible:getComputedStyle(b).display!=='none'&&getComputedStyle(b).visibility!=='hidden'};window.setMobileView('list');return out;})()`);
  assert.equal(installPath.visible, true);
  assert.match(installPath.text, /홈 화면에 추가/);
  console.log("STEP install-path");

  await cdp.evaluate(`(async()=>{document.querySelector('#mobileNewBtn').click();const t=document.querySelector('#edTitle');t.value=${JSON.stringify(qaTitle)};t.dispatchEvent(new Event('input',{bubbles:true}));const e=document.querySelector('#edContent');e.textContent=${JSON.stringify(`실제 Android 저장 본문 ${marker}`)};e.dispatchEvent(new Event('input',{bubbles:true}));await window.persist();return true;})()`);
  assert.equal(await cdp.evaluate(`window.state.notes.some(note=>note.title===${JSON.stringify(qaTitle)})`), true);
  await cdp.send("Page.reload", { ignoreCache: false });
  await poll(() => cdp.evaluate("Boolean(window.storageReady && typeof window.storageReady.then === 'function')"), 60000);
  await cdp.evaluate("window.storageReady");
  assert.equal(await cdp.evaluate(`window.state.notes.filter(note=>note.title===${JSON.stringify(qaTitle)}).length`), 1);
  console.log("STEP note-reloaded");

  const fixture = buildEnex();
  await cdp.evaluate(`(()=>{const file=new File([${JSON.stringify(fixture.xml)}],'PhysicalAlpha.enex',{type:'application/xml',lastModified:Date.now()});document.querySelector('#enexFile').onchange({target:{files:[file],value:''}});return true;})()`);
  await poll(() => cdp.evaluate("document.querySelector('#importPreview')?.classList.contains('show')"), 30000);
  assert.match(await cdp.evaluate("document.querySelector('#importPreviewSummary').textContent"), /1개 파일에서 노트 1개와 첨부 1개/);
  await cdp.evaluate("document.querySelector('#importPreviewConfirm').click();true");
  await poll(() => cdp.evaluate(`window.state.notes.some(note=>note.title===${JSON.stringify(enexTitle)})`), 30000);
  const imported = await cdp.evaluate(`(async()=>{const note=window.state.notes.find(item=>item.title===${JSON.stringify(enexTitle)});const id=note?.attachmentIds?.[0];const meta=id?await window.idbGet('attachment_meta',id):null;const stored=id?await window.idbGet('attachment_blob',id):null;return {attachmentId:id,name:meta?.name,mime:meta?.mime,blobSize:stored?.blob?.size||0};})()`);
  createdAttachmentIds = [imported.attachmentId].filter(Boolean);
  assert.equal(imported.name, "physical-alpha-proof.pdf");
  assert.equal(imported.mime, "application/pdf");
  assert.equal(imported.blobSize, fixture.pdfBytes);
  console.log("STEP enex-imported");

  await cdp.send("Page.reload", { ignoreCache: false });
  await poll(() => cdp.evaluate("Boolean(window.storageReady && typeof window.storageReady.then === 'function')"), 60000);
  await cdp.evaluate("window.storageReady");
  const restored = await cdp.evaluate(`(async()=>{const note=window.state.notes.find(item=>item.title===${JSON.stringify(enexTitle)});const id=note?.attachmentIds?.[0];const stored=id?await window.idbGet('attachment_blob',id):null;const registration=await navigator.serviceWorker.ready.catch(()=>null);return {qaCount:window.state.notes.filter(item=>item.title===${JSON.stringify(qaTitle)}).length,enexCount:window.state.notes.filter(item=>item.title===${JSON.stringify(enexTitle)}).length,blobSize:stored?.blob?.size||0,swActive:Boolean(registration?.active),swControlled:Boolean(navigator.serviceWorker.controller),installPromptReady:Boolean(window.deferredInstallPrompt),overflowFree:document.documentElement.scrollWidth<=innerWidth+1};})()`);
  assert.equal(restored.qaCount, 1);
  assert.equal(restored.enexCount, 1);
  assert.equal(restored.blobSize, fixture.pdfBytes);
  assert.equal(restored.swActive, true);
  assert.equal(restored.swControlled, true);
  assert.equal(restored.overflowFree, true);
  console.log("STEP enex-reloaded");

  await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  let offlineOk = false;
  try {
    await cdp.send("Page.reload", { ignoreCache: false });
    await poll(() => cdp.evaluate("Boolean(window.storageReady && typeof window.storageReady.then === 'function')"), 60000);
    await cdp.evaluate("window.storageReady");
    offlineOk = await cdp.evaluate(`window.state.notes.some(note=>note.title===${JSON.stringify(qaTitle)})&&window.state.notes.some(note=>note.title===${JSON.stringify(enexTitle)})`);
  } finally {
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
  }
  assert.equal(offlineOk, true);
  console.log("STEP offline-reopen");

  await cdp.evaluate(`(async()=>{window.state=window.migrateState(JSON.parse(${JSON.stringify(originalStateJson)}));window.sanitizeAllNoteHtml(window.state);if(window.noteDb)await window.writeStateAndAttachments([],${JSON.stringify(createdAttachmentIds)},null);else await window.persist();window.render();return true;})()`);
  cleaned = true;
  await cdp.send("Page.reload", { ignoreCache: false });
  await poll(() => cdp.evaluate("Boolean(window.storageReady && typeof window.storageReady.then === 'function')"), 60000);
  await cdp.evaluate("window.storageReady");
  const cleanup = await cdp.evaluate(`({qaCount:window.state.notes.filter(note=>note.title===${JSON.stringify(qaTitle)}).length,enexCount:window.state.notes.filter(note=>note.title===${JSON.stringify(enexTitle)}).length,signatureMatch:window.stateSignature(window.state)===${JSON.stringify(originalSignature)}})`);
  assert.deepEqual(cleanup, { qaCount: 0, enexCount: 0, signatureMatch: true });
  console.log("STEP cleanup-verified");

  // Never capture a user's note list. Replace the live DOM only after the persisted
  // state is restored, then capture a proof card. CDP is preferred; ADB is a bounded
  // fallback for Chrome builds whose Page.captureScreenshot command does not respond.
  await cdp.evaluate(`(()=>{document.documentElement.innerHTML='<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f3f7f2;color:#173b23;font:600 18px system-ui;display:grid;place-items:center;min-height:100vh}main{padding:28px;border:2px solid #00a33a;border-radius:18px;background:#fff;text-align:center;max-width:300px}small{display:block;color:#52645a;margin-top:12px;font-weight:400}</style></head><body><main>NotePlusP v16<br>Android device QA passed<small>Privacy-safe proof · no note content captured</small></main></body>';return true;})()`);
  let screenshot = {captured: false, method: "", error: ""};
  try {
    const captured = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, 10000);
    fs.writeFileSync(path.join(artifacts, "physical_android_alpha_v16.png"), Buffer.from(captured.data, "base64"));
    screenshot = {captured: true, method: "cdp", error: ""};
  } catch (cdpError) {
    try {
      if (!adbPath || !adbSerial) throw new Error("ADB screenshot fallback is not configured");
      const png = execFileSync(adbPath, ["-s", adbSerial, "exec-out", "screencap", "-p"], {encoding: "buffer", timeout: 15000, maxBuffer: 16 * 1024 * 1024});
      if (!Buffer.isBuffer(png) || png.length < 100 || png.subarray(0, 8).compare(Buffer.from([137,80,78,71,13,10,26,10])) !== 0) throw new Error("ADB screenshot is not a valid PNG");
      fs.writeFileSync(path.join(artifacts, "physical_android_alpha_v16.png"), png);
      screenshot = {captured: true, method: "adb", error: String(cdpError && cdpError.message || cdpError)};
    } catch (adbError) {
      screenshot = {captured: false, method: "", error: `${String(cdpError && cdpError.message || cdpError)} | ${String(adbError && adbError.message || adbError)}`};
      console.log(`STEP screenshot-unavailable ${screenshot.error}`);
    }
  }
  console.log(`STEP screenshot-${screenshot.captured ? screenshot.method : "unavailable"}`);
  const result={ok:true,publicUrl,version,release:{bytes:releaseBytes.length,sha256:expectedSha},device:{userAgent:initial.userAgent,viewport:initial.viewport},initialCounts:{notes:initial.notes,trash:initial.trash},persistenceMode:initial.persistenceMode,noteReloaded:true,enexPdfReloaded:true,serviceWorker:{active:restored.swActive,controlled:restored.swControlled,offlineReopen:offlineOk},install:{buttonExists:initial.installButtonExists,mobilePathVerified:true,promptReady:restored.installPromptReady},screenshot,cleanup};
  fs.writeFileSync(path.join(artifacts,"physical_android_alpha_v16.json"),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally {
  if (originalStateJson && !cleaned) {
    await cdp.evaluate(`(async()=>{window.state=window.migrateState(JSON.parse(${JSON.stringify(originalStateJson)}));window.sanitizeAllNoteHtml(window.state);if(window.noteDb)await window.writeStateAndAttachments([],${JSON.stringify(createdAttachmentIds)},null);else await window.persist();window.render();return true;})()`).catch(() => {});
  }
  if (originalTargetUrl && originalTargetUrl !== appUrl) {
    await cdp.send("Page.navigate", { url: originalTargetUrl }).catch(() => {});
  }
  console.log("STEP original-tab-restored");
  cdp.close();
}
