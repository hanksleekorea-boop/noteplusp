import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import zlib from "node:zlib";

const qrPath = new URL("../artifacts/noteplusp_v20_qr_20260730.svg", import.meta.url);
const expected = "https://hanksleekorea-boop.github.io/noteplusp/%EB%85%B8%ED%8A%B8%EC%95%B1_v20.html";
const svg = fs.readFileSync(qrPath, "utf8");

const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
assert.ok(viewBox, "QR SVG needs a square viewBox");
assert.equal(viewBox[1], viewBox[2]);
assert.doesNotMatch(svg, /<script|javascript:|(?:href|src)=["']https?:\/\//i, "QR image must be a self-contained static SVG");

const modules = Number(viewBox[1]);
const scale = 12;
const width = modules * scale;
const dark = new Set();
let darkCount = 0;
for (const match of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
  const column = Number(match[1]);
  const row = Number(match[2]);
  darkCount++;
  dark.add(`${column},${row}`);
}
assert.ok(darkCount > 100, "QR SVG must contain dark data modules");

const crcTable = Array.from({length:256},(_,index)=>{
  let value=index;
  for(let bit=0;bit<8;bit++) value=(value&1)?0xEDB88320^(value>>>1):value>>>1;
  return value>>>0;
});
function crc32(buffer){let value=0xFFFFFFFF;for(const byte of buffer)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xFFFFFFFF)>>>0;}
function pngChunk(type,data){
  const typeBytes=Buffer.from(type,"ascii"),length=Buffer.alloc(4),checksum=Buffer.alloc(4);
  length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes,data])));
  return Buffer.concat([length,typeBytes,data,checksum]);
}
const raw=Buffer.alloc((width+1)*width);
for(let y=0;y<width;y++){
  const rowOffset=y*(width+1);raw[rowOffset]=0;
  for(let x=0;x<width;x++) raw[rowOffset+1+x]=dark.has(`${Math.floor(x/scale)},${Math.floor(y/scale)}`)?0:255;
}
const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(width,4);header[8]=8;header[9]=0;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk("IHDR",header),pngChunk("IDAT",zlib.deflateSync(raw,{level:9})),pngChunk("IEND",Buffer.alloc(0))]);
const pngPath=new URL("../artifacts/noteplusp_v20_qr_20260730.png",import.meta.url);
fs.writeFileSync(pngPath,png);
const form=new FormData();form.append("file",new Blob([png],{type:"image/png"}),"noteplusp_v20_qr_20260730.png");
const response=await fetch("https://api.qrserver.com/v1/read-qr-code/",{method:"POST",body:form});
assert.equal(response.ok,true,`independent QR decoder HTTP ${response.status}`);
const result=await response.json();
const symbol=result?.[0]?.symbol?.[0];
assert.equal(symbol?.error,null,"independent QR decoder must report no error");
const decoded=symbol?.data||"";
assert.equal(decoded, expected, "decoded QR payload must equal the verified public v20 URL");

console.log(JSON.stringify({
  ok: true,
  decoded,
  modules,
  svgSha256: crypto.createHash("sha256").update(svg).digest("hex").toUpperCase(),
  pngSha256: crypto.createHash("sha256").update(png).digest("hex").toUpperCase()
}, null, 2));
