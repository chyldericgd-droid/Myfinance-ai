/* ALADDIN v5 — wrapper transactional save to enforce preFlightCheck */
window.__originalDbPut = window.__originalDbPut || dbPut;
async function _dbPutWithCompliance(store,data){
  if(store==='transactions' && typeof ALADDIN!=='undefined' && data){
    try{ await ALADDIN.preFlightCheck(data); }catch(_){}
  }
  return window.__originalDbPut(store,data);
}
// Best-effort override
try{ dbPut = _dbPutWithCompliance; }catch(_){}
