(function(global){
  "use strict";
  const STORAGE_KEY="noteplusp-v22-telemetry-v1";
  const ALLOWED_EVENTS=new Set(["app_open","local_save","drive_backup","drive_restore","import"]);
  const ALLOWED_STAGES=new Set(["start","success","error"]);
  let memory={schema:1,enabled:false,events:[]};
  function cleanCode(value){value=String(value||"").toUpperCase();return /^[A-Z][A-Z0-9_]{0,39}$/.test(value)?value:"OTHER";}
  function durationBucket(value){value=Number(value);if(!Number.isFinite(value)||value<0)return "unknown";if(value<100)return "under_100ms";if(value<500)return "100_499ms";if(value<2000)return "500_1999ms";return "2000ms_plus";}
  function countBucket(value){value=Math.max(0,Math.floor(Number(value)||0));if(value===0)return "0";if(value===1)return "1";if(value<=10)return "2_10";if(value<=100)return "11_100";if(value<=1000)return "101_1000";return "1001_plus";}
  function validEvent(event){return event&&event.schema===1&&ALLOWED_EVENTS.has(event.event)&&ALLOWED_STAGES.has(event.stage)&&["ok","error"].includes(event.status)&&typeof event.errorCode==="string"&&typeof event.durationBucket==="string"&&typeof event.countBucket==="string"&&Object.keys(event).every(function(key){return ["schema","event","stage","status","errorCode","durationBucket","countBucket"].includes(key);});}
  function normalize(value){var item=value&&typeof value==="object"?value:{},events=Array.isArray(item.events)?item.events:[];return {schema:1,enabled:item.enabled===true,events:events.filter(validEvent).slice(-100).map(function(event){return Object.assign({},event);})};}
  function load(){try{var raw=localStorage.getItem(STORAGE_KEY);memory=raw?normalize(JSON.parse(raw)):normalize(null);}catch(ignore){memory=normalize(null);}return settings();}
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(memory));return true;}catch(ignore){return false;}}
  function settings(){return {enabled:memory.enabled,eventCount:memory.events.length};}
  function setEnabled(enabled){memory.enabled=enabled===true;if(!memory.enabled)memory.events=[];save();return settings();}
  function record(input){if(!memory.enabled)return false;input=input&&typeof input==="object"?input:{};var event=ALLOWED_EVENTS.has(input.event)?input.event:"app_open",stage=ALLOWED_STAGES.has(input.stage)?input.stage:"error",status=input.status==="ok"?"ok":"error",item={schema:1,event:event,stage:stage,status:status,errorCode:status==="ok"?"NONE":cleanCode(input.errorCode),durationBucket:durationBucket(input.durationMs),countBucket:countBucket(input.count)};memory.events.push(item);memory.events=memory.events.slice(-100);save();return true;}
  function preview(){return memory.events.map(function(event){return Object.assign({},event);});}
  function clear(){memory.events=[];save();return settings();}
  load();
  global.noteplusTelemetry=Object.freeze({storageKey:STORAGE_KEY,getSettings:settings,setEnabled:setEnabled,record:record,preview:preview,clear:clear,reload:load,durationBucket:durationBucket,countBucket:countBucket});
})(window);
