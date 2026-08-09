import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const runtimePlaywright = process.env.NOTEPLUS_PLAYWRIGHT || "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core";
let chromium;
try { ({chromium} = require("playwright-core")); } catch { ({chromium} = require(runtimePlaywright)); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browserPath = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const target = path.resolve(root, "." + (pathname === "/" ? "/노트앱_v16.html" : pathname));
  if (!target.startsWith(root + path.sep) && target !== root) return response.writeHead(403).end();
  fs.readFile(target, (error, bytes) => {
    if (error) return response.writeHead(404).end();
    response.writeHead(200, {"content-type": path.extname(target) === ".js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", "cache-control": "no-store"});
    response.end(bytes);
  });
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

const browser = await chromium.launch({executablePath: browserPath, headless: true});
try {
  const checks = [];
  for (const viewport of [{width: 360, height: 740}, {width: 390, height: 844}, {width: 1280, height: 900}]) {
    const context = await browser.newContext({viewport, locale: "ko-KR"});
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/노트앱_v16.html?responsive=${viewport.width}`, {waitUntil: "networkidle"});
    await page.evaluate(() => window.storageReady);
    const initial = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      mobileNavVisible: getComputedStyle(document.getElementById("mobileNav")).display !== "none",
      navButtonCount: document.querySelectorAll("#mobileNav button").length,
      smallestNavButton: Math.min(...Array.from(document.querySelectorAll("#mobileNav button"), button => button.getBoundingClientRect().height)),
      mainClass: document.getElementById("main").className
    }));
    assert.ok(initial.scrollWidth <= initial.innerWidth, `${viewport.width}px has horizontal overflow`);
    if (viewport.width <= 640) {
      assert.equal(initial.mobileNavVisible, true);
      assert.equal(initial.navButtonCount, 4);
      assert.ok(initial.smallestNavButton >= 40);
      await page.locator('[data-mobile-view="side"]').click();
      await page.locator('[data-mobile-view="list"]').click();
      await page.locator('[data-mobile-view="editor"]').click();
      const after = await page.evaluate(() => ({mainClass: document.getElementById("main").className, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
      assert.match(after.mainClass, /mobile-editor/);
      assert.ok(after.scrollWidth <= after.innerWidth, `${viewport.width}px overflows after mobile navigation`);
      checks.push({width: viewport.width, mobileNav: true, overflowFree: true, mobileNavigation: true});
    } else {
      assert.equal(initial.mobileNavVisible, false);
      checks.push({width: viewport.width, mobileNav: false, overflowFree: true, mobileNavigation: "not-applicable"});
    }
    await context.close();
  }
  console.log(JSON.stringify({ok: true, contract: "v21-responsive-layout-v1", checks, syntheticEvidenceOnly: true}, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
