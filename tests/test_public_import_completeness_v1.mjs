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
const appFile = process.env.NOTEPLUS_APP_FILE || "%EB%85%B8%ED%8A%B8%EC%95%B1_v16.html";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "64832DEDEB76D7A469B6238F274042A27C894BCBAFD56E4B36B526FDBAE2E520";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(); }
function buildEnex(title) {
  const pdf = Buffer.from("%PDF-1.4\n%%EOF\n", "utf8");
  const hash = crypto.createHash("md5").update(pdf).digest("hex");
  const enml = `<?xml version="1.0"?><en-note><div>완전성 대시보드 회귀</div><en-media type="application/pdf" hash="${hash}"/></en-note>`;
  return Buffer.from(`<?xml version="1.0"?><en-export><note><title>${title}</title><content><![CDATA[${enml}]]></content><created>20260719T000000Z</created><updated>20260719T000100Z</updated><resource><data encoding="base64" hash="${hash}">${pdf.toString("base64")}</data><mime>application/pdf</mime><resource-attributes><file-name>proof.pdf</file-name></resource-attributes></resource></note></en-export>`, "utf8");
}
async function verifyRelease() {
  const appUrl = new URL(appFile + "?qa=" + Date.now(), publicUrl);
  const response = await fetch(appUrl, { cache: "no-store" });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha, "public/local app must match declared SHA-256");
  for (const match of bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);
  return { appUrl: appUrl.href, bytes: bytes.length, sha256: sha256(bytes) };
}
function watchPage(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(`page: ${error.message}`));
  page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console: ${message.text()}`); });
  return errors;
}
async function ready(page, appUrl) {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
}

const release = await verifyRelease();
const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  const errors = watchPage(page);
  await ready(page, release.appUrl);
  const before = await page.evaluate(() => ({ notes: window.state.notes.length, trash: window.state.trash.length }));
  await page.locator("#enexFile").setInputFiles([
    { name: "업무.enex", mimeType: "application/xml", buffer: buildEnex("업무 노트") },
    { name: "빈노트북.enex", mimeType: "application/xml", buffer: Buffer.alloc(0) },
    { name: "노트없음.enex", mimeType: "application/xml", buffer: Buffer.from('<?xml version="1.0"?><en-export></en-export>', "utf8") }
  ]);
  await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  assert.equal(await page.locator("#importPreviewFiles tbody tr").count(), 3, "dashboard must show every selected file");
  const rows = await page.locator("#importPreviewFiles tbody tr").allInnerTexts();
  assert.ok(rows.some(text => /업무\.enex.*1.*1.*분석 통과/s.test(text)));
  assert.ok(rows.some(text => /빈노트북\.enex.*빈 파일/s.test(text)));
  assert.ok(rows.some(text => /노트없음\.enex.*노트 0개/s.test(text)));
  const verdict = await page.locator("#importPreviewVerdict").innerText();
  assert.match(verdict, /확인 필요/);
  assert.match(verdict, /전체 노트 수 미입력/);
  assert.equal(await page.evaluate(() => window.state.notes.length), before.notes, "preview must not mutate notes");
  await page.screenshot({ path: path.join(artifacts, "public_import_completeness_review_v1.png"), fullPage: true });
  await page.locator("#importPreviewConfirm").click();
  await page.waitForFunction(() => window.state.lastImportReport?.completedAt > 0, null, { timeout: 30000 });
  const report = await page.evaluate(() => window.state.lastImportReport);
  assert.equal(report.fileResults.length, 3);
  assert.deepEqual(report.fileResults.map(item => item.status).sort(), ["analyzed", "empty", "zero-notes"].sort());
  assert.equal(report.completenessVerdict.status, "review");
  assert.equal(report.foundNoteCount, 1);
  assert.equal(report.attachmentCount, 1);
  assert.equal(report.outcome, "partial");
  assert.deepEqual(errors, [], errors.join("\n"));
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
  const mobilePage = await mobile.newPage();
  const mobileErrors = watchPage(mobilePage);
  await ready(mobilePage, release.appUrl);
  await mobilePage.evaluate(() => { window.enexExpectedNotes = 1; window.enexExpectedNotebooks = 1; });
  await mobilePage.locator("#enexFile").setInputFiles({ name: "전체1.enex", mimeType: "application/xml", buffer: buildEnex("전체 확인 노트") });
  await mobilePage.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  const completeVerdict = await mobilePage.locator("#importPreviewVerdict").innerText();
  assert.match(completeVerdict, /완전 이전 수량 확인/);
  assert.match(completeVerdict, /정확히 일치/);
  assert.equal(await mobilePage.locator("#importPreviewVerdict").evaluate(node => node.classList.contains("complete")), true);
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "390px viewport must not overflow horizontally");
  await mobilePage.screenshot({ path: path.join(artifacts, "public_import_completeness_complete_mobile_v1.png"), fullPage: true });
  await mobilePage.locator("#importPreviewCancel").click();
  assert.deepEqual(mobileErrors, [], mobileErrors.join("\n"));
  await mobile.close();

  console.log(JSON.stringify({ ok: true, publicUrl, release, mixedVerdict: verdict, completeVerdict, fileStatuses: report.fileResults.map(item => ({ name: item.name, status: item.status, notes: item.noteCount, attachments: item.attachmentCount })) }, null, 2));
} finally {
  await browser.close();
}
