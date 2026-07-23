import fs from "node:fs";
import assert from "node:assert/strict";
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");
const loader=read("노트앱_v20.html"),module=read("noteplus-drive-v20.js"),worker=read("sw-v20.js");
assert.match(loader,/noteplus-drive-v20\.js/);assert.match(loader,/noteplus-v20\.webmanifest/);assert.match(loader,/sw-v20\.js/);assert.match(loader,/location\.protocol==="file:"/);
assert.match(module,/const workers=Array\.from\(\{length:Math\.min\(2,attachments\.length\)\},worker\)/);assert.match(module,/uploadProgressMessage/);assert.match(module,/약 \$\{formatUploadEta\(remaining\)\} 남음/);assert.match(module,/Promise\.allSettled\(workers\)/);
assert.match(module,/multipart\/related; boundary=/);assert.match(module,/uploadType=resumable/);assert.match(module,/Content-Range/);assert.doesNotMatch(module,/"Content-Length"/);
assert.match(worker,/noteplusp-v20-shell-1/);assert.match(worker,/noteplus-drive-v20\.js/);
console.log("PASS v20 bounded parallel upload and ETA contract");
