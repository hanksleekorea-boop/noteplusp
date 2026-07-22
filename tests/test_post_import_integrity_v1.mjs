import assert from "node:assert/strict";
import fs from "node:fs";

const cdpHttp = process.env.NOTEPLUS_DESKTOP_CDP || "http://127.0.0.1:9222";
const expectedNotes = Number(process.env.NOTEPLUS_EXPECTED_NOTES || 1950);
const expectedAttachments = Number(process.env.NOTEPLUS_EXPECTED_ATTACHMENTS || 2272);
const outputPath = process.env.NOTEPLUS_AUDIT_OUTPUT || "";
const publicOrigin = "https://hanksleekorea-boop.github.io/noteplusp/";

class CdpTarget {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
    };
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error("Chrome CDP WebSocket 연결 실패"));
    });
  }

  send(method, params = {}, timeout = 120000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: 응답 시간 초과`));
      }, timeout);
      this.pending.set(id, {
        method,
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); }
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "브라우저 감사 실행 실패");
    }
    return response.result?.value;
  }

  close() {
    try { this.ws?.close(); } catch {}
  }
}

async function getTargets() {
  let response;
  try {
    response = await fetch(`${cdpHttp}/json/list`);
  } catch {
    throw new Error(`Chrome 원격 디버깅에 연결할 수 없습니다: ${cdpHttp}`);
  }
  assert.equal(response.ok, true, "Chrome CDP 대상 목록을 읽을 수 있어야 합니다");
  return response.json();
}

const targets = await getTargets();
const target = targets.find(item => item.type === "page" && String(item.url || "").startsWith(publicOrigin));
assert.ok(target?.webSocketDebuggerUrl, "공개 노트플러스P 탭을 찾지 못했습니다. 가져오기 완료 화면을 닫지 마세요.");

const cdp = new CdpTarget(target.webSocketDebuggerUrl);
await cdp.connect();

try {
  const audit = await cdp.evaluate(`(async () => {
    if (!window.storageReady || typeof window.state !== "object") throw new Error("노트플러스P 저장 준비 전입니다");
    await window.storageReady;
    if (!window.noteDb) throw new Error("IndexedDB 모드가 아닙니다");

    function readStore(storeName) {
      return new Promise((resolve, reject) => {
        const tx = window.noteDb.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const rows = [];
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          if (storeName === "attachment_blob") rows.push({ id: String(cursor.key), size: Number(cursor.value?.blob?.size || 0) });
          else rows.push(cursor.value);
          cursor.continue();
        };
        req.onerror = () => reject(req.error || new Error(storeName + " 읽기 실패"));
        tx.oncomplete = () => resolve(rows);
        tx.onerror = () => reject(tx.error || new Error(storeName + " 트랜잭션 실패"));
      });
    }

    const active = Array.isArray(window.state.notes) ? window.state.notes : [];
    const trash = Array.isArray(window.state.trash) ? window.state.trash : [];
    const allNotes = active.concat(trash);
    const referenced = new Set();
    for (const note of allNotes) {
      for (const id of Array.isArray(note.attachmentIds) ? note.attachmentIds : []) {
        if (typeof id === "string") referenced.add(id);
      }
    }

    const [metas, blobs] = await Promise.all([readStore("attachment_meta"), readStore("attachment_blob")]);
    const metaIds = new Set(metas.map(item => String(item?.id || "")).filter(Boolean));
    const blobIds = new Set(blobs.map(item => item.id));
    const missingMeta = [...referenced].filter(id => !metaIds.has(id));
    const missingBlob = [...referenced].filter(id => !blobIds.has(id));
    const orphanMeta = [...metaIds].filter(id => !referenced.has(id));
    const orphanBlob = [...blobIds].filter(id => !referenced.has(id));
    const mimeCounts = {};
    for (const meta of metas) {
      const mime = String(meta?.mime || "unknown").toLowerCase().slice(0, 120);
      mimeCounts[mime] = (mimeCounts[mime] || 0) + 1;
    }

    const report = window.normalizeImportReport ? window.normalizeImportReport(window.state.lastImportReport) : window.state.lastImportReport;
    return {
      format: "noteplusp-post-import-integrity-v1",
      checkedAt: new Date().toISOString(),
      appPath: location.pathname,
      schema: Number(window.state.schema || 0),
      persistenceMode: String(window.persistenceMode || "unknown"),
      activeNoteCount: active.length,
      trashNoteCount: trash.length,
      notebookCount: Array.isArray(window.state.notebooks) ? window.state.notebooks.length : 0,
      referencedAttachmentCount: referenced.size,
      attachmentMetaCount: metaIds.size,
      attachmentBlobCount: blobIds.size,
      attachmentBlobBytes: blobs.reduce((sum, item) => sum + item.size, 0),
      missingMetaCount: missingMeta.length,
      missingBlobCount: missingBlob.length,
      orphanMetaCount: orphanMeta.length,
      orphanBlobCount: orphanBlob.length,
      mimeCounts,
      lastImport: report ? {
        outcome: report.outcome,
        foundNoteCount: report.foundNoteCount,
        importedNoteCount: report.importedNoteCount,
        newNoteCount: report.newNoteCount,
        mergedNoteCount: report.mergedNoteCount,
        skippedNoteCount: report.skippedNoteCount,
        attachmentCount: report.attachmentCount,
        attachmentErrorCount: report.attachmentErrorCount,
        attachmentIssueCount: Array.isArray(report.attachmentIssues) ? report.attachmentIssues.length : 0,
        persistenceLimited: Boolean(report.persistenceLimited),
        completenessStatus: report.completenessVerdict?.status || "unknown",
        processedFileCount: report.processedFileCount,
        failedFileCount: Array.isArray(report.failedFiles) ? report.failedFiles.length : 0
      } : null
    };
  })()`);

  assert.equal(
    audit.appPath.includes("노트앱_v12.html") || audit.appPath.toLowerCase().includes("%eb%85%b8%ed%8a%b8%ec%95%b1_v12.html") || audit.appPath.endsWith("/noteplusp/"),
    true,
    "감사 대상이 공개 v12여야 합니다"
  );
  assert.equal(audit.schema, 5, "schema 5여야 합니다");
  assert.equal(audit.persistenceMode, "idb", "최종 가져오기는 IndexedDB에 저장돼야 합니다");
  assert.ok(audit.lastImport, "최종 가져오기 보고서가 있어야 합니다");
  assert.equal(audit.lastImport.foundNoteCount, expectedNotes, "ENEX 발견 노트 수가 원본과 일치해야 합니다");
  assert.equal(audit.lastImport.importedNoteCount, expectedNotes, "가져온 노트 수가 원본과 일치해야 합니다");
  assert.equal(audit.lastImport.attachmentCount, expectedAttachments, "가져온 첨부 수가 원본과 일치해야 합니다");
  assert.equal(audit.lastImport.attachmentErrorCount, 0, "첨부 오류가 없어야 합니다");
  assert.equal(audit.lastImport.attachmentIssueCount, 0, "제외 첨부가 없어야 합니다");
  assert.equal(audit.lastImport.persistenceLimited, false, "세션 한정 저장이면 안 됩니다");
  assert.equal(audit.missingMetaCount, 0, "참조 첨부 메타 누락이 없어야 합니다");
  assert.equal(audit.missingBlobCount, 0, "참조 첨부 Blob 누락이 없어야 합니다");

  const result = JSON.stringify(audit, null, 2);
  if (outputPath) fs.writeFileSync(outputPath, result + "\n", "utf8");
  process.stdout.write(result + "\n");
} finally {
  cdp.close();
}
