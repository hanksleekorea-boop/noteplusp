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
const TEXT_EXTENSIONS = new Set([".cmd", ".html", ".js", ".json", ".md", ".mjs", ".ps1", ".txt", ".yaml", ".yml"]);
const SKIP_DIRECTORIES = new Set([".git", "node_modules"]);

function normalizeRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

export function findPublicWebKeyLocations(root, apiKey) {
  if (typeof apiKey !== "string" || !apiKey) return [];
  const matches = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile() || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      if (fs.readFileSync(fullPath, "utf8").includes(apiKey)) matches.push(normalizeRelative(root, fullPath));
    }
  };
  visit(root);
  return matches.sort();
}

export function validateFirebaseConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {ok: false, reason: "Firebase Web 설정이 아직 입력되지 않았습니다."};
  }
  const missing = REQUIRED_FIELDS.filter(key => typeof value[key] !== "string" || !value[key].trim() || /YOUR_|REPLACE|CHANGE_ME/i.test(value[key]));
  if (missing.length) return {ok: false, reason: `필수 항목 누락 또는 예시 값: ${missing.join(", ")}`};
  if (!/^[a-z0-9.-]+$/i.test(value.authDomain)) return {ok: false, reason: "authDomain 형식이 올바르지 않습니다."};
  if (!/^[a-z0-9._:-]+$/i.test(value.projectId)) return {ok: false, reason: "projectId 형식이 올바르지 않습니다."};
  if (!/^[a-z0-9._-]+\.(appspot\.com|firebasestorage\.app)$/i.test(value.storageBucket)) return {ok: false, reason: "storageBucket은 appspot.com 또는 firebasestorage.app 버킷이어야 합니다."};
  if (!/^AIza[\w-]{35}$/.test(value.apiKey)) return {ok: false, reason: "apiKey가 Firebase Web 설정의 공개 키 형식과 일치하지 않습니다."};
  if (value.authDomain !== `${value.projectId}.firebaseapp.com`) return {ok: false, reason: "authDomain과 projectId가 같은 Firebase 프로젝트를 가리키지 않습니다."};
  if (!value.storageBucket.startsWith(`${value.projectId}.`)) return {ok: false, reason: "storageBucket과 projectId가 같은 Firebase 프로젝트를 가리키지 않습니다."};
  if (value.messagingSenderId && !value.appId.startsWith(`1:${value.messagingSenderId}:web:`)) return {ok: false, reason: "appId와 messagingSenderId가 같은 Firebase Web App을 가리키지 않습니다."};
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
  const apiKeyLocations = configResult.ok ? findPublicWebKeyLocations(root, config.apiKey) : [];
  const expectedConfigPath = normalizeRelative(root, configPath);
  const publicWebKeyReview = {
    present: configResult.ok,
    rawValueIncluded: false,
    locations: apiKeyLocations,
    singleApprovedLocation: configResult.ok && apiKeyLocations.length === 1 && apiKeyLocations[0] === expectedConfigPath,
    authorizationBoundary: "Firebase Security Rules와 App Check가 데이터 접근을 통제하며 API 키는 프로젝트 식별에만 사용",
    externalRestrictionStatus: configResult.ok ? "REVIEW_REQUIRED" : "NOT_APPLICABLE",
    externalChecks: [
      "Google Cloud Console에서 이 키가 Firebase 관련 API에만 제한되고 다른 API가 허용되지 않았는지 확인",
      "웹사이트 제한에 https://hanksleekorea-boop.github.io 및 https://hanksleekorea-boop.github.io/*가 포함됐는지 확인",
      "Firebase Console에 hanksleekorea-boop.github.io 승인 도메인이 등록됐는지 확인",
      "게시된 Storage Rules와 App Check 적용 여부를 실제 프로젝트에서 확인"
    ]
  };
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
    publicWebKeyReview,
    readyForFirebaseConsole: configResult.ok && rulesResult && publicWebKeyReview.singleApprovedLocation,
    productionPilotStatus: configResult.ok && rulesResult && publicWebKeyReview.singleApprovedLocation ? "EXTERNAL_REVIEW_REQUIRED" : "BLOCKED_LOCAL_CONFIG",
    externalSteps: [
      "Firebase 프로젝트와 Web App을 만들고 전용 설정 파일에 공개 Web 설정을 입력",
      "Google Cloud Console에서 Firebase 전용 API 제한과 GitHub Pages 웹사이트 제한을 읽기 확인",
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
