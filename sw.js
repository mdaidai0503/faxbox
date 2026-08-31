const CACHE='faxbox-v1.5.1';
const ASSETS=['./','./index.html','./manifest.webmanifest','./push-config.js','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('faxbox-')&&k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
])));

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin){e.respondWith(fetch(e.request));return;}
  e.respondWith(
    fetch(e.request)
      .then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return res})
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});

self.addEventListener('push',event=>{
  let data={};
  try{ data=event.data?event.data.json():{}; }catch{}
  const badge=Math.max(0,Number(data.badge)||0);
  const title=data.title||'FAXBOX';
  const body=data.body||(badge>0?`未送信FAXが${badge}件あります`:'未送信FAXはありません');
  const url=data.url||'./';

  const tasks=[];
  try{
    if(badge>0 && self.navigator.setAppBadge) tasks.push(self.navigator.setAppBadge(badge));
    else if(badge===0 && self.navigator.clearAppBadge) tasks.push(self.navigator.clearAppBadge());
  }catch{}

  // iPhone/iPadのWeb Pushは、バックグラウンドPushごとにユーザーに見える通知が必要です。
  tasks.push(self.registration.showNotification(title,{
    body,
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    tag:'faxbox-unsent-count',
    renotify:false,
    data:{url}
  }));
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification.data?.url||'./';
  event.waitUntil((async()=>{
    const list=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of list){
      if('focus' in c){await c.focus();return;}
    }
    if(clients.openWindow)return clients.openWindow(url);
  })());
});
