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
const version = process.env.NOTEPLUS_VERSION || "v10";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "856D5FFA793210347E4647CCCDB4731810F729D08AF2AB0812666F389435D9E1";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const appUrl = new URL(`${encodeURIComponent(`노트앱_${version}.html`)}?unlimited=${Date.now()}`, publicUrl).href;
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(); }
const response = await fetch(appUrl, { cache: "no-store" });
assert.equal(response.status, 200);
const release = Buffer.from(await response.arrayBuffer());
const releaseSha = sha256(release);
assert.equal(releaseSha, expectedSha);
const source = release.toString("utf8");
assert.doesNotMatch(source, /300MB|350MB|500MB|ENEX_MAX_FILE_BYTES|ENEX_MAX_TOTAL_BYTES/, "current app must not contain fixed ENEX size limits or old guidance");
for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);

const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);

  const boundary = await page.evaluate(() => {
    const MB = 1024 * 1024;
    const files = [
      { name: "exact-300.enex", size: 300 * MB },
      { name: "over-old-limit.enex", size: 351 * MB },
      { name: "very-large.enex", size: 800 * MB }
    ];
    const split = window.splitEnexIntoBatches(files);
    const plan = window.planEnexFiles(files);
    const roomy = window.assessEnexStoragePreflight(files, { usage: 1 * 1024 * MB, quota: 8 * 1024 * MB }, "idb");
    const low = window.assessEnexStoragePreflight(files, { usage: 900 * MB, quota: 1024 * MB }, "idb");
    const report = window.createEnexImportReport(files, split, roomy);
    const empty = window.planEnexFiles([{ name: "empty.enex", size: 0 }]);
    return {
      acceptedNames: plan.accepted.map(file => file.name),
      rejectedNames: plan.rejected.map(file => file.name),
      blockedReason: plan.blockedReason,
      warningReason: plan.warningReason,
      batchSizes: split.batches.map(batch => batch.map(file => file.size)),
      reportStatuses: report.fileResults.map(file => file.status),
      reportRejected: report.rejectedFiles,
      roomy,
      low,
      empty: { accepted: empty.accepted.length, empty: empty.empty.length, rejected: empty.rejected.length }
    };
  });

  assert.deepEqual(boundary.acceptedNames, ["exact-300.enex", "over-old-limit.enex", "very-large.enex"]);
  assert.deepEqual(boundary.rejectedNames, []);
  assert.equal(boundary.blockedReason, "");
  assert.match(boundary.warningReason, /고정 용량 제한 없이 순차 처리/);
  assert.deepEqual(boundary.batchSizes.map(batch => batch.length), [1, 1, 1], "large files must be processed in separate sequential batches");
  assert.deepEqual(boundary.reportStatuses, ["pending", "pending", "pending"]);
  assert.deepEqual(boundary.reportRejected, []);
  assert.notEqual(boundary.roomy.status, "blocked", "large files with enough browser storage must not be blocked by a fixed limit");
  assert.equal(boundary.low.status, "blocked", "actual browser storage shortage must still block before mutation");
  assert.deepEqual(boundary.empty, { accepted: 0, empty: 1, rejected: 0 }, "empty ENEX safety boundary must remain");

  await page.locator("#enexGuideTop").click();
  await page.locator('[data-guide-step="2"]').click();
  const guideText = await page.locator('[data-guide-panel="2"]').innerText();
  assert.match(guideText, /고정 파일 크기 제한이 없습니다/);
  assert.doesNotMatch(guideText, /300MB/);
  await page.screenshot({ path: path.join(artifacts, "public_enex_no_fixed_limit_v1.png"), fullPage: true });
  console.log(JSON.stringify({ ok: true, publicUrl, version, release: { bytes: release.length, sha256: releaseSha }, boundary, guide: { fixedLimitRemoved: true, storagePreflightRetained: true } }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
