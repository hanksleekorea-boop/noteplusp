import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const runtimePlaywright = "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core";
let chromium;
try { ({ chromium } = require("playwright-core")); } catch { ({ chromium } = require(runtimePlaywright)); }

const realEnex = process.env.NOTEPLUS_REAL_ENEX;
const appUrl = process.env.NOTEPLUS_APP_URL || `http://127.0.0.1:4173/${encodeURIComponent(process.env.NOTEPLUS_APP_FILE || "노트앱_v11.html")}?real-enex=${Date.now()}`;
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
assert.ok(realEnex && fs.existsSync(realEnex), "NOTEPLUS_REAL_ENEX must point to a local ENEX file");

const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  const before = await page.evaluate(() => ({ notes: window.state.notes.length, trash: (window.state.trash || []).length }));

  await page.locator("#enexFile").setInputFiles(realEnex);
  await Promise.race([
    page.locator("#importPreview").waitFor({ state: "visible", timeout: 600000 }).then(() => "preview"),
    page.waitForFunction(() => /가져오기 시작 전 중단|가져오기 실패|읽기 실패|분석 실패/.test(document.querySelector("#enexStatus")?.textContent || ""), null, { timeout: 600000 }).then(() => "blocked-or-failed")
  ]).then(async state => {
    const status = await page.locator("#enexStatus").innerText();
    if (state !== "preview") throw new Error(`real ENEX did not reach preview: ${status}`);
  });

  const preview = await page.evaluate(() => window.pendingEnexImport ? ({
    notes: window.pendingEnexImport.notes.length,
    attachments: window.pendingEnexImport.attachments.length,
    attachmentErrors: window.pendingEnexImport.totalAttachmentErrors,
    attachmentIssues: (window.pendingEnexImport.attachmentIssues || []).length
  }) : null);
  const after = await page.evaluate(() => ({ notes: window.state.notes.length, trash: (window.state.trash || []).length }));
  assert.deepEqual(after, before, "previewing a real ENEX must not mutate existing notes");
  assert.ok(preview && preview.notes > 0, "a real ENEX preview must contain notes");
  assert.ok(preview.attachments > 0, "a real ENEX with attachments must not silently drop them");
  assert.equal(preview.attachmentErrors, 0, "valid real ENEX attachments must not be reported as errors");
  await page.locator("#importPreviewCancel").click();
  console.log(JSON.stringify({ ok: true, fileBytes: fs.statSync(realEnex).size, previewReached: true, stateUnchanged: true, preview, pageErrors }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
