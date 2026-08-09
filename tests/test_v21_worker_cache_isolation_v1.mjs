import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worker = fs.readFileSync(path.join(root, "sw-v21.js"), "utf8");
assert.match(worker, /const CACHE="noteplusp-v21-shell-1"/);
assert.match(worker, /key\.startsWith\("noteplusp-v21-"\)&&key!==CACHE/, "v21 activation must only remove old v21 caches");
assert.doesNotMatch(worker, /filter\(key=>key!==CACHE\)/, "v21 activation must not remove the default v16 cache");
console.log("PASS v21 worker keeps non-v21 caches while retiring only prior v21 caches");
