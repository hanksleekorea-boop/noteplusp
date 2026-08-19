import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {findPublicWebKeyLocations, inspectActivation, validateFirebaseConfig} from "../tools/firebase-activation-diagnostics-v1.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "noteplus-firebase-"));
try {
  assert.equal(validateFirebaseConfig(null).ok, false);
  assert.equal(validateFirebaseConfig({apiKey: "YOUR_KEY"}).ok, false);
  const fakePublicWebKey = "AI" + "za" + "x".repeat(35);
  const valid = {
    apiKey: fakePublicWebKey, authDomain: "example-123.firebaseapp.com", projectId: "example-123",
    storageBucket: "example-123.firebasestorage.app", appId: "1:123:web:abc", messagingSenderId: "123", mobileAuthMode: "popup"
  };
  assert.equal(validateFirebaseConfig(valid).ok, true);
  assert.equal(validateFirebaseConfig({...valid, mobileAuthMode: "invalid"}).ok, false);
  assert.match(validateFirebaseConfig({...valid, authDomain: "not a domain"}).reason, /authDomain/);
  assert.match(validateFirebaseConfig({...valid, projectId: "bad project id"}).reason, /projectId/);
  assert.match(validateFirebaseConfig({...valid, storageBucket: "example.invalid"}).reason, /storageBucket/);
  assert.match(validateFirebaseConfig({...valid, apiKey: "public-key"}).reason, /apiKey/);
  assert.match(validateFirebaseConfig({...valid, authDomain: "other.firebaseapp.com"}).reason, /같은 Firebase 프로젝트/);
  assert.match(validateFirebaseConfig({...valid, storageBucket: "other.firebasestorage.app"}).reason, /같은 Firebase 프로젝트/);
  assert.match(validateFirebaseConfig({...valid, appId: "1:999:web:abc"}).reason, /같은 Firebase Web App/);
  assert.match(validateFirebaseConfig({...valid, appId: "YOUR_PUBLIC_WEB_APP_ID"}).reason, /예시 값/);
  assert.match(validateFirebaseConfig({...valid, apiKey: ""}).reason, /필수 항목/);
  const configPath = path.join(temp, "firebase-config-v17.js");
  fs.writeFileSync(configPath, `window.NOTEPLUS_FIREBASE_CONFIG = ${JSON.stringify(valid)};`, "utf8");
  fs.writeFileSync(path.join(temp, "firebase.json"), JSON.stringify({storage: {rules: "firebase.storage.rules"}}), "utf8");
  fs.copyFileSync(path.join(root, "firebase.storage.rules"), path.join(temp, "firebase.storage.rules"));
  assert.deepEqual(findPublicWebKeyLocations(temp, fakePublicWebKey), ["firebase-config-v17.js"]);
  const result = inspectActivation(temp, configPath);
  assert.equal(result.config.ok, true);
  assert.equal(result.rules, true);
  assert.equal(result.readyForFirebaseConsole, true);
  assert.equal(result.productionPilotStatus, "EXTERNAL_REVIEW_REQUIRED");
  assert.equal(result.publicWebKeyReview.rawValueIncluded, false);
  assert.equal(result.publicWebKeyReview.singleApprovedLocation, true);
  assert.deepEqual(result.publicWebKeyReview.locations, ["firebase-config-v17.js"]);
  assert.equal(JSON.stringify(result).includes(fakePublicWebKey), false);
  assert.equal(result.externalSteps.length, 6);
  fs.writeFileSync(path.join(temp, "duplicate.md"), `duplicate=${fakePublicWebKey}`, "utf8");
  const duplicate = inspectActivation(temp, configPath);
  assert.equal(duplicate.publicWebKeyReview.singleApprovedLocation, false);
  assert.equal(duplicate.readyForFirebaseConsole, false);
  assert.equal(duplicate.productionPilotStatus, "BLOCKED_LOCAL_CONFIG");
  assert.deepEqual(duplicate.publicWebKeyReview.locations, ["duplicate.md", "firebase-config-v17.js"]);
  assert.equal(JSON.stringify(duplicate).includes(fakePublicWebKey), false);
  const rules = fs.readFileSync(path.join(root, "firebase.storage.rules"), "utf8");
  assert.match(rules, /function owns\(uid\)\s*\{\s*return request\.auth != null && request\.auth\.uid == uid;/);
  assert.match(rules, /match \/users\/\{uid\}\/current\.json/);
  assert.match(rules, /match \/users\/\{uid\}\/snapshots\/\{snapshotId\}\/manifest\.json/);
  assert.match(rules, /match \/users\/\{uid\}\/snapshots\/\{snapshotId\}\/attachments\/\{attachmentId\}/);
  assert.match(rules, /allow delete: if false;/);
  assert.match(rules, /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.doesNotMatch(rules, /allow\s+(?:read|write|read, write)\s*:\s*if\s+true/);
  console.log("PASS firebase activation packet: config binding, key dedupe, redacted output, rules, no-deploy readiness");
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
