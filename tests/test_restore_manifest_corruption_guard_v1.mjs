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
const edge = process.env.NOTEPLUS_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const types = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"]]);
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const target = path.resolve(root, "." + (pathname === "/" ? "/노트앱_v16.html" : pathname));
  if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(403).end(); return; }
  fs.readFile(target, (error, bytes) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, {"content-type": types.get(path.extname(target).toLowerCase()) || "application/octet-stream", "cache-control": "no-store"});
    response.end(bytes);
  });
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const appUrl = `http://127.0.0.1:${server.address().port}/노트앱_v16.html?restore-guard=1`;

const browser = await chromium.launch({executablePath: edge, headless: true});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, locale: "ko-KR"});
  const page = await context.newPage();
  page.on("dialog", dialog => dialog.accept());
  await page.goto(appUrl, {waitUntil: "networkidle"});
  await page.evaluate(() => window.storageReady);

  const result = await page.evaluate(async () => {
    const ATTACHMENT_ID = "att_guard_0001";
    const ORPHAN_ID = "att_guard_0002";
    const NOTE_ID = "note_guard_0001";
    const ACCOUNT_UID = "guard-uid";

    function buildValidBundle() {
      const snapshot = window.cloneState(window.state);
      const strip = list => (Array.isArray(list) ? list : []).map(note => Object.assign({}, note, {attachmentIds: []}));
      snapshot.notes = strip(snapshot.notes);
      snapshot.trash = strip(snapshot.trash);
      snapshot.notes.push({
        id: NOTE_ID, title: "복원 계약 검사 노트", body: "guard", bodyHtml: "<p>guard</p>",
        tags: [], notebook: "", created: 1700000000000, updated: 1700000000000,
        attachmentIds: [ATTACHMENT_ID], favorite: false, history: []
      });
      const attachment = {id: ATTACHMENT_ID, noteId: NOTE_ID, name: "guard.png", mime: "image/png", size: 10, created: 1700000000000, sha256: "A".repeat(64)};
      const manifest = {
        format: "noteplusp-cloud-snapshot-v1", schema: 5, appVersion: "v16",
        snapshotId: "s5_guard_contract_v1", contentSha256: "B".repeat(64),
        createdAt: "2026-01-01T00:00:00.000Z",
        counts: {noteCount: snapshot.notes.length + snapshot.trash.length, activeNoteCount: snapshot.notes.length, trashNoteCount: snapshot.trash.length, attachmentCount: 1},
        state: snapshot, attachments: [attachment]
      };
      return {pointer: {format: "noteplusp-cloud-current-v1", snapshotId: manifest.snapshotId, manifestSha256: "C".repeat(64)}, manifest, manifestSize: 4096, accountUid: ACCOUNT_UID};
    }

    let downloads = 0;
    window.noteplusCloud = {
      status: () => ({user: {uid: ACCOUNT_UID}}),
      downloadAttachment: async () => { downloads += 1; throw new Error("합성 첨부 다운로드 실패"); }
    };
    Object.defineProperty(navigator, "storage", {configurable: true, value: {estimate: async () => ({usage: 1024, quota: 8 * 1024 * 1024 * 1024})}});

    const cases = [
      // 1) 깨진 JSON: 해석에 실패한 텍스트가 그대로 넘어온 경우
      {name: "json_broken_manifest_is_text", group: "broken_json", mutate: b => { b.manifest = '{"format":"noteplusp-cloud-snapshot-v1","schema":5,'; }},
      {name: "json_broken_manifest_null", group: "broken_json", mutate: b => { b.manifest = null; }},
      {name: "json_broken_state_is_text", group: "broken_json", mutate: b => { b.manifest.state = '{"notes":['; }},
      // 2) 형식 불일치
      {name: "format_wrong_format_string", group: "format_mismatch", mutate: b => { b.manifest.format = "noteplusp-cloud-snapshot-v2"; }},
      {name: "format_wrong_schema", group: "format_mismatch", mutate: b => { b.manifest.schema = 4; }},
      {name: "format_attachments_not_array", group: "format_mismatch", mutate: b => { b.manifest.attachments = {}; }},
      {name: "format_state_missing", group: "format_mismatch", mutate: b => { delete b.manifest.state; }},
      // 3) 첨부 메타데이터 불일치
      {name: "attachment_bad_mime", group: "attachment_meta_mismatch", mutate: b => { b.manifest.attachments[0].mime = "image png"; }},
      {name: "attachment_bad_sha256", group: "attachment_meta_mismatch", mutate: b => { b.manifest.attachments[0].sha256 = "XYZ"; }},
      {name: "attachment_negative_size", group: "attachment_meta_mismatch", mutate: b => { b.manifest.attachments[0].size = -1; }},
      {name: "attachment_bad_id", group: "attachment_meta_mismatch", mutate: b => { b.manifest.attachments[0].id = "guard-not-att"; }},
      {name: "attachment_owner_mismatch", group: "attachment_meta_mismatch", mutate: b => { b.manifest.attachments[0].noteId = "note_guard_other"; }},
      {name: "attachment_duplicate_id", group: "attachment_meta_mismatch", mutate: b => {
        b.manifest.attachments.push(JSON.parse(JSON.stringify(b.manifest.attachments[0])));
        b.manifest.counts.attachmentCount = 2;
      }},
      {name: "attachment_count_mismatch", group: "attachment_meta_mismatch", mutate: b => { b.manifest.counts.attachmentCount = 2; }},
      {name: "note_count_mismatch", group: "attachment_meta_mismatch", mutate: b => { b.manifest.counts.noteCount += 1; }},
      {name: "attachment_orphan_reference", group: "attachment_meta_mismatch", mutate: b => {
        b.manifest.state.notes[b.manifest.state.notes.length - 1].attachmentIds = [ATTACHMENT_ID, ORPHAN_ID];
      }}
    ];

    const rejected = [];
    for (const item of cases) {
      const before = window.stateSignature(window.state);
      const downloadsBefore = downloads;
      const bundle = buildValidBundle();
      item.mutate(bundle);
      let threw = "";
      try { window.validateCloudRestorePreview(bundle); }
      catch (error) { threw = String(error && error.message || error); }
      rejected.push({
        name: item.name,
        group: item.group,
        threw: threw !== "",
        message: threw,
        stateUnchanged: window.stateSignature(window.state) === before,
        attachmentAbsent: !(await window.getAttachmentRecord(ATTACHMENT_ID)),
        downloads: downloads - downloadsBefore
      });
    }

    // 음성 대조 A: 정상 manifest는 검증을 통과해야 한다.
    const controlBefore = window.stateSignature(window.state);
    const validPreview = window.validateCloudRestorePreview(buildValidBundle());
    const controlAccept = {
      attachmentCount: validPreview.attachmentCount,
      noteCount: validPreview.noteCount,
      totalBytes: validPreview.totalBytes,
      stateUnchanged: window.stateSignature(window.state) === controlBefore,
      attachmentAbsent: !(await window.getAttachmentRecord(ATTACHMENT_ID)),
      downloads
    };

    // 복원 단계 실패 시 무변경(롤백) 계약
    const rollbackBefore = window.stateSignature(window.state);
    let rollbackError = "";
    try { await window.restoreVerifiedCloudSnapshot(window.validateCloudRestorePreview(buildValidBundle())); }
    catch (error) { rollbackError = String(error && error.message || error); }
    const rollback = {
      threw: rollbackError !== "",
      message: rollbackError,
      stateUnchanged: window.stateSignature(window.state) === rollbackBefore,
      attachmentAbsent: !(await window.getAttachmentRecord(ATTACHMENT_ID)),
      downloadAttempts: downloads,
      persisted: await (async () => {
        const stored = window.migrateState(await window.idbGet("app_state", "root"));
        return stored ? window.stateSignature(stored) === rollbackBefore : false;
      })()
    };

    // 음성 대조 B: 정상 경로에서는 실제로 복원이 일어나야 한다.
    window.noteplusCloud.downloadAttachment = async () => { downloads += 1; return new Blob([new Uint8Array(10)], {type: "image/png"}); };
    const successBefore = window.stateSignature(window.state);
    const restored = await window.restoreVerifiedCloudSnapshot(window.validateCloudRestorePreview(buildValidBundle()));
    const controlRestore = {
      noteCount: restored.noteCount,
      attachmentCount: restored.attachmentCount,
      stateChanged: window.stateSignature(window.state) !== successBefore,
      attachmentPresent: !!(await window.getAttachmentRecord(ATTACHMENT_ID)),
      noteRestored: window.state.notes.some(note => note.id === "note_guard_0001")
    };

    return {rejected, controlAccept, rollback, controlRestore};
  });

  const groups = {broken_json: 0, format_mismatch: 0, attachment_meta_mismatch: 0};
  for (const item of result.rejected) {
    assert.equal(item.threw, true, `${item.name}: 손상된 manifest가 차단되지 않았습니다.`);
    assert.notEqual(item.message, "", `${item.name}: 차단 사유가 비어 있습니다.`);
    assert.equal(item.stateUnchanged, true, `${item.name}: 노트 상태가 변경되었습니다.`);
    assert.equal(item.attachmentAbsent, true, `${item.name}: 첨부 저장소가 변경되었습니다.`);
    assert.equal(item.downloads, 0, `${item.name}: 차단 전에 첨부를 내려받았습니다.`);
    groups[item.group] += 1;
  }
  assert.ok(groups.broken_json >= 3, "깨진 JSON 사례가 부족합니다.");
  assert.ok(groups.format_mismatch >= 4, "형식 불일치 사례가 부족합니다.");
  assert.ok(groups.attachment_meta_mismatch >= 8, "첨부 메타데이터 불일치 사례가 부족합니다.");

  assert.equal(result.controlAccept.attachmentCount, 1, "음성 대조: 정상 manifest가 거부되었습니다.");
  assert.equal(result.controlAccept.totalBytes, 10);
  assert.equal(result.controlAccept.stateUnchanged, true, "미리보기 검증만으로 상태가 바뀌었습니다.");
  assert.equal(result.controlAccept.attachmentAbsent, true, "미리보기 검증만으로 첨부가 저장되었습니다.");
  assert.equal(result.controlAccept.downloads, 0, "미리보기 검증 단계에서 첨부를 내려받았습니다.");

  assert.equal(result.rollback.threw, true, "복원 실패가 예외로 보고되지 않았습니다.");
  assert.equal(result.rollback.stateUnchanged, true, "복원 실패 후 메모리 상태가 원복되지 않았습니다.");
  assert.equal(result.rollback.persisted, true, "복원 실패 후 저장된 상태가 원복되지 않았습니다.");
  assert.equal(result.rollback.attachmentAbsent, true, "복원 실패 후 첨부가 남았습니다.");
  assert.ok(result.rollback.downloadAttempts >= 1, "복원 단계에 도달하지 못했습니다.");

  assert.equal(result.controlRestore.stateChanged, true, "음성 대조: 정상 경로에서 복원이 일어나지 않았습니다.");
  assert.equal(result.controlRestore.attachmentPresent, true, "음성 대조: 정상 경로에서 첨부가 저장되지 않았습니다.");
  assert.equal(result.controlRestore.noteRestored, true, "음성 대조: 정상 경로에서 노트가 복원되지 않았습니다.");
  assert.equal(result.controlRestore.attachmentCount, 1);

  console.log(JSON.stringify({
    ok: true,
    app: "노트앱_v16.html",
    contract: "restore-manifest-corruption-guard-v1",
    rejectedCases: result.rejected.length,
    groups,
    everyCaseUnchanged: true,
    downloadsBeforeBlock: 0,
    rollbackVerified: true,
    negativeControls: {previewAccepted: true, restoreSucceeded: true}
  }, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
