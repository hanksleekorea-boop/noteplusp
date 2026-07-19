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
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "A7173ACA0DD1DC44017D4C4FA289E2E96C7690D5245A38AB3D016C42A8F6E108";

fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

async function verifyRelease() {
  const appUrl = new URL("%EB%85%B8%ED%8A%B8%EC%95%B1_v6.html?qa=" + Date.now(), publicUrl);
  const response = await fetch(appUrl);
  assert.equal(response.status, 200, "public app must return HTTP 200");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha, "public app must match the declared release SHA-256");
  const source = bytes.toString("utf8");
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(Boolean);
  assert.ok(scripts.length > 0, "public app must contain executable application code");
  for (const script of scripts) new Function(script);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function watchPage(page, label) {
  const errors = [];
  page.on("pageerror", error => errors.push(`${label}: ${error.message}`));
  page.on("response", response => {
    if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
      errors.push(`${label} HTTP ${response.status()}: ${response.url()}`);
    }
  });
  page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label} console: ${message.text()}`);
    }
  });
  return errors;
}

async function openMobile(context, suffix) {
  const page = await context.newPage();
  const errors = watchPage(page, suffix);
  await page.goto(publicUrl + "?qa=" + Date.now(), { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  await page.locator("#mobileNav").waitFor({ state: "visible" });
  return { page, errors };
}

async function verifyPersistentMobileJourney(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "ko-KR"
  });
  const { page, errors } = await openMobile(context, "persistent");

  assert.equal(await page.evaluate(() => window.persistenceMode), "idb", "normal public browser must use IndexedDB");
  assert.equal(await page.locator("#banner").evaluate(node => node.classList.contains("show")), false, "normal storage must not show a failure banner");
  assert.ok(await page.locator("#mobileNewBtn").isVisible(), "mobile new-note action must be visible");

  const marker = `alpha-${Date.now()}`;
  const title = `제한 알파 저장 확인 ${marker}`;
  const body = `공개 모바일 핵심 여정 ${marker}`;
  await page.locator("#mobileNewBtn").click();
  await page.locator("#edTitle").fill(title);
  await page.locator("#edContent").fill(body);
  await page.waitForFunction(() => document.querySelector("#edStatus")?.textContent.includes("저장됨"));
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);

  const persisted = await page.evaluate(expected => {
    const note = window.state.notes.find(item => item.title === expected.title);
    return Boolean(note && note.body.includes(expected.marker));
  }, { title, marker });
  assert.ok(persisted, "created note must survive a public-page reload");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "mobile page must not overflow horizontally");
  await page.screenshot({ path: path.join(artifacts, "public_alpha_mobile_persist_v2.png"), fullPage: true });
  assert.deepEqual(errors, [], errors.join("\n"));
  await context.close();
  return { title, persistenceMode: "idb" };
}

async function verifyHonestNoStorageFallback(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "ko-KR"
  });
  await context.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    Storage.prototype.setItem = function setItemBlocked() {
      throw new DOMException("QA storage blocked", "SecurityError");
    };
  });
  const { page, errors } = await openMobile(context, "blocked-storage");

  assert.equal(await page.evaluate(() => window.persistenceMode), "memory", "fully blocked persistence must use memory mode");
  const banner = page.locator("#banner");
  assert.equal(await banner.evaluate(node => node.classList.contains("show")), true, "storage failure must be visibly disclosed");
  assert.match(await page.locator("#persistMessage").innerText(), /영구 저장을 사용할 수 없습니다/);

  const marker = `blocked-${Date.now()}`;
  await page.locator("#mobileNewBtn").click();
  await page.locator("#edTitle").fill(marker);
  await page.locator("#edContent").fill("저장 실패 중에도 현재 화면 입력 유지");
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#edTitle").inputValue(), marker, "title must remain on screen when persistence fails");
  assert.match(await page.locator("#edContent").innerText(), /현재 화면 입력 유지/);
  assert.match(await page.locator("#edStatus").innerText(), /이번 세션/);
  await page.screenshot({ path: path.join(artifacts, "public_alpha_mobile_storage_blocked_v2.png"), fullPage: true });
  assert.deepEqual(errors, [], errors.join("\n"));
  await context.close();
  return { persistenceMode: "memory", honestDisclosure: true, inputRetained: true };
}

const release = await verifyRelease();
const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const persistent = await verifyPersistentMobileJourney(browser);
  const fallback = await verifyHonestNoStorageFallback(browser);
  console.log(JSON.stringify({
    ok: true,
    publicUrl,
    release,
    persistent,
    fallback,
    knownNonBlocking: ["favicon.ico returns HTTP 404 (P2; app journey unaffected)"]
  }, null, 2));
} finally {
  await browser.close();
}
