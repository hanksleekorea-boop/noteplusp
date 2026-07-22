import assert from "node:assert/strict";
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
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const server = http.createServer((request, response) => { const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname), target = path.resolve(root, "." + (pathname === "/" ? "/노트앱_v14.html" : pathname)); if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(403).end(); return; } fs.readFile(target, (error, bytes) => { if (error) { response.writeHead(404).end(); return; } response.writeHead(200, {"content-type": path.extname(target) === ".js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", "cache-control": "no-store"}); response.end(bytes); }); });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const appUrl = `http://127.0.0.1:${server.address().port}/노트앱_v14.html?qa=${Date.now()}`;
const browser = await chromium.launch({executablePath: edge, headless: true});
try {
  const page = await browser.newPage(); await page.goto(appUrl, {waitUntil: "networkidle"}); await page.evaluate(() => window.storageReady);
  const result = await page.evaluate(async () => {
    const now = Date.now(), notes = [];
    for (let i = 0; i < 10000; i++) notes.push({id: "bench_" + i, title: "성능 노트 " + i, body: "본문 " + i, bodyHtml: "<div>본문 " + i + "</div>", notebook: "성능", tags: ["대량"], attachmentIds: [], favorite: false, history: [], created: now - i, updated: now - i});
    window.state = window.migrateState({schema: 5, notebooks: ["성능"], notes, trash: [], evernoteBannerDismissed: true, theme: "light", preferences: {savedSearches: [], templates: [], snapshots: [], sync: {version: 1, deviceId: "bench", updatedAt: now, pendingOps: [], conflicts: []}}});
    await window.writeStateAndAttachments([], [], null);
    const before = window.stateSignature(window.state), started = performance.now(), payload = await window.prepareCloudSnapshot(), preparedMs = performance.now() - started;
    const manifest = JSON.parse(payload.manifestText), validateStarted = performance.now(), preview = window.validateCloudRestorePreview({pointer: {snapshotId: manifest.snapshotId}, manifest, accountUid: "bench"}), validateMs = performance.now() - validateStarted;
    return {noteCount: payload.counts.noteCount, attachmentCount: payload.counts.attachmentCount, manifestBytes: new Blob([payload.manifestText]).size, preparedMs: Math.round(preparedMs), validateMs: Math.round(validateMs), signatureUnchanged: window.stateSignature(window.state) === before, previewNotes: preview.noteCount, heap: performance.memory ? {used: performance.memory.usedJSHeapSize, limit: performance.memory.jsHeapSizeLimit} : null};
  });
  assert.equal(result.noteCount, 10000);
  assert.equal(result.previewNotes, 10000);
  assert.equal(result.attachmentCount, 0);
  assert.equal(result.signatureUnchanged, true);
  assert.ok(result.preparedMs < 30000, `manifest preparation too slow: ${result.preparedMs}ms`);
  assert.ok(result.validateMs < 15000, `manifest validation too slow: ${result.validateMs}ms`);
  console.log(JSON.stringify({ok: true, appUrl, benchmark: result, syntheticEvidenceOnly: true}, null, 2));
  await page.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
