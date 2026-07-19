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
const fixturePath = path.join(root, "pilot-assets", "노트플러스P_파일럿_샘플.enex");
const publicUrl = process.env.NOTEPLUS_PUBLIC_URL || "https://hanksleekorea-boop.github.io/noteplusp/";
const version = process.env.NOTEPLUS_VERSION || "v11";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "AEB1CE08F4064331C1AF5A7E5907AFAE2FAFCBE80B4686C276EECF974A7036C9";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const appUrl = new URL(`${encodeURIComponent(`노트앱_${version}.html`)}?pilot=${Date.now()}`, publicUrl).href;
const fixture = fs.readFileSync(fixturePath);
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(); }
const response = await fetch(appUrl, { cache: "no-store" });
assert.equal(response.status, 200);
const release = Buffer.from(await response.arrayBuffer());
assert.equal(sha256(release), expectedSha);
for (const match of release.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);

const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ko-KR" });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  await page.locator("#enexFile").setInputFiles({ name: "노트플러스P_파일럿_샘플.enex", mimeType: "application/xml", buffer: fixture });
  await page.locator("#importPreview").waitFor({ state: "visible", timeout: 30000 });
  const summary = await page.locator("#importPreviewSummary").innerText();
  assert.match(summary, /1개 파일에서 노트 1개와 첨부 1개/);
  await page.locator("#importPreviewConfirm").click();
  await page.waitForFunction(() => window.state.notes.some(note => note.title === "노트플러스P 파일럿 샘플 노트"));
  await page.waitForFunction(async () => {
    const note = window.state.notes.find(item => item.title === "노트플러스P 파일럿 샘플 노트");
    const attachmentId = note?.attachmentIds?.[0];
    const stored = attachmentId ? await window.idbGet("attachment_blob", attachmentId) : null;
    return Boolean(stored?.blob?.size === 69);
  });
  const imported = await page.evaluate(async () => {
    const note = window.state.notes.find(item => item.title === "노트플러스P 파일럿 샘플 노트");
    const attachmentId = note?.attachmentIds?.[0];
    const meta = await window.idbGet("attachment_meta", attachmentId);
    const stored = await window.idbGet("attachment_blob", attachmentId);
    return { noteCount: window.state.notes.filter(item => item.title === note.title).length, body: note.body, tag: note.tags?.[0], attachmentName: meta?.name, attachmentMime: meta?.mime, blobSize: stored?.blob?.size || 0 };
  });
  assert.equal(imported.noteCount, 1);
  assert.match(imported.body, /가져오기가 정상적으로 끝났습니다/);
  assert.equal(imported.tag, "파일럿");
  assert.equal(imported.attachmentName, "노트플러스P_파일럿_확인.pdf");
  assert.equal(imported.attachmentMime, "application/pdf");
  assert.equal(imported.blobSize, 69);
  await page.screenshot({ path: path.join(artifacts, "pilot_10min_sample_import_v1.png"), fullPage: true });
  console.log(JSON.stringify({ ok: true, publicUrl, release: { bytes: release.length, sha256: expectedSha }, fixture: { bytes: fixture.length, sha256: sha256(fixture) }, preview: { files: 1, notes: 1, attachments: 1 }, imported }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
