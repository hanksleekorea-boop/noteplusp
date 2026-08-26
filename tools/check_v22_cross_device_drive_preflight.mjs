import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const clientConfig=path.join(root,'google-drive-config-v18.js');

function originOf(value){try{const url=new URL(String(value||''));return url.protocol==='https:'?url.origin:null;}catch{return null;}}
function projectNumber(clientId){const match=/^(\d+)-[^.]+\.apps\.googleusercontent\.com$/.exec(String(clientId||''));return match?match[1]:null;}
function deviceCount(text){return String(text||'').split(/\r?\n/).filter(line=>/\tdevice\b/.test(line)).length;}
export async function cdpEndpointReady(value){try{if(!value)return false;const response=await fetch(new URL('/json/version',String(value)).toString());return response.ok;}catch{return false;}}
export function evaluatePreflight({clientId,pcUrl,androidUrl,adbOutput='',cloudProjectNumbers=null,pcCdpReady=false,androidCdpReady=false}){
 const number=projectNumber(clientId),pcOrigin=originOf(pcUrl),androidOrigin=originOf(androidUrl),blockers=[];
 if(!number)blockers.push('OAUTH_CLIENT_ID_INVALID');
 if(!pcOrigin)blockers.push('PC_V22_HTTPS_URL_REQUIRED');
 if(!androidOrigin)blockers.push('ANDROID_V22_HTTPS_URL_REQUIRED');
 if(pcCdpReady!==true)blockers.push('PC_CDP_ENDPOINT_UNAVAILABLE');
 if(androidCdpReady!==true)blockers.push('ANDROID_CDP_ENDPOINT_UNAVAILABLE');
 if(deviceCount(adbOutput)<1)blockers.push('ANDROID_DEVICE_UNAVAILABLE');
 if(!Array.isArray(cloudProjectNumbers))blockers.push('OAUTH_PROJECT_ACCESS_UNVERIFIED');
 else if(number&&!cloudProjectNumbers.includes(number))blockers.push('OAUTH_PROJECT_ACCESS_UNAVAILABLE');
 return {schema:1,candidate:'v22',method:'cross-device-preflight',result:blockers.length?'BLOCKED':'READY',noDataWritten:true,clientProjectNumber:number,origins:{pc:pcOrigin,android:androidOrigin},adbOnlineDeviceCount:deviceCount(adbOutput),cloudProjectAccessChecked:Array.isArray(cloudProjectNumbers),cdpEndpoints:{pc:pcCdpReady===true,android:androidCdpReady===true},blockers,nextAction:blockers.length?'Resolve every listed blocker before the real-account device test.':'Run tests/test_physical_cross_device_v22_drive_real_v1.mjs.'};
}
function commandText(command,args){const result=spawnSync(command,args,{encoding:'utf8',windowsHide:true,shell:process.platform==='win32'});return result.status===0?String(result.stdout||''):'';}
function readClientId(){const text=fs.readFileSync(clientConfig,'utf8'),match=/clientId:\s*["']([^"']+)["']/.exec(text);return match?.[1]||'';}
function cloudProjectNumbers(){const text=commandText('gcloud',['projects','list','--format=value(projectNumber)','--limit=100']);return text?text.split(/\r?\n/).map(value=>value.trim()).filter(Boolean):null;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const pcCdp=process.env.NOTEPLUS_PC_CDP||'',androidCdp=process.env.NOTEPLUS_ANDROID_CDP||'';
 const result=evaluatePreflight({clientId:readClientId(),pcUrl:process.env.NOTEPLUS_PC_V22_URL||'',androidUrl:process.env.NOTEPLUS_ANDROID_V22_URL||'',adbOutput:commandText('adb',['devices','-l']),cloudProjectNumbers:cloudProjectNumbers(),pcCdpReady:await cdpEndpointReady(pcCdp),androidCdpReady:await cdpEndpointReady(androidCdp)});
 console.log(JSON.stringify(result,null,2));
 if(result.result!=='READY')process.exitCode=2;
}