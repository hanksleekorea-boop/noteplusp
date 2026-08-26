const CACHE="noteplusp-v22-shell-1";
const SHELL=["./노트앱_v22.html","./노트앱_core_v22.html","./google-drive-config-v18.js","./noteplus-drive-v22.js","./noteplus-portable-v22.js","./noteplus-v22.webmanifest","./icon.svg"];
const shellURLs=new Set(SHELL.map(item=>new URL(item,self.location.href).href));
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("noteplusp-v22-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
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
