import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runtimePlaywright = "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core";
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  ({ chromium } = require(runtimePlaywright));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const artifacts = path.join(root, "artifacts");
const publicUrl = process.env.NOTEPLUS_PUBLIC_URL || "https://hanksleekorea-boop.github.io/noteplusp/";
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "6D8F20F73896DA3F94EFAFE9291CEB51E53D4BD84560430583F9F0EFFCE633A0";
const marker = `schema4-${Date.now()}`;
const legacy = {
  schema: 4,
  notebooks: ["이전 노트북"],
  notes: [{
    id: `legacy_${marker}`,
    title: `구버전 원본 ${marker}`,
    body: `구버전 본문 ${marker}`,
    bodyHtml: `<div><strong>구버전 본문 ${marker}</strong><img src="https://evil.invalid/migration.png" onerror="window.__migrationPwned=1"><script>window.__migrationPwned=2</script></div>`,
    notebook: "이전 노트북",
    tags: ["이전태그"],
    updated: 1784419200000,
    created: 1784419100000
  }],
  evernoteBannerDismissed: false,
  theme: "light"
};
const legacyRaw = JSON.stringify(legacy);

fs.mkdirSync(artifacts, { recursive: true });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

async function verifyRelease() {
  const appUrl = new URL("%EB%85%B8%ED%8A%B8%EC%95%B1_v7.html?qa=" + Date.now(), publicUrl);
  const response = await fetch(appUrl, { cache: "no-store" });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedSha);
  for (const match of bytes.toString("utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1]) new Function(match[1]);
  }
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

async function readIdb(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("noteplusp_schema5", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(["app_state", "migration_meta"], "readonly");
      const stateReq = tx.objectStore("app_state").get("root");
      const migrationReq = tx.objectStore("migration_meta").get("localStorage_to_schema5");
      tx.oncomplete = () => {
        db.close();
        resolve({ state: stateReq.result, migration: migrationReq.result });
      };
      tx.onerror = () => reject(tx.error);
    };
  }));
}

const release = await verifyRelease();
const browser = await chromium.launch({ executablePath: edge, headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
  await context.addInitScript(raw => {
    window.__migrationPwned = 0;
    if (!localStorage.getItem("notes_app_v1")) localStorage.setItem("notes_app_v1", raw);
  }, legacyRaw);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(publicUrl + "?qa=" + Date.now(), { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.storageReady && typeof window.storageReady.then === "function");
  await page.evaluate(() => window.storageReady);

  const migrated = await page.evaluate(expectedMarker => {
    const note = window.state.notes.find(item => item.id === `legacy_${expectedMarker}`);
    return {
      schema: window.state.schema,
      persistenceMode: window.persistenceMode,
      note,
      legacyRaw: localStorage.getItem("notes_app_v1"),
      pwned: window.__migrationPwned
    };
  }, marker);
  assert.equal(migrated.schema, 5);
  assert.equal(migrated.persistenceMode, "idb");
  assert.equal(migrated.note?.title, legacy.notes[0].title);
  assert.equal(migrated.note?.body, legacy.notes[0].body);
  assert.deepEqual(migrated.note?.tags, ["이전태그"]);
  assert.equal(migrated.note?.notebook, "이전 노트북");
  assert.doesNotMatch(migrated.note?.bodyHtml || "", /<script|<img|onerror|evil\.invalid/i);
  assert.equal(migrated.legacyRaw, legacyRaw, "schema 4 localStorage source must remain byte-for-byte unchanged");
  assert.equal(migrated.pwned, 0);

  const firstIdb = await readIdb(page);
  assert.equal(firstIdb.state?.schema, 5);
  assert.equal(firstIdb.migration?.verified, true);
  assert.equal(firstIdb.migration?.source, "notes_app_v1");
  assert.ok(firstIdb.migration?.noteIds?.includes(legacy.notes[0].id));

  const editedTitle = `마이그레이션 후 수정 ${marker}`;
  await page.evaluate(async title => {
    const note = window.state.notes.find(item => item.id.startsWith("legacy_schema4-"));
    note.title = title;
    note.updated = Date.now();
    await window.persist();
  }, editedTitle);
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.storageReady);

  const reloaded = await page.evaluate(({ id, raw }) => ({
    schema: window.state.schema,
    matching: window.state.notes.filter(item => item.id === id).length,
    title: window.state.notes.find(item => item.id === id)?.title,
    legacyRaw: localStorage.getItem("notes_app_v1"),
    pwned: window.__migrationPwned
  }), { id: legacy.notes[0].id, raw: legacyRaw });
  assert.equal(reloaded.schema, 5);
  assert.equal(reloaded.matching, 1, "migration must be idempotent without duplicate notes");
  assert.equal(reloaded.title, editedTitle, "verified IndexedDB state must win over unchanged legacy source after reload");
  assert.equal(reloaded.legacyRaw, legacyRaw);
  assert.equal(reloaded.pwned, 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(artifacts, "public_schema4_migration_v1.png"), fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    publicUrl,
    release,
    originalPreserved: true,
    schema: reloaded.schema,
    migrationVerified: firstIdb.migration.verified,
    idempotentCount: reloaded.matching,
    editedTitleRestored: reloaded.title === editedTitle,
    hostileHtmlSanitized: true
  }, null, 2));
} finally {
  await browser.close();
}
