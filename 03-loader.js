// PATCH v4.13.0 — Loader natif APK/PWA, multilingue, polling robuste
(function(){
  'use strict';
  console.log('[LOADER v4.19.0] init');

  var L = (function(){
    var raw = '';
    try { raw = (localStorage.getItem('app_lang')||navigator.language||'en').toLowerCase(); } catch(_){ raw='en'; }
    if (raw.indexOf('fr')===0) return 'fr';
    if (raw.indexOf('es')===0) return 'es';
    if (raw.indexOf('pt')===0) return 'pt';
    return 'en';
  })();
  var T = {
    fr:{loading:'Chargement…',title:'Finance AI OS',err:'Erreur initialisation',retry:'Réessayer',offline:'Hors ligne — réessaie une fois connecté',clear:'Vider le cache & recharger'},
    en:{loading:'Loading…',title:'Finance AI OS',err:'Initialization error',retry:'Retry',offline:'Offline — retry when connected',clear:'Clear cache & reload'},
    es:{loading:'Cargando…',title:'Finance AI OS',err:'Error de inicialización',retry:'Reintentar',offline:'Sin conexión — reintenta al conectar',clear:'Borrar caché y recargar'},
    pt:{loading:'Carregando…',title:'Finance AI OS',err:'Erro de inicialização',retry:'Tentar novamente',offline:'Offline — tente quando conectado',clear:'Limpar cache e recarregar'}
  }[L];

  var overlay = document.createElement('div');
  overlay.id = 'loadingScreen';
  overlay.setAttribute('style','position:fixed;inset:0;background:#09090f;display:flex;align-items:center;justify-content:center;z-index:99999;color:#f1f5f9;font-family:Inter,-apple-system,sans-serif;');
  overlay.innerHTML = '<div style="text-align:center;padding:20px"><div style="font-size:48px;margin-bottom:16px">💰</div><div style="font-size:14px;margin-bottom:20px;color:#94a3b8">'+T.title+'</div><div style="width:40px;height:40px;border:3px solid rgba(139,92,246,.2);border-top-color:#8b5cf6;border-radius:50%;animation:fa-spin 1s linear infinite;margin:0 auto"></div><div id="ldStatus" style="margin-top:18px;font-size:12px;color:#64748b">'+T.loading+'</div><style>@keyframes fa-spin{to{transform:rotate(360deg)}}</style></div>';
  function attach(){ if(document.body && !document.getElementById('loadingScreen')) document.body.appendChild(overlay); }
  if (document.body) attach(); else document.addEventListener('DOMContentLoaded', attach);

  function hideLoader(){
    var el = document.getElementById('loadingScreen');
    if (!el) return;
    el.style.transition='opacity .4s ease';
    el.style.opacity='0';
    setTimeout(function(){ try{ el.remove(); }catch(_){}}, 450);
  }
  function setStatus(s){ var el=document.getElementById('ldStatus'); if(el) el.textContent=s; }

  function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];}); }

  function showError(msg, details){
    attach();
    var el = document.getElementById('loadingScreen');
    if (!el) return;
    var diagText = '';
    try {
      var errs = (window.__earlyErrors||[]).slice(-5).map(function(e){
        return '- '+(e.message||'')+(e.line?' @'+e.line+':'+e.col:'');
      }).join('\n');
      diagText = (errs?errs+'\n\n':'') + (details||'');
    } catch(_) { diagText = details||''; }
    var offlineNote = navigator.onLine ? '' : '<div style="color:#fbbf24;font-size:12px;margin-bottom:10px">⚠ '+T.offline+'</div>';
    el.innerHTML = '<div style="background:rgba(244,63,94,.08);border:2px solid #f43f5e;border-radius:14px;padding:22px;max-width:380px;margin:16px;text-align:center;color:#f1f5f9"><div style="font-size:38px;margin-bottom:10px">⚠️</div><div style="font-weight:700;margin-bottom:12px;font-size:16px">'+T.err+'</div>'+offlineNote+'<div style="font-size:12px;color:#cbd5e1;margin-bottom:14px;line-height:1.5;text-align:left;background:rgba(0,0,0,.35);padding:10px;border-radius:8px;max-height:160px;overflow:auto;font-family:ui-monospace,monospace;white-space:pre-wrap;word-break:break-word"><strong>'+escapeHtml(msg)+'</strong>\n\n'+escapeHtml(diagText)+'</div><button id="btnRetry" style="background:linear-gradient(135deg,#8b5cf6,#06b6d4);color:#fff;border:0;border-radius:10px;padding:13px 20px;font-weight:700;font-size:14px;width:100%;margin-bottom:8px;cursor:pointer">'+T.retry+'</button><button id="btnClear" style="background:transparent;color:#94a3b8;border:1px solid #2a2a3e;border-radius:10px;padding:11px 20px;font-size:13px;width:100%;cursor:pointer">'+T.clear+'</button></div>';
    var br=document.getElementById('btnRetry'); if(br) br.onclick=function(){location.reload();};
    var bc=document.getElementById('btnClear'); if(bc) bc.onclick=function(){
      try{ if('caches' in window){ caches.keys().then(function(ks){ Promise.all(ks.map(function(k){return caches.delete(k);})).then(function(){
        if(navigator.serviceWorker){ navigator.serviceWorker.getRegistrations().then(function(rs){ rs.forEach(function(r){r.unregister();}); location.reload(true); }); } else location.reload(true);
      }); }); } else location.reload(true);
      }catch(_){ location.reload(true); }
    };
  }

  var START = Date.now();
  var MAX_WAIT = 20000;
  var POLL_MS  = 150;
  var triedRender = false;

  function rootHasContent(){
    var r = document.getElementById('root');
    return !!(r && r.innerHTML && r.innerHTML.replace(/\s+/g,'').length > 30);
  }

  function poll(){
    if (rootHasContent()) { console.log('[LOADER] root has content — hide'); hideLoader(); return; }

    if (!triedRender && typeof window.render === 'function') {
      triedRender = true;
      try {
        setStatus(T.loading);
        var p = window.render();
        if (p && typeof p.then === 'function') {
          p.then(function(){ if(rootHasContent()) hideLoader(); else setTimeout(poll, POLL_MS); })
           .catch(function(e){ console.error('[LOADER] render() rejected', e); setTimeout(poll, POLL_MS); });
          return;
        } else {
          if (rootHasContent()) { hideLoader(); return; }
        }
      } catch(e){ console.error('[LOADER] render() threw', e); }
    }

    if (Date.now() - START < MAX_WAIT) { setTimeout(poll, POLL_MS); return; }

    var errs = (window.__earlyErrors||[]);
    var msg = errs.length ? (errs[0].message||'Script error') : 'App did not initialize in time';
    var details = '';
    try {
      details = 'render=' + (typeof window.render) +
                ' | root=' + (document.getElementById('root') ? 'OK' : 'MISSING') +
                ' | online=' + navigator.onLine +
                ' | sw=' + (('serviceWorker' in navigator) ? 'yes':'no') +
                ' | ua=' + (navigator.userAgent||'').slice(0,80);
    } catch(_){}
    showError(msg, details);
  }

  function start(){ setTimeout(poll, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  function syncOnline(){
    try { document.documentElement.setAttribute('data-online', navigator.onLine ? '1':'0'); } catch(_){}
  }
  window.addEventListener('online', syncOnline);
  window.addEventListener('offline', syncOnline);
  syncOnline();

  console.log('[LOADER v4.19.0] armed — lang='+L);
})();
