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
const appFile = process.env.NOTEPLUS_APP_FILE || "%EB%85%B8%ED%8A%B8%EC%95%B1_v16.html";
const appUrl = new URL(appFile + "?qa=" + Date.now(), publicUrl).href;
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "64832DEDEB76D7A469B6238F274042A27C894BCBAFD56E4B36B526FDBAE2E520";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(); }

// This deliberately does not call the app's import function. It checks the portable
// JSON contract before the app gets a chance to interpret the backup.
function validatePortableBackup(bundle) {
  assert.ok(bundle && typeof bundle === "object" && !Array.isArray(bundle), "backup must be an object");
  assert.equal(Number(bundle.schema), 5, "backup must declare schema 5");
  assert.ok(Array.isArray(bundle.notes) && Array.isArray(bundle.trash) && Array.isArray(bundle.notebooks), "backup state lists are required");
  assert.ok(Array.isArray(bundle.attachments), "attachment export list is required");
  const noteIds = new Set(bundle.notes.concat(bundle.trash).map(note => String(note && note.id || "")));
  assert.equal(noteIds.size, bundle.notes.length + bundle.trash.length, "note IDs must be unique");
  for (const item of bundle.attachments) {
    assert.match(String(item && item.id || ""), /^att_[a-z0-9_-]{6,100}$/i, "attachment ID must be safe");
    assert.ok(noteIds.has(String(item.noteId || "")), "attachment must belong to an exported note");
    assert.match(String(item.mime || ""), /^(image|audio)\/.+|^application\/pdf$|^text\/html$/i, "attachment MIME must be portable");
    assert.equal(Number(item.size), Buffer.from(String(item.dataBase64 || ""), "base64").length, "attachment byte size must match base64");
    assert.equal(Object.hasOwn(item, "blob"), false, "backup must not serialize a runtime Blob");
  }
  return {notes: bundle.notes.length + bundle.trash.length, attachments: bundle.attachments.length};
}
const response = await fetch(appUrl, { cache: "no-store" });
assert.equal(response.status, 200);
const releaseBytes = Buffer.from(await response.arrayBuffer());
assert.equal(sha256(releaseBytes), expectedSha);
for (const match of releaseBytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);

const marker = `json-restore-${Date.now()}`;
const title = `JSON 백업 복원 ${marker}`;
const pdf = Buffer.from("%PDF-1.4\nJSON RESTORE\n%%EOF\n", "utf8");
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
  const pdfBase64 = pdf.toString("base64");

  const created = await page.evaluate(async ({ title, marker, pdfBase64 }) => {
    const noteId = "jsonnote_" + Date.now().toString(36);
    const attachmentId = "att_json_" + Date.now().toString(36);
    const bytes = Uint8Array.from(atob(pdfBase64), value => value.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const note = { id: noteId, title, body: `JSON 복원 본문 ${marker}`, bodyHtml: `<div>JSON 복원 본문 ${marker}</div>`, notebook: "JSON복원", tags: ["백업검증"], attachmentIds: [attachmentId], favorite: true, history: [], created: Date.now(), updated: Date.now() };
    window.state.notes.unshift(note);
    if (!window.state.notebooks.includes("JSON복원")) window.state.notebooks.push("JSON복원");
    const item = { meta: { id: attachmentId, noteId, name: "json-restore.pdf", mime: "application/pdf", size: blob.size, created: Date.now(), sha256: "" }, blob };
    await window.writeStateAndAttachments([item], [], null);
    return { noteId, attachmentId, blobSize: blob.size };
  }, { title, marker, pdfBase64 });

  const backup = await page.evaluate(async () => {
    const attachments = await window.collectExportAttachments();
    const bundle = window.cloneState(window.state);
    bundle.attachments = attachments;
    return bundle;
  });
  assert.equal(backup.notes.filter(note => note.title === title).length, 1);
  assert.equal(backup.attachments.filter(item => item.noteId === created.noteId).length, 1);
  const portable = validatePortableBackup(backup);
  assert.throws(() => validatePortableBackup({...backup, schema: 4}), /schema 5/);
  assert.throws(() => validatePortableBackup({...backup, attachments: [{...backup.attachments[0], dataBase64: "%%%"}]}), /byte size/);

  await page.evaluate(async attachmentId => {
    const cleared = window.cloneState(window.state);
    cleared.notes = [];
    cleared.trash = [];
    cleared.notebooks = [];
    window.state = window.migrateState(cleared);
    window.ui.selectedId = null;
    await window.writeStateAndAttachments([], [attachmentId], null);
    window.render();
  }, created.attachmentId);
  assert.equal(await page.evaluate(expected => window.state.notes.some(note => note.title === expected), title), false, "reset must remove the fixture before restore");

  await page.locator("#importFile").setInputFiles({ name: "notes_backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup), "utf8") });
  await page.waitForFunction(expected => document.querySelector("#backupStatus")?.textContent.includes("가져오기 완료") && window.state.notes.some(note => note.title === expected), title, { timeout: 30000 });
  const restored = await page.evaluate(async expected => {
    const note = window.state.notes.find(item => item.title === expected);
    const id = note?.attachmentIds?.[0];
    const meta = id ? await window.idbGet("attachment_meta", id) : null;
    const stored = id ? await window.idbGet("attachment_blob", id) : null;
    return { title: note?.title, body: note?.body, notebook: note?.notebook, tags: note?.tags, favorite: note?.favorite, attachmentId: id, name: meta?.name, mime: meta?.mime, metaSize: meta?.size, blobSize: stored?.blob?.size };
  }, title);
  assert.equal(restored.title, title);
  assert.match(restored.body, new RegExp(marker));
  assert.equal(restored.notebook, "JSON복원");
  assert.deepEqual(restored.tags, ["백업검증"]);
  assert.equal(restored.favorite, true);
  assert.equal(restored.name, "json-restore.pdf");
  assert.equal(restored.mime, "application/pdf");
  assert.equal(restored.metaSize, pdf.length);
  assert.equal(restored.blobSize, pdf.length);
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  assert.equal(await page.evaluate(expected => window.state.notes.filter(note => note.title === expected).length, title), 1, "restored note must survive reload exactly once");
  await page.screenshot({ path: path.join(artifacts, "public_json_backup_restore_v1.png"), fullPage: true });

  await page.evaluate(async ({ json, attachmentId }) => {
    window.state = window.migrateState(JSON.parse(json));
    window.sanitizeAllNoteHtml(window.state);
    await window.writeStateAndAttachments([], [attachmentId], null);
    window.render();
  }, { json: original.json, attachmentId: created.attachmentId });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  assert.equal(await page.evaluate(({ expected, signature }) => !window.state.notes.some(note => note.title === expected) && window.stateSignature(window.state) === signature, { expected: title, signature: original.signature }), true);
  assert.deepEqual(errors, [], errors.join("\n"));
  console.log(JSON.stringify({ ok: true, publicUrl, release: { bytes: releaseBytes.length, sha256: expectedSha }, backup: portable, independentSchemaValidation: true, reset: { fixtureRemoved: true }, restored, reload: { exactlyOnce: true }, cleanup: { signatureMatch: true } }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
