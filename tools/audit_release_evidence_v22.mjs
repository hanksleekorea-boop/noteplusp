import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const expectedMethods={legacyVersionReturn:'cross-version-browser',androidPhysical:'physical-device',drivePcAndroidRoundtrip:'real-account-device',talkBack:'physical-device',threeNonDeveloperPilots:'human-users',representativeLargeLibrary:'attachment-rich-dataset',operationsDrill:'operator-observed'};

function safeFile(projectRoot,relative){
 if(typeof relative!=='string'||!relative||path.isAbsolute(relative))return null;
 const target=path.resolve(projectRoot,relative);
 return target.startsWith(projectRoot+path.sep)&&fs.existsSync(target)&&fs.statSync(target).isFile()&&fs.statSync(target).size>0?target:null;
}
function defaultCommitExists(projectRoot,sha){
 if(typeof sha!=='string'||!/^[0-9a-f]{40}$/i.test(sha))return false;
 return spawnSync('git',['-c',`safe.directory=${projectRoot.replace(/\\/g,'/')}`,'-C',projectRoot,'cat-file','-e',`${sha}^{commit}`],{stdio:'ignore'}).status===0;
}
export function auditReleaseEvidence(evidence,{projectRoot=root,now=Date.now(),commitExists=sha=>defaultCommitExists(projectRoot,sha)}={}){
 const findings=[],records=[];
 const add=(level,key,message)=>findings.push({level,key,message});
 if(evidence?.schema!==1)add('error','schema','schema must equal 1');
 if(evidence?.candidate!=='v22')add('error','candidate','candidate must equal v22');
 for(const [key,method] of Object.entries(expectedMethods)){
  const check=evidence?.checks?.[key];
  const record={key,status:check?.status||'MISSING',valid:false};records.push(record);
  if(!check){add('error',key,'check is missing');continue;}
  if(check.method!==method)add('error',key,`method must equal ${method}`);
  if(check.status==='NOT_RUN'){
   if(check.evidence!==null||check.checkedAt!==null)add('error',key,'NOT_RUN must not declare evidence or checkedAt');
   if(key==='threeNonDeveloperPilots'&&check.participants!==0)add('error',key,'NOT_RUN pilot participants must equal 0');
   record.valid=check.method===method&&check.evidence===null&&check.checkedAt===null;
   continue;
  }
  if(check.status!=='PASS'){add('error',key,'status must be PASS or NOT_RUN');continue;}
  const date=Date.parse(check.checkedAt);
  if(!Number.isFinite(date)||date>now||now-date>30*86400000){add('error',key,'PASS checkedAt must be valid, non-future and no older than 30 days');continue;}
  const target=safeFile(projectRoot,check.evidence);
  if(!target){add('error',key,'PASS evidence must be a non-empty project-relative file');continue;}
  if(key==='threeNonDeveloperPilots'&&(!Number.isInteger(check.participants)||check.participants<3)){add('error',key,'PASS pilots require at least 3 participants');continue;}
  if(path.extname(target).toLowerCase()!=='.json'){record.valid=true;continue;}
  let artifact;try{artifact=JSON.parse(fs.readFileSync(target,'utf8'));}catch{add('error',key,'evidence JSON is unreadable');continue;}
  if(artifact.candidate!=='v22')add('error',key,'artifact candidate must equal v22');
  if(artifact.method!==method)add('error',key,'artifact method must equal declared method');
  if(artifact.result!=='PASS'&&artifact.ok!==true)add('error',key,'artifact must declare PASS or ok true');
  if(Date.parse(artifact.checkedAt)!==date)add('error',key,'artifact checkedAt must match declared checkedAt');
  if(artifact.sourceHead&&!commitExists(artifact.sourceHead))add('error',key,'artifact sourceHead is not a known commit');
  record.valid=!findings.some(item=>item.level==='error'&&item.key===key);
 }
 const errors=findings.filter(item=>item.level==='error');
 const passed=records.filter(record=>record.status==='PASS'&&record.valid).map(record=>record.key);
 const notRun=records.filter(record=>record.status==='NOT_RUN'&&record.valid).map(record=>record.key);
 return {candidate:evidence?.candidate||null,auditPassed:errors.length===0,releaseReady:notRun.length===0&&errors.length===0,passed,notRun,findings,records};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'release-evidence-v22.json'),'utf8'));
 const result=auditReleaseEvidence(evidence);
 console.log(JSON.stringify(result,null,2));
 if(!result.auditPassed)process.exitCode=1;
}
