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
const version = process.env.NOTEPLUS_VERSION || "v16";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "64832DEDEB76D7A469B6238F274042A27C894BCBAFD56E4B36B526FDBAE2E520";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const appUrl = new URL(`${encodeURIComponent(`노트앱_${version}.html`)}?a11y=${Date.now()}`, publicUrl).href;
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
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

async function verifyRelease() {
  const response = await fetch(appUrl, { cache: "no-store" });
  assert.equal(response.status, 200, "public accessibility target must return HTTP 200");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha, "public accessibility target must match release SHA-256");
  for (const match of bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1]) new Function(match[1]);
  }
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

async function semanticAudit(page) {
  const audit = await page.evaluate(() => {
    const visible = node => Boolean(node && (node.offsetWidth || node.offsetHeight || node.getClientRects().length));
    const ids = [...document.querySelectorAll("[id]")].map(node => node.id);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    const label = node => {
      const labelledBy = node.getAttribute("aria-labelledby");
      const labelled = labelledBy ? labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || "").join(" ").trim() : "";
      const explicit = node.id ? document.querySelector(`label[for="${CSS.escape(node.id)}"]`)?.textContent?.trim() || "" : "";
      const implicit = node.closest("label")?.textContent?.trim() || "";
      return (node.getAttribute("aria-label") || labelled || explicit || implicit || node.textContent || node.title || node.placeholder || "").trim();
    };
    const unnamed = [...document.querySelectorAll("button,input:not([type=hidden]),select,textarea,[contenteditable=true]")]
      .filter(visible)
      .filter(node => !label(node))
      .map(node => node.id || node.outerHTML.slice(0, 120));
    const requiredKeyboardTargets = ["secNb", "secTag", "nbAddBtn"]
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .filter(node => node.tabIndex < 0 || !["button", "link"].includes(node.getAttribute("role") || "") && node.tagName !== "BUTTON")
      .map(node => node.id);
    const missingLiveStatus = ["banner", "enexStatus", "backupStatus", "edStatus"]
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .filter(node => !["status", "alert"].includes(node.getAttribute("role") || "") || !node.getAttribute("aria-live"))
      .map(node => node.id);
    const noteList = document.getElementById("listScroll");
    const noteRows = [...document.querySelectorAll("#listScroll .row")];
    return {
      duplicateIds,
      unnamed,
      requiredKeyboardTargets,
      missingLiveStatus,
      noteListSemantics: Boolean(noteList?.getAttribute("role") === "listbox" && noteList?.getAttribute("aria-label")),
      noteRowsKeyboardReady: noteRows.length > 0 && noteRows.every(row => row.getAttribute("role") === "option" && row.tabIndex >= 0 && row.hasAttribute("aria-selected")),
      editorBodySemantics: Boolean(document.getElementById("edContent")?.getAttribute("role") === "textbox" && document.getElementById("edContent")?.getAttribute("aria-label") && document.getElementById("edContent")?.getAttribute("aria-multiline") === "true"),
      progressSemantics: Boolean(document.getElementById("enexProgress")?.getAttribute("role") === "progressbar")
    };
  });

  const violations = [];
  if (audit.duplicateIds.length) violations.push(`duplicate ids: ${audit.duplicateIds.join(", ")}`);
  if (audit.unnamed.length) violations.push(`unnamed controls: ${audit.unnamed.join(", ")}`);
  if (audit.requiredKeyboardTargets.length) violations.push(`pointer-only controls: ${audit.requiredKeyboardTargets.join(", ")}`);
  if (audit.missingLiveStatus.length) violations.push(`status messages not announced: ${audit.missingLiveStatus.join(", ")}`);
  if (!audit.noteListSemantics) violations.push("note list must expose listbox semantics");
  if (!audit.noteRowsKeyboardReady) violations.push("note rows must be keyboard-selectable options");
  if (!audit.editorBodySemantics) violations.push("content editor must expose a labelled multiline textbox");
  if (!audit.progressSemantics) violations.push("ENEX progress must expose progressbar semantics");
  assert.deepEqual(violations, [], `accessibility violations:\n${violations.join("\n")}`);
  return audit;
}

async function verifyKeyboardJourney(page) {
  await page.keyboard.press("Control+k");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "search", "Ctrl+K must focus search");

  await page.keyboard.press("Control+n");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "edTitle", "Ctrl+N must create a note and focus title");
  const marker = `키보드 접근성 ${Date.now()}`;
  await page.locator("#edTitle").fill(marker);
  await page.locator("#edContent").fill("키보드로 만든 노트 본문");
  await page.waitForFunction(() => document.querySelector("#edStatus")?.textContent.includes("저장됨"));

  const row = page.locator("#listScroll .row").filter({ hasText: marker });
  await row.focus();
  await page.keyboard.press("Enter");
  assert.equal(await row.getAttribute("aria-selected"), "true", "Enter must select the focused note row");

  await page.locator("#secNb").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#secNb").getAttribute("aria-expanded"), "false", "Enter must collapse notebooks");
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#secNb").getAttribute("aria-expanded"), "true", "Space must expand notebooks");

  await page.locator("#nbAddBtn").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "nbAddInput", "keyboard activation must open notebook input");
  await page.keyboard.press("Escape");

  await page.locator("#enexGuideTop").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#enexGuide").getAttribute("aria-hidden"), "false", "Enter must open the guide dialog");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "enexGuideClose", "dialog must move focus to its close control");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "guideNext", "Shift+Tab from first dialog control must wrap to last");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "enexGuideClose", "Tab from last dialog control must wrap to first");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#enexGuide").getAttribute("aria-hidden"), "true", "Escape must close the guide dialog");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "enexGuideTop", "closing dialog must restore trigger focus");

  return { shortcutSearch: true, shortcutNewNote: true, noteRowKeyboard: true, disclosureKeyboard: true, dialogFocusTrap: true, dialogFocusRestore: true };
}

const release = await verifyRelease();
const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  const errors = watchPage(page);
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  const audit = await semanticAudit(page);
  const keyboard = await verifyKeyboardJourney(page);
  await page.screenshot({ path: path.join(artifacts, "public_accessibility_v1.png"), fullPage: true });
  assert.deepEqual(errors, [], errors.join("\n"));
  await context.close();
  console.log(JSON.stringify({ ok: true, publicUrl, version, release, audit, keyboard }, null, 2));
} finally {
  await browser.close();
}
