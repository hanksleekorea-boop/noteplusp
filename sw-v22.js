const CACHE="noteplusp-v22-shell-4";
const SHARE_CACHE="noteplusp-v22-share-inbox-v1";
const SHELL=["./노트앱_v22.html","./노트앱_core_v22.html","./google-drive-config-v18.js","./noteplus-drive-v22.js","./noteplus-portable-v22.js","./noteplus-telemetry-v1.js","./noteplus-v22.webmanifest","./icon.svg"];
const shellURLs=new Set(SHELL.map(item=>new URL(item,self.location.href).href));
const shareTargetURL=new URL("./share-target-v22",self.location.href).href;
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("noteplusp-v22-")&&key!==CACHE&&key!==SHARE_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
function cleanShareText(value,max){return String(value||"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,"").slice(0,max);}
function cleanShareURL(value){try{const url=new URL(String(value||""));return url.protocol==="http:"||url.protocol==="https:"?url.href.slice(0,2048):"";}catch{return "";}}
function shareToken(){const bytes=crypto.getRandomValues(new Uint8Array(16));return Array.from(bytes,byte=>byte.toString(16).padStart(2,"0")).join("");}
async function purgeExpiredShares(cache){const now=Date.now(),requests=await cache.keys();await Promise.all(requests.map(async request=>{const response=await cache.match(request),created=Number(response&&response.headers.get("x-noteplus-created-at"));if(!Number.isFinite(created)||now-created>86400000)await cache.delete(request);}));}
async function receiveShare(request){
  const form=await request.formData(),payload={title:cleanShareText(form.get("title"),300),text:cleanShareText(form.get("text"),20000),url:cleanShareURL(form.get("url"))};
  if(!payload.title&&!payload.text&&!payload.url)return Response.redirect(new URL("./노트앱_v22.html?action=share&shareError=empty",self.location.href),303);
  const token=shareToken(),cache=await caches.open(SHARE_CACHE),payloadURL=new URL("./_noteplus-share-v22/"+token,self.location.href).href;
  await purgeExpiredShares(cache);
  await cache.put(payloadURL,new Response(JSON.stringify(payload),{headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-noteplus-created-at":String(Date.now())}}));
  return Response.redirect(new URL("./노트앱_v22.html?action=share&token="+token,self.location.href),303);
}
self.addEventListener("fetch",event=>{
  if(event.request.method==="POST"&&event.request.url===shareTargetURL){event.respondWith(receiveShare(event.request));return;}
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);url.search="";url.hash="";
  // Never intercept OAuth, Drive, old releases, or arbitrary remote resources.
  if(!shellURLs.has(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(event.request,{cache:"no-store"});
      if(!response.ok)throw new Error("shell HTTP "+response.status);
      await cache.put(url.href,response.clone());return response;
    } catch(error){
      const cached=await cache.match(url.href);
      if(cached)return cached;
      return new Response("v22 오프라인 파일이 없습니다. 인터넷 연결 후 다시 열어 주세요.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
    }
  })());
});
