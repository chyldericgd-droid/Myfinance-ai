(function(){
  window.__earlyErrors = [];
  window.addEventListener('error', function(e){
    try { window.__earlyErrors.push({type:'error',message:(e&&e.message)||'unknown',source:(e&&e.filename)||'',line:(e&&e.lineno)||0,col:(e&&e.colno)||0,stack:(e&&e.error&&e.error.stack)||''}); } catch(_){}
  }, true);
  window.addEventListener('unhandledrejection', function(e){
    try { window.__earlyErrors.push({type:'promise',message:String((e&&e.reason&&(e.reason.message||e.reason))||'unhandled rejection'),stack:(e&&e.reason&&e.reason.stack)||''}); } catch(_){}
  });
})();
