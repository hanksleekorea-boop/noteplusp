import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const versions = fs.readdirSync(root).map(name=>/^노트앱_v(\d+)\.html$/.exec(name)).filter(Boolean).map(match=>Number(match[1])).sort((a,b)=>b-a);
assert.ok(versions.length,"a versioned app loader must exist");
const version = `v${versions[0]}`;
const loaderName = `노트앱_${version}.html`;
const expected = `https://hanksleekorea-boop.github.io/noteplusp/${encodeURIComponent(loaderName)}`;
const artifacts = path.join(root,"artifacts");
const svgPath = path.join(artifacts,`noteplusp_${version}_qr.svg`);
const pngPath = path.join(artifacts,`noteplusp_${version}_qr.png`);

const libraryResponse = await fetch("https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js");
assert.equal(libraryResponse.ok,true,`QR generator HTTP ${libraryResponse.status}`);
const module = {exports:{}};
new Function("module","exports",await libraryResponse.text())(module,module.exports);
const createQr = module.exports;
assert.equal(typeof createQr,"function","QR generator must export a function");

const qr = createQr(0,"M");
qr.addData(expected);
qr.make();
const quiet = 4, modules = qr.getModuleCount(), size = modules + quiet * 2;
let pathData = "";
for(let row=0;row<modules;row++) for(let column=0;column<modules;column++) if(qr.isDark(row,column)) pathData += `M${column+quiet} ${row+quiet}h1v1h-1z`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${pathData}" fill="#000"/></svg>\n`;
fs.writeFileSync(svgPath,svg);

const scale = 12, width = size * scale, dark = new Set();
for(let row=0;row<modules;row++) for(let column=0;column<modules;column++) if(qr.isDark(row,column)) dark.add(`${column+quiet},${row+quiet}`);
const crcTable=Array.from({length:256},(_,index)=>{let value=index;for(let bit=0;bit<8;bit++)value=(value&1)?0xEDB88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(buffer){let value=0xFFFFFFFF;for(const byte of buffer)value=crcTable[(value^byte)&255]^(value>>>8);return(value^0xFFFFFFFF)>>>0;}
function pngChunk(type,data){const typeBytes=Buffer.from(type,"ascii"),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes,data])));return Buffer.concat([length,typeBytes,data,checksum]);}
const raw=Buffer.alloc((width+1)*width);
for(let y=0;y<width;y++){const rowOffset=y*(width+1);for(let x=0;x<width;x++)raw[rowOffset+1+x]=dark.has(`${Math.floor(x/scale)},${Math.floor(y/scale)}`)?0:255;}
const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(width,4);header[8]=8;header[9]=0;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk("IHDR",header),pngChunk("IDAT",zlib.deflateSync(raw,{level:9})),pngChunk("IEND",Buffer.alloc(0))]);
fs.writeFileSync(pngPath,png);

const form=new FormData();form.append("file",new Blob([png],{type:"image/png"}),path.basename(pngPath));
const decodeResponse=await fetch("https://api.qrserver.com/v1/read-qr-code/",{method:"POST",body:form});
assert.equal(decodeResponse.ok,true,`independent QR decoder HTTP ${decodeResponse.status}`);
const decoded=(await decodeResponse.json())?.[0]?.symbol?.[0]?.data||"";
assert.equal(decoded,expected,"decoded QR payload must equal the latest candidate URL");

let negativeControlCaught=false;
try{assert.equal(decoded,expected.replace(version,"v0"),"negative control must reject the wrong version URL");}catch{negativeControlCaught=true;}
assert.equal(negativeControlCaught,true,"negative control must prove version mismatch detection");

console.log(JSON.stringify({ok:true,version,expected,decoded,modules,size,svgPath:path.relative(root,svgPath),pngPath:path.relative(root,pngPath),svgSha256:crypto.createHash("sha256").update(svg).digest("hex").toUpperCase(),pngSha256:crypto.createHash("sha256").update(png).digest("hex").toUpperCase(),negativeControl:"PASS"},null,2));
