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
const fixturePath = fs.readdirSync(path.join(root, "pilot-assets"))
  .map(name => path.join(root, "pilot-assets", name))
  .find(file => file.toLowerCase().endsWith(".enex"));
const publicUrl = process.env.NOTEPLUS_PUBLIC_URL || "https://hanksleekorea-boop.github.io/noteplusp/";
const appFile = process.env.NOTEPLUS_APP_FILE || "%EB%85%B8%ED%8A%B8%EC%95%B1_v16.html";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "64832DEDEB76D7A469B6238F274042A27C894BCBAFD56E4B36B526FDBAE2E520";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const testerCount = Number(process.env.NOTEPLUS_VIRTUAL_TESTERS || 100);
const concurrency = Number(process.env.NOTEPLUS_VIRTUAL_CONCURRENCY || 4);
const appUrl = new URL(appFile, publicUrl).href;

assert.ok(fixturePath, "pilot ENEX fixture must be present");
assert.equal(testerCount, 100, "this alpha evidence run is fixed at 100 virtual testers");
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(); }

async function verifyRelease() {
  const response = await fetch(appUrl, { cache: "no-store" });
  assert.equal(response.status, 200, "public v16 app must return HTTP 200");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha, "public v16 app must match the declared release hash");
  for (const match of bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function profileFor(index) {
  const cohort = index % 4;
  if (cohort === 0) return { name: "mobile-persist", mobile: true, blocked: false, imported: false };
  if (cohort === 1) return { name: "desktop-persist", mobile: false, blocked: false, imported: false };
  if (cohort === 2) return { name: "enex-import", mobile: true, blocked: false, imported: true };
  return { name: "storage-blocked", mobile: true, blocked: true, imported: false };
}

async function createContext(browser, profile) {
  const context = await browser.newContext(profile.mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ko-KR" }
    : { viewport: { width: 1440, height: 900 }, locale: "ko-KR" });
  if (profile.blocked) {
    await context.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      Storage.prototype.setItem = function blockedStorage() { throw new DOMException("virtual tester storage blocked", "SecurityError"); };
    });
  }
  return context;
}

async function openApp(context, testerId) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto(`${appUrl}?virtualTester=${testerId}&run=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function", undefined, { timeout: 60000 });
  await page.evaluate(() => window.storageReady);
  return { context, page, errors };
}

async function runTester(context, testerId) {
  const profile = profileFor(testerId);
  const marker = `virtual-${testerId}-${Date.now()}`;
  let page;
  let errors = [];
  try {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        ({ page, errors } = await openApp(context, `${testerId}-attempt${attempt}`));
        break;
      } catch (error) {
        lastError = error;
        if (page) await page.close().catch(() => {});
        page = undefined;
      }
    }
    if (!page) throw lastError || new Error("virtual tester could not open the app");
    if (profile.imported) {
      const before = await page.evaluate(() => window.state.notes.length);
      await page.locator("#enexFile").setInputFiles(fixturePath);
      await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
      await page.locator("#importPreviewConfirm").click();
      await page.waitForFunction(expected => window.state.notes.length > expected, before);
      const imported = await page.evaluate(async () => {
        const note = window.state.notes.find(item => Array.isArray(item.attachmentIds) && item.attachmentIds.length > 0);
        const attachmentId = note?.attachmentIds?.[0];
        const meta = attachmentId ? await window.idbGet("attachment_meta", attachmentId) : null;
        const blob = attachmentId ? await window.idbGet("attachment_blob", attachmentId) : null;
        return { noteFound: Boolean(note), metaFound: Boolean(meta), blobSize: blob?.blob?.size || 0 };
      });
      assert.deepEqual(imported.noteFound && imported.metaFound && imported.blobSize > 0, true, "ENEX note and attachment must persist");
    } else {
      const newButton = profile.mobile ? page.locator("#mobileNewBtn") : page.locator("#newBtn");
      await newButton.click();
      await page.locator("#edTitle").fill(marker);
      await page.locator("#edContent").fill(`virtual tester body ${marker}`);
      await page.waitForTimeout(350);
      if (profile.blocked) {
        assert.equal(await page.evaluate(() => window.persistenceMode), "memory", "blocked storage must retain a live memory session");
        assert.equal(await page.locator("#edTitle").inputValue(), marker, "blocked storage must retain title on screen");
        assert.match(await page.locator("#persistMessage").innerText(), /저장|세션|영구/, "blocked storage must disclose persistence state");
      } else {
        assert.equal(await page.evaluate(() => window.persistenceMode), "idb", "normal browser must use IndexedDB");
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.evaluate(() => window.storageReady);
        assert.equal(await page.evaluate(expected => window.state.notes.some(note => note.title === expected), marker), true, "note must survive reload");
      }
    }
    assert.deepEqual(errors, [], errors.join("\n"));
    return { testerId, profile: profile.name, ok: true };
  } catch (error) {
    return { testerId, profile: profile.name, ok: false, error: error?.stack || String(error) };
  } finally {
    if (page) await page.close();
  }
}

async function runPool(browser) {
  const cohorts = [0, 1, 2, 3].map(offset => Array.from({ length: testerCount / 4 }, (_, index) => offset + 1 + index * 4));
  const results = await Promise.all(cohorts.map(async ids => {
    const context = await createContext(browser, profileFor(ids[0]));
    const pending = [...ids];
    const cohortResults = [];
    const workers = Math.max(1, Math.floor(concurrency / 4));
    async function worker() {
      while (pending.length) cohortResults.push(await runTester(context, pending.shift()));
    }
    try { await Promise.all(Array.from({ length: workers }, worker)); return cohortResults; }
    finally { await context.close(); }
  }));
  return results.flat().sort((a, b) => a.testerId - b.testerId);
}

const release = await verifyRelease();
const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const results = await runPool(browser);
  const failed = results.filter(result => !result.ok);
  const byProfile = Object.fromEntries([...new Set(results.map(result => result.profile))].map(profile => [profile, results.filter(result => result.profile === profile && result.ok).length]));
  const report = { ok: failed.length === 0, label: "100 virtual automated testers (not human pilot evidence)", publicUrl: appUrl, release, testerCount, concurrency, passed: results.length - failed.length, failed: failed.length, byProfile, failures: failed };
  fs.writeFileSync(path.join(artifacts, "virtual_pilot_100_v1.json"), JSON.stringify(report, null, 2));
  assert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
