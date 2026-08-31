import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {findTalkBackService,parseAdbDevices,runTalkBackPreflight,selectOnlineDevice} from '../tools/android_talkback_preflight_v22.mjs';

const now=Date.parse('2026-08-26T10:00:00.000Z');
assert.deepEqual(parseAdbDevices('List of devices attached\nR3CR106852H\tdevice product:x\nblocked\toffline\n'),[{serial:'R3CR106852H',state:'device'},{serial:'blocked',state:'offline'}]);
assert.equal(selectOnlineDevice([{serial:'one',state:'device'},{serial:'two',state:'device'}]),null);
assert.equal(selectOnlineDevice([{serial:'one',state:'device'}],'one').serial,'one');
assert.equal(findTalkBackService('com.samsung.android.accessibility.talkback/com.samsung.android.marvin.talkback.TalkBackService'),'com.samsung.android.accessibility.talkback/com.samsung.android.marvin.talkback.TalkBackService');

const noDevice=runTalkBackPreflight({now,run:(_bin,args)=>{assert.deepEqual(args,['devices','-l']);return 'List of devices attached\n';}});
assert.equal(noDevice.result,'SKIP_NO_DEVICE');
assert.equal(noDevice.checkedAt,'2026-08-26T10:00:00.000Z');

const commands=[];
const service='com.samsung.android.accessibility.talkback/com.samsung.android.marvin.talkback.TalkBackService';
const ready=runTalkBackPreflight({now,run:(_bin,args)=>{
 commands.push(args);
 if(args.length===2)return 'List of devices attached\nserial-a\tdevice\n';
 const command=args.slice(3).join(' ');
 if(command==='am get-current-user')return '0\n';
 if(command==='dumpsys package com.samsung.android.accessibility.talkback')return `Package [com.samsung.android.accessibility.talkback]\nServices:\n ${service}\n`;
 if(command==='settings get secure enabled_accessibility_services')return `${service}:other/service\n`;
 if(command==='settings get secure accessibility_enabled')return '1\n';
 if(command==='settings get secure touch_exploration_enabled')return '1\n';
 throw new Error(`unexpected command: ${command}`);
}});
assert.equal(ready.result,'READY_FOR_REVERSIBLE_TRIAL');
assert.equal(ready.talkBackConfigured,true);
assert.equal(ready.accessibilityEnabled,true);
assert.equal(ready.touchExplorationEnabled,true);
assert.equal(Object.hasOwn(ready,'serial'),false);
assert.equal(commands.some(args=>args.join(' ').includes(' settings put ')||args.join(' ').includes(' settings delete ')),false);
const source=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','tools','android_talkback_preflight_v22.mjs'),'utf8');
assert.equal(/settings\s+(?:put|delete)\b/.test(source),false);
console.log('PASS v22 Android TalkBack preflight is read-only, privacy-safe, and never becomes task PASS evidence');