import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const runtimePlaywright = "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core";
let chromium;
try { ({ chromium } = require("playwright-core")); } catch { ({ chromium } = require(runtimePlaywright)); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appFile = process.env.NOTEPLUS_APP_FILE || "노트앱_v16.html";
const externalAppUrl = process.env.NOTEPLUS_APP_URL || "";
let server = null;
let appUrl = externalAppUrl;
if (!appUrl) {
  server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const target = path.resolve(root, "." + (pathname === "/" ? `/${appFile}` : pathname));
    if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const types = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml"};
    fs.readFile(target, (error, bytes) => { if (error) { response.writeHead(404).end(); return; } response.writeHead(200, {"content-type": types[path.extname(target).toLowerCase()] || "application/octet-stream", "cache-control": "no-store"}); response.end(bytes); });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  appUrl = `http://127.0.0.1:${server.address().port}/${encodeURIComponent(appFile)}?hashless=${Date.now()}`;
}
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "utf8");
const htmlAttachment = Buffer.from("<script>window.hashlessAttachmentPwned=1</script><p>download-only</p>", "utf8");
const enmlHash = crypto.createHash("md5").update(pdf).digest("hex");
const marker = `hashless-${Date.now()}`;
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<en-export export-date="20260722T000000Z" application="Evernote" version="11">
  <note>
    <title>Hashless attachment ${marker}</title>
    <created>20260722T000000Z</created>
    <content><![CDATA[<en-note><div>${marker}</div><en-media type="application/pdf" hash="${enmlHash}"/></en-note>]]></content>
    <resource>
      <data encoding="base64">${pdf.toString("base64")}</data>
      <mime>application/pdf</mime>
      <resource-attributes><file-name>hashless-proof.pdf</file-name></resource-attributes>
    </resource>
    <resource>
      <data encoding="base64">${htmlAttachment.toString("base64")}</data>
      <mime>text/html</mime>
      <resource-attributes><file-name>untrusted.html</file-name></resource-attributes>
    </resource>
  </note>
</en-export>`;

const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  const before = await page.evaluate(() => window.state.notes.length);
  await page.locator("#enexFile").setInputFiles({ name: "hashless.enex", mimeType: "application/xml", buffer: Buffer.from(xml, "utf8") });
  await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  const preview = await page.evaluate(() => ({
    notes: window.pendingEnexImport?.notes.length,
    attachments: window.pendingEnexImport?.attachments.length,
    errors: window.pendingEnexImport?.totalAttachmentErrors,
    unchanged: window.state.notes.length
  }));
  assert.deepEqual(preview, { notes: 1, attachments: 2, errors: 0, unchanged: before }, "hashless standard and download-only ENEX resources must be previewed without mutation");
  await page.locator("#importPreviewConfirm").click();
  await page.waitForFunction(expected => window.state.notes.some(note => note.title === expected), `Hashless attachment ${marker}`);
  const stored = await page.evaluate(async expected => {
    const note = window.state.notes.find(item => item.title === expected);
    window.ui.selectedId = note?.id || null; window.render();
    const records = await Promise.all((note?.attachmentIds || []).map(async id => ({ meta: await window.idbGet("attachment_meta", id), body: await window.idbGet("attachment_blob", id) })));
    return { noteFound: !!note, attachmentIds: note?.attachmentIds?.length || 0, mimes: records.map(item => item.meta?.mime).sort(), sizes: records.map(item => item.body?.blob?.size).sort((a,b) => a-b), pwned: window.hashlessAttachmentPwned || 0 };
  }, `Hashless attachment ${marker}`);
  assert.equal(stored.noteFound, true);
  assert.equal(stored.attachmentIds, 2);
  assert.deepEqual(stored.mimes, ["application/pdf", "text/html"]);
  assert.deepEqual(stored.sizes, [htmlAttachment.length, pdf.length].sort((a,b) => a-b));
  await page.locator("#attachmentList .attachment-open").nth(1).waitFor({ state: "visible" });
  const links = await page.locator("#attachmentList .attachment-open").evaluateAll(items => items.map(link => ({ text: link.textContent, target: link.getAttribute("target"), download: link.getAttribute("download") })));
  assert.deepEqual(links.map(item => item.target), ["_blank", null]);
  assert.equal(links[1].text, "파일 저장");
  assert.equal(stored.pwned, 0, "HTML attachments must never execute while rendering the note");
  console.log(JSON.stringify({ ok: true, preview, stored, hashlessResource: true }, null, 2));
  await context.close();
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
