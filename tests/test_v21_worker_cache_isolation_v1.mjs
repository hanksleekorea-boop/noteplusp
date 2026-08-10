import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worker = fs.readFileSync(path.join(root, "sw-v21.js"), "utf8");
assert.match(worker, /const CACHE="noteplusp-v21-shell-2"/);
assert.match(worker, /key\.startsWith\("noteplusp-v21-"\)&&key!==CACHE/, "v21 activation must only remove old v21 caches");
assert.doesNotMatch(worker, /filter\(key=>key!==CACHE\)/, "v21 activation must not remove the default v16 cache");
assert.match(worker, /NOTEPLUS_UPDATE_READY/, "v21 activation must tell open pages that an update is ready");
assert.match(worker, /노트앱_v21\.html.*노트앱_v16\.html.*cache:"no-store"/s, "v21 app documents must prefer fresh network responses");
const app = fs.readFileSync(path.join(root, "노트앱_v16.html"), "utf8");
assert.match(app, /NOTEPLUS_UPDATE_READY/);
assert.match(app, /안전하게 새로고침/);
assert.match(app, /기존 노트와 설정은 그대로 유지됩니다/);
const loader = fs.readFileSync(path.join(root, "노트앱_v21.html"), "utf8");
assert.match(loader, /navigator\.serviceWorker\.register\("\.\/sw-v21\.js"\)/, "v21 loader must select the v21 update-aware worker");
console.log("PASS v21 worker isolates caches, refreshes app documents, and offers a safe update action");
