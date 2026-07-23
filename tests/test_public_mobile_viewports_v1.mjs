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
const version = process.env.NOTEPLUS_VERSION || "v16";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "64832DEDEB76D7A469B6238F274042A27C894BCBAFD56E4B36B526FDBAE2E520";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const appUrl = new URL(`${encodeURIComponent(`노트앱_${version}.html`)}?mobile=${Date.now()}`, publicUrl).href;
fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(); }

async function verifyRelease() {
  const response = await fetch(appUrl, { cache: "no-store" });
  assert.equal(response.status, 200, "public mobile target must return HTTP 200");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha, "public mobile target must match release SHA-256");
  for (const match of bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function watchPage(page, label) {
  const errors = [];
  page.on("pageerror", error => errors.push(`${label}: ${error.message}`));
  page.on("response", response => {
    if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) errors.push(`${label} HTTP ${response.status()}: ${response.url()}`);
  });
  page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label} console: ${message.text()}`);
  });
  return errors;
}

async function geometryAudit(page, width, stage) {
  const result = await page.evaluate(({ width, stage }) => {
    const html = document.documentElement;
    const body = document.body;
    const visible = node => Boolean(node && (node.offsetWidth || node.offsetHeight || node.getClientRects().length));
    const overflowing = [...document.querySelectorAll("body *")].filter(visible).filter(node => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (style.position === "fixed" && rect.left < -1) return false;
      return rect.right > window.innerWidth + 1 || rect.left < -1;
    }).map(node => ({ id: node.id, className: String(node.className || "").slice(0, 80), left: Math.round(node.getBoundingClientRect().left), right: Math.round(node.getBoundingClientRect().right) })).slice(0, 20);
    const navButtons = [...document.querySelectorAll("#mobileNav button")].filter(visible).map(button => {
      const rect = button.getBoundingClientRect();
      return { label: button.getAttribute("aria-label"), width: Math.round(rect.width), height: Math.round(rect.height), left: Math.round(rect.left), right: Math.round(rect.right), bottom: Math.round(rect.bottom) };
    });
    return {
      stage,
      requestedWidth: width,
      innerWidth: window.innerWidth,
      htmlScrollWidth: html.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      overflowing,
      navButtons,
      mobileNavVisible: visible(document.getElementById("mobileNav"))
    };
  }, { width, stage });
  assert.equal(result.innerWidth, width, `${stage}: viewport width must be exact`);
  assert.ok(result.htmlScrollWidth <= width + 1, `${stage}: document must not overflow horizontally (${result.htmlScrollWidth}/${width})`);
  assert.ok(result.bodyScrollWidth <= width + 1, `${stage}: body must not overflow horizontally (${result.bodyScrollWidth}/${width})`);
  assert.deepEqual(result.overflowing, [], `${stage}: visible elements overflow viewport: ${JSON.stringify(result.overflowing)}`);
  assert.equal(result.mobileNavVisible, true, `${stage}: mobile navigation must be visible`);
  assert.equal(result.navButtons.length, 4, `${stage}: all four mobile actions must be visible`);
  for (const button of result.navButtons) {
    assert.ok(button.width >= 40 && button.height >= 40, `${stage}: ${button.label} touch target must be at least 40x40`);
    assert.ok(button.left >= -1 && button.right <= width + 1, `${stage}: ${button.label} must stay within viewport`);
  }
  return result;
}

async function verifyFocusIndicator(page, selector, label) {
  await page.locator(selector).focus();
  const focus = await page.locator(selector).evaluate(node => {
    const style = getComputedStyle(node);
    return { active: document.activeElement === node, outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) || 0, outlineColor: style.outlineColor };
  });
  assert.equal(focus.active, true, `${label}: target must receive focus`);
  assert.notEqual(focus.outlineStyle, "none", `${label}: keyboard focus outline must be visible`);
  assert.ok(focus.outlineWidth >= 2, `${label}: keyboard focus outline must be at least 2px`);
  return focus;
}

async function verifyViewport(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ko-KR" });
  const page = await context.newPage();
  const errors = watchPage(page, `${width}px`);
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);
  await page.locator("#mobileNav").waitFor({ state: "visible" });

  const stages = [];
  stages.push(await geometryAudit(page, width, "list"));
  const focus = await verifyFocusIndicator(page, "#mobileNewBtn", `${width}px 새 노트`);

  await page.locator("#mobileNewBtn").click();
  await page.locator("#edTitle").fill(`모바일 ${width}px 검사`);
  await page.locator("#edContent").fill("작은 화면에서도 입력과 저장 상태가 유지됩니다.");
  await page.waitForFunction(() => document.querySelector("#edStatus")?.textContent.includes("저장됨"));
  stages.push(await geometryAudit(page, width, "editor"));

  await page.locator('[data-mobile-view="side"]').click();
  await page.locator("#installAppBtn").scrollIntoViewIfNeeded();
  assert.equal(await page.locator("#installAppBtn").isVisible(), true, `${width}px: home-screen action must be reachable in organize view`);
  stages.push(await geometryAudit(page, width, "organize"));

  await page.locator("#enexGuideSide").scrollIntoViewIfNeeded();
  await page.locator("#enexGuideSide").click();
  assert.equal(await page.locator("#enexGuide").getAttribute("aria-hidden"), "false", `${width}px: guide dialog must open`);
  const dialog = await page.locator(".guide-dialog").boundingBox();
  assert.ok(dialog && dialog.x >= -1 && dialog.x + dialog.width <= width + 1, `${width}px: guide dialog must fit horizontally`);
  assert.ok(dialog && dialog.y >= -1 && dialog.y + dialog.height <= height + 1, `${width}px: guide dialog must fit vertically`);
  stages.push(await geometryAudit(page, width, "guide"));
  await page.screenshot({ path: path.join(artifacts, `public_mobile_${width}_v1.png`), fullPage: true });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#enexGuide").getAttribute("aria-hidden"), "true", `${width}px: Escape must close guide`);

  assert.deepEqual(errors, [], errors.join("\n"));
  await context.close();
  return { width, height, focus, stages: stages.map(stage => ({ stage: stage.stage, scrollWidth: stage.htmlScrollWidth, navTargets: stage.navButtons.map(button => `${button.width}x${button.height}`) })) };
}

const release = await verifyRelease();
const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const viewports = [];
  viewports.push(await verifyViewport(browser, 390, 844));
  viewports.push(await verifyViewport(browser, 360, 800));
  console.log(JSON.stringify({ ok: true, publicUrl, version, release, viewports }, null, 2));
} finally {
  await browser.close();
}
