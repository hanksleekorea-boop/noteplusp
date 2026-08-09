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
  const context = await browser.newContext({locale: "ko-KR"});
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/노트앱_v16.html?virtual-persona=${Date.now()}`, {waitUntil: "networkidle"});
  await page.evaluate(() => window.storageReady);

  const result = await page.evaluate(async () => {
    const categories = [
      {name: "새 사용자", count: 0},
      {name: "가벼운 기록", count: 1},
      {name: "분류 사용", count: 4},
      {name: "검색 중심", count: 12},
      {name: "이력 포함", count: 6}
    ];
    const original = window.state;
    const originalSignature = window.stateSignature(original);
    const summary = Object.fromEntries(categories.map(category => [category.name, 0]));
    let snapshotChecks = 0;
    let previewChecks = 0;
    let unchangedChecks = 0;
    try {
      for (let persona = 0; persona < 1000; persona++) {
        const category = categories[Math.floor(persona / 200)];
        const now = Date.now() - persona;
        const notes = Array.from({length: category.count}, (_, index) => ({
          id: `persona_${persona}_note_${index}`,
          title: `${category.name} 노트 ${index}`,
          body: `합성 프로필 ${persona}의 안전 검사 내용`,
          bodyHtml: `<div>합성 프로필 ${persona}의 안전 검사 내용</div>`,
          notebook: index % 2 ? "개인" : "업무",
          tags: index % 3 ? ["합성", category.name] : [],
          attachmentIds: [],
          favorite: index === 0 && persona % 5 === 0,
          history: category.name === "이력 포함" ? [{at: now - 1, title: "이전 제목", body: "이전 본문"}] : [],
          created: now - index,
          updated: now - index
        }));
        window.state = window.migrateState({schema: 5, notebooks: ["개인", "업무"], notes, trash: [], evernoteBannerDismissed: true, theme: "light", preferences: {savedSearches: [], templates: [], snapshots: [], sync: {version: 1, deviceId: `persona_${persona}`, updatedAt: now, pendingOps: [], conflicts: []}}});
        const before = window.stateSignature(window.state);
        const payload = await window.prepareCloudSnapshot();
        const manifest = JSON.parse(payload.manifestText);
        const preview = window.validateCloudRestorePreview({pointer: {snapshotId: manifest.snapshotId}, manifest, accountUid: "synthetic-persona"});
        if (payload.counts.noteCount !== category.count) throw new Error(`persona ${persona}: snapshot note count mismatch`);
        if (preview.noteCount !== category.count) throw new Error(`persona ${persona}: preview note count mismatch`);
        if (window.stateSignature(window.state) !== before) throw new Error(`persona ${persona}: source state changed`);
        summary[category.name] += 1;
        snapshotChecks += 1;
        previewChecks += 1;
        unchangedChecks += 1;
      }
    } finally {
      window.state = original;
    }
    return {personas: 1000, categories: summary, snapshotChecks, previewChecks, unchangedChecks, originalStateUnchanged: window.stateSignature(window.state) === originalSignature, syntheticEvidenceOnly: true};
  });

  assert.equal(result.personas, 1000);
  assert.deepEqual(result.categories, {"새 사용자": 200, "가벼운 기록": 200, "분류 사용": 200, "검색 중심": 200, "이력 포함": 200});
  assert.equal(result.snapshotChecks, 1000);
  assert.equal(result.previewChecks, 1000);
  assert.equal(result.unchangedChecks, 1000);
  assert.equal(result.originalStateUnchanged, true);
  console.log(JSON.stringify({ok: true, contract: "virtual-persona-snapshot-safety-v1", ...result}, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
