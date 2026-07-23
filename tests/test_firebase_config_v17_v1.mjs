import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadConfig(name) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, name), "utf8"), sandbox, { filename: name });
  return sandbox.window.NOTEPLUS_FIREBASE_CONFIG;
}

assert.equal(loadConfig("firebase-config.js"), null, "v16 must keep its existing null cloud configuration");
const config = loadConfig("firebase-config-v17.js");
assert.deepEqual(Object.keys(config).sort(), ["apiKey", "appId", "authDomain", "messagingSenderId", "mobileAuthMode", "projectId", "storageBucket"].sort());
assert.equal(config.projectId, "noteplusp-d1078");
assert.equal(config.authDomain, "noteplusp-d1078.firebaseapp.com");
assert.equal(config.storageBucket, "noteplusp-d1078.firebasestorage.app");
assert.match(config.apiKey, /^AIza[\w-]{20,}$/);
assert.match(config.appId, /^1:539219859603:web:[a-f0-9]+$/);
assert.equal(config.mobileAuthMode, "popup");
console.log(JSON.stringify({ ok: true, v16Config: "null", v17Project: config.projectId, v17ConfigFields: Object.keys(config).length }, null, 2));
