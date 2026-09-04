(function(root){
  'use strict';
  var VERSION='v22-stage3-local-contract-1';
  var DAY=86400000, MAX_SHARE_DAYS=30;
  var memory={shares:[],spaces:[],settings:{locale:'ko'}};
  function storage(){try{return root.localStorage||null;}catch(e){return null;}}
  function read(){var s=storage();if(!s)return memory;try{var v=JSON.parse(s.getItem('noteplusp_stage3')||'null');if(!v||typeof v!=='object')return memory;return {shares:Array.isArray(v.shares)?v.shares:[],spaces:Array.isArray(v.spaces)?v.spaces:[],settings:(v.settings&&typeof v.settings==='object')?v.settings:{locale:'ko'}};}catch(e){return memory;}}
  function write(v){memory=v;var s=storage();if(!s)return false;try{s.setItem('noteplusp_stage3',JSON.stringify(v));return true;}catch(e){return false;}}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function iso(ms){return new Date(ms).toISOString();}
  function id(prefix){var bytes=new Uint8Array(16);try{if(root.crypto&&root.crypto.getRandomValues)root.crypto.getRandomValues(bytes);}catch(e){}var out='';for(var i=0;i<bytes.length;i++)out+=bytes[i].toString(16).padStart(2,'0');return prefix+out;}
  function cleanText(v,max){return String(v==null?'':v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max);}
  function requireString(v,name,max){var s=cleanText(v,max);if(!s)throw Error(name+'이(가) 필요합니다.');return s;}
  function canonical(v){return JSON.stringify(v,Object.keys(v).sort());}
  function fingerprint(v){var s=canonical(v),h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return ('00000000'+(h>>>0).toString(16)).slice(-8);}

  /* S3-001: 보기 전용, 만료·회수 가능한 로컬 계약. 서버 전송은 하지 않는다. */
  function createShare(input, clock){
    input=input||{};var now=Number(clock||Date.now());if(!Number.isFinite(now))now=Date.now();
    var noteId=requireString(input.noteId,'노트 ID',160), title=cleanText(input.title,160)||'제목 없음', body=cleanText(input.body,200000);
    var expires=Number(input.expiresAt);if(!Number.isFinite(expires))expires=now+7*DAY;
    if(expires<=now||expires>now+MAX_SHARE_DAYS*DAY)throw Error('공유 만료일은 오늘 이후 30일 안에서 정해야 합니다.');
    var record={version:1,token:id('sh_'),noteId:noteId,title:title,body:body,permission:'view',createdAt:iso(now),expiresAt:iso(expires),revokedAt:null,accessCount:0};
    var db=read();db.shares=db.shares.filter(function(x){return x.token!==record.token;});db.shares.push(record);write(db);return clone(record);
  }
  function resolveShare(token,clock){var now=Number(clock||Date.now());var db=read(),r=db.shares.find(function(x){return x.token===String(token||'');});if(!r)return null;if(r.revokedAt||Date.parse(r.expiresAt)<=now)return null;r.accessCount=Math.min(999999,(Number(r.accessCount)||0)+1);write(db);var result=clone(r);delete result.body;result.body=cleanText(r.body,200000);return result;}
  function revokeShare(token,reason,clock){var db=read(),r=db.shares.find(function(x){return x.token===String(token||'');});if(!r||r.revokedAt)return false;r.revokedAt=iso(Number(clock||Date.now()));r.revokeReason=cleanText(reason,120)||'사용자 회수';write(db);return true;}
  function listShares(noteId){var db=read();return db.shares.filter(function(x){return !noteId||x.noteId===noteId;}).map(clone);}

  /* S3-002: AI는 미리보기·명시 승인·비용 상한·주입 어댑터 없이는 실행되지 않는다. */
  function previewAi(input){input=input||{};var fields=Array.isArray(input.fields)?input.fields.filter(function(x){return ['title','body'].includes(x);}):['title','body'];if(!fields.length)throw Error('보낼 항목을 하나 이상 선택하세요.');if(input.allVault===true)throw Error('전체 보관함 자동 전송은 금지되어 있습니다.');var body=cleanText(input.body,200000),title=cleanText(input.title,160);var payload={noteId:requireString(input.noteId,'노트 ID',160),provider:cleanText(input.provider,80)||'미지정 제공자',purpose:cleanText(input.purpose,160)||'사용자 요청 처리',fields:fields,retentionDays:Math.max(0,Math.min(30,Number(input.retentionDays)||0)),costCents:Math.max(0,Math.min(10000,Number(input.costCents)||0)),title:fields.includes('title')?title:'',body:fields.includes('body')?body:'',createdAt:iso(Date.now())};return {version:1,previewId:id('ai_'),payload:payload,bytes:payload.title.length+payload.body.length,signature:fingerprint(payload),approved:false,networkTransmission:false};}
  function approveAi(preview,options){if(!preview||!preview.payload||preview.networkTransmission!==false)throw Error('AI 미리보기 형식이 안전하지 않습니다.');options=options||{};if(options.confirm!==true)throw Error('AI 전송은 명시적으로 확인해야 합니다.');var out=clone(preview);out.approved=true;out.approvedAt=iso(Date.now());out.maxCostCents=Math.max(0,Math.min(10000,Number(options.maxCostCents==null?preview.payload.costCents:options.maxCostCents)||0));return out;}
  async function runAi(preview,adapter){if(!preview||preview.approved!==true)throw Error('승인된 AI 미리보기만 실행할 수 있습니다.');if(typeof adapter!=='function')throw Error('AI 제공자가 연결되지 않았습니다. 원본은 그대로 유지됩니다.');var result=await adapter(clone(preview.payload));return {previewId:preview.previewId,provider:preview.payload.provider,result:result,sourceSignature:preview.signature,originalChanged:false};}

  /* S3-003: 최소 역할 모델. 서버 없는 상태에서는 로컬 시험 데이터만 만든다. */
  var ROLE_RANK={viewer:1,editor:2,owner:3};
  function createSpace(input){input=input||{};var owner=requireString(input.ownerId,'소유자',160),name=requireString(input.name,'공간 이름',120),db=read(),space={version:1,spaceId:id('sp_'),name:name,ownerId:owner,members:[{memberId:owner,role:'owner',status:'active'}],audit:[]};space.audit.push({at:iso(Date.now()),actorId:owner,action:'space_created'});db.spaces.push(space);write(db);return clone(space);}
  function authorize(space,actor,needed){var s=space&&space.members&&space.members.find(function(m){return m.memberId===actor&&m.status==='active';});return !!(s&&ROLE_RANK[s.role]>=ROLE_RANK[needed||'viewer']);}
  function inviteMember(spaceId,actor,memberId,role){if(!['viewer','editor'].includes(role))throw Error('초대 역할은 보기 또는 편집만 가능합니다.');var db=read(),s=db.spaces.find(function(x){return x.spaceId===spaceId;});if(!s||!authorize(s,actor,'owner'))throw Error('소유자만 구성원을 초대할 수 있습니다.');memberId=requireString(memberId,'구성원',160);if(s.members.some(function(m){return m.memberId===memberId&&m.status==='active';}))throw Error('이미 활성 구성원입니다.');s.members.push({memberId:memberId,role:role,status:'active'});s.audit.push({at:iso(Date.now()),actorId:actor,action:'member_invited',memberId:memberId,role:role});write(db);return clone(s);}
  function changeRole(spaceId,actor,memberId,role){if(!['viewer','editor','owner'].includes(role))throw Error('알 수 없는 역할입니다.');var db=read(),s=db.spaces.find(function(x){return x.spaceId===spaceId;});if(!s||!authorize(s,actor,'owner'))throw Error('소유자만 역할을 바꿀 수 있습니다.');var m=s.members.find(function(x){return x.memberId===memberId&&x.status==='active';});if(!m)throw Error('활성 구성원이 아닙니다.');if(m.memberId===s.ownerId&&role!=='owner')throw Error('소유자는 먼저 소유권 이전을 명시해야 합니다.');m.role=role;s.audit.push({at:iso(Date.now()),actorId:actor,action:'role_changed',memberId:memberId,role:role});write(db);return clone(s);}
  function removeMember(spaceId,actor,memberId){var db=read(),s=db.spaces.find(function(x){return x.spaceId===spaceId;});if(!s||!authorize(s,actor,'owner'))throw Error('소유자만 구성원을 제거할 수 있습니다.');if(memberId===s.ownerId)throw Error('소유자는 제거할 수 없습니다. 소유권 이전이 먼저입니다.');var m=s.members.find(function(x){return x.memberId===memberId&&x.status==='active';});if(!m)return false;m.status='removed';m.removedAt=iso(Date.now());s.audit.push({at:m.removedAt,actorId:actor,action:'member_removed',memberId:memberId});write(db);return true;}

  /* S3-004: 한국어 정본을 유지한 최소 다국어 계약. */
  var messages={ko:{stage3:'3단계 확장 기능(시험)',localOnly:'현재는 이 기기에만 저장됩니다.',share:'만료·회수 공유',ai:'AI 전송 미리보기',team:'팀 권한 점검',ops:'운영훈련 시뮬레이션',gate:'출시 게이트'},en:{stage3:'Stage 3 extensions (test)',localOnly:'Stored on this device only.',share:'Expiring share',ai:'AI transfer preview',team:'Team permissions',ops:'Operations drill',gate:'Release gate'}};
  function setLocale(locale){var db=read();db.settings.locale=messages[locale]?locale:'ko';write(db);return db.settings.locale;}
  function t(key,locale){var l=locale||read().settings.locale||'ko';return (messages[l]&&messages[l][key])||(messages.ko[key]||key);}
  function missingTranslations(){return Object.keys(messages.ko).filter(function(k){return !messages.en[k];});}

  /* S3-005: 실제 장애가 아닌 재현 가능한 운영훈련 시뮬레이션. */
  var SCENARIOS={share_recall:['공유 링크 생성','접근 기록 확인','회수 실행','회수 뒤 접근 차단 확인'],drive_outage:['Drive 장애 표시','로컬 편집 유지','완료 포인터 보존','복구 뒤 사용자가 다시 백업'],ai_outage:['AI 제공자 오류 표시','원문 보존','재시도 선택','AI 없이 핵심 과업 유지'],storage_full:['저장공간 경고','전체 반출 안내','새 자동 저장 보류','자료 삭제 없이 복구']};
  function operationsDrill(name){name=SCENARIOS[name]?name:'share_recall';var steps=SCENARIOS[name].map(function(label,i){return {step:i+1,label:label,status:'PASS',evidence:'synthetic-local'};});return {version:1,scenario:name,startedAt:iso(Date.now()),steps:steps,realIncident:false,requiresOperatorReview:true};}

  /* S3-006/007/008: 외부 검토·재비교·출시 판정용 메타데이터 계약. */
  function reviewPacket(input){input=input||{};var checks=Array.isArray(input.checks)?input.checks.map(function(c){return {id:cleanText(c.id,80),status:['PASS','FAIL','NOT_RUN'].includes(c.status)?c.status:'NOT_RUN',owner:cleanText(c.owner,120),due:cleanText(c.due,40)};}):[];return {version:1,candidate:cleanText(input.candidate,40)||'v22',method:cleanText(input.method,160)||'독립 검토 필요',createdAt:iso(Date.now()),checks:checks,containsPersonalNotes:false,reviewerVerified:false};}
  function comparisonManifest(input){input=input||{};var fields=Array.isArray(input.fields)?input.fields:[],ids=fields.map(function(f){return f&&f.id;}).filter(Boolean),weights=fields.map(function(f){return Number(f.weight);});if(ids.length!==27||new Set(ids).size!==27)throw Error('27개 비교 분야가 필요합니다.');if(weights.some(function(w){return !Number.isFinite(w)||w<=0;}))throw Error('모든 비교 가중치를 확인하세요.');return {version:1,fieldCount:27,ids:ids,weightTotal:weights.reduce(function(a,b){return a+b;},0),sameWeights:true,sourcesVerified:false,actualUsersVerified:false};}
  function releaseGate(input){input=input||{};var owners=['operator','supportContact','privacyContact','jurisdiction','incidentOwner','supportResponseHours','termsReview'],evidence=['drivePcAndroidRoundtrip','talkBack','threeNonDeveloperPilots','operationsDrill'],blockers=[];owners.forEach(function(k){if(!input.owners||!input.owners[k])blockers.push('OWNER:'+k);});evidence.forEach(function(k){if(!input.evidence||input.evidence[k]!==true)blockers.push('EVIDENCE:'+k);});return {candidate:'v22',releaseAllowed:blockers.length===0,blockers:blockers,localContracts:true,automaticDeployment:false};}
  function reset(){memory={shares:[],spaces:[],settings:{locale:'ko'}};var s=storage();try{if(s)s.removeItem('noteplusp_stage3');}catch(e){}return true;}

  var api={VERSION:VERSION,share:{create:createShare,resolve:resolveShare,revoke:revokeShare,list:listShares},ai:{preview:previewAi,approve:approveAi,run:runAi},team:{createSpace:createSpace,authorize:authorize,invite:inviteMember,changeRole:changeRole,remove:removeMember},i18n:{setLocale:setLocale,t:t,missing:missingTranslations},operations:{scenarios:Object.keys(SCENARIOS),drill:operationsDrill},review:{packet:reviewPacket},compare:{manifest:comparisonManifest},gate:releaseGate,reset:reset,localOnly:true};
  root.noteplusStage3=api;

  function installUI(){
    if(!root.document||root.document.getElementById('v22Stage3Panel'))return;
    var panel=root.document.createElement('section');panel.id='v22Stage3Panel';panel.className='cloud-panel full';panel.setAttribute('aria-labelledby','v22Stage3Title');panel.style.marginTop='10px';
    var title=root.document.createElement('h2');title.id='v22Stage3Title';title.textContent=t('stage3');title.style.fontSize='15px';
    var note=root.document.createElement('p');note.textContent=t('localOnly')+' 공유·AI·팀은 외부 연결 전까지 시험 계약만 제공합니다.';note.style.fontSize='12px';
    var result=root.document.createElement('p');result.id='v22Stage3Result';result.setAttribute('role','status');result.setAttribute('aria-live','polite');result.textContent='외부 전송 없음 · 기본 꺼짐';
    function btn(label,fn){var b=root.document.createElement('button');b.type='button';b.className='backup-btn';b.textContent=label;b.style.margin='3px';b.onclick=fn;return b;}
    function selected(){var st=root.state||{};var notes=Array.isArray(st.notes)?st.notes:[];var ui=root.ui||{};return notes.find(function(n){return n.id===ui.selectedId;})||notes[0]||null;}
    panel.append(title,note,btn(t('share'),function(){var n=selected();if(!n){result.textContent='먼저 공유할 노트를 선택하세요.';return;}try{var r=createShare({noteId:n.id,title:n.title,body:n.body||''});result.textContent='시험 공유 생성: '+r.token+' · '+r.expiresAt+' · 보기 전용';}catch(e){result.textContent='공유 생성 중단: '+e.message;}}),btn(t('ai'),function(){var n=selected();if(!n){result.textContent='먼저 AI 미리보기 노트를 선택하세요.';return;}try{var p=previewAi({noteId:n.id,title:n.title,body:n.body||'',fields:['title','body']});result.textContent='AI 미리보기만 생성됨 · 전송 0 · 글자 '+p.bytes+' · 승인 전';}catch(e){result.textContent='AI 미리보기 중단: '+e.message;}}),btn(t('team'),function(){var r=releaseGate({});result.textContent='팀/공유 권한은 외부 서버 미연결 · 게이트 차단 '+r.blockers.length+'개';}),btn(t('ops'),function(){var d=operationsDrill('share_recall');result.textContent='운영훈련 합성 '+d.steps.length+'단계 PASS · 실제 장애 아님';}),btn(t('gate'),function(){var g=releaseGate({});result.textContent=g.releaseAllowed?'출시 조건 모두 확인됨':'출시 보류 · 차단 '+g.blockers.length+'개';}),btn('EN/한국어',function(){var l=setLocale((read().settings.locale||'ko')==='ko'?'en':'ko');title.textContent=t('stage3',l);note.textContent=t('localOnly',l)+' 공유·AI·팀은 외부 연결 전까지 시험 계약만 제공합니다.';result.textContent='표시 언어: '+l;}),result);
    var side=root.document.querySelector('.sidebar');if(side)side.append(panel);else root.document.body.append(panel);
  }
  if(root.document) { if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',installUI);else installUI(); }
})(typeof window==='object'?window:globalThis);
