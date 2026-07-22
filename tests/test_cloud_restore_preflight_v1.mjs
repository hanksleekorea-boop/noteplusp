import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const runtimePlaywright = "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core";
let chromium;
try { ({chromium} = require("playwright-core")); } catch { ({chromium} = require(runtimePlaywright)); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
fs.mkdirSync(artifacts, {recursive: true});
const types = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"]]);
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const target = path.resolve(root, "." + (pathname === "/" ? "/노트앱_v16.html" : pathname));
  if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(403).end(); return; }
  fs.readFile(target, (error, bytes) => { if (error) { response.writeHead(404).end(); return; } response.writeHead(200, {"content-type": types.get(path.extname(target).toLowerCase()) || "application/octet-stream", "cache-control": "no-store"}); response.end(bytes); });
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const appUrl = `http://127.0.0.1:${server.address().port}/노트앱_v16.html?restore-preflight=${Date.now()}`;

const browser = await chromium.launch({executablePath: edge, headless: true});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, locale: "ko-KR", userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36"});
  const page = await context.newPage();
  await page.goto(appUrl, {waitUntil: "networkidle"});
  await page.evaluate(() => window.storageReady);
  const result = await page.evaluate(async () => {
    const totalBytes = 800 * 1024 * 1024;
    const low = window.assessCloudRestorePreflight({totalBytes}, {usage: 900 * 1024 * 1024, quota: 1024 * 1024 * 1024});
    const roomy = window.assessCloudRestorePreflight({totalBytes}, {usage: 100 * 1024 * 1024, quota: 2 * 1024 * 1024 * 1024});
    const unknown = window.assessCloudRestorePreflight({totalBytes}, null);
    const saveData = window.cloudRestoreNetworkNotice({totalBytes}, {saveData: true, effectiveType: "4g"});
    const slow = window.cloudRestoreNetworkNotice({totalBytes}, {saveData: false, effectiveType: "3g"});
    const signature = window.stateSignature(window.state);
    let downloads = 0;
    window.noteplusCloud = {status: () => ({user: {uid: "preflight-user"}}), downloadAttachment: async () => { downloads += 1; return new Blob(["unexpected"]); }};
    Object.defineProperty(navigator, "storage", {configurable: true, value: {estimate: async () => ({usage: 900 * 1024 * 1024, quota: 1024 * 1024 * 1024})}});
    const preview = {bundle: {accountUid: "preflight-user", manifest: {snapshotId: "s5_preflight_safe"}}, state: window.cloneState(window.state), descriptors: {}, attachmentCount: 1, totalBytes};
    let blocked = "";
    try { await window.restoreVerifiedCloudSnapshot(preview); } catch (error) { blocked = String(error && error.message || error); }
    window.pendingCloudRestore = preview;
    window.setCloudUi({phase: "error", configured: true, user: {uid: "preflight-user", email: "mobile@example.invalid"}, mobile: true, message: blocked});
    return {low, roomy, unknown, saveData, slow, blocked, downloads, signatureSame: window.stateSignature(window.state) === signature};
  });
  assert.equal(result.low.status, "blocked");
  assert.equal(result.roomy.status, "ok");
  assert.equal(result.unknown.status, "unknown");
  assert.match(result.saveData, /데이터 절약 모드/);
  assert.match(result.slow, /3G/);
  assert.match(result.blocked, /저장공간 부족/);
  assert.match(result.blocked, /어떤 첨부도 다운로드하지 않았습니다/);
  assert.equal(result.downloads, 0);
  assert.equal(result.signatureSame, true);
  await page.locator('[data-mobile-view="side"]').click();
  await page.locator("#cloudPanel").scrollIntoViewIfNeeded();
  await page.screenshot({path: path.join(artifacts, "cloud_restore_preflight_v16.png"), fullPage: true});
  console.log(JSON.stringify({ok: true, appUrl, low: result.low, roomy: result.roomy, unknown: result.unknown, networkWarnings: true, blockedBeforeDownload: true, stateUnchanged: true}, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
