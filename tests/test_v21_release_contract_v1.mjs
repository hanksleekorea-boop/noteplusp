import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const versions = fs.readdirSync(root).map(name=>/^노트앱_v(\d+)\.html$/.exec(name)).filter(Boolean).map(match=>Number(match[1])).sort((a,b)=>b-a);
assert.ok(versions.length,"a versioned app loader must exist");
const versionNumber = versions[0], version = `v${versionNumber}`;
const read = name => fs.readFileSync(path.join(root,name),"utf8");

function verifyRelease(files) {
  assert.ok(files.loader.includes(`<title>노트플러스P ${version}</title>`));
  assert.ok(files.loader.includes(`noteplus-drive-${version}.js`));
  assert.ok(files.loader.includes(`noteplus-${version}.webmanifest`));
  assert.ok(files.loader.includes(`sw-${version}.js`));
  const manifest = JSON.parse(files.manifest);
  assert.equal(manifest.name,`노트플러스P ${version}`);
  assert.equal(manifest.start_url,`./노트앱_${version}.html`);
  assert.ok(files.worker.includes(`noteplusp-${version}-shell-1`));
  for (const required of [`노트앱_${version}.html`,`noteplus-drive-${version}.js`,`noteplus-${version}.webmanifest`]) assert.ok(files.worker.includes(required),`worker must cache ${required}`);
  assert.ok(files.module.includes(`const VERSION="noteplus-drive-${version}"`));
  for (const match of files.loader.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1]) new Function(match[1]);
  new Function(files.module);
  new Function("self","caches","fetch","URL",files.worker);
}

const files = {
  loader:read(`노트앱_${version}.html`),
  manifest:read(`noteplus-${version}.webmanifest`),
  worker:read(`sw-${version}.js`),
  module:read(`noteplus-drive-${version}.js`)
};
verifyRelease(files);

let negativeControlCaught = false;
try {
  verifyRelease({...files,loader:files.loader.replace(`noteplus-drive-${version}.js`,`noteplus-drive-v0.js`)});
} catch {
  negativeControlCaught = true;
}
assert.equal(negativeControlCaught,true,"negative control must reject a loader wired to the prior module");

console.log(`PASS ${version} loader/module/manifest/worker contract with negative control`);
