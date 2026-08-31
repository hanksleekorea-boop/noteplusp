import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const historyName = "PROJECT_EVOLUTION_HISTORY.md";
const archiveName = "PROJECT_REUSE_ARCHIVE.md";
const history = fs.readFileSync(path.join(root, historyName), "utf8");
const archive = fs.readFileSync(path.join(root, archiveName), "utf8");
const errors = [];

const requiredHistory = [
  "## 1. 기록 범위와 판정 원칙",
  "## 3. 시대별 기획·개발 진행 이력",
  "## 4. 제품 판별 개발 계보",
  "## 5. 기획 문서 계보",
  "## 6. 현재 개발 방향과 실제 상태",
  "## 7. 계속 갱신하는 규칙",
  "## 8. 변경 로그",
];
const requiredArchive = [
  "## 2. 대체된 기획·운영 문서",
  "## 3. 과거 판과 기술 경로",
  "## 4. 알파 일정에서 제외됐던 항목",
  "## 5. 명시적으로 거부한 제품 방식",
  "## 6. 현재 보류된 기획·기능",
  "## 7. 다른 프로젝트에 바로 재사용할 수 있는 묶음",
  "## 9. 갱신 기록",
];

for (const heading of requiredHistory) if (!history.includes(heading)) errors.push(`history heading missing: ${heading}`);
for (const heading of requiredArchive) if (!archive.includes(heading)) errors.push(`archive heading missing: ${heading}`);

const phases = [...history.matchAll(/^### PH-(\d{2})/gm)].map((match) => match[1]);
const archiveIds = [...archive.matchAll(/\| (RA-\d{3}) \|/g)].map((match) => match[1]);
const reusePacks = [...archive.matchAll(/^### (RP-\d{2})/gm)].map((match) => match[1]);
if (new Set(phases).size < 12) errors.push(`expected at least 12 phases, found ${new Set(phases).size}`);
if (new Set(archiveIds).size < 40) errors.push(`expected at least 40 reusable archive items, found ${new Set(archiveIds).size}`);
if (new Set(reusePacks).size < 6) errors.push(`expected at least 6 reuse packs, found ${new Set(reusePacks).size}`);
if (!history.includes("2026-07-18") || !history.includes("2026-08-31")) errors.push("history date boundary missing");
if (!history.includes("v21") || !history.includes("v22")) errors.push("current public/candidate versions missing");
if (!archive.includes("대체됨") || !archive.includes("범위 제외") || !archive.includes("보류") || !archive.includes("거부")) errors.push("archive status taxonomy incomplete");

function gitNames(args) {
  try {
    return execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const changed = new Set([
  ...gitNames(["diff", "--name-only", "HEAD"]),
  ...gitNames(["diff", "--cached", "--name-only"]),
]);
for (const line of gitNames(["status", "--porcelain"])) {
  const name = line.slice(3).trim().replace(/^"|"$/g, "");
  if (name) changed.add(name.includes(" -> ") ? name.split(" -> ").at(-1) : name);
}
if (gitNames(["rev-parse", "--verify", "HEAD^"]).length || fs.existsSync(path.join(root, ".git"))) {
  for (const name of gitNames(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])) changed.add(name);
}

const watched = [...changed].filter((name) =>
  /^(PRODUCT_PLAN|DEVELOPMENT_PLAN|PROJECT_PLAN|CONTENT_).*\.md$/i.test(name) ||
  /^RELEASE_.*\.md$/i.test(name) ||
  /^노트앱_.*\.html$/u.test(name) ||
  /^noteplus.*\.(js|webmanifest)$/i.test(name) ||
  /^(pricing|privacy|terms|support|status|data-rights)\.html$/i.test(name)
);
const historyTouched = changed.has(historyName) || changed.has(archiveName);
const negativeControls = {
  watchedWithoutHistoryRejected: (() => {
    const sample = new Set(["PRODUCT_PLAN_sample.md"]);
    const sampleWatched = [...sample].some((name) => /^(PRODUCT_PLAN|DEVELOPMENT_PLAN|PROJECT_PLAN|CONTENT_).*\.md$/i.test(name));
    return sampleWatched && !sample.has(historyName) && !sample.has(archiveName);
  })(),
  watchedWithHistoryAccepted: (() => {
    const sample = new Set(["노트앱_sample.html", historyName]);
    const sampleWatched = [...sample].some((name) => /^노트앱_.*\.html$/u.test(name));
    return sampleWatched && (sample.has(historyName) || sample.has(archiveName));
  })(),
};
if (!negativeControls.watchedWithoutHistoryRejected || !negativeControls.watchedWithHistoryAccepted) errors.push("history update negative controls failed");
if (watched.length && !historyTouched) errors.push(`history update required for: ${watched.join(", ")}`);

if (errors.length) {
  console.error(JSON.stringify({ status: "FAIL", errors, phases: new Set(phases).size, archiveItems: new Set(archiveIds).size, reusePacks: new Set(reusePacks).size, negativeControls }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "PASS", phases: new Set(phases).size, archiveItems: new Set(archiveIds).size, reusePacks: new Set(reusePacks).size, watchedChanges: watched, historyTouched, negativeControls }, null, 2));
