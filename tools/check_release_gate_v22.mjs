import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function evaluateGate(owner,evidence,readEvidence=()=>false,now=Date.now()){
 const blockers=[];
 for(const key of ['operator','supportContact','privacyContact','jurisdiction','incidentOwner'])if(typeof owner[key]!=='string'||!owner[key].trim())blockers.push('OWNER:'+key);
 if(!Number.isFinite(owner.supportResponseHours)||owner.supportResponseHours<=0)blockers.push('OWNER:supportResponseHours');
 if(owner.termsReviewed!==true||!Number.isFinite(Date.parse(owner.reviewedAt))||Date.parse(owner.reviewedAt)>now)blockers.push('OWNER:termsReview');
 const methods={androidPhysical:'physical-device',drivePcAndroidRoundtrip:'real-account-device',talkBack:'physical-device',threeNonDeveloperPilots:'human-users',representativeLargeLibrary:'attachment-rich-dataset',operationsDrill:'operator-observed'};
 if(evidence.schema!==1||evidence.candidate!=='v22')blockers.push('EVIDENCE:schema');
 for(const [key,method] of Object.entries(methods)){
  const c=evidence.checks?.[key],date=Date.parse(c?.checkedAt);
  if(!c||c.status!=='PASS'||c.method!==method||!Number.isFinite(date)||date>now||now-date>30*86400000||!c.evidence||!readEvidence(c.evidence)||(key==='threeNonDeveloperPilots'&&(!Number.isInteger(c.participants)||c.participants<3)))blockers.push('EVIDENCE:'+key);
 }
 return {candidate:'v22',releaseAllowed:blockers.length===0,blockers,notice:'A gate checks declared evidence, not its truth; reviewer must inspect referenced reports. No automatic deployment.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const owner=JSON.parse(fs.readFileSync(path.join(root,'commercial-owner-v22.json'),'utf8')),evidence=JSON.parse(fs.readFileSync(path.join(root,'release-evidence-v22.json'),'utf8'));
 const result=evaluateGate(owner,evidence,relative=>{if(typeof relative!=='string'||path.isAbsolute(relative))return false;const target=path.resolve(root,relative);return target.startsWith(root+path.sep)&&fs.existsSync(target)&&fs.statSync(target).isFile()&&fs.statSync(target).size>0;});
 console.log(JSON.stringify(result,null,2));if(!result.releaseAllowed)process.exitCode=2;
}
