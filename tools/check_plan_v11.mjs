import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productPath = path.join(root, 'PRODUCT_PLAN_v11_ADOPTED.md');
const developmentPath = path.join(root, 'DEVELOPMENT_PLAN_v11_3STAGE.md');
const product = fs.readFileSync(productPath, 'utf8');
const development = fs.readFileSync(developmentPath, 'utf8');
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function unique(matches) {
  return [...new Set(matches)];
}

expect(/상태:\s*\*\*ADOPTED —/.test(product), '제품기획서 상태가 ADOPTED가 아닙니다.');
expect(/상태:\s*\*\*ADOPTED EXECUTION PLAN\*\*/.test(development), '개발계획서 상태가 ADOPTED EXECUTION PLAN이 아닙니다.');

const improvements = unique([...product.matchAll(/^### (P11-IMP-\d{3})\b/gm)].map((match) => match[1]));
const requirements = unique([...product.matchAll(/^\| (P11-REQ-\d{3}) \|/gm)].map((match) => match[1]));
const benchmarkRows = unique([...product.matchAll(/^\| (F\d{2}) /gm)].map((match) => match[1]));
const taskMatches = [...development.matchAll(/^### (S([123])-\d{3}) — (.+)$/gm)];
const tasks = taskMatches.map((match) => ({ id: match[1], stage: Number(match[2]), title: match[3], index: match.index }));
const taskIds = new Set(tasks.map((task) => task.id));
const requirementIds = new Set(requirements);

expect(improvements.length === 15, `개선안은 15개여야 하나 ${improvements.length}개입니다.`);
expect(requirements.length === 26, `요구사항은 26개여야 하나 ${requirements.length}개입니다.`);
expect(benchmarkRows.length === 27, `상세분야 비교는 27개여야 하나 ${benchmarkRows.length}개입니다.`);
expect(tasks.filter((task) => task.stage === 1).length === 12, '1단계 작업은 12개여야 합니다.');
expect(tasks.filter((task) => task.stage === 2).length === 8, '2단계 작업은 8개여야 합니다.');
expect(tasks.filter((task) => task.stage === 3).length === 8, '3단계 작업은 8개여야 합니다.');
expect(taskIds.size === 28, `작업 식별자는 28개가 모두 달라야 하나 ${taskIds.size}개입니다.`);

for (let index = 0; index < tasks.length; index += 1) {
  const task = tasks[index];
  const end = tasks[index + 1]?.index ?? development.length;
  const body = development.slice(task.index, end);
  for (const label of ['상태:', '요구사항:', '선행 작업:', '다음 작업:']) {
    expect(body.includes(`- ${label}`), `${task.id}에 '${label}' 항목이 없습니다.`);
  }
  expect(/^- 완료(?: 증거| 조건| 기준)?:/m.test(body), `${task.id}에 완료 조건·기준·증거가 없습니다.`);

  const referencedRequirements = unique([...body.matchAll(/P11-REQ-\d{3}/g)].map((match) => match[0]));
  for (const requirement of referencedRequirements) {
    expect(requirementIds.has(requirement), `${task.id}가 정의되지 않은 요구사항 ${requirement}을 참조합니다.`);
  }

  const predecessorLine = body.match(/^- 선행 작업:\s*(.+)$/m)?.[1] ?? '';
  const predecessors = unique([...predecessorLine.matchAll(/S[123]-\d{3}/g)].map((match) => match[0]));
  for (const predecessor of predecessors) {
    expect(taskIds.has(predecessor), `${task.id}가 없는 선행 작업 ${predecessor}을 참조합니다.`);
    expect(predecessor !== task.id, `${task.id}가 자신을 선행 작업으로 참조합니다.`);
  }
}

const allDevelopmentRequirements = unique([...development.matchAll(/P11-REQ-\d{3}/g)].map((match) => match[0]));
for (const requirement of allDevelopmentRequirements) {
  expect(requirementIds.has(requirement), `개발계획서가 정의되지 않은 요구사항 ${requirement}을 참조합니다.`);
}

expect(development.includes('1단계 종료 조건 — 하나라도 빠지면 상용 완료 아님'), '1단계 상용 종료 조건이 없습니다.');
expect(development.includes('개발 1단계 — 완전한 무료 상용판'), '1단계 무료 상용화 결정 문구가 없습니다.');
expect(development.includes('`S1-001 — v22 안전 개발 틀과 보호 계약`만 READY'), '첫 실행 가능 카드가 S1-001로 고정되지 않았습니다.');

if (failures.length > 0) {
  console.error(`PLAN_V11_FAIL ${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PLAN_V11_PASS fields=${benchmarkRows.length} improvements=${improvements.length} requirements=${requirements.length} tasks=${tasks.length} stages=12/8/8`);
