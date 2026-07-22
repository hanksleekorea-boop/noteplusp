import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "노트앱_v15.html"), "utf8");
const cloud = fs.readFileSync(path.join(root, "noteplus-cloud-v3.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const manifest = fs.readFileSync(path.join(root, "noteplus.webmanifest"), "utf8");
const configExample = fs.readFileSync(path.join(root, "firebase-config.example.js"), "utf8");

assert.match(html, /Google 계정 보호 · PC·모바일 베타/);
assert.match(html, /noteplus-cloud-v3\.js/);
assert.match(html, /appVersion:"v15"/);
assert.match(html, /isAuthBusy/);
assert.match(cloud, /const VERSION = "noteplus-cloud-v3"/);
assert.match(cloud, /signInWithPopup/);
assert.match(cloud, /signInWithRedirect/);
assert.match(cloud, /getRedirectResult/);
assert.match(cloud, /browserLocalPersistence/);
assert.match(cloud, /mobileAuthMode === "redirect"/);
assert.match(cloud, /unauthorized-domain/);
assert.match(cloud, /web-storage-unsupported/);
assert.match(cloud, /로그인만으로는 노트가 전송되지 않습니다/);
assert.doesNotMatch(cloud, /localStorage\.removeItem|indexedDB\.deleteDatabase|deleteObject/);
assert.match(worker, /noteplusp-v15-shell-1/);
assert.match(worker, /노트앱_v15\.html/);
assert.match(manifest, /노트앱_v15\.html/);
assert.match(configExample, /mobileAuthMode: "popup"/);

console.log(JSON.stringify({ok: true, app: "v15", mobilePopupDefault: true, optionalRedirect: true, redirectReturnHandled: true, localDataUntouchedByAuth: true}, null, 2));
