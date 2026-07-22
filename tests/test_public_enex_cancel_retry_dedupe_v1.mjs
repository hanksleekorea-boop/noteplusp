import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runtimePlaywright = "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core";
let chromium;
try { ({ chromium } = require("playwright-core")); } catch { ({ chromium } = require(runtimePlaywright)); }

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const artifacts = path.join(root, "artifacts");
const publicUrl = process.env.NOTEPLUS_PUBLIC_URL || "https://hanksleekorea-boop.github.io/noteplusp/";
const appFile = process.env.NOTEPLUS_APP_FILE || "%EB%85%B8%ED%8A%B8%EC%95%B1_v8.html";
const appUrl = new URL(appFile + "?qa=" + Date.now(), publicUrl).href;
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "931DCD4EED4FE128A3A549D018795BEF130442B2FAD00A41E35853D3DE24F460";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(); }
function fixture(title) {
  const pdf = Buffer.from("%PDF-1.4\n%%EOF\n", "utf8");
  const hash = crypto.createHash("md5").update(pdf).digest("hex");
  const enml = `<?xml version="1.0"?><en-note><div>중단 재시도 중복 회귀 본문</div><en-media type="application/pdf" hash="${hash}"/></en-note>`;
  const xml = `<?xml version="1.0"?><en-export><note><title>${title}</title><content><![CDATA[${enml}]]></content><created>20260719T000000Z</created><updated>20260719T000100Z</updated><resource><data encoding="base64" hash="${hash}">${pdf.toString("base64")}</data><mime>application/pdf</mime><resource-attributes><file-name>retry-proof.pdf</file-name></resource-attributes></resource></note></en-export>`;
  return Buffer.from(xml, "utf8");
}
async function release() {
  const response = await fetch(appUrl, { cache: "no-store" });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha);
  for (const match of bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

const verified = await release();
const marker = `retry-${Date.now()}`;
const title = `중단 재시도 중복 확인 ${marker}`;
const enex = fixture(title);
const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(`page: ${error.message}`));
  page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console: ${message.text()}`); });
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  const original = await page.evaluate(() => ({ json: JSON.stringify(window.state), signature: window.stateSignature(window.state), notes: window.state.notes.length, trash: window.state.trash.length }));

  await page.evaluate(() => {
    const originalReadAsText = FileReader.prototype.readAsText;
    window.__qaOriginalReadAsText = originalReadAsText;
    FileReader.prototype.readAsText = function(...args) {
      const reader = this;
      setTimeout(() => originalReadAsText.apply(reader, args), 5000);
    };
  });
  await page.locator("#enexFile").setInputFiles({ name: "RetryNotebook.enex", mimeType: "application/xml", buffer: enex });
  await page.waitForFunction(() => window.activeEnexJob && !document.querySelector("#enexCancel").hidden);
  await page.locator("#enexCancel").click();
  await page.waitForFunction(() => /중단했습니다/.test(document.querySelector("#enexStatus")?.textContent || ""));
  await page.evaluate(() => { FileReader.prototype.readAsText = window.__qaOriginalReadAsText; delete window.__qaOriginalReadAsText; });
  assert.equal(await page.evaluate(() => window.activeEnexJob), null);
  assert.deepEqual(await page.evaluate(() => ({ notes: window.state.notes.length, trash: window.state.trash.length, signature: window.stateSignature(window.state) })), { notes: original.notes, trash: original.trash, signature: original.signature }, "cancel must not mutate state");

  await page.waitForTimeout(5200);
  await page.locator("#enexFile").setInputFiles({ name: "RetryNotebook.enex", mimeType: "application/xml", buffer: enex });
  await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  assert.match(await page.locator("#importPreviewSummary").innerText(), /1개 파일에서 노트 1개와 첨부 1개/);
  await page.locator("#importPreviewConfirm").click();
  await page.waitForFunction(expected => window.state.notes.some(note => note.title === expected), title, { timeout: 30000 });
  await page.waitForFunction(async expected => {
    const note = window.state.notes.find(item => item.title === expected);
    const attachmentId = note?.attachmentIds?.[0];
    const stored = attachmentId ? await window.idbGet("attachment_blob", attachmentId) : null;
    return Boolean(stored?.blob?.size);
  }, title, { timeout: 30000 });
  const imported = await page.evaluate(async expected => {
    const note = window.state.notes.find(item => item.title === expected);
    const attachmentId = note?.attachmentIds?.[0];
    const stored = attachmentId ? await window.idbGet("attachment_blob", attachmentId) : null;
    return { count: window.state.notes.filter(item => item.title === expected).length, attachmentId, blobSize: stored?.blob?.size || 0 };
  }, title);
  assert.equal(imported.count, 1);
  assert.ok(imported.attachmentId && imported.blobSize > 0);

  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  await page.locator("#enexFile").setInputFiles({ name: "RetryNotebook.enex", mimeType: "application/xml", buffer: enex });
  await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  assert.equal(await page.locator(".import-preview-note.has-duplicate").count(), 1);
  assert.equal(await page.locator(".import-duplicate-mode").inputValue(), "add");
  assert.match(await page.locator(".import-preview-note.has-duplicate").innerText(), /첨부가 있어 자동 제외하지 않습니다/);
  assert.equal(await page.locator("#importPreviewConfirm").isDisabled(), false);
  const beforeCancel = await page.evaluate(expected => ({ count: window.state.notes.filter(note => note.title === expected).length, attachmentIds: window.state.notes.find(note => note.title === expected)?.attachmentIds || [] }), title);
  await page.screenshot({ path: path.join(artifacts, "public_enex_cancel_retry_dedupe_v1.png"), fullPage: true });
  await page.locator("#importPreviewCancel").click();
  const afterCancel = await page.evaluate(expected => ({ count: window.state.notes.filter(note => note.title === expected).length, attachmentIds: window.state.notes.find(note => note.title === expected)?.attachmentIds || [] }), title);
  assert.deepEqual(afterCancel, beforeCancel, "duplicate preview cancel must not change note or attachment references");

  await page.evaluate(async ({ json, attachmentId }) => {
    window.state = window.migrateState(JSON.parse(json));
    window.sanitizeAllNoteHtml(window.state);
    if (window.noteDb) await window.writeStateAndAttachments([], [attachmentId], null);
    else await window.persist();
    window.render();
  }, { json: original.json, attachmentId: imported.attachmentId });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  assert.equal(await page.evaluate(({ expected, signature }) => window.state.notes.filter(note => note.title === expected).length === 0 && window.stateSignature(window.state) === signature, { expected: title, signature: original.signature }), true, "cleanup must restore the original state exactly");
  assert.deepEqual(errors, [], errors.join("\n"));
  console.log(JSON.stringify({ ok: true, publicUrl, release: verified, cancellation: { stateUnchanged: true }, retry: { noteCount: 1, blobSize: imported.blobSize, survivedReload: true }, duplicate: { detected: true, attachmentProtectedByDefaultAdd: true, cancelUnchanged: true }, cleanup: { signatureMatch: true } }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
