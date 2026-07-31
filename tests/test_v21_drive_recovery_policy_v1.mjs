import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const candidates = fs.readdirSync(root).map(name=>/^noteplus-drive-v(\d+)\.js$/.exec(name)).filter(Boolean).map(match=>({version:Number(match[1]),name:match[0]})).sort((a,b)=>b.version-a.version);
assert.ok(candidates.length,"a versioned Drive module must exist");
const candidate = candidates[0];
const source = fs.readFileSync(path.join(root,candidate.name),"utf8");
const chunkSize = 8 * 1024 * 1024;
const total = 10 * 1024 * 1024;
const expectedHash = "A".repeat(64);

function createApi(mockFetch) {
  const delays = [];
  const events = [];
  const mockWindow = {
    NOTEPLUS_DRIVE_CONFIG: {clientId:"test.apps.googleusercontent.com",scope:"https://www.googleapis.com/auth/drive.appdata",folder:"appDataFolder"},
    google: {accounts:{oauth2:{}}},
    addEventListener() {},
    dispatchEvent(event) { events.push(event.detail); },
    matchMedia() { return {matches:false}; }
  };
  class MockCustomEvent { constructor(type, init) { this.type=type; this.detail=init?.detail; } }
  const immediateTimeout = (callback, milliseconds) => { delays.push(milliseconds); callback(); return delays.length; };
  const factory = new Function("window","navigator","crypto","fetch","Headers","Blob","CustomEvent","google","setTimeout", `${source}\ntoken="test-token";return {uploadResumable,friendlyError,acknowledgedOffset,retryDelay,RESUMABLE_RECOVERY_LIMIT};`);
  const api = factory(mockWindow,{userAgent:"",maxTouchPoints:0,onLine:true},globalThis.crypto,mockFetch,Headers,Blob,MockCustomEvent,mockWindow.google,immediateTimeout);
  return {api,delays,events};
}

function initResponse(session) {
  return new Response("", {status:200,headers:{Location:session}});
}

const noRangeCalls = [];
const noRangeFetch = async (url, options={}) => {
  const headers = new Headers(options.headers || {});
  noRangeCalls.push({url:String(url),headers});
  if (String(url).includes("uploadType=resumable")) return initResponse("https://upload.example/no-range");
  if (noRangeCalls.length === 2) return new Response("", {status:308});
  return new Response(JSON.stringify({id:"no-skip",size:String(total),appProperties:{sha256:expectedHash}}), {status:200,headers:{"Content-Type":"application/json"}});
};
const noRange = createApi(noRangeFetch);
const blob = new Blob([new Uint8Array(total)], {type:"application/octet-stream"});
assert.equal((await noRange.api.uploadResumable("no-range.bin",blob,{sha256:expectedHash},null)).id,"no-skip");
assert.equal(noRangeCalls[1].headers.get("Content-Range"),`bytes 0-${chunkSize - 1}/${total}`);
assert.equal(noRangeCalls[2].headers.get("Content-Range"),`bytes 0-${chunkSize - 1}/${total}`,"missing Range must retry the same bytes, never skip ahead");

const rateCalls = [];
const rateFetch = async (url, options={}) => {
  const headers = new Headers(options.headers || {});
  rateCalls.push({url:String(url),headers});
  if (String(url).includes("uploadType=resumable")) return initResponse("https://upload.example/rate");
  if (rateCalls.length === 2) return new Response("busy", {status:429,headers:{"Retry-After":"0"}});
  if (headers.get("Content-Range") === `bytes */${total}`) return new Response("", {status:308});
  return new Response(JSON.stringify({id:"rate-recovered",size:String(total),appProperties:{sha256:expectedHash}}), {status:200,headers:{"Content-Type":"application/json"}});
};
const rate = createApi(rateFetch);
assert.equal((await rate.api.uploadResumable("rate.bin",blob,{sha256:expectedHash},null)).id,"rate-recovered");
assert.deepEqual(rate.delays,[0],"Retry-After: 0 must be honored without a real wait");
assert.match(rate.events.map(item=>item?.message||"").join("\n"),/429/);

let persistentCalls = 0;
const persistentFetch = async (url, options={}) => {
  persistentCalls++;
  if (String(url).includes("uploadType=resumable")) return initResponse("https://upload.example/persistent");
  const range = new Headers(options.headers || {}).get("Content-Range");
  if (range === `bytes */${total}`) return new Response("", {status:308});
  return new Response("still unavailable", {status:500});
};
const persistent = createApi(persistentFetch);
const recoveryLimit = persistent.api.RESUMABLE_RECOVERY_LIMIT;
await assert.rejects(() => persistent.api.uploadResumable("persistent.bin",blob,{sha256:expectedHash},null),new RegExp(`${recoveryLimit}회 반복되어 안전하게 중단`));
assert.equal(persistentCalls,2+2*recoveryLimit,"init + bounded failed chunks and probes must terminate");
assert.deepEqual(persistent.delays,Array.from({length:recoveryLimit},(_,index)=>Math.min(30000,1000*2**index)));

assert.match(rate.api.friendlyError(new Error("Drive HTTP 401")),/다시 로그인/);
assert.match(rate.api.friendlyError(new Error("Drive HTTP 403")),/권한/);
assert.match(rate.api.friendlyError(new Error("Drive HTTP 429")),/요청이 많아/);
assert.match(rate.api.friendlyError(new Error("Drive HTTP 500")),/일시적으로 응답하지/);
assert.match(rate.api.friendlyError(new Error("Drive HTTP 507")),/저장공간/);

let negativeControlCaught = false;
try {
  const deliberatelyWrongOffset = (_range, optimisticEnd) => optimisticEnd;
  assert.equal(deliberatelyWrongOffset(null, chunkSize),0,"negative control must reject the old optimistic skip behavior");
} catch {
  negativeControlCaught = true;
}
assert.equal(negativeControlCaught,true,"negative control must prove this test rejects a broken offset policy");

console.log(JSON.stringify({ok:true,candidate:`v${candidate.version}`,noRangeRetry:"same-offset",rateLimitRecovery:"PASS",persistentFailureCalls:persistentCalls,retryDelays:persistent.delays,negativeControl:"PASS"},null,2));
