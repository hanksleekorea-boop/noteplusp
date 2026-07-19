import assert from "node:assert/strict";
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
const appFile = process.env.NOTEPLUS_APP_FILE || "노트앱_v11.html";
const appUrl = process.env.NOTEPLUS_APP_URL || `http://127.0.0.1:4173/${encodeURIComponent(appFile)}?stream=${Date.now()}`;
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const source = fs.readFileSync(path.join(root, appFile), "utf8");

assert.match(source, /ENEX_STREAMING_THRESHOLD_BYTES/);
assert.match(source, /parseEnexFileStreaming/);
for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);

const browser = await chromium.launch({ executablePath: edge, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.parseEnexFileStreaming === "function");
  await page.evaluate(() => window.storageReady);

  const result = await page.evaluate(async () => {
    const chunk = window.ENEX_STREAM_CHUNK_BYTES;
    const header = '<?xml version="1.0" encoding="UTF-8"?><en-export>';
    // The first <note> opening tag crosses the 2MB decoder boundary: <no | te>.
    const padding = " ".repeat(chunk - header.length - 3);
    const xml = header + padding + "<no" + "te><title>첫 노트</title><created>20260719T000000Z</created><content><![CDATA[<en-note><div>첫 본문</div></en-note>]]></content></note>" +
      "<note><title>둘째 노트</title><created>20260719T000001Z</created><content><![CDATA[<en-note><div>둘째 본문</div></en-note>]]></content></note></en-export>";
    const file = new File([xml], "boundary.enex", { type: "application/xml" });
    const job = { cancelled: false, readers: [] };
    const parsed = await window.parseEnexFileStreaming(file, "스트리밍", file.name, () => {}, job);
    return {
      count: parsed.notes.length,
      titles: parsed.notes.map(note => note.title),
      bodies: parsed.notes.map(note => note.body),
      readersRemaining: job.readers.length
    };
  });

  assert.equal(result.count, 2, "a note tag split across chunks must still be imported");
  assert.deepEqual(result.titles, ["첫 노트", "둘째 노트"]);
  assert.deepEqual(result.bodies, ["첫 본문", "둘째 본문"]);
  assert.equal(result.readersRemaining, 0, "completed streaming reads must release FileReader handles");
  console.log(JSON.stringify({ ok: true, appFile, result }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
