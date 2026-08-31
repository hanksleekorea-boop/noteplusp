import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = fs.readFileSync(path.join(root, '노트앱_core_v22.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw-v22.js'), 'utf8');

assert.match(core, /v22AccountOpen\.id='v22AccountOpen'/);
assert.match(core, /Google로 로그인·무료 가입/);
assert.match(core, /id="v22AccountDialog"/);
assert.match(core, /V22_ACCOUNT_SETTINGS_KEY='noteplusp-v22-account-settings-v1'/);
assert.match(core, /v22WriteAccountSettings/);
assert.match(core, /localStorage\.setItem\(V22_ACCOUNT_SETTINGS_KEY/);
assert.match(core, /Google 계정의 이름이나 이메일은 바꾸지 않습니다/);
assert.match(core, /Google 계정 정보와 노트는 변경하지 않았습니다/);
assert.match(core, /v22MaskedCloudAccount/);
assert.match(core, /document\.getElementById\('googleSignInBtn'\)\.click\(\)/);
assert.match(core, /document\.getElementById\('v22DataOpen'\)\.click\(\)/);
const accountSegment = core.slice(core.indexOf('<dialog id="v22AccountDialog"'));
assert.doesNotMatch(accountSegment, /updateProfile\s*\(|accounts:signUp|password/i);
assert.match(worker, /const CACHE="noteplusp-v22-shell-4"/);
assert.match(worker, /key!==SHARE_CACHE/);
assert.match(worker, /key\.startsWith\("noteplusp-v22-"\)/);
assert.match(worker, /Never intercept OAuth, Drive, old releases/);
console.log('PASS v22 account boundary and PWA cache contract');
