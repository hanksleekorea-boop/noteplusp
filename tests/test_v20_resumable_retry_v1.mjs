import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../noteplus-drive-v20.js", import.meta.url), "utf8");
const chunkSize = 8 * 1024 * 1024;
const total = 10 * 1024 * 1024;
const expectedHash = "F".repeat(64);
const calls = [];
let firstChunkAttempted = false;

const mockWindow = {
  NOTEPLUS_DRIVE_CONFIG: {clientId:"test.apps.googleusercontent.com",scope:"https://www.googleapis.com/auth/drive.appdata",folder:"appDataFolder"},
  google: {accounts:{oauth2:{}}},
  addEventListener() {},
  dispatchEvent() {},
  matchMedia() { return {matches:false}; }
};
class MockCustomEvent { constructor(type, init) { this.type=type; this.detail=init?.detail; } }
const mockFetch = async (url, options={}) => {
  const headers = new Headers(options.headers || {});
  calls.push({url:String(url),method:options.method || "GET",headers,body:options.body});
  if (String(url).includes("uploadType=resumable")) {
    return new Response("", {status:200,headers:{Location:"https://upload.example/v20-retry"}});
  }
  assert.equal(String(url), "https://upload.example/v20-retry");
  const range = headers.get("Content-Range");
  if (range === `bytes 0-${chunkSize - 1}/${total}` && !firstChunkAttempted) {
    firstChunkAttempted = true;
    return new Response("temporary server failure", {status:500});
  }
  if (range === `bytes */${total}`) {
    return new Response("", {status:308,headers:{Range:`bytes=0-${chunkSize - 1}`}});
  }
  assert.equal(range, `bytes ${chunkSize}-${total - 1}/${total}`, "retry must continue from the server-acknowledged offset");
  return new Response(JSON.stringify({id:"resumed",size:String(total),appProperties:{sha256:expectedHash}}), {status:200,headers:{"Content-Type":"application/json"}});
};

const factory = new Function("window","navigator","crypto","fetch","Headers","Blob","CustomEvent","google", `${source}\ntoken="test-token";return {uploadResumable};`);
const api = factory(mockWindow,{userAgent:"",maxTouchPoints:0,onLine:true},globalThis.crypto,mockFetch,Headers,Blob,MockCustomEvent,mockWindow.google);
const blob = new Blob([new Uint8Array(total)], {type:"application/octet-stream"});
const saved = await api.uploadResumable("retry.bin",blob,{sha256:expectedHash},null);

assert.equal(saved.id,"resumed");
assert.equal(calls.length,4,"init, failed chunk, status probe, resumed chunk expected");
assert.equal(calls[1].headers.has("Content-Length"),false);
assert.equal(calls[2].headers.get("Content-Range"),`bytes */${total}`);
assert.equal(calls[3].headers.get("Content-Range"),`bytes ${chunkSize}-${total - 1}/${total}`);
console.log("PASS v20 resumable upload resumes at acknowledged offset after HTTP 500");
