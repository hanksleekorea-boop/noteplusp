import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
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
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
fs.mkdirSync(artifacts, { recursive: true });

const mime = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"]]);
const externalAppUrl = process.env.NOTEPLUS_GOOGLE_TEST_URL || "";
let server = null;
function createServer() { return http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const target = path.resolve(root, "." + (pathname === "/" ? "/노트앱_v13.html" : pathname));
  if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(403).end(); return; }
  fs.readFile(target, (error, bytes) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, {"content-type": mime.get(path.extname(target).toLowerCase()) || "application/octet-stream", "cache-control": "no-store"});
    response.end(bytes);
  });
}); }
let appUrl = externalAppUrl;
if (!appUrl) {
  server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  appUrl = `http://127.0.0.1:${address.port}/노트앱_v13.html?qa=${Date.now()}`;
}
const expectedSha = process.env.NOTEPLUS_EXPECTED_SHA || "";
if (expectedSha) {
  const releaseResponse = await fetch(appUrl, {cache: "no-store"});
  assert.equal(releaseResponse.status, 200);
  const releaseBytes = Buffer.from(await releaseResponse.arrayBuffer());
  assert.equal(crypto.createHash("sha256").update(releaseBytes).digest("hex").toUpperCase(), expectedSha);
}

const browser = await chromium.launch({executablePath: edge, headless: true});
try {
  const context = await browser.newContext({viewport: {width: 1365, height: 900}, locale: "ko-KR"});
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(`page: ${error.message}`));
  page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console: ${message.text()}`); });
  await page.goto(appUrl, {waitUntil: "networkidle"});
  await page.evaluate(() => window.storageReady);
  await page.waitForFunction(() => window.noteplusCloud?.status().phase === "unconfigured");

  assert.match(await page.locator("#cloudStatus").innerText(), /설정 전|로컬 저장/);
  assert.equal(await page.locator("#googleSignInBtn").isDisabled(), true);
  assert.equal(await page.locator("#cloudBackupBtn").isDisabled(), true);

  const fixture = await page.evaluate(async () => {
    const marker = Date.now().toString(36);
    const noteId = "cloudnote_" + marker;
    const attachmentId = "att_cloud_" + marker;
    const blob = new Blob([new TextEncoder().encode("%PDF-1.4\nCLOUD BACKUP TEST\n%%EOF\n")], {type: "application/pdf"});
    const note = {id: noteId, title: "클라우드 백업 무손실 검사", body: "합성 검사 데이터", bodyHtml: "<div>합성 검사 데이터</div>", notebook: "개인", tags: ["검사"], attachmentIds: [attachmentId], favorite: false, history: [], created: Date.now(), updated: Date.now()};
    window.state.notes.unshift(note);
    await window.writeStateAndAttachments([{meta: {id: attachmentId, noteId, name: "cloud-test.pdf", mime: "application/pdf", size: blob.size, created: Date.now(), sha256: ""}, blob}], [], null);
    window.render();
    return {noteId, attachmentId, signature: window.stateSignature(window.state), blobSize: blob.size};
  });

  await page.evaluate(() => {
    window.__failedSnapshotId = null;
    window.noteplusCloud = {
      status: () => ({phase: "ready", configured: true, user: {uid: "test-user", email: "test@example.invalid"}}),
      signIn: async () => ({uid: "test-user"}),
      signOut: async () => {},
      uploadSnapshot: async payload => { window.__failedSnapshotId = payload.snapshotId; throw new Error("모의 네트워크 중단"); }
    };
    window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: window.noteplusCloud.status()}));
  });
  await page.locator("#cloudBackupBtn").click();
  await page.waitForFunction(() => document.querySelector("#cloudStatus")?.textContent.includes("모의 네트워크 중단"));
  const afterFailure = await page.evaluate(async ({signature, attachmentId}) => {
    const record = await window.getAttachmentRecord(attachmentId);
    return {signatureSame: window.stateSignature(window.state) === signature, blobSize: record?.blob?.size || 0, failedSnapshotId: window.__failedSnapshotId, phase: document.querySelector("#cloudStatus")?.textContent || ""};
  }, fixture);
  assert.equal(afterFailure.signatureSame, true);
  assert.equal(afterFailure.blobSize, fixture.blobSize);
  assert.match(afterFailure.phase, /로컬 데이터와 이전 완성 백업은 그대로/);

  await page.evaluate(() => {
    window.__capturedCloudPayload = null;
    window.noteplusCloud.uploadSnapshot = async payload => {
      window.__capturedCloudPayload = payload;
      return {noteCount: payload.counts.noteCount, attachmentCount: payload.counts.attachmentCount};
    };
    window.dispatchEvent(new CustomEvent("noteplus-cloud-state", {detail: window.noteplusCloud.status()}));
  });
  await page.locator("#cloudBackupBtn").click();
  await page.waitForFunction(() => document.querySelector("#cloudStatus")?.textContent.includes("검증된 클라우드 백업 완료"));
  const afterSuccess = await page.evaluate(async ({signature, attachmentId}) => {
    const payload = window.__capturedCloudPayload;
    const manifest = JSON.parse(payload.manifestText);
    const record = await window.getAttachmentRecord(attachmentId);
    return {
      signatureSame: window.stateSignature(window.state) === signature,
      format: manifest.format,
      schema: manifest.schema,
      attachmentCount: payload.attachments.length,
      attachmentIsBlob: payload.attachments[0]?.blob instanceof Blob,
      attachmentSha256: payload.attachments[0]?.sha256 || "",
      rawAttachmentInManifest: Object.hasOwn(manifest.attachments[0] || {}, "blob") || Object.hasOwn(manifest.attachments[0] || {}, "dataBase64"),
      manifestHash: payload.manifestSha256,
      retryUsedSameSnapshot: payload.snapshotId === window.__failedSnapshotId,
      blobSize: record?.blob?.size || 0
    };
  }, fixture);
  assert.equal(afterSuccess.signatureSame, true);
  assert.equal(afterSuccess.format, "noteplusp-cloud-snapshot-v1");
  assert.equal(afterSuccess.schema, 5);
  assert.equal(afterSuccess.attachmentCount, 1);
  assert.equal(afterSuccess.attachmentIsBlob, true);
  assert.match(afterSuccess.attachmentSha256, /^[A-F0-9]{64}$/);
  assert.equal(afterSuccess.rawAttachmentInManifest, false);
  assert.match(afterSuccess.manifestHash, /^[A-F0-9]{64}$/);
  assert.equal(afterSuccess.retryUsedSameSnapshot, true);
  assert.equal(afterSuccess.blobSize, fixture.blobSize);
  assert.deepEqual(errors, [], errors.join("\n"));
  await page.screenshot({path: path.join(artifacts, "google_pc_backup_no_loss_v1.png"), fullPage: true});
  console.log(JSON.stringify({ok: true, appUrl, noConfig: true, uploadFailureNoLoss: afterFailure, mockUploadVerified: afterSuccess}, null, 2));
  await context.close();
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
