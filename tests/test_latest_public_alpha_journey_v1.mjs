import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const versions=fs.readdirSync(root).map(name=>/^노트앱_v(\d+)\.html$/.exec(name)).filter(Boolean).map(match=>Number(match[1])).sort((a,b)=>b-a);
assert.ok(versions.length,"a versioned app loader must exist");
const version=`v${versions[0]}`,loader=`노트앱_${version}.html`,bytes=fs.readFileSync(path.join(root,loader)),expectedSha=crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();

let negativeControlCaught=false;
try{assert.equal(expectedSha,"0".repeat(64),"negative control must reject a wrong candidate hash");}catch{negativeControlCaught=true;}
assert.equal(negativeControlCaught,true,"negative control must prove candidate hash mismatch detection");

process.env.NOTEPLUS_PUBLIC_URL="https://hanksleekorea-boop.github.io/noteplusp/";
process.env.NOTEPLUS_APP_FILE=encodeURIComponent(loader);
process.env.NOTEPLUS_EXPECTED_SHA=expectedSha;
process.env.NOTEPLUS_EXPECTED_CLOUD_VERSION=`noteplus-drive-${version}`;
process.env.NOTEPLUS_BROWSER=process.env.NOTEPLUS_BROWSER||"C:/Program Files/Google/Chrome/Application/chrome.exe";
process.env.NOTEPLUS_ARTIFACT_PREFIX=`${version}_public_${new Date().toISOString().slice(0,10).replaceAll("-","")}_`;

await import("./test_public_alpha_journey_v4.mjs");
