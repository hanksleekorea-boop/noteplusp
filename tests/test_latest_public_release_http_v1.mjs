import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const versions = fs.readdirSync(root).map(name=>/^노트앱_v(\d+)\.html$/.exec(name)).filter(Boolean).map(match=>Number(match[1])).sort((a,b)=>b-a);
assert.ok(versions.length,"a versioned app loader must exist");
const version=`v${versions[0]}`, base="https://hanksleekorea-boop.github.io/noteplusp/";
const resources=[
  `노트앱_${version}.html`,
  `noteplus-drive-${version}.js`,
  `sw-${version}.js`,
  `noteplus-${version}.webmanifest`,
  `artifacts/noteplusp_${version}_qr.png`
];
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
const expected=new Map(resources.map(name=>[name,{bytes:fs.readFileSync(path.join(root,name)),sha256:sha(fs.readFileSync(path.join(root,name)))}]));

const observations=[];
for(let run=1;run<=3;run++){
  for(const name of resources){
    const url=new URL(name.split("/").map(encodeURIComponent).join("/"),base);url.searchParams.set("qa",`${Date.now()}-${run}`);
    const response=await fetch(url,{headers:{"cache-control":"no-cache","pragma":"no-cache"}}),bytes=Buffer.from(await response.arrayBuffer()),actual=sha(bytes),local=expected.get(name);
    assert.equal(response.status,200,`${name} public HTTP run ${run}`);
    assert.equal(bytes.length,local.bytes.length,`${name} public byte length run ${run}`);
    assert.equal(actual,local.sha256,`${name} public SHA-256 run ${run}`);
    observations.push({run,name,status:response.status,bytes:bytes.length,sha256:actual,cache:response.headers.get("cache-control")});
  }
}

let negativeControlCaught=false;
try{assert.equal(observations[0].sha256,"0".repeat(64),"negative control must reject a wrong public hash");}catch{negativeControlCaught=true;}
assert.equal(negativeControlCaught,true,"negative control must prove public hash mismatch detection");

console.log(JSON.stringify({ok:true,version,entrypoint:new URL(encodeURIComponent(`노트앱_${version}.html`),base).href,runs:3,resources:resources.length,observations,negativeControl:"PASS"},null,2));
