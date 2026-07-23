import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const v16 = fs.readFileSync(path.join(root, "노트앱_v16.html"), "utf8");
const v17 = fs.readFileSync(path.join(root, "노트앱_v17.html"), "utf8");
const sourceMarker = '<script src="firebase-config.js"></script>';
const v17Marker = '<script src="firebase-config-v17.js"></script>';

assert.match(v16, new RegExp(sourceMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "v16 must retain its original null-config script");
assert.match(v17, /const source = "노트앱_v16\.html"/, "v17 must load the preserved v16 source");
assert.match(v17, /fetch\(source, \{cache:"no-store"\}\)/, "v17 must request a fresh source");
assert.match(v17, /const closeScriptTag = "<" \+ "\/script>"/, "v17 must keep script closing tags out of its inline source");
assert.match(v17, /firebase-config-v17\.js/, "v17 must inject only its versioned Firebase config");
assert.match(v17, /noteplus-v17\.webmanifest/, "v17 must use its own install manifest");
assert.match(v17, /sw-v17\.js/, "v17 must use its own service worker");
assert.match(v17, /original\.replace\(oldConfig, newConfig\)/, "v17 must replace only the explicit config marker");
assert.match(v17, /기존 데이터는 변경되지 않았습니다/, "v17 must make loader failures honest");
for (const match of v17.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "noteplus-v17.webmanifest"), "utf8"));
const worker = fs.readFileSync(path.join(root, "sw-v17.js"), "utf8");
assert.equal(manifest.start_url, "./노트앱_v17.html", "installed v17 must reopen v17");
assert.match(worker, /noteplusp-v17-shell-1/, "v17 must not reuse v16 cache");
assert.match(worker, /firebase-config-v17\.js/, "v17 service worker must cache its own config");
assert.match(worker, /cache:"no-store"/, "v17 config must refresh when online");
console.log("PASS v17 versioned loader preserves v16 and injects v17 config only");
