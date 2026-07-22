import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "노트앱_v14.html"), "utf8");
const cloud = fs.readFileSync(path.join(root, "noteplus-cloud-v2.js"), "utf8");
const config = fs.readFileSync(path.join(root, "firebase-config.js"), "utf8");
const rules = fs.readFileSync(path.join(root, "firebase.storage.rules"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert.match(config, /NOTEPLUS_FIREBASE_CONFIG\s*=\s*null/);
assert.match(html, /noteplus-cloud-v2\.js/);
assert.match(html, /id="cloudRestoreBtn"/);
assert.match(html, /validateCloudRestorePreview/);
assert.match(html, /Google 복원 전 자동 보관/);
assert.match(html, /referencedAttachmentIdsIncludingSnapshots/);
assert.match(cloud, /const FIREBASE_VERSION = "12\.16\.0"/);
assert.match(cloud, /downloadCurrentSnapshot/);
assert.match(cloud, /downloadAttachment\(snapshotId, descriptor, accountUid\)/);
assert.match(cloud, /user\.uid !== accountUid/);
assert.match(cloud, /auth\.currentUser\.uid !== uid/);
assert.match(cloud, /popup-blocked/);
assert.match(cloud, /quota-exceeded/);
assert.match(cloud, /completedBytes \+ transferred/);
assert.doesNotMatch(cloud, /deleteObject|deleteDoc|localStorage\.removeItem|indexedDB\.deleteDatabase/);
assert.match(rules, /request\.auth != null && request\.auth\.uid == uid/);
assert.match(rules, /allow delete: if false/g);
assert.match(worker, /firebase-config\.js/);
assert.match(worker, /fetch\(event\.request, \{cache:"no-store"\}\)/);
assert.match(worker, /noteplusp-v14-shell-1/);

console.log(JSON.stringify({ok: true, app: "v14", configDisabledByDefault: true, restorePreview: true, accountBinding: true, friendlyErrors: true, byteProgress: true, uidRules: true, configNetworkFirst: true}, null, 2));
