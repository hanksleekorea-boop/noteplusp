import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const names=['pricing.html','data-rights.html','privacy.html','terms.html','support.html','status.html'];
for(const name of names){const text=fs.readFileSync(path.join(root,name),'utf8');assert.match(text,/data-release-state="blocked"/);assert.match(text,/운영자 확인 전 초안/);for(const link of text.matchAll(/href="([^"]+)"/g))assert.ok(fs.existsSync(path.join(root,link[1])));assert.doesNotMatch(text,/example\.com|your@email|TODO/);}
assert.match(fs.readFileSync(path.join(root,'pricing.html'),'utf8'),/결제를 받지 않으며 자동 유료 전환도 없습니다/);
console.log('PASS trust-center drafts, six-page links and honest unpublished state; operator approval is NOT complete');
