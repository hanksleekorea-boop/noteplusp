import assert from 'node:assert/strict';
import {evaluateGate} from '../tools/check_release_gate_v22.mjs';
const now=Date.now(),owner={operator:'TEST ONLY',supportContact:'test',privacyContact:'test',jurisdiction:'test',incidentOwner:'test',supportResponseHours:24,termsReviewed:true,reviewedAt:new Date(now).toISOString()};
const methods={androidPhysical:'physical-device',drivePcAndroidRoundtrip:'real-account-device',talkBack:'physical-device',threeNonDeveloperPilots:'human-users',representativeLargeLibrary:'attachment-rich-dataset',operationsDrill:'operator-observed'};
const evidence={schema:1,candidate:'v22',checks:Object.fromEntries(Object.entries(methods).map(([key,method])=>[key,{status:'PASS',method,evidence:'TEST ONLY',checkedAt:new Date(now).toISOString(),participants:3}]))};
assert.equal(evaluateGate(owner,evidence,()=>true,now).releaseAllowed,true);
for(const key of Object.keys(methods)){const copy=structuredClone(evidence);copy.checks[key].status='NOT_RUN';assert.equal(evaluateGate(owner,copy,()=>true,now).releaseAllowed,false);}
assert.equal(evaluateGate(owner,evidence,()=>false,now).releaseAllowed,false);
assert.equal(evaluateGate({...owner,operator:null},evidence,()=>true,now).releaseAllowed,false);
assert.equal(evaluateGate(owner,evidence,()=>true,now+31*86400000).releaseAllowed,false);
const missingCount=structuredClone(evidence);delete missingCount.checks.threeNonDeveloperPilots.participants;assert.equal(evaluateGate(owner,missingCount,()=>true,now).releaseAllowed,false);
console.log('PASS release-gate logic positive synthetic fixture and 10 blocking controls; not actual release approval');
