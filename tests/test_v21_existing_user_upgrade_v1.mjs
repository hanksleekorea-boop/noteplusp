import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const runtimePlaywright = process.env.NOTEPLUS_PLAYWRIGHT || "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core";
let chromium;
try { ({chromium} = require("playwright-core")); } catch { ({chromium} = require(runtimePlaywright)); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browserPath = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const mime = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".webmanifest", "application/manifest+json"]]);
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const target = path.resolve(root, "." + (pathname === "/" ? "/노트앱_v21.html" : pathname));
  if (!target.startsWith(root + path.sep) && target !== root) return response.writeHead(403).end();
  fs.readFile(target, (error, bytes) => {
    if (error) return response.writeHead(404).end();
    response.writeHead(200, {"content-type": mime.get(path.extname(target).toLowerCase()) || "application/octet-stream", "cache-control": "no-store"});
    response.end(bytes);
  });
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({executablePath: browserPath, headless: true});
try {
  const legacyContext = await browser.newContext({locale: "ko-KR"});
  const legacyState = {
    schema: 1,
    notebooks: ["기존 업무", "기존 개인"],
    notes: [{id: "legacy_note_001", title: "기존 사용자의 노트", body: "업데이트 전부터 있던 본문", notebook: "기존 업무", tags: ["보존"], created: 1700000000000, updated: 1700000001000}],
    trash: [{id: "legacy_trash_001", title: "기존 휴지통 노트", body: "휴지통 본문", notebook: "기존 개인", tags: [], created: 1690000000000, updated: 1690000001000, deletedAt: 1690000002000}],
    evernoteBannerDismissed: true,
    theme: "dark"
  };
  await legacyContext.addInitScript(state => localStorage.setItem("notes_app_v1", JSON.stringify(state)), legacyState);
  const legacyPage = await legacyContext.newPage();
  await legacyPage.goto(`${origin}/노트앱_v21.html?upgrade=legacy`, {waitUntil: "networkidle"});
  await legacyPage.waitForFunction(() => window.storageReady && typeof window.state === "object");
  await legacyPage.evaluate(() => window.storageReady);
  const legacyResult = await legacyPage.evaluate(async () => ({
    schema: window.state.schema,
    note: window.state.notes.find(note => note.id === "legacy_note_001"),
    trash: window.state.trash.find(note => note.id === "legacy_trash_001"),
    notebooks: window.state.notebooks,
    theme: window.state.theme,
    bannerDismissed: window.state.evernoteBannerDismissed,
    originalKeyRetained: localStorage.getItem("notes_app_v1") !== null,
    idbStateCreated: Boolean(await window.idbGet("app_state", "root"))
  }));
  assert.equal(legacyResult.schema, 5);
  assert.equal(legacyResult.note?.title, legacyState.notes[0].title);
  assert.equal(legacyResult.note?.body, legacyState.notes[0].body);
  assert.deepEqual(legacyResult.note?.tags, legacyState.notes[0].tags);
  assert.equal(legacyResult.trash?.title, legacyState.trash[0].title);
  assert.deepEqual(legacyResult.notebooks, legacyState.notebooks);
  assert.equal(legacyResult.theme, "dark");
  assert.equal(legacyResult.bannerDismissed, true);
  assert.equal(legacyResult.originalKeyRetained, true);
  assert.equal(legacyResult.idbStateCreated, true);
  await legacyContext.close();

  const currentContext = await browser.newContext({locale: "ko-KR"});
  const oldPage = await currentContext.newPage();
  await oldPage.goto(`${origin}/노트앱_v16.html?upgrade=current`, {waitUntil: "networkidle"});
  await oldPage.evaluate(() => window.storageReady);
  const before = await oldPage.evaluate(async () => {
    const noteId = "existing_v16_note_001", attachmentId = "att_existing_v16_001";
    const note = {id: noteId, title: "기존 v16 사용자 노트", body: "새 버전에서도 보존할 내용", bodyHtml: "<div>새 버전에서도 보존할 내용</div>", notebook: "업무", tags: ["업데이트", "보존"], attachmentIds: [attachmentId], favorite: true, history: [{at: 1700000000000, title: "이전 제목", body: "이전 본문", bodyHtml: "<div>이전 본문</div>", tags: ["이력"], notebook: "업무", favorite: false}], created: 1700000000000, updated: 1700000001000};
    window.state = window.migrateState({schema: 5, notebooks: ["업무", "개인"], notes: [note], trash: [], evernoteBannerDismissed: true, theme: "dark", preferences: {savedSearches: [{name: "보존 검색", query: "업데이트"}], templates: [{name: "보존 양식", title: "양식", bodyHtml: "<div>양식 본문</div>"}], snapshots: [], sync: {version: 1, deviceId: "existing-user", updatedAt: 1700000002000, pendingOps: [], conflicts: []}}});
    const blob = new Blob(["existing attachment body"], {type: "text/plain"});
    await window.writeStateAndAttachments([{meta: {id: attachmentId, noteId, name: "기존첨부.txt", mime: "text/plain", size: blob.size, created: 1700000000000, sha256: ""}, blob}], [], null);
    return {signature: window.stateSignature(window.state), noteId, attachmentId, blobText: await blob.text()};
  });
  await oldPage.close();

  const newPage = await currentContext.newPage();
  await newPage.goto(`${origin}/노트앱_v21.html?upgrade=v16`, {waitUntil: "networkidle"});
  await newPage.evaluate(() => window.storageReady);
  const currentResult = await newPage.evaluate(async ({noteId, attachmentId}) => {
    const note = window.state.notes.find(item => item.id === noteId);
    const meta = await window.idbGet("attachment_meta", attachmentId);
    const stored = await window.idbGet("attachment_blob", attachmentId);
    return {signature: window.stateSignature(window.state), note, meta, blobText: stored?.blob ? await stored.blob.text() : "", theme: window.state.theme, savedSearch: window.state.preferences.savedSearches[0]?.name, template: window.state.preferences.templates[0]?.name};
  }, before);
  assert.equal(currentResult.signature, before.signature);
  assert.equal(currentResult.note?.title, "기존 v16 사용자 노트");
  assert.deepEqual(currentResult.note?.attachmentIds, [before.attachmentId]);
  assert.equal(currentResult.meta?.name, "기존첨부.txt");
  assert.equal(currentResult.blobText, before.blobText);
  assert.equal(currentResult.theme, "dark");
  assert.equal(currentResult.savedSearch, "보존 검색");
  assert.equal(currentResult.template, "보존 양식");
  await currentContext.close();

  console.log(JSON.stringify({ok: true, contract: "v21-existing-user-upgrade-v1", legacy: {schemaUpgraded: true, notePreserved: true, trashPreserved: true, settingsPreserved: true, originalKeyRetained: true, durableStateCreated: true}, current: {stateSignaturePreserved: true, notePreserved: true, attachmentPreserved: true, settingsPreserved: true}, syntheticEvidenceOnly: true}, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
