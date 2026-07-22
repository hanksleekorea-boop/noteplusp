import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlName = fs.readdirSync(root).find(name => name.endsWith("_v13.html"));
assert.ok(htmlName, "v13 app missing");
const html = fs.readFileSync(path.join(root, htmlName), "utf8");
const config = fs.readFileSync(path.join(root, "firebase-config.js"), "utf8");
const cloud = fs.readFileSync(path.join(root, "noteplus-cloud-v1.js"), "utf8");
const rules = fs.readFileSync(path.join(root, "firebase.storage.rules"), "utf8");

assert.match(config, /NOTEPLUS_FIREBASE_CONFIG\s*=\s*null/);
assert.match(html, /<script src="firebase-config\.js"><\/script>/);
assert.match(html, /<script type="module" src="noteplus-cloud-v1\.js"><\/script>/);
assert.match(html, /로그인만으로는 노트가 전송되지 않습니다/);
assert.match(cloud, /firebasejs\/\$\{FIREBASE_VERSION\}\/firebase-app\.js/);
assert.match(cloud, /const FIREBASE_VERSION = "12\.16\.0"/);
assert.doesNotMatch(cloud, /deleteObject|deleteDoc|localStorage\.removeItem|indexedDB\.deleteDatabase/);
assert.match(cloud, /users\/\$\{uid\}\/snapshots\/\$\{payload\.snapshotId\}/);
assert.match(cloud, /users\/\$\{uid\}\/current\.json/);
assert.ok(cloud.indexOf("manifest.json") < cloud.lastIndexOf("current.json"), "pointer must be committed after manifest");
assert.match(rules, /request\.auth != null && request\.auth\.uid == uid/);
assert.match(rules, /allow delete: if false/g);
assert.match(rules, /match \/\{allPaths=\*\*\}[\s\S]*allow read, write: if false/);
assert.doesNotMatch(rules, /allow read, write: if true/);

console.log(JSON.stringify({ok: true, app: htmlName, configDefault: "disabled", pinnedFirebase: "12.16.0", uidIsolation: true, deleteDenied: true, pointerLast: true}, null, 2));
