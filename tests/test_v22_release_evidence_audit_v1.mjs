import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {auditReleaseEvidence} from '../tools/audit_release_evidence_v22.mjs';

const now=Date.now(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'noteplus-v22-audit-'));
try{
 const methods={legacyVersionReturn:'cross-version-browser',androidPhysical:'physical-device',drivePcAndroidRoundtrip:'real-account-device',talkBack:'physical-device',threeNonDeveloperPilots:'human-users',representativeLargeLibrary:'attachment-rich-dataset',operationsDrill:'operator-observed'};
 const at=new Date(now-1000).toISOString(),checks={};
 for(const [key,method] of Object.entries(methods)){
  const file=`${key}.json`;fs.writeFileSync(path.join(dir,file),JSON.stringify({candidate:'v22',method,result:'PASS',checkedAt:at,sourceHead:'a'.repeat(40)}));
  checks[key]={status:'PASS',method,evidence:file,checkedAt:at,participants:key==='threeNonDeveloperPilots'?3:undefined};
 }
 const valid={schema:1,candidate:'v22',checks};
 const audited=auditReleaseEvidence(valid,{projectRoot:dir,now,commitExists:sha=>sha==='a'.repeat(40)});
 assert.equal(audited.auditPassed,true);assert.equal(audited.releaseReady,true);assert.equal(audited.passed.length,7);
 const badPath=structuredClone(valid);badPath.checks.androidPhysical.evidence='../escape.json';
 assert.equal(auditReleaseEvidence(badPath,{projectRoot:dir,now,commitExists:()=>true}).auditPassed,false);
 const badCandidate=structuredClone(valid);fs.writeFileSync(path.join(dir,'talkBack.json'),JSON.stringify({candidate:'v21',method:'physical-device',result:'PASS',checkedAt:at,sourceHead:'a'.repeat(40)}));
 assert.equal(auditReleaseEvidence(badCandidate,{projectRoot:dir,now,commitExists:()=>true}).auditPassed,false);
 fs.writeFileSync(path.join(dir,'talkBack.json'),JSON.stringify({candidate:'v22',method:'physical-device',result:'PASS',checkedAt:at,sourceHead:'a'.repeat(40)}));
 const notRun=structuredClone(valid);notRun.checks.talkBack={status:'NOT_RUN',method:'physical-device',evidence:null,checkedAt:null};
 const pending=auditReleaseEvidence(notRun,{projectRoot:dir,now,commitExists:()=>true});assert.equal(pending.auditPassed,true);assert.equal(pending.releaseReady,false);assert.deepEqual(pending.notRun,['talkBack']);
 const future=structuredClone(valid);future.checks.operationsDrill.checkedAt=new Date(now+1000).toISOString();
 assert.equal(auditReleaseEvidence(future,{projectRoot:dir,now,commitExists:()=>true}).auditPassed,false);
 console.log('PASS v22 release-evidence audit validates candidate, method, date, safe path, artifact metadata and pending external evidence');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
