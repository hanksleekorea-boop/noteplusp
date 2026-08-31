import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'노트앱_core_v22.html'),'utf8');
const drive=fs.readFileSync(path.join(root,'google-drive-config-v18.js'),'utf8');
const privacy=fs.readFileSync(path.join(root,'privacy.html'),'utf8');
const rights=fs.readFileSync(path.join(root,'data-rights.html'),'utf8');

assert.match(app,/기본 저장 위치는 이 기기의 브라우저/);
assert.match(app,/Google 로그인 후 백업·복원 버튼을 직접 누를 때만/);
assert.match(app,/다른 사람이나 AI 제공자에게 자동 전송하지 않습니다/);
assert.match(app,/무료로 전체 JSON 또는 Markdown·첨부·원본 정보 ZIP/);
assert.match(drive,/drive\.appdata/);assert.match(drive,/appDataFolder/);
assert.match(privacy,/로컬 노트와 첨부는 기본적으로 서버에 전송하지 않습니다/);assert.match(privacy,/Google 로그인과 백업·복원 버튼을 선택/);
assert.match(rights,/전체 JSON/);assert.match(rights,/Markdown·첨부·원본 정보 ZIP/);
for(const text of [app,privacy,rights])assert.doesNotMatch(text,/자동으로 AI.{0,20}(전송|제공)|동의 없이.{0,20}(판매|전송)/);
console.log('PASS v22 data-flow notice consistently states local default, explicit appData transfer, no automatic AI transfer and free export');
