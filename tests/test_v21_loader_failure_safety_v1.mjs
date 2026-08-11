import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const runtimePlaywright = process.env.NOTEPLUS_PLAYWRIGHT || path.join(process.env.USERPROFILE || "C:/Users/User", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright-core");
let chromium;
try { ({chromium} = require("playwright-core")); } catch { ({chromium} = require(runtimePlaywright)); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browserPath = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const loader = fs.readFileSync(path.join(root, "노트앱_v21.html"));
let sourceRequests = 0;
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  if (pathname === "/노트앱_v21.html") {
    response.writeHead(200, {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"});
    response.end(loader);
    return;
  }
  if (pathname === "/노트앱_v16.html") {
    sourceRequests += 1;
    response.writeHead(503, {"content-type": "text/plain; charset=utf-8", "cache-control": "no-store"});
    response.end("synthetic source outage");
    return;
  }
  response.writeHead(404).end();
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/노트앱_v21.html`;
const browser = await chromium.launch({executablePath: browserPath, headless: true});
try {
  const context = await browser.newContext({locale: "ko-KR"});
  await context.addInitScript(() => localStorage.setItem("noteplus-loader-guard", "preserve"));
  const page = await context.newPage();
  await page.goto(url, {waitUntil: "domcontentloaded"});
  await page.getByText("v21 준비에 실패했습니다. 기존 데이터는 변경되지 않았습니다.").waitFor();

  assert.equal(sourceRequests, 1, "loader must make exactly one source request");
  await assert.doesNotReject(() => page.locator("body").waitFor({state: "visible"}));
  assert.match(await page.locator("body").innerText(), /v21 준비에 실패했습니다\. 기존 데이터는 변경되지 않았습니다\./);
  assert.equal(await page.locator('a[href="노트앱_v20.html"]').count(), 1, "fallback link must remain available");
  assert.equal(await page.evaluate(() => localStorage.getItem("noteplus-loader-guard")), "preserve", "loader failure must not alter existing local data");
  assert.match(await page.locator("pre").innerText(), /원본 앱을 불러오지 못했습니다 \(HTTP 503\)/);

  console.log(JSON.stringify({
    ok: true,
    contract: "v21-loader-failure-safety-v1",
    sourceRequests,
    fallbackVisible: true,
    localDataPreserved: true
  }, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
