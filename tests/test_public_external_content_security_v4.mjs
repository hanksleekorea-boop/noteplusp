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

const publicUrl = process.env.NOTEPLUS_PUBLIC_URL || "https://hanksleekorea-boop.github.io/noteplusp/";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "931DCD4EED4FE128A3A549D018795BEF130442B2FAD00A41E35853D3DE24F460";
const here = path.dirname(fileURLToPath(import.meta.url));
const artifacts = path.resolve(here, "..", "artifacts");
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function assertSafeHtml(html, label) {
  assert.doesNotMatch(html, /<(script|img|iframe|object|embed|style|link|meta)\b/i, `${label}: blocked element stored`);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${label}: event handler stored`);
  assert.doesNotMatch(html, /javascript\s*:/i, `${label}: javascript URL stored`);
  assert.doesNotMatch(html, /\ssrc\s*=/i, `${label}: external source stored`);
  assert.doesNotMatch(html, /url\s*\(/i, `${label}: CSS URL stored`);
  assert.match(html, /안전한 강조/, `${label}: safe content must be preserved`);
}

function maliciousHtml(marker) {
  return `<div onclick="window.__securityPwned=1" style="color:red;background-image:url(https://evil.invalid/css-${marker})"><strong>안전한 강조 ${marker}</strong></div>` +
    `<img src="https://evil.invalid/image-${marker}.png" onerror="window.__securityPwned=2">` +
    `<a href="javascript:window.__securityPwned=3">위험 링크</a>` +
    `<iframe src="https://evil.invalid/frame-${marker}"></iframe>` +
    `<script>window.__securityPwned=4</script>`;
}

function buildEnex(title, html) {
  const enml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>${html}</en-note>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">
<en-export export-date="20260719T000000Z" application="Evernote" version="10">
  <note><title>${title}</title><content><![CDATA[${enml}]]></content><created>20260719T000000Z</created><updated>20260719T000100Z</updated></note>
</en-export>`;
}

async function verifyRelease() {
  const appUrl = new URL("%EB%85%B8%ED%8A%B8%EC%95%B1_v8.html?qa=" + Date.now(), publicUrl);
  const response = await fetch(appUrl, { cache: "no-store" });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha);
  for (const match of bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1]) new Function(match[1]);
  }
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

const release = await verifyRelease();
const marker = `security-${Date.now()}`;
const hostile = maliciousHtml(marker);
const enexTitle = `보안 ENEX ${marker}`;
const jsonTitle = `보안 JSON ${marker}`;
const trashTitle = `보안 휴지통 ${marker}`;
const browser = await chromium.launch({ executablePath: edge, headless: true });

try {
  console.log("STEP browser-launched");
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  const errors = [];
  const hostileRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.url().includes("evil.invalid")) hostileRequests.push(request.url());
  });
  page.on("response", response => {
    if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.addInitScript(() => { window.__securityPwned = 0; });
  await page.goto(publicUrl + "?qa=" + Date.now(), { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  console.log("STEP public-ready");

  await page.locator("#enexFile").setInputFiles({
    name: "SecurityNotebook.enex",
    mimeType: "application/xml",
    buffer: Buffer.from(buildEnex(enexTitle, hostile), "utf8")
  });
  await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  await page.locator("#importPreviewConfirm").click();
  await page.waitForFunction(expected => window.state.notes.some(note => note.title === expected), enexTitle);
  const enexStored = await page.evaluate(expected => window.state.notes.find(note => note.title === expected)?.bodyHtml || "", enexTitle);
  assertSafeHtml(enexStored, "ENEX active note");
  console.log("STEP enex-safe");

  const now = Date.now();
  const jsonBundle = {
    schema: 5,
    notebooks: ["SecurityJson"],
    notes: [{ id: `json_${now}`, title: jsonTitle, body: "안전한 강조", bodyHtml: hostile, notebook: "SecurityJson", tags: [], attachmentIds: [], created: now, updated: now }],
    trash: [{ id: `trash_${now}`, title: trashTitle, body: "안전한 강조", bodyHtml: hostile, notebook: "SecurityJson", tags: [], attachmentIds: [], created: now, updated: now, deletedAt: now }]
  };
  await page.locator("#importFile").setInputFiles({
    name: "security-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(jsonBundle), "utf8")
  });
  await page.waitForFunction(() => document.querySelector("#backupStatus")?.textContent.includes("가져오기 완료"), null, { timeout: 30000 });
  const jsonStored = await page.evaluate(expected => window.state.notes.find(note => note.title === expected)?.bodyHtml || "", jsonTitle);
  const trashStored = await page.evaluate(expected => window.state.trash.find(note => note.title === expected)?.bodyHtml || "", trashTitle);
  assertSafeHtml(jsonStored, "JSON active note");
  assertSafeHtml(trashStored, "JSON trash note");
  console.log("STEP json-safe");

  await page.locator("#newBtn").click();
  await page.locator("#edContent").focus();
  await page.evaluate(html => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: type => type === "text/html" ? html : "안전한 강조" } });
    document.querySelector("#edContent").dispatchEvent(event);
  }, hostile);
  await page.waitForTimeout(700);
  const pastedStored = await page.evaluate(() => window.state.notes.find(note => note.id === window.ui.selectedId)?.bodyHtml || "");
  assertSafeHtml(pastedStored, "pasted HTML");
  console.log("STEP paste-safe");

  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  const reloaded = await page.evaluate(titles => ({
    enex: window.state.notes.find(note => note.title === titles.enex)?.bodyHtml || "",
    json: window.state.notes.find(note => note.title === titles.json)?.bodyHtml || "",
    trash: window.state.trash.find(note => note.title === titles.trash)?.bodyHtml || "",
    pwned: window.__securityPwned
  }), { enex: enexTitle, json: jsonTitle, trash: trashTitle });
  assertSafeHtml(reloaded.enex, "reloaded ENEX note");
  assertSafeHtml(reloaded.json, "reloaded JSON note");
  assertSafeHtml(reloaded.trash, "reloaded JSON trash note");
  assert.equal(reloaded.pwned, 0, "hostile scripts and event handlers must never execute");
  assert.deepEqual(hostileRequests, [], `external resources requested: ${hostileRequests.join(", ")}`);
  assert.deepEqual(errors, [], errors.join("\n"));
  await page.evaluate(expected => {
    const note = window.state.notes.find(item => item.title === expected);
    window.ui.selectedId = note.id;
    window.render();
  }, enexTitle);
  await page.screenshot({ path: path.join(artifacts, "public_external_content_security_v4.png"), fullPage: true });
  console.log("STEP reload-safe");

  console.log(JSON.stringify({ ok: true, publicUrl, release, enexStored, jsonStored, trashStored, pastedStored, hostileRequests, pwned: reloaded.pwned }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
