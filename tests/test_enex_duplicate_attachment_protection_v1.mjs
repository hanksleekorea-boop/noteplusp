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
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const externalAppUrl = process.env.NOTEPLUS_DUPLICATE_TEST_URL || "";
let server = null;
function createServer() { return http.createServer((request, response) => { const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname), target = path.resolve(root, "." + (pathname === "/" ? "/노트앱_v16.html" : pathname)); if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(403).end(); return; } fs.readFile(target, (error, bytes) => { if (error) { response.writeHead(404).end(); return; } response.writeHead(200, {"content-type": path.extname(target) === ".js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", "cache-control": "no-store"}); response.end(bytes); }); }); }
let appUrl = externalAppUrl;
if (!appUrl) { server = createServer(); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); appUrl = `http://127.0.0.1:${server.address().port}/노트앱_v16.html?qa=${Date.now()}`; }
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "";
if (expectedSha) { const response = await fetch(appUrl, {cache: "no-store"}); assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), expectedSha); }
const browser = await chromium.launch({executablePath: edge, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1365, height: 900}});
  await page.goto(appUrl, {waitUntil: "networkidle"}); await page.evaluate(() => window.storageReady);
  const result = await page.evaluate(() => {
    const existing = window.state.notes[0], before = window.stateSignature(window.state), marker = Date.now().toString(36);
    const withAttachment = {id: "incoming_att_" + marker, title: existing.title, body: existing.body, bodyHtml: existing.bodyHtml, notebook: existing.notebook, tags: (existing.tags || []).slice(), attachmentIds: ["att_duplicate_" + marker], created: existing.created, updated: existing.updated};
    const withoutAttachment = {id: "incoming_plain_" + marker, title: existing.title, body: existing.body, bodyHtml: existing.bodyHtml, notebook: existing.notebook, tags: (existing.tags || []).slice(), attachmentIds: [], created: existing.created, updated: existing.updated};
    const metadataDifferent = {id: "incoming_meta_" + marker, title: existing.title, body: existing.body, bodyHtml: existing.bodyHtml, notebook: "다른 노트북", tags: ["다른 태그"], attachmentIds: [], created: existing.created, updated: existing.updated};
    window.showImportPreview({notes: [withAttachment], attachments: [{meta: {id: withAttachment.attachmentIds[0], noteId: withAttachment.id, name: "protected.pdf", mime: "application/pdf", size: 3, created: Date.now(), sha256: ""}, blob: new Blob(["pdf"], {type: "application/pdf"})}], okFiles: 1, failFiles: 0, failNames: [], fileResults: [], attachmentIssues: [], totalAttachmentErrors: 0});
    const protectedResult = {checked: document.querySelector(".import-preview-note-check").checked, mode: document.querySelector(".import-duplicate-mode").value, text: document.querySelector(".import-preview-duplicate")?.textContent || ""};
    window.cancelPendingEnexImport();
    window.showImportPreview({notes: [withoutAttachment], attachments: [], okFiles: 1, failFiles: 0, failNames: [], fileResults: [], attachmentIssues: [], totalAttachmentErrors: 0});
    const plainResult = {checked: document.querySelector(".import-preview-note-check").checked, mode: document.querySelector(".import-duplicate-mode").value};
    window.cancelPendingEnexImport();
    const metadataDuplicateCount = window.markImportDuplicates([metadataDifferent]);
    return {protectedResult, plainResult, metadataDifferenceNotDuplicate: metadataDuplicateCount === 0 && !metadataDifferent._importDuplicate, stateUnchanged: window.stateSignature(window.state) === before};
  });
  assert.equal(result.protectedResult.checked, true);
  assert.equal(result.protectedResult.mode, "add");
  assert.match(result.protectedResult.text, /첨부가 있어 자동 제외하지 않습니다/);
  assert.equal(result.plainResult.checked, false);
  assert.equal(result.plainResult.mode, "skip");
  assert.equal(result.metadataDifferenceNotDuplicate, true);
  assert.equal(result.stateUnchanged, true);
  console.log(JSON.stringify({ok: true, appUrl, ...result}, null, 2));
  await page.close();
} finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
