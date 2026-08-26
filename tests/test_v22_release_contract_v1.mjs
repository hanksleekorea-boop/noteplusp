import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
function verify(loader,core,worker,manifest,module){
  assert.match(core,/NOTEPLUS_CORE_V22/);
  assert.match(core,/var DB_NAME="noteplusp_schema5"/);
  assert.match(loader,/source="노트앱_core_v22.html"/);
  assert.match(loader,/scope:"\.\/노트앱_v22.html"/);
  assert.match(loader,/noteplus-drive-v22.js/);
  assert.match(loader,/html.split\(from\).length!==2/);
  assert.equal(manifest.scope,'./노트앱_v22.html');
  assert.equal(manifest.start_url,'./노트앱_v22.html');
  assert.match(module,/const VERSION="noteplus-drive-v22"/);
  assert.match(worker,/key.startsWith\("noteplusp-v22-"\)/);
  assert.match(worker,/if\(!shellURLs.has\(url.href\)\)return/);
  assert.doesNotMatch(worker,/caches.match/);
  for(const text of [loader,core]) for(const match of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1])new Function(match[1]);
  new Function(module);new Function(worker);
}
const args=[read('노트앱_v22.html'),read('노트앱_core_v22.html'),read('sw-v22.js'),JSON.parse(read('noteplus-v22.webmanifest')),read('noteplus-drive-v22.js')];
verify(...args);
assert.throws(()=>verify(args[0].replace('noteplus-drive-v22.js','noteplus-drive-v21.js'),...args.slice(1)));
assert.throws(()=>verify(args[0],args[1],args[2].replaceAll('noteplusp-v22-','noteplusp-v21-'),...args.slice(3)));
console.log('PASS v22 isolated loader/core/worker/storage contract and negative controls');
