import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runtimePlaywright = "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core";
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  ({ chromium } = require(runtimePlaywright));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const artifacts = path.join(root, "artifacts");
const publicUrl = process.env.NOTEPLUS_PUBLIC_URL || "https://hanksleekorea-boop.github.io/noteplusp/";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "F9DC9C17B415FB8817FE2439A293E51B93075C75C2BDA4A06435D31FD3202CDA";

fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildEnex(title, marker) {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "utf8");
  const hash = crypto.createHash("md5").update(pdf).digest("hex");
  const body = `공개 ENEX 회귀 본문 ${marker}`;
  const enml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note><div>${escapeXml(body)}</div><en-media type="application/pdf" hash="${hash}"/></en-note>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">
<en-export export-date="20260719T000000Z" application="Evernote" version="10">
  <note>
    <title>${escapeXml(title)}</title>
    <content><![CDATA[${enml}]]></content>
    <created>20260719T000000Z</created>
    <updated>20260719T000100Z</updated>
    <tag>제한알파</tag>
    <resource>
      <data encoding="base64" hash="${hash}">${pdf.toString("base64")}</data>
      <mime>application/pdf</mime>
      <resource-attributes><file-name>alpha-proof.pdf</file-name></resource-attributes>
    </resource>
  </note>
</en-export>`;
  return { xml, body, pdfBytes: pdf.length };
}

async function verifyRelease() {
  const appUrl = new URL("%EB%85%B8%ED%8A%B8%EC%95%B1_v5.html?qa=" + Date.now(), publicUrl);
  const response = await fetch(appUrl, { cache: "no-store" });
  assert.equal(response.status, 200, "public app must return HTTP 200");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha, "public app must match the declared SHA-256");
  for (const match of bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1]) new Function(match[1]);
  }
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function watchPage(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(`page: ${error.message}`));
  page.on("response", response => {
    if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
}

async function attachmentRecord(page, title) {
  return page.evaluate(async expectedTitle => {
    const note = window.state.notes.find(item => item.title === expectedTitle);
    if (!note || note.attachmentIds.length !== 1) return null;
    const id = note.attachmentIds[0];
    const meta = await window.idbGet("attachment_meta", id);
    const stored = await window.idbGet("attachment_blob", id);
    return {
      noteId: note.id,
      body: note.body,
      notebook: note.notebook,
      tags: note.tags,
      attachmentId: id,
      attachmentName: meta?.name,
      attachmentMime: meta?.mime,
      attachmentSize: meta?.size,
      blobSize: stored?.blob?.size,
      persistenceMode: window.persistenceMode
    };
  }, title);
}

const release = await verifyRelease();
const marker = `enex-${Date.now()}`;
const title = `제한 알파 ENEX 공개 검증 ${marker}`;
const fixture = buildEnex(title, marker);
const browser = await chromium.launch({ executablePath: edge, headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  const errors = watchPage(page);
  await page.goto(publicUrl + "?qa=" + Date.now(), { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  assert.equal(await page.evaluate(() => window.persistenceMode), "idb");

  const beforeCount = await page.evaluate(() => window.state.notes.length);
  await page.locator("#enexFile").setInputFiles({
    name: "AlphaNotebook.enex",
    mimeType: "application/xml",
    buffer: Buffer.from(fixture.xml, "utf8")
  });

  await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  const previewSummary = await page.locator("#importPreviewSummary").innerText();
  assert.match(previewSummary, /1개 파일에서 노트 1개와 첨부 1개/);
  assert.match(previewSummary, /확인 전에는 기존 데이터가 바뀌지 않습니다/);
  assert.equal(await page.locator(".import-preview-note-title").innerText(), title);
  assert.match(await page.locator(".import-preview-attachment").innerText(), /alpha-proof\.pdf/);
  assert.equal(await page.evaluate(() => window.state.notes.length), beforeCount, "preview must not mutate stored notes");
  await page.screenshot({ path: path.join(artifacts, "public_enex_preview_v1.png"), fullPage: true });

  await page.locator("#importPreviewConfirm").click();
  await page.waitForFunction(expected => document.querySelector("#enexStatus")?.textContent.includes(expected), "가져옴", { timeout: 30000 });
  await page.waitForFunction(expectedTitle => window.state.notes.some(item => item.title === expectedTitle), title);
  const imported = await attachmentRecord(page, title);
  assert.ok(imported, "imported note and attachment must exist before reload");
  assert.match(imported.body, new RegExp(marker));
  assert.equal(imported.notebook, "AlphaNotebook");
  assert.deepEqual(imported.tags, ["제한알파"]);
  assert.equal(imported.attachmentName, "alpha-proof.pdf");
  assert.equal(imported.attachmentMime, "application/pdf");
  assert.equal(imported.attachmentSize, fixture.pdfBytes);
  assert.equal(imported.blobSize, fixture.pdfBytes);
  assert.equal(imported.persistenceMode, "idb");

  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  const reloaded = await attachmentRecord(page, title);
  assert.ok(reloaded, "imported note and attachment must survive reload");
  assert.equal(reloaded.attachmentName, "alpha-proof.pdf");
  assert.equal(reloaded.blobSize, fixture.pdfBytes);
  assert.equal(reloaded.persistenceMode, "idb");

  await page.evaluate(expectedTitle => {
    const note = window.state.notes.find(item => item.title === expectedTitle);
    window.ui.selectedId = note.id;
    window.render();
  }, title);
  await page.locator("#edTitle").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(artifacts, "public_enex_reloaded_v1.png"), fullPage: true });
  assert.deepEqual(errors, [], errors.join("\n"));

  console.log(JSON.stringify({
    ok: true,
    publicUrl,
    release,
    preview: { summary: previewSummary, stateUnchanged: true },
    imported,
    reloaded,
    syntheticEvidenceOnly: true,
    knownNonBlocking: ["favicon.ico returns HTTP 404 (P2)"]
  }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
