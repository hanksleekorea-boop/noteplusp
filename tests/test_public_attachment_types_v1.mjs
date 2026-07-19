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
const publicUrl = "https://hanksleekorea-boop.github.io/noteplusp/";
const appUrl = new URL("%EB%85%B8%ED%8A%B8%EC%95%B1_v8.html?qa=" + Date.now(), publicUrl).href;
const expectedSha = "931DCD4EED4FE128A3A549D018795BEF130442B2FAD00A41E35853D3DE24F460";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
fs.mkdirSync(artifacts, { recursive: true });
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(); }

const assets = [
  { name: "pixel.png", mime: "image/png", bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") },
  { name: "document.pdf", mime: "application/pdf", bytes: Buffer.from("%PDF-1.4\n%%EOF\n", "utf8") },
  { name: "recording.mp3", mime: "audio/mpeg", bytes: Buffer.from("ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000", "binary") }
].map(item => ({ ...item, hash: crypto.createHash("md5").update(item.bytes).digest("hex") }));
const marker = `types-${Date.now()}`;
const title = `첨부 3종 확인 ${marker}`;
const media = assets.map(item => `<en-media type="${item.mime}" hash="${item.hash}"/>`).join("");
const resources = assets.map(item => `<resource><data encoding="base64" hash="${item.hash}">${item.bytes.toString("base64")}</data><mime>${item.mime}</mime><resource-attributes><file-name>${item.name}</file-name></resource-attributes></resource>`).join("");
const enex = Buffer.from(`<?xml version="1.0"?><en-export><note><title>${title}</title><content><![CDATA[<?xml version="1.0"?><en-note><div>첨부 3종 회귀 ${marker}</div>${media}</en-note>]]></content><created>20260719T000000Z</created><updated>20260719T000100Z</updated>${resources}</note></en-export>`, "utf8");

const response = await fetch(appUrl, { cache: "no-store" });
assert.equal(response.status, 200);
const releaseBytes = Buffer.from(await response.arrayBuffer());
assert.equal(sha256(releaseBytes), expectedSha);
for (const match of releaseBytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);

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
  const original = await page.evaluate(() => ({ json: JSON.stringify(window.state), signature: window.stateSignature(window.state) }));
  await page.locator("#enexFile").setInputFiles({ name: "AttachmentTypes.enex", mimeType: "application/xml", buffer: enex });
  await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  assert.match(await page.locator("#importPreviewSummary").innerText(), /노트 1개와 첨부 3개/);
  assert.equal(await page.locator(".import-preview-attachment").count(), 3);
  await page.locator("#importPreviewConfirm").click();
  await page.waitForFunction(expected => window.state.notes.some(note => note.title === expected), title, { timeout: 30000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  const restored = await page.evaluate(async expected => {
    const note = window.state.notes.find(item => item.title === expected);
    return Promise.all((note?.attachmentIds || []).map(async id => {
      const meta = await window.idbGet("attachment_meta", id);
      const stored = await window.idbGet("attachment_blob", id);
      return { id, name: meta?.name, mime: meta?.mime, metaSize: meta?.size, blobSize: stored?.blob?.size };
    }));
  }, title);
  restored.sort((a, b) => a.name.localeCompare(b.name));
  const expected = assets.map(item => ({ name: item.name, mime: item.mime, size: item.bytes.length })).sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(restored.map(item => ({ name: item.name, mime: item.mime, size: item.blobSize })), expected);
  assert.ok(restored.every(item => item.metaSize === item.blobSize));
  await page.evaluate(expectedTitle => { const note = window.state.notes.find(item => item.title === expectedTitle); window.ui.selectedId = note.id; window.render(); }, title);
  await page.screenshot({ path: path.join(artifacts, "public_attachment_types_v1.png"), fullPage: true });
  await page.evaluate(async ({ json, ids }) => { window.state = window.migrateState(JSON.parse(json)); window.sanitizeAllNoteHtml(window.state); await window.writeStateAndAttachments([], ids, null); window.render(); }, { json: original.json, ids: restored.map(item => item.id) });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  assert.equal(await page.evaluate(({ expectedTitle, signature }) => !window.state.notes.some(note => note.title === expectedTitle) && window.stateSignature(window.state) === signature, { expectedTitle: title, signature: original.signature }), true);
  assert.deepEqual(errors, [], errors.join("\n"));
  console.log(JSON.stringify({ ok: true, publicUrl, release: { bytes: releaseBytes.length, sha256: expectedSha }, preview: { notes: 1, attachments: 3 }, restored, cleanup: { signatureMatch: true } }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
