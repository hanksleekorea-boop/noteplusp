import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const runtimePlaywright = "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core";
let chromium;
try { ({chromium} = require("playwright-core")); } catch { ({chromium} = require(runtimePlaywright)); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
fs.mkdirSync(artifacts, {recursive: true});
const types = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"]]);
const externalAppUrl = process.env.NOTEPLUS_RESTORE_TEST_URL || "";
let server = null;
function createServer() { return http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const target = path.resolve(root, "." + (pathname === "/" ? "/노트앱_v16.html" : pathname));
  if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(403).end(); return; }
  fs.readFile(target, (error, bytes) => { if (error) { response.writeHead(404).end(); return; } response.writeHead(200, {"content-type": types.get(path.extname(target).toLowerCase()) || "application/octet-stream", "cache-control": "no-store"}); response.end(bytes); });
}); }
let appUrl = externalAppUrl;
if (!appUrl) { server = createServer(); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); appUrl = `http://127.0.0.1:${server.address().port}/노트앱_v16.html?qa=${Date.now()}`; }
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "";
if (expectedSha) { const response = await fetch(appUrl, {cache: "no-store"}); assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), expectedSha); }

const localBytes = Buffer.from("LOCAL ORIGINAL ATTACHMENT", "utf8");
const cloudBytes = Buffer.from("CLOUD RESTORED ATTACHMENT", "utf8");
const cloudSha = crypto.createHash("sha256").update(cloudBytes).digest("hex").toUpperCase();
const browser = await chromium.launch({executablePath: edge, headless: true});
try {
  const context = await browser.newContext({viewport: {width: 1365, height: 900}, locale: "ko-KR"});
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(`page: ${error.message}`));
  page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console: ${message.text()}`); });
  page.on("dialog", dialog => dialog.accept());
  await page.goto(appUrl, {waitUntil: "networkidle"});
  await page.evaluate(() => window.storageReady);
  await page.waitForFunction(() => window.noteplusCloud?.status().phase === "unconfigured");
  assert.equal(await page.locator("#googleSignInBtn").isDisabled(), true);
  assert.equal(await page.locator("#cloudRestoreBtn").isDisabled(), true);
  const offline = await page.evaluate(() => { const before = window.stateSignature(window.state); window.dispatchEvent(new Event("offline")); const offlineText = document.querySelector("#cloudStatus").textContent; window.dispatchEvent(new Event("online")); return {unchanged: window.stateSignature(window.state) === before, offlineText, recoveredText: document.querySelector("#cloudStatus").textContent}; });
  assert.equal(offline.unchanged, true);
  assert.match(offline.offlineText, /오프라인/);
  assert.match(offline.recoveredText, /설정 전/);

  const fixture = await page.evaluate(async ({localBase64, cloudBase64, cloudSha}) => {
    const marker = Date.now().toString(36), conflictId = "att_restore_" + marker, localNoteId = "local_" + marker, cloudNoteId = "cloud_" + marker;
    const localBlob = new Blob([Uint8Array.from(atob(localBase64), value => value.charCodeAt(0))], {type: "application/pdf"});
    const cloudBlob = new Blob([Uint8Array.from(atob(cloudBase64), value => value.charCodeAt(0))], {type: "application/pdf"});
    const localNote = {id: localNoteId, title: "복원 전 로컬 노트", body: "보존 대상", bodyHtml: "<div>보존 대상</div>", notebook: "개인", tags: ["로컬"], attachmentIds: [conflictId], favorite: false, history: [], created: Date.now(), updated: Date.now()};
    window.state.notes.unshift(localNote);
    await window.writeStateAndAttachments([{meta: {id: conflictId, noteId: localNoteId, name: "local.pdf", mime: "application/pdf", size: localBlob.size, created: Date.now(), sha256: ""}, blob: localBlob}], [], null);
    const cloudState = {schema: 5, notebooks: ["클라우드"], notes: [{id: cloudNoteId, title: "클라우드 복원 노트", body: "검증된 복원", bodyHtml: "<div>검증된 복원</div>", notebook: "클라우드", tags: ["복원"], attachmentIds: [conflictId], favorite: true, history: [], created: Date.now() - 1000, updated: Date.now() - 1000}], trash: [], evernoteBannerDismissed: false, theme: "light", preferences: {savedSearches: [], templates: [], snapshots: [], sync: {version: 1, deviceId: "cloud-device", updatedAt: Date.now(), pendingOps: [], conflicts: []}}};
    const snapshotId = "s5_restore_" + marker;
    const descriptor = {id: conflictId, noteId: cloudNoteId, name: "cloud.pdf", mime: "application/pdf", size: cloudBlob.size, created: Date.now() - 1000, sha256: cloudSha};
    const manifest = {format: "noteplusp-cloud-snapshot-v1", schema: 5, appVersion: "v16", snapshotId, createdAt: new Date().toISOString(), counts: {noteCount: 1, activeNoteCount: 1, trashNoteCount: 0, attachmentCount: 1}, state: cloudState, attachments: [descriptor]};
    window.__restoreCloudBlob = cloudBlob;
    window.__restoreBundle = {pointer: {format: "noteplusp-cloud-current-v1", snapshotId}, manifest, accountUid: "restore-user"};
    window.__restoreShouldFail = true;
    window.__restoreUid = "restore-user";
    window.noteplusCloud = {
      status: () => ({phase: "ready", configured: true, user: {uid: window.__restoreUid, email: "restore@example.invalid"}}),
      signIn: async () => ({}), signOut: async () => {}, uploadSnapshot: async () => ({}),
      downloadCurrentSnapshot: async () => window.__restoreBundle,
      downloadAttachment: async () => { if (window.__restoreShouldFail) throw new Error("모의 다운로드 중단"); return window.__restoreCloudBlob; }
    };
    window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: window.noteplusCloud.status()}));
    window.render();
    return {marker, conflictId, localNoteId, cloudNoteId, before: window.stateSignature(window.state), localSize: localBlob.size, cloudSize: cloudBlob.size};
  }, {localBase64: localBytes.toString("base64"), cloudBase64: cloudBytes.toString("base64"), cloudSha});

  await page.locator("#cloudRestoreBtn").click();
  await page.waitForFunction(() => document.querySelector("#cloudStatus")?.textContent.includes("복원 미리보기"));
  assert.equal(await page.evaluate(expected => window.stateSignature(window.state) === expected, fixture.before), true, "preview must not mutate local state");
  await page.evaluate(() => { window.__restoreUid = "different-user"; });
  await page.locator("#cloudRestoreBtn").click();
  await page.waitForFunction(() => document.querySelector("#cloudStatus")?.textContent.includes("계정이 변경"));
  assert.equal(await page.evaluate(expected => window.stateSignature(window.state) === expected, fixture.before), true, "account switch must not mutate local state");

  await page.evaluate(() => { window.pendingCloudRestore = null; window.__restoreUid = "restore-user"; window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: window.noteplusCloud.status()})); });
  await page.locator("#cloudRestoreBtn").click();
  await page.waitForFunction(() => document.querySelector("#cloudStatus")?.textContent.includes("복원 미리보기"));
  await page.locator("#cloudRestoreBtn").click();
  await page.waitForFunction(() => document.querySelector("#cloudStatus")?.textContent.includes("모의 다운로드 중단"));
  const failed = await page.evaluate(async ({before, conflictId}) => ({signatureSame: window.stateSignature(window.state) === before, blobSize: (await window.getAttachmentRecord(conflictId))?.blob?.size || 0}), fixture);
  assert.equal(failed.signatureSame, true);
  assert.equal(failed.blobSize, fixture.localSize);

  await page.evaluate(() => { window.pendingCloudRestore = null; window.__restoreShouldFail = false; window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: window.noteplusCloud.status()})); });
  await page.locator("#cloudRestoreBtn").click();
  await page.waitForFunction(() => document.querySelector("#cloudStatus")?.textContent.includes("복원 미리보기"));
  await page.locator("#cloudRestoreBtn").click();
  await page.waitForFunction(() => document.querySelector("#cloudStatus")?.textContent.includes("클라우드 복원 완료"));
  const restored = await page.evaluate(async ({localNoteId, cloudNoteId, conflictId}) => {
    const cloudNote = window.state.notes.find(note => note.id === cloudNoteId), restoredId = cloudNote?.attachmentIds?.[0];
    const oldRecord = await window.getAttachmentRecord(conflictId), newRecord = restoredId ? await window.getAttachmentRecord(restoredId) : null;
    const snapshots = window.state.preferences?.snapshots || [];
    return {activeCloud: !!cloudNote, activeLocal: window.state.notes.some(note => note.id === localNoteId), restoredId, remapped: restoredId !== conflictId, oldBlobSize: oldRecord?.blob?.size || 0, newBlobSize: newRecord?.blob?.size || 0, newHash: newRecord ? await window.sha256Blob(newRecord.blob) : "", priorInSnapshot: snapshots.some(item => item.data?.notes?.some(note => note.id === localNoteId))};
  }, fixture);
  assert.equal(restored.activeCloud, true);
  assert.equal(restored.activeLocal, false);
  assert.equal(restored.remapped, true);
  assert.equal(restored.oldBlobSize, fixture.localSize);
  assert.equal(restored.newBlobSize, fixture.cloudSize);
  assert.equal(restored.newHash, cloudSha);
  assert.equal(restored.priorInSnapshot, true);

  const cleanup = await page.evaluate(async conflictId => { const removed = await window.cleanupOrphanAttachments(), oldRecord = await window.getAttachmentRecord(conflictId); return {removed, oldBlobSize: oldRecord?.blob?.size || 0}; }, fixture.conflictId);
  assert.equal(cleanup.oldBlobSize, fixture.localSize, "restore-point attachment must survive orphan cleanup");
  await page.locator(".sidebar").evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.screenshot({path: path.join(artifacts, "google_pc_restore_connected_v1.png"), fullPage: true});

  await page.reload({waitUntil: "networkidle"});
  await page.evaluate(() => window.storageReady);
  const reloaded = await page.evaluate(async cloudNoteId => { const note = window.state.notes.find(item => item.id === cloudNoteId), record = note?.attachmentIds?.[0] ? await window.getAttachmentRecord(note.attachmentIds[0]) : null; return {note: !!note, blobSize: record?.blob?.size || 0}; }, fixture.cloudNoteId);
  assert.equal(reloaded.note, true);
  assert.equal(reloaded.blobSize, fixture.cloudSize);
  assert.deepEqual(errors, [], errors.join("\n"));
  await page.screenshot({path: path.join(artifacts, "google_pc_restore_no_loss_v1.png"), fullPage: true});
  console.log(JSON.stringify({ok: true, appUrl, offlineNoLoss: offline, previewNoMutation: true, accountSwitchBlocked: true, failureNoLoss: failed, collisionPreserved: restored, recoveryAttachmentCleanup: cleanup, reload: reloaded}, null, 2));
  await context.close();
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
