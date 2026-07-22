#!/usr/bin/env node
/*
 * Read-only Firebase activation readiness check for NotePlusP.
 * It never contacts Firebase, signs a user in, edits project files, or deploys rules.
 * Usage: node tools/firebase-activation-diagnostics-v1.mjs [path-to-firebase-config.js]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_FIELDS = ["apiKey", "authDomain", "projectId", "storageBucket", "appId"];

export function validateFirebaseConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {ok: false, reason: "Firebase Web 설정이 아직 입력되지 않았습니다."};
  }
  const missing = REQUIRED_FIELDS.filter(key => typeof value[key] !== "string" || !value[key].trim() || /YOUR_|REPLACE|CHANGE_ME/i.test(value[key]));
  if (missing.length) return {ok: false, reason: `필수 항목 누락 또는 예시 값: ${missing.join(", ")}`};
  if (!/^[a-z0-9.-]+$/i.test(value.authDomain)) return {ok: false, reason: "authDomain 형식이 올바르지 않습니다."};
  if (!/^[a-z0-9._:-]+$/i.test(value.projectId)) return {ok: false, reason: "projectId 형식이 올바르지 않습니다."};
  if (!/^[a-z0-9._-]+\.(appspot\.com|firebasestorage\.app)$/i.test(value.storageBucket)) return {ok: false, reason: "storageBucket은 appspot.com 또는 firebasestorage.app 버킷이어야 합니다."};
  if (value.mobileAuthMode && !["popup", "redirect"].includes(value.mobileAuthMode)) return {ok: false, reason: "mobileAuthMode는 popup 또는 redirect만 허용됩니다."};
  return {ok: true, reason: "Firebase Web 설정 형식이 앱의 허용 규칙과 일치합니다."};
}

export function readConfigFile(configPath) {
  const sandbox = {window: {NOTEPLUS_FIREBASE_CONFIG: undefined}};
  vm.runInNewContext(fs.readFileSync(configPath, "utf8"), sandbox, {filename: configPath, timeout: 1000});
  return sandbox.window.NOTEPLUS_FIREBASE_CONFIG;
}

export function inspectActivation(root, configPath) {
  const config = readConfigFile(configPath);
  const configResult = validateFirebaseConfig(config);
  const firebaseJsonPath = path.join(root, "firebase.json");
  const rulesPath = path.join(root, "firebase.storage.rules");
  const firebaseJson = fs.existsSync(firebaseJsonPath) ? JSON.parse(fs.readFileSync(firebaseJsonPath, "utf8")) : null;
  const rules = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, "utf8") : "";
  const rulesResult = Boolean(
    firebaseJson && firebaseJson.storage && firebaseJson.storage.rules === "firebase.storage.rules" &&
    /match \/users\/\{uid\}\/current\.json/.test(rules) &&
    /match \/users\/\{uid\}\/snapshots\/\{snapshotId\}\/attachments\/\{attachmentId\}/.test(rules) &&
    /allow delete: if false;/.test(rules) &&
    /match \/\{allPaths=\*\*\}/.test(rules)
  );
  return {
    config: configResult,
    rules: rulesResult,
    readyForFirebaseConsole: configResult.ok && rulesResult,
    externalSteps: [
      "Firebase 프로젝트와 Web App을 만들고 firebase-config.js에 공개 Web 설정을 입력",
      "Authentication에서 Google 공급자를 켜고 hanksleekorea-boop.github.io를 승인 도메인에 추가",
      "Cloud Storage를 활성화하고 필요한 요금제를 확인",
      "Firebase CLI에 로그인한 소유자가 firebase deploy --only storage로 규칙을 게시",
      "PC의 실제 노트로 백업 후, 휴대폰에서 로그인·미리보기·명시 복원·재접속을 검증"
    ]
  };
}

function main() {
  const relative = process.argv[2] || "firebase-config.js";
  const configPath = path.resolve(ROOT, relative);
  if (!fs.existsSync(configPath)) throw new Error(`설정 파일을 찾을 수 없습니다: ${configPath}`);
  const result = inspectActivation(ROOT, configPath);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.readyForFirebaseConsole ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
