import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {inspectActivation, validateFirebaseConfig} from "../tools/firebase-activation-diagnostics-v1.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "noteplus-firebase-"));
try {
  assert.equal(validateFirebaseConfig(null).ok, false);
  assert.equal(validateFirebaseConfig({apiKey: "YOUR_KEY"}).ok, false);
  const valid = {
    apiKey: "public-key", authDomain: "example.firebaseapp.com", projectId: "example-123",
    storageBucket: "example-123.firebasestorage.app", appId: "1:123:web:abc", mobileAuthMode: "popup"
  };
  assert.equal(validateFirebaseConfig(valid).ok, true);
  assert.equal(validateFirebaseConfig({...valid, mobileAuthMode: "invalid"}).ok, false);
  assert.match(validateFirebaseConfig({...valid, authDomain: "not a domain"}).reason, /authDomain/);
  assert.match(validateFirebaseConfig({...valid, projectId: "bad project id"}).reason, /projectId/);
  assert.match(validateFirebaseConfig({...valid, storageBucket: "example.invalid"}).reason, /storageBucket/);
  assert.match(validateFirebaseConfig({...valid, appId: "YOUR_PUBLIC_WEB_APP_ID"}).reason, /예시 값/);
  assert.match(validateFirebaseConfig({...valid, apiKey: ""}).reason, /필수 항목/);
  const configPath = path.join(temp, "config.js");
  fs.writeFileSync(configPath, `window.NOTEPLUS_FIREBASE_CONFIG = ${JSON.stringify(valid)};`, "utf8");
  const result = inspectActivation(root, configPath);
  assert.equal(result.config.ok, true);
  assert.equal(result.rules, true);
  assert.equal(result.readyForFirebaseConsole, true);
  assert.equal(result.externalSteps.length, 5);
  const rules = fs.readFileSync(path.join(root, "firebase.storage.rules"), "utf8");
  assert.match(rules, /function owns\(uid\)\s*\{\s*return request\.auth != null && request\.auth\.uid == uid;/);
  assert.match(rules, /match \/users\/\{uid\}\/current\.json/);
  assert.match(rules, /match \/users\/\{uid\}\/snapshots\/\{snapshotId\}\/manifest\.json/);
  assert.match(rules, /match \/users\/\{uid\}\/snapshots\/\{snapshotId\}\/attachments\/\{attachmentId\}/);
  assert.match(rules, /allow delete: if false;/);
  assert.match(rules, /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.doesNotMatch(rules, /allow\s+(?:read|write|read, write)\s*:\s*if\s+true/);
  console.log("PASS firebase activation packet: config, rules, no-deploy readiness");
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
