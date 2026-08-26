import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const talkBackPackages=['com.samsung.android.accessibility.talkback','com.google.android.marvin.talkback'];
const servicePattern=/([A-Za-z0-9._-]+)\/([A-Za-z0-9._$-]*TalkBack[A-Za-z0-9._$-]*)/g;

export function parseAdbDevices(text){
 return String(text).split(/\r?\n/).slice(1).map(line=>line.trim().split(/\s+/)).filter(parts=>parts.length>=2&&parts[0]&&parts[1]).map(([serial,state])=>({serial,state}));
}

export function selectOnlineDevice(devices,requestedSerial=''){
 const online=devices.filter(device=>device.state==='device');
 if(requestedSerial)return online.find(device=>device.serial===requestedSerial)||null;
 return online.length===1?online[0]:null;
}

export function findTalkBackService(packageDetails){
 const match=[...String(packageDetails).matchAll(servicePattern)].find(item=>talkBackPackages.includes(item[1]));
 return match?`${match[1]}/${match[2]}`:null;
}

function createResult(result,now,extra={}){
 return {schema:1,candidate:'v22',method:'physical-device-preflight',result,checkedAt:new Date(now).toISOString(),...extra};
}

export function runTalkBackPreflight({adbPath='adb',requestedSerial='',now=Date.now(),run}={}){
 if(typeof run!=='function')throw new Error('A read-only adb command runner is required.');
 const devices=parseAdbDevices(run(adbPath,['devices','-l']));
 const online=devices.filter(device=>device.state==='device');
 const selected=selectOnlineDevice(devices,requestedSerial);
 if(!selected){
  const result=requestedSerial?(online.length?'SKIP_REQUESTED_DEVICE_NOT_ONLINE':'SKIP_NO_DEVICE'):(online.length?'BLOCKED_DEVICE_SELECTION':'SKIP_NO_DEVICE');
  return createResult(result,now,{adbOnlineDeviceCount:online.length,reason:result==='BLOCKED_DEVICE_SELECTION'?'Connect one device or explicitly choose one; no device identifier is recorded.':'Connect the approved Android test device and run this read-only preflight again.'});
 }
 const shell=(...args)=>run(adbPath,['-s',selected.serial,'shell',...args]).trim();
 const currentUser=shell('am','get-current-user');
 let packageName=null,packageDetails='';
 for(const candidate of talkBackPackages){
  const details=shell('dumpsys','package',candidate);
  if(details&&/Package \[|Services:|Activity Resolver Table:|versionName=/.test(details)){packageName=candidate;packageDetails=details;break;}
 }
 if(!packageName)return createResult('BLOCKED_NO_TALKBACK_PACKAGE',now,{adbOnlineDeviceCount:1,currentUser,reason:'A supported TalkBack package was not found. Do not install or change accessibility settings as part of this preflight.'});
 const enabledAccessibilityServices=shell('settings','get','secure','enabled_accessibility_services');
 const service=findTalkBackService(packageDetails);
 const serviceConfigured=Boolean(service&&enabledAccessibilityServices.includes(service));
 const accessibilityEnabled=shell('settings','get','secure','accessibility_enabled')==='1';
 const touchExplorationEnabled=shell('settings','get','secure','touch_exploration_enabled')==='1';
 return createResult('READY_FOR_REVERSIBLE_TRIAL',now,{adbOnlineDeviceCount:1,currentUser,talkBackPackage:packageName,talkBackServiceDetected:Boolean(service),talkBackConfigured:serviceConfigured,accessibilityEnabled,touchExplorationEnabled,reason:'Read-only preflight only. This is not TalkBack task evidence and does not change device settings.'});
}

function liveRun(adbPath,args){
 const child=spawnSync(adbPath,args,{encoding:'utf8'});
 if(child.error)throw child.error;
 if(child.status!==0)throw new Error(`adb command failed (${child.status}): ${String(child.stderr||'').trim()}`);
 return String(child.stdout||'');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const adbPath=process.env.NOTEPLUS_ADB_PATH||'adb';
 const requestedSerial=process.env.NOTEPLUS_ANDROID_SERIAL||'';
 console.log(JSON.stringify(runTalkBackPreflight({adbPath,requestedSerial,run:liveRun}),null,2));
}