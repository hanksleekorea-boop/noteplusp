import fs from "node:fs";
import assert from "node:assert/strict";

const original = fs.readFileSync(new URL("../noteplus-drive-v20.js", import.meta.url), "utf8");
const replacement = `async function uploadAndVerify(name,blob,properties){
  const state=window.__parallelState;
  if(properties.kind==="attachment"){
    state.inFlight++;
    state.maxInFlight=Math.max(state.maxInFlight,state.inFlight);
    await new Promise(resolve=>setTimeout(resolve,8));
    state.inFlight--;
    if(properties.attachmentId==="att_fail000")throw new Error("simulated attachment failure");
    state.attachmentsComplete++;
  }else{
    state.nonAttachments.push({kind:properties.kind,attachmentsComplete:state.attachmentsComplete});
  }
  return {id:name,size:String(blob.size),appProperties:{sha256:properties.sha256}};
}
`;
const source = original.replace(/async function uploadAndVerify[\s\S]*?(?=async function downloadFile)/, replacement);
assert.notEqual(source, original, "test harness must replace only the network upload verifier");

const events=[];
const mockWindow={
  NOTEPLUS_DRIVE_CONFIG:{clientId:"test.apps.googleusercontent.com",scope:"https://www.googleapis.com/auth/drive.appdata",folder:"appDataFolder"},
  google:{accounts:{oauth2:{}}},
  __parallelState:{inFlight:0,maxInFlight:0,attachmentsComplete:0,nonAttachments:[]},
  addEventListener(){},
  dispatchEvent(event){events.push(event);},
  matchMedia(){return {matches:false};}
};
class MockCustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail;}}
const factory=new Function("window","navigator","crypto","fetch","Headers","Blob","CustomEvent","google",`${source}\ntoken="test-token";tokenExpiry=Date.now()+3600000;user={uid:"tester"};return {uploadSnapshot,formatUploadEta,uploadProgressMessage};`);
const api=factory(mockWindow,{userAgent:"",maxTouchPoints:0,onLine:true},globalThis.crypto,async()=>{throw new Error("network mock should not be called");},Headers,Blob,MockCustomEvent,mockWindow.google);

const attachments=Array.from({length:5},(_,index)=>({
  id:`att_parallel${index}`,
  blob:new Blob([`attachment-${index}`],{type:"text/plain"}),
  sha256:"A".repeat(64)
}));
const pointer=await api.uploadSnapshot({
  snapshotId:"snapshot_v20aa",
  attachments,
  manifestText:'{"format":"noteplusp-cloud-snapshot-v1"}',
  manifestSha256:"B".repeat(64),
  counts:{noteCount:1,attachmentCount:attachments.length}
});

assert.equal(mockWindow.__parallelState.maxInFlight,2,"attachment workers must stay bounded at two");
assert.equal(mockWindow.__parallelState.attachmentsComplete,attachments.length);
assert.deepEqual(mockWindow.__parallelState.nonAttachments,[
  {kind:"manifest",attachmentsComplete:attachments.length},
  {kind:"pointer",attachmentsComplete:attachments.length}
]);
assert.equal(pointer.snapshotId,"snapshot_v20aa");
assert.equal(api.formatUploadEta(61_000),"1분 1초");
assert.match(api.uploadProgressMessage(3,5,Date.now()-10_000),/3 \/ 5/);
assert(events.some(event=>event.detail?.phase==="uploading"&&/5 \/ 5/.test(event.detail.message)));

mockWindow.__parallelState={inFlight:0,maxInFlight:0,attachmentsComplete:0,nonAttachments:[]};
const noAttachmentPointer=await api.uploadSnapshot({
  snapshotId:"snapshot_v20cc",
  attachments:[],
  manifestText:'{"format":"noteplusp-cloud-snapshot-v1"}',
  manifestSha256:"E".repeat(64),
  counts:{noteCount:1,attachmentCount:0}
});
assert.equal(noAttachmentPointer.snapshotId,"snapshot_v20cc");
assert.equal(mockWindow.__parallelState.maxInFlight,0,"empty snapshots must not create attachment workers");
assert.deepEqual(mockWindow.__parallelState.nonAttachments,[
  {kind:"manifest",attachmentsComplete:0},
  {kind:"pointer",attachmentsComplete:0}
]);

mockWindow.__parallelState={inFlight:0,maxInFlight:0,attachmentsComplete:0,nonAttachments:[]};
const failedAttachments=["att_ok0000","att_fail000","att_after00"].map((id,index)=>({
  id,
  blob:new Blob([`failure-${index}`],{type:"text/plain"}),
  sha256:"C".repeat(64)
}));
await assert.rejects(api.uploadSnapshot({
  snapshotId:"snapshot_v20bb",
  attachments:failedAttachments,
  manifestText:'{"format":"noteplusp-cloud-snapshot-v1"}',
  manifestSha256:"D".repeat(64),
  counts:{noteCount:1,attachmentCount:failedAttachments.length}
}),/simulated attachment failure/);
assert.deepEqual(mockWindow.__parallelState.nonAttachments,[],"failed attachment work must never commit a manifest or current pointer");
console.log("PASS v20 bounded parallel execution preserves attachment-before-commit order");
