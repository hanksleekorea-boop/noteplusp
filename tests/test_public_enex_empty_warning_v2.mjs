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
const appFile = process.env.NOTEPLUS_APP_FILE || "%EB%85%B8%ED%8A%B8%EC%95%B1_v16.html";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "64832DEDEB76D7A469B6238F274042A27C894BCBAFD56E4B36B526FDBAE2E520";

fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

async function verifyRelease() {
  const appUrl = new URL(appFile + "?qa=" + Date.now(), publicUrl);
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

async function selectEnex(page, name, buffer) {
  await page.locator("#enexFile").setInputFiles({
    name,
    mimeType: "application/xml",
    buffer
  });
  await page.waitForFunction(() => {
    const text = document.querySelector("#enexStatus")?.textContent || "";
    return /가져오기 실패|가져올 수 있는 파일|노트가 없습니다/.test(text);
  }, null, { timeout: 30000 });
  return page.locator("#enexStatus").innerText();
}

async function assertFailureBoundary(page, before, fileName) {
  assert.equal(await page.evaluate(() => window.state.notes.length), before.notes, "invalid ENEX must not change notes");
  assert.equal(await page.evaluate(() => window.state.trash.length), before.trash, "invalid ENEX must not change trash");
  assert.equal(await page.locator("#importPreview").isVisible(), false, "invalid ENEX must not open import preview");
  const report = await page.evaluate(() => window.state.lastImportReport);
  assert.equal(report?.outcome, "failed", "zero-result ENEX must be recorded as failed");
  assert.ok(report?.failedFiles?.some(value => value.includes(fileName)), "report must name the failed ENEX file");
}

const release = await verifyRelease();
console.log("STEP release-verified");
const browser = await chromium.launch({ executablePath: edge, headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  const errors = watchPage(page);
  await page.goto(publicUrl + "?qa=" + Date.now(), { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  console.log("STEP app-ready");
  const before = await page.evaluate(() => ({ notes: window.state.notes.length, trash: window.state.trash.length }));
  await page.evaluate(() => {
    window.__enexReadCount = 0;
    const originalReadAsText = FileReader.prototype.readAsText;
    FileReader.prototype.readAsText = function(...args) {
      window.__enexReadCount += 1;
      return originalReadAsText.apply(this, args);
    };
  });

  const emptyStatus = await selectEnex(page, "EmptyNotebook.enex", Buffer.alloc(0));
  console.log("STEP empty-status", emptyStatus);
  assert.match(emptyStatus, /0KB|0바이트/, "0-byte ENEX warning must identify the empty file size");
  assert.match(emptyStatus, /비어|빈 ENEX/, "0-byte ENEX warning must explain that the file is empty");
  assert.match(emptyStatus, /다시 내보내/, "0-byte ENEX warning must give the next action");
  assert.equal(await page.evaluate(() => window.__enexReadCount), 0, "0-byte ENEX must be rejected before FileReader");
  await assertFailureBoundary(page, before, "EmptyNotebook.enex");
  await page.screenshot({ path: path.join(artifacts, "public_enex_empty_warning_v2.png"), fullPage: true });

  const whitespaceStatus = await selectEnex(page, "WhitespaceNotebook.enex", Buffer.from("   \n\t", "utf8"));
  console.log("STEP whitespace-status", whitespaceStatus);
  assert.match(whitespaceStatus, /노트 0개/, "blank non-zero ENEX warning must identify zero parsed notes");
  assert.match(whitespaceStatus, /WhitespaceNotebook\.enex\(노트 0개\)/, "blank ENEX warning must preserve filename and reason");
  assert.match(whitespaceStatus, /다시 내보내/, "blank non-zero ENEX warning must give the next action");
  await assertFailureBoundary(page, before, "WhitespaceNotebook.enex");

  const zeroNoteXml = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><en-export export-date="20260719T000000Z" application="Evernote" version="10"></en-export>', "utf8");
  const zeroNoteStatus = await selectEnex(page, "ZeroNotesNotebook.enex", zeroNoteXml);
  console.log("STEP zero-note-status", zeroNoteStatus);
  assert.match(zeroNoteStatus, /노트 0개/, "valid ENEX container without notes must identify zero parsed notes");
  assert.match(zeroNoteStatus, /ZeroNotesNotebook\.enex\(노트 0개\)/, "zero-note ENEX warning must preserve filename and reason");
  assert.match(zeroNoteStatus, /노트가 들어 있는 노트북|다시 내보내/, "zero-note warning must explain how to recover");
  await assertFailureBoundary(page, before, "ZeroNotesNotebook.enex");
  await page.screenshot({ path: path.join(artifacts, "public_enex_zero_notes_warning_v2.png"), fullPage: true });

  assert.deepEqual(errors, [], errors.join("\n"));
  console.log(JSON.stringify({
    ok: true,
    publicUrl,
    release,
    emptyStatus,
    whitespaceStatus,
    zeroNoteStatus,
    stateUnchanged: true
  }, null, 2));
} finally {
  await browser.close();
}
