import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../noteplus-drive-v19.js", import.meta.url), "utf8");
const events = [];
const mockWindow = {
  NOTEPLUS_DRIVE_CONFIG: {clientId:"test.apps.googleusercontent.com",scope:"https://www.googleapis.com/auth/drive.appdata",folder:"appDataFolder"},
  google: {accounts:{oauth2:{}}},
  addEventListener() {}, dispatchEvent(event) { events.push(event); }, matchMedia() { return {matches:false}; }
};
const mockNavigator = {userAgent:"",maxTouchPoints:0,onLine:true};
class MockCustomEvent { constructor(type, init) { this.type=type; this.detail=init?.detail; } }
const recorded = [];
const mockFetch = async (url, options={}) => {
  recorded.push({url:String(url),method:options.method||"GET",headers:new Headers(options.headers||{}),body:options.body});
  if(String(url).includes("uploadType=resumable")) return new Response("", {status:200,headers:{Location:"https://upload.example/session"}});
  if(String(url)==="https://upload.example/session") return new Response(JSON.stringify({id:"large",size:String(6*1024*1024),appProperties:{sha256:"A".repeat(64)}}),{status:200,headers:{"Content-Type":"application/json"}});
  return new Response(JSON.stringify({id:"small",size:"3",appProperties:{sha256:"B".repeat(64)}}),{status:200,headers:{"Content-Type":"application/json"}});
};
const factory = new Function("window","navigator","crypto","fetch","Headers","Blob","CustomEvent","google", `${source}\ntoken="test-token"; return {uploadMultipart,uploadResumable};`);
const api = factory(mockWindow,mockNavigator,globalThis.crypto,mockFetch,Headers,Blob,MockCustomEvent,mockWindow.google);
const small = new Blob(["abc"], {type:"text/plain"});
await api.uploadMultipart("small.txt",small,{sha256:"B".repeat(64)},null);
assert.equal(recorded[0].method,"POST");
assert.match(recorded[0].headers.get("Content-Type"),/^multipart\/related; boundary=noteplus_/);
assert.equal(recorded[0].headers.has("Content-Length"),false);
const smallBody = await recorded[0].body.text();
assert.match(smallBody,/Content-Type: application\/json; charset=UTF-8/);
assert.match(smallBody,/Content-Type: text\/plain/);
recorded.length=0;
const large = new Blob([new Uint8Array(6*1024*1024)], {type:"application/octet-stream"});
await api.uploadResumable("large.bin",large,{sha256:"A".repeat(64)},null);
assert.equal(recorded.length,2);
assert.match(recorded[0].url,/uploadType=resumable/);
assert.equal(recorded[0].headers.get("X-Upload-Content-Length"),String(large.size));
assert.equal(recorded[1].method,"PUT");
assert.equal(recorded[1].headers.get("Content-Range"),`bytes 0-${large.size-1}/${large.size}`);
assert.equal(recorded[1].headers.has("Content-Length"),false);
console.log("PASS v19 Drive multipart and resumable browser protocol simulation");
