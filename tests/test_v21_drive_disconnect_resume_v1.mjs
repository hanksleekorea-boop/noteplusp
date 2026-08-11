import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "noteplus-drive-v21.js"), "utf8");
const chunkSize = 8 * 1024 * 1024;
const total = 10 * 1024 * 1024;
const expectedHash = "D".repeat(64);
const calls = [];
const events = [];
let disconnected = true;

const mockFetch = async (url, options={}) => {
  const headers = new Headers(options.headers || {});
  calls.push({url:String(url), range:headers.get("Content-Range")});
  if (String(url).includes("uploadType=resumable")) return new Response("", {status:200,headers:{Location:"https://upload.example/disconnect"}});
  if (disconnected) { disconnected = false; throw new TypeError("network disconnected"); }
  return new Response(JSON.stringify({id:"resumed-once",size:String(total),appProperties:{sha256:expectedHash}}), {status:200,headers:{"Content-Type":"application/json"}});
};

const mockWindow = {
  NOTEPLUS_DRIVE_CONFIG:{clientId:"test.apps.googleusercontent.com",scope:"https://www.googleapis.com/auth/drive.appdata",folder:"appDataFolder"},
  google:{accounts:{oauth2:{}}}, addEventListener(){}, dispatchEvent(event){events.push(event.detail);}, matchMedia(){return {matches:false};}
};
class MockCustomEvent { constructor(type,init){this.type=type;this.detail=init?.detail;} }
const delays=[];
const immediateTimeout=(callback,milliseconds)=>{delays.push(milliseconds);callback();return delays.length;};
const factory=new Function("window","navigator","crypto","fetch","Headers","Blob","CustomEvent","google","setTimeout",`${source}\ntoken="test-token";return {uploadResumable};`);
const api=factory(mockWindow,{userAgent:"",maxTouchPoints:0,onLine:true},globalThis.crypto,mockFetch,Headers,Blob,MockCustomEvent,mockWindow.google,immediateTimeout);
const blob=new Blob([new Uint8Array(total)],{type:"application/octet-stream"});
const saved=await api.uploadResumable("disconnect.bin",blob,{sha256:expectedHash},null);

assert.equal(saved.id,"resumed-once");
assert.equal(calls.filter(call=>call.url.includes("uploadType=resumable")).length,1,"reconnect must reuse one resumable session");
assert.equal(calls[1].range,`bytes 0-${chunkSize-1}/${total}`);
assert.equal(calls[2].range,calls[1].range,"a network disconnect must retry exactly the same bytes");
assert.deepEqual(delays,[1000]);
assert.match(events.map(event=>event?.message||"").join("\n"),/같은 위치부터 다시 시도/);
console.log(JSON.stringify({ok:true,contract:"v21-drive-disconnect-resume-v1",sessionCount:1,sameRangeRetry:true,localMutation:false,reconnectDelayMs:delays[0]},null,2));
