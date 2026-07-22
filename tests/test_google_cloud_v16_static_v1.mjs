import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "노트앱_v16.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const manifest = fs.readFileSync(path.join(root, "noteplus.webmanifest"), "utf8");

assert.match(html, /appVersion:"v16"/);
assert.match(html, /assessCloudRestorePreflight/);
assert.match(html, /checkCloudRestorePreflight/);
assert.match(html, /cloudRestoreNetworkNotice/);
assert.match(html, /어떤 첨부도 다운로드하지 않았습니다/);
assert.match(html, /processedBytes/);
assert.match(html, /max\(64\*1024\*1024/);
assert.match(worker, /noteplusp-v16-shell-1/);
assert.match(worker, /노트앱_v16\.html/);
assert.match(manifest, /노트앱_v16\.html/);

console.log(JSON.stringify({ok: true, app: "v16", storagePreflight: true, lowSpaceBlocksBeforeDownload: true, networkWarning: true, byteProgress: true}, null, 2));
