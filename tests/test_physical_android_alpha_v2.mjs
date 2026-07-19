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
const cdpUrl = process.env.NOTEPLUS_ANDROID_CDP || "http://127.0.0.1:9222";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "931DCD4EED4FE128A3A549D018795BEF130442B2FAD00A41E35853D3DE24F460";
const physicalAppUrl = new URL("%EB%85%B8%ED%8A%B8%EC%95%B1_v8.html?physical=" + Date.now(), publicUrl).href;
const marker = `physical-${Date.now()}`;
const qaTitle = `실기기 저장 확인 ${marker}`;
const enexTitle = `실기기 ENEX 확인 ${marker}`;

fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildEnex() {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "utf8");
  const hash = crypto.createHash("md5").update(pdf).digest("hex");
  const body = `실제 Android ENEX 본문 ${marker}`;
  const enml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note><div>${escapeXml(body)}</div><en-media type="application/pdf" hash="${hash}"/></en-note>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">
<en-export export-date="20260719T000000Z" application="Evernote" version="10">
  <note>
    <title>${escapeXml(enexTitle)}</title>
    <content><![CDATA[${enml}]]></content>
    <created>20260719T000000Z</created>
    <updated>20260719T000100Z</updated>
    <tag>실기기검증</tag>
    <resource>
      <data encoding="base64" hash="${hash}">${pdf.toString("base64")}</data>
      <mime>application/pdf</mime>
      <resource-attributes><file-name>physical-alpha-proof.pdf</file-name></resource-attributes>
    </resource>
  </note>
</en-export>`;
  return { xml, body, pdfBytes: pdf.length };
}

async function verifyRelease() {
  const response = await fetch(new URL("%EB%85%B8%ED%8A%B8%EC%95%B1_v8.html?physical=" + Date.now(), publicUrl), { cache: "no-store" });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha);
  for (const match of bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1]) new Function(match[1]);
  }
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

async function waitStorage(page) {
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function", null, { timeout: 30000 });
  await page.evaluate(() => window.storageReady);
}

const release = await verifyRelease();
const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 120000 });
const context = browser.contexts()[0];
assert.ok(context, "Android Chrome default context must be available");

let page;
let originalStateJson = "";
let originalSignature = "";
let createdAttachmentIds = [];
let cleaned = false;

try {
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(`page: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console: ${message.text()}`);
  });
  await page.goto(physicalAppUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitStorage(page);

  const initial = await page.evaluate(() => ({
    stateJson: JSON.stringify(window.state),
    signature: window.stateSignature(window.state),
    notes: window.state.notes.length,
    trash: window.state.trash.length,
    persistenceMode: window.persistenceMode,
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      dpr: window.devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth
    },
    userAgent: navigator.userAgent,
    mobileNavVisible: getComputedStyle(document.querySelector("#mobileNav")).display !== "none",
    installButtonExists: Boolean(document.querySelector("#installAppBtn")),
    manifest: document.querySelector('link[rel="manifest"]')?.href || ""
  }));
  originalStateJson = initial.stateJson;
  originalSignature = initial.signature;
  assert.equal(initial.persistenceMode, "idb", "physical Chrome must use IndexedDB");
  assert.equal(initial.mobileNavVisible, true, "physical phone must use mobile navigation");
  assert.equal(initial.installButtonExists, true, "home-screen install button must exist");
  assert.match(initial.manifest, /noteplus\.webmanifest/);
  assert.ok(initial.viewport.innerWidth < 700, `expected phone viewport, got ${initial.viewport.innerWidth}`);
  assert.ok(initial.viewport.scrollWidth <= initial.viewport.innerWidth + 1, "physical phone page must not overflow horizontally");

  await page.locator('#mobileNav [data-mobile-view="side"]').click();
  assert.equal(await page.locator("#installAppBtn").isVisible(), true, "home-screen button must be reachable through the mobile organize panel");
  await page.locator("#installAppBtn").scrollIntoViewIfNeeded();
  assert.match(await page.locator("#installAppBtn").innerText(), /홈 화면에 추가/);
  await page.evaluate(() => window.setMobileView("list"));

  await page.locator("#mobileNewBtn").click();
  await page.locator("#edTitle").fill(qaTitle);
  await page.locator("#edContent").fill(`실제 Android 저장 본문 ${marker}`);
  await page.waitForFunction(title => document.querySelector("#edStatus")?.textContent.includes("저장됨") && window.state.notes.some(note => note.title === title), qaTitle, { timeout: 30000 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await waitStorage(page);
  assert.equal(await page.evaluate(title => window.state.notes.filter(note => note.title === title).length, qaTitle), 1, "physical note must survive reload exactly once");

  const fixture = buildEnex();
  await page.evaluate(({ xml, name }) => {
    const file = new File([xml], name, { type: "application/xml", lastModified: Date.now() });
    document.querySelector("#enexFile").onchange({ target: { files: [file], value: "" } });
  }, { xml: fixture.xml, name: "PhysicalAlpha.enex" });
  await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  assert.match(await page.locator("#importPreviewSummary").innerText(), /1개 파일에서 노트 1개와 첨부 1개/);
  await page.locator("#importPreviewConfirm").click();
  await page.waitForFunction(title => window.state.notes.some(note => note.title === title), enexTitle, { timeout: 30000 });
  const imported = await page.evaluate(async title => {
    const note = window.state.notes.find(item => item.title === title);
    const id = note?.attachmentIds?.[0];
    const record = id ? await window.getAttachmentRecord(id) : null;
    return {
      id: note?.id,
      body: note?.body,
      notebook: note?.notebook,
      tags: note?.tags,
      attachmentId: id,
      attachmentName: record?.meta?.name,
      attachmentMime: record?.meta?.mime,
      attachmentSize: record?.blob?.size
    };
  }, enexTitle);
  assert.match(imported.body || "", new RegExp(marker));
  assert.equal(imported.notebook, "PhysicalAlpha");
  assert.deepEqual(imported.tags, ["실기기검증"]);
  assert.equal(imported.attachmentName, "physical-alpha-proof.pdf");
  assert.equal(imported.attachmentMime, "application/pdf");
  assert.equal(imported.attachmentSize, fixture.pdfBytes);
  createdAttachmentIds = [imported.attachmentId];

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await waitStorage(page);
  const restored = await page.evaluate(async ({ title, noteTitle }) => {
    const note = window.state.notes.find(item => item.title === title);
    const attachmentId = note?.attachmentIds?.[0];
    const record = attachmentId ? await window.getAttachmentRecord(attachmentId) : null;
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : null;
    return {
      qaCount: window.state.notes.filter(item => item.title === noteTitle).length,
      enexCount: window.state.notes.filter(item => item.title === title).length,
      attachmentId,
      blobSize: record?.blob?.size,
      swActive: Boolean(registration?.active),
      swControlled: Boolean(navigator.serviceWorker?.controller),
      installPromptReady: Boolean(window.deferredInstallPrompt),
      overflowFree: document.documentElement.scrollWidth <= window.innerWidth + 1
    };
  }, { title: enexTitle, noteTitle: qaTitle });
  assert.equal(restored.qaCount, 1);
  assert.equal(restored.enexCount, 1);
  assert.equal(restored.blobSize, fixture.pdfBytes);
  assert.equal(restored.swActive, true);
  assert.equal(restored.swControlled, true);
  assert.equal(restored.overflowFree, true);

  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  let offlineOk = false;
  try {
    await client.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await waitStorage(page);
    offlineOk = await page.evaluate(({ title, noteTitle }) => window.state.notes.some(note => note.title === title) && window.state.notes.some(note => note.title === noteTitle), { title: enexTitle, noteTitle: qaTitle });
  } finally {
    await client.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
    await client.detach().catch(() => {});
  }
  assert.equal(offlineOk, true, "installed service worker must reopen the physical app offline");

  await page.screenshot({ path: path.join(artifacts, "physical_android_alpha_v2.png"), fullPage: true });
  assert.deepEqual(errors, [], errors.join("\n"));

  await page.evaluate(async ({ original, signature, attachmentIds }) => {
    window.state = window.migrateState(JSON.parse(original));
    window.sanitizeAllNoteHtml(window.state);
    if (window.noteDb) await window.writeStateAndAttachments([], attachmentIds.filter(Boolean), null);
    else await window.persist();
    window.ui.notebook = "all";
    window.ui.tag = null;
    window.ui.query = "";
    window.ui.trash = false;
    window.ui.selectedId = window.state.notes[0]?.id || null;
    window.render();
    if (window.stateSignature(window.state) !== signature) throw new Error("original state signature mismatch after cleanup");
  }, { original: originalStateJson, signature: originalSignature, attachmentIds: createdAttachmentIds });
  cleaned = true;
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await waitStorage(page);
  const cleanup = await page.evaluate(({ title, enex, signature }) => ({
    qaCount: window.state.notes.filter(note => note.title === title).length,
    enexCount: window.state.notes.filter(note => note.title === enex).length,
    signatureMatch: window.stateSignature(window.state) === signature
  }), { title: qaTitle, enex: enexTitle, signature: originalSignature });
  assert.deepEqual(cleanup, { qaCount: 0, enexCount: 0, signatureMatch: true });

  console.log(JSON.stringify({
    ok: true,
    publicUrl,
    release,
    device: {
      userAgent: initial.userAgent,
      viewport: initial.viewport
    },
    initialCounts: { notes: initial.notes, trash: initial.trash },
    persistenceMode: initial.persistenceMode,
    noteReloaded: true,
    enexPdfReloaded: true,
    serviceWorker: { active: restored.swActive, controlled: restored.swControlled, offlineReopen: offlineOk },
    install: { buttonExists: initial.installButtonExists, mobilePathVerified: true, promptReady: restored.installPromptReady },
    cleanup
  }, null, 2));
} finally {
  if (page && originalStateJson && !cleaned) {
    await page.evaluate(async ({ original, attachmentIds }) => {
      window.state = window.migrateState(JSON.parse(original));
      window.sanitizeAllNoteHtml(window.state);
      if (window.noteDb) await window.writeStateAndAttachments([], attachmentIds.filter(Boolean), null);
      else await window.persist();
      window.render();
    }, { original: originalStateJson, attachmentIds: createdAttachmentIds }).catch(() => {});
  }
  if (page) await page.close().catch(() => {});
}

process.exit(0);
