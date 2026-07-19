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
const response = await fetch(appUrl, { cache: "no-store" });
const releaseBytes = Buffer.from(await response.arrayBuffer());
assert.equal(response.status, 200);
assert.equal(sha256(releaseBytes), expectedSha);
for (const match of releaseBytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);

const marker = `idb-blocked-${Date.now()}`;
const title = `보조 저장 확인 ${marker}`;
const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
  await context.addInitScript(() => { Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined }); });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(`page: ${error.message}`));
  page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console: ${message.text()}`); });
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  assert.equal(await page.evaluate(() => window.persistenceMode), "local");
  const disclosure = await page.locator("#persistMessage").innerText();
  assert.match(disclosure, /노트 상태만 보조 저장소에 저장/);
  assert.match(disclosure, /첨부는 이번 세션 메모리에만 유지/);
  assert.equal(await page.locator("#banner").isVisible(), true);
  await page.locator("#mobileNewBtn").click();
  await page.locator("#edTitle").fill(title);
  await page.locator("#edContent").fill(`IndexedDB 차단 보조 저장 본문 ${marker}`);
  await page.waitForFunction(expected => window.state.notes.some(note => note.title === expected) && window.persistenceMode === "local", title, { timeout: 30000 });
  await page.waitForFunction(expected => localStorage.getItem("notes_app_v1_schema5_fallback")?.includes(expected), title, { timeout: 30000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  assert.equal(await page.evaluate(expected => window.state.notes.filter(note => note.title === expected).length, title), 1);
  assert.equal(await page.evaluate(() => window.persistenceMode), "local");
  assert.match(await page.locator("#persistMessage").innerText(), /첨부는 이번 세션/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  await page.screenshot({ path: path.join(artifacts, "public_idb_blocked_fallback_v1.png"), fullPage: true });
  await page.evaluate(expected => { window.state.notes = window.state.notes.filter(note => note.title !== expected); localStorage.setItem("notes_app_v1_schema5_fallback", JSON.stringify(window.state)); window.render(); }, title);
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);
  assert.equal(await page.evaluate(expected => window.state.notes.some(note => note.title === expected), title), false);
  assert.deepEqual(errors, [], errors.join("\n"));
  console.log(JSON.stringify({ ok: true, publicUrl, release: { bytes: releaseBytes.length, sha256: expectedSha }, persistenceMode: "local", honestDisclosure: disclosure, noteSurvivedReload: true, attachmentScopeDisclosed: true, cleanup: true }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
