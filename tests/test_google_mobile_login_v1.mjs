import assert from "node:assert/strict";
import crypto from "node:crypto";
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
function createServer() { return http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const target = path.resolve(root, "." + (pathname === "/" ? "/노트앱_v15.html" : pathname));
  if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(403).end(); return; }
  fs.readFile(target, (error, bytes) => { if (error) { response.writeHead(404).end(); return; } response.writeHead(200, {"content-type": types.get(path.extname(target).toLowerCase()) || "application/octet-stream", "cache-control": "no-store"}); response.end(bytes); });
}); }
const externalAppUrl = process.env.NOTEPLUS_MOBILE_GOOGLE_TEST_URL || "";
let server = null;
let appUrl = externalAppUrl;
if (!appUrl) {
  server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  appUrl = `http://127.0.0.1:${server.address().port}/노트앱_v15.html?mobile-google=${Date.now()}`;
}
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "";
if (expectedSha) {
  const response = await fetch(appUrl, {cache: "no-store"});
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), expectedSha);
}

const browser = await chromium.launch({executablePath: edge, headless: true});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, locale: "ko-KR", userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36"});
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(appUrl, {waitUntil: "networkidle"});
  await page.evaluate(() => window.storageReady);
  await page.waitForFunction(() => window.noteplusCloud?.status().phase === "unconfigured");
  const config = await page.evaluate(() => window.noteplusCloud.configurationStatus());
  assert.equal(config.configured, false);
  assert.equal(config.mobile, true);
  assert.equal(config.signInStrategy, "popup");
  assert.match(await page.evaluate(() => window.noteplusCloud.friendlyError({code: "auth/unauthorized-domain"})), /승인 도메인/);
  assert.match(await page.evaluate(() => window.noteplusCloud.friendlyError({code: "auth/web-storage-unsupported"})), /일반 Chrome 또는 Safari/);

  const before = await page.evaluate(() => window.stateSignature(window.state));
  await page.evaluate(() => {
    window.__mobileGoogleCalls = 0;
    window.noteplusCloud = {
      status: () => ({phase: "ready", configured: true, user: null, mobile: true, signInStrategy: "popup"}),
      signIn: async () => {
        window.__mobileGoogleCalls += 1;
        const user = {uid: "mobile-user", email: "mobile@example.invalid"};
        window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: {phase: "ready", configured: true, user, mobile: true, signInStrategy: "popup", message: "Google 계정이 연결되었습니다. 백업 버튼을 눌러야 데이터가 전송됩니다."}}));
        return user;
      },
      signOut: async () => {},
      friendlyError: error => String(error && error.message || error)
    };
    window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: window.noteplusCloud.status()}));
  });
  assert.match(await page.locator("#googleSignInBtn").innerText(), /휴대폰/);
  await page.evaluate(() => document.querySelector("#googleSignInBtn").click());
  await page.waitForFunction(() => document.querySelector("#cloudAccount")?.textContent === "mobile@example.invalid");
  assert.equal(await page.evaluate(() => window.__mobileGoogleCalls), 1);
  assert.equal(await page.evaluate(() => window.stateSignature(window.state)), before);

  await page.evaluate(() => {
    window.noteplusCloud = {
      status: () => ({phase: "ready", configured: true, user: null, mobile: true, signInStrategy: "redirect"}),
      signIn: async () => {
        window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: {phase: "auth-returning", configured: true, user: null, mobile: true, signInStrategy: "redirect", message: "Google 로그인에서 돌아왔습니다. 계정 상태를 확인 중입니다."}}));
        return {redirecting: true};
      },
      signOut: async () => {},
      friendlyError: error => String(error && error.message || error)
    };
    window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: window.noteplusCloud.status()}));
  });
  await page.evaluate(() => document.querySelector("#googleSignInBtn").click());
  await page.waitForFunction(() => document.querySelector("#googleSignInBtn")?.textContent.includes("확인 중"));
  assert.equal(await page.locator("#googleSignInBtn").isDisabled(), true);
  assert.equal(await page.evaluate(() => window.stateSignature(window.state)), before);
  await page.locator('[data-mobile-view="side"]').click();
  await page.locator("#cloudPanel").scrollIntoViewIfNeeded();
  await page.screenshot({path: path.join(artifacts, "google_mobile_login_v15.png"), fullPage: true});
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ok: true, appUrl, mobileDetected: true, popupDefault: true, redirectReturnUi: true, authNoLocalMutation: true}, null, 2));
  await context.close();
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
