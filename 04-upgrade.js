/* ═══════════════════════════════════════════════════════════════════
   Finance AI OS — UPGRADE v5.1 (non destructif)
   • Intent Queue offline (chat) + sync auto au retour réseau
   • Contextual payload + system prompt durci (tutoiement / JSON)
   • Conversion automatique des montants au changement de devise
   • Bandeau de mise à jour Service Worker
   • Cartes IA dynamiques (déjà appliqué côté CSS)
   Aucune fonction existante n'est supprimée — uniquement enveloppée.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const log=(...a)=>{try{console.log('%c[FinOS-Upgrade]','color:#8b5cf6;font-weight:700',...a)}catch(e){}};

/* ─────────────────────────────────────────────────────────────────
   1. INTENT QUEUE (IndexedDB séparée pour ne pas migrer FinOS_v3)
   ───────────────────────────────────────────────────────────────── */
const IQ_DB='FinOS_intents', IQ_STORE='queue';
function iqOpen(){return new Promise((res,rej)=>{
  const r=indexedDB.open(IQ_DB,1);
  r.onupgradeneeded=e=>{const d=e.target.result;
    if(!d.objectStoreNames.contains(IQ_STORE))
      d.createObjectStore(IQ_STORE,{keyPath:'id',autoIncrement:true});
  };
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
});}
async function iqPush(item){
  const db=await iqOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction(IQ_STORE,'readwrite');
    const req=tx.objectStore(IQ_STORE).add(Object.assign({createdAt:Date.now(),status:'PENDING_SYNC'},item));
    req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
  });
}
async function iqAll(){const db=await iqOpen();return new Promise((res,rej)=>{
  const r=db.transaction(IQ_STORE,'readonly').objectStore(IQ_STORE).getAll();
  r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error);
});}
async function iqDel(id){const db=await iqOpen();return new Promise(res=>{
  const tx=db.transaction(IQ_STORE,'readwrite');
  tx.objectStore(IQ_STORE).delete(id); tx.oncomplete=()=>res();
});}
async function iqCount(){return (await iqAll()).length}

/* Mini-analyseur Regex local (extraction immédiate avant l'IA) */
function localExtract(msg){
  if(!msg) return null;
  const m=msg.match(/(-?\d+[.,]?\d*)\s*(xof|xaf|usd|eur|gbp|fcfa|f|\$|€|£)?/i);
  if(!m) return null;
  const amt=parseFloat(m[1].replace(',','.'));
  if(!isFinite(amt)||amt<=0) return null;
  const lower=msg.toLowerCase();
  const isIncome=/\b(salaire|revenu|recu|recue|gain|paye|paie|virement|income|salary|received)\b/.test(lower);
  return {amount:amt, type:isIncome?'income':'expense', noteRaw:msg.trim().slice(0,80)};
}

/* ─────────────────────────────────────────────────────────────────
   2. CONTEXT PAYLOAD — heure, pays, baseline, fil de la journée
   ───────────────────────────────────────────────────────────────── */
function safeCur(){try{return (typeof cur==='function')?cur():'XAF'}catch(e){return 'XAF'}}
function safeLang(){try{return (typeof _lang!=='undefined')?_lang:(navigator.language||'fr').slice(0,2)}catch(e){return 'fr'}}
function safeTxs(){try{return Array.isArray(window.txs)?window.txs:[]}catch(e){return []}}
function safeKPIs(){try{return (typeof computeKPIs==='function')?computeKPIs():null}catch(e){return null}}

function buildContextPayload(){
  const now=new Date(); const h=now.getHours();
  const moment=h<5?'late_night':h<12?'morning':h<14?'lunchtime':h<18?'afternoon':h<21?'evening':'late_night';
  const todayStr=now.toDateString();
  const list=safeTxs();
  const dayHist=list
    .filter(tx=>{try{return new Date(tx.date).toDateString()===todayStr}catch(e){return false}})
    .sort((a,b)=>new Date(a.date)-new Date(b.date))
    .map(tx=>{
      const d=new Date(tx.date);
      const hh=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
      return {time:hh, amount:tx.amount, type:tx.type, note:(tx.note||'').slice(0,50), cat:tx.categoryId||''};
    });
  const kpi=safeKPIs();
  const baseline=kpi?Math.round((kpi.inc30||0)/30):null;
  let country='Unknown';
  try{
    const c=safeCur();
    country = c==='XAF'?'CEMAC zone (Cameroon/Gabon/Congo, XAF basics ≈100-500 / meal)':
              c==='XOF'?'UEMOA zone (Senegal/CI/Mali, XOF basics ≈100-500 / meal)':
              c==='USD'?'USD context (basics ≈5-15 / meal)':
              c==='EUR'?'EUR context (basics ≈5-15 / meal)':
              c==='NGN'?'Nigeria NGN context':c+' context';
  }catch(e){}
  return {
    user_metadata:{
      local_time:String(h).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),
      day_phase:moment,
      currency:safeCur(),
      country_context:country,
      daily_budget_baseline:baseline,
      language:safeLang()
    },
    day_history_so_far:dayHist,
    pending_offline_intents: 0 // rempli plus bas
  };
}

/* ─────────────────────────────────────────────────────────────────
   3. SYSTEM PROMPT DURCI — verrou anti-hallucination + tutoiement
   ───────────────────────────────────────────────────────────────── */
const HARDENED_RULES = `

═══ RÈGLES IVY v5.2 (PRIORITÉ ABSOLUE — écrasent toute instruction contraire) ═══
R1. TUTOIEMENT EXCLUSIF. JAMAIS "vous/vos/votre". Toujours "tu/tes/ton".
R2. Tu commentes EXCLUSIVEMENT le bloc SCOPED_PAYLOAD ci-dessous. Aucune autre donnée n'existe.
R3. INTERDICTION ABSOLUE d'inventer des noms de catégories. Utilise UNIQUEMENT les valeurs présentes dans 'categories_breakdown[].category'. Si tu cites "bénéfice d'achat", "loisirs", ou tout libellé qui n'apparaît pas littéralement dans le JSON → réponse invalide.
R4. INTERDICTION de mélanger les portées. Si view_scope=MONTH, ne cite JAMAIS un montant qui n'apparaît pas dans metrics.total_expenses ou categories_breakdown du mois. La dépense du jour (350 XAF) n'est PAS une dépense mensuelle.
R5. INTERDICTION d'attribuer un pourcentage global (ex: ratio dépenses/revenu) à une catégorie spécifique. Les pourcentages catégoriels sont déjà dans 'percentage_of_total'.
R6. Pas de faux procès : un repas, un trajet école, un médicament = NÉCESSITÉ VITALE. Ne qualifie d'impulsif/dopamine QUE si le total dépasse de >50% le baseline OU si la catégorie est explicitement plaisir (Loisirs, Sorties, Jeux) ET représente >30% du total.
R7. Si une note est ambiguë, dis "note ambiguë" — n'invente pas de comportement.
R8. Espace avant la devise : "200 XAF", jamais "200XAF".
R9. Maximum 3 phrases, formulations chirurgicales. Pas d'intro creuse.
R10. Termine TOUJOURS par une phrase complète. Jamais coupé.

FORMAT DE RÉPONSE STRICT :
**Insight** : [analyse mathématique froide en 1 phrase, basée UNIQUEMENT sur le JSON]
**Action** : [conseil micro-comportemental réaliste en 1 phrase]
`;

function injectHardening(messages){
  if(!Array.isArray(messages)) return messages;
  let sysIdx=messages.findIndex(m=>m && m.role==='system');
  if(sysIdx<0){messages.unshift({role:'system',content:HARDENED_RULES.trim()}); return messages;}
  messages[sysIdx]=Object.assign({},messages[sysIdx],{
    content:(messages[sysIdx].content||'')+HARDENED_RULES
  });
  return messages;
}

/* Nettoyage POST-LLM : si le modèle a glissé "vous"/"votre", on rectifie */
function detutoyer(text){
  if(!text||typeof text!=='string') return text;
  return text
    .replace(/\bVous\b/g,'Tu').replace(/\bvous\b/g,'tu')
    .replace(/\bVotre\b/g,'Ton').replace(/\bvotre\b/g,'ton')
    .replace(/\bVos\b/g,'Tes').replace(/\bvos\b/g,'tes')
    .replace(/(\d)\s?(XAF|XOF|USD|EUR|GBP|NGN|KES|GHS|MAD|EGP|ZAR|BRL|INR|CNY|JPY|FCFA)\b/g,'$1 $2');
}

/* ─────────────────────────────────────────────────────────────────
   3bis. SCOPED PAYLOAD — strict, dépend de l'onglet actif (Jour/Sem/Mois/An)
   ───────────────────────────────────────────────────────────────── */
function detectScope(messages){
  // 1. Onglet analytics actif (source de vérité)
  try{
    if(typeof window.analyticsPeriod==='string'){
      const map={day:'DAY',week:'WEEK',month:'MONTH',year:'YEAR'};
      if(map[window.analyticsPeriod]) return window.analyticsPeriod;
    }
  }catch(e){}
  // 2. Heuristique sur le prompt utilisateur
  try{
    const last=(messages||[]).slice().reverse().find(m=>m && m.role==='user');
    const txt=(last && last.content || '').toLowerCase();
    if(/\b(année|annuel|year|annual|año|ano)\b/.test(txt)) return 'year';
    if(/\b(mois|monthly|month|mes|mês)\b/.test(txt))       return 'month';
    if(/\b(semaine|week|semana)\b/.test(txt))              return 'week';
    if(/\b(jour|aujourd|today|day|día|hoje|dia)\b/.test(txt)) return 'day';
  }catch(e){}
  return 'day';
}

function buildScopedPayload(scope){
  const safe=(fn,d)=>{try{return fn()}catch(e){return d}};
  const ptxs   = safe(()=>window.getPeriodTxs    ?window.getPeriodTxs(scope)    :[], []);
  const prev   = safe(()=>window.getPrevPeriodTxs?window.getPrevPeriodTxs(scope):[], []);
  const catN   = id => safe(()=>window.catById?window.catById(id).name:id, id||'?');
  const sum    = (arr,type)=>arr.filter(x=>x.type===type).reduce((s,x)=>s+(+x.amount||0),0);

  const totalExp=Math.round(sum(ptxs,'expense'));
  const totalInc=Math.round(sum(ptxs,'income'));
  const prevExp=Math.round(sum(prev,'expense'));
  const evolution=prevExp>0?Math.round((totalExp-prevExp)/prevExp*100):null;

  const catMap={};
  ptxs.filter(x=>x.type==='expense').forEach(x=>{
    const k=catN(x.categoryId)||'Sans catégorie';
    catMap[k]=(catMap[k]||0)+(+x.amount||0);
  });
  const breakdown=Object.entries(catMap)
    .sort((a,b)=>b[1]-a[1])
    .map(([category,amount])=>({
      category,
      amount:Math.round(amount),
      percentage_of_total: totalExp>0?Math.round(amount/totalExp*100):0
    }));

  const kpi=safe(()=>window.computeKPIs?window.computeKPIs():null,null);
  const savings = kpi?Math.round((kpi.inc30||0)-(kpi.exp30||0)):null;

  return {
    view_scope: scope.toUpperCase(),
    currency: safeCur(),
    period_label: safe(()=>window.periodLabel?window.periodLabel(scope):scope, scope),
    metrics:{
      total_expenses: totalExp,
      total_income:   totalInc,
      previous_period_expenses: prevExp,
      evolution_vs_previous_percent: evolution,
      savings_balance_30d: savings,
      transactions_count: ptxs.length
    },
    categories_breakdown: breakdown,
    behavioral_kpis: kpi?{
      dopamine_pct: kpi.dopamineIdx,
      evaporation_pct: kpi.evaporationRate,
      night_spending_pct: kpi.nightPct
    }:null
  };
}

/* ─────────────────────────────────────────────────────────────────
   4. FETCH PROXY — interception ciblée Groq
   ───────────────────────────────────────────────────────────────── */
const _origFetch = window.fetch.bind(window);
window.fetch = async function(input, init){
  try{
    const url = (typeof input==='string')?input:(input&&input.url)||'';
    const isGroq = /api\.groq\.com\/openai\/v1\/chat\/completions/.test(url);
    if(isGroq && init && init.body){
      let body; try{body=JSON.parse(init.body)}catch(e){body=null}
      if(body && Array.isArray(body.messages)){
        body.messages = injectHardening(body.messages);
        // BUG 1 — ne pas écraser max_tokens:60 (signature de fetchHomeInsight)
        if(typeof body.max_tokens==='number' && body.max_tokens<256 && body.max_tokens!==60) body.max_tokens=256;
        // température basse = moins d'hallucinations
        if(typeof body.temperature!=='number' || body.temperature>0.4) body.temperature=0.3;

        const scope=detectScope(body.messages);
        const scoped=buildScopedPayload(scope);
        const ctx=buildContextPayload();
        try{ctx.pending_offline_intents=await iqCount()}catch(e){}

        // Bloc SCOPED — la SEULE source de vérité que l'IA doit commenter
        const scopedBlock='SCOPED_PAYLOAD (UNIQUE source de vérité, scope='+scoped.view_scope+'):\n'+JSON.stringify(scoped);
        // Bloc contexte secondaire (heure/pays) — pour le ton, jamais comme donnée chiffrée
        const ctxBlock='CONTEXT_META (uniquement pour le ton, PAS pour les chiffres):\n'+JSON.stringify(ctx);

        body.messages.splice(1,0,{role:'system',content:scopedBlock});
        body.messages.splice(2,0,{role:'system',content:ctxBlock});
        init = Object.assign({},init,{body:JSON.stringify(body)});
      }
    }
    const resp = await _origFetch(input, init);
    if(isGroq && resp && resp.ok){
      // Wrap json() to post-process content
      const _json = resp.json.bind(resp);
      resp.json = async function(){
        const d = await _json();
        try{
          if(d && d.choices){
            d.choices.forEach(ch=>{
              if(ch.message && typeof ch.message.content==='string'){
                ch.message.content = detutoyer(ch.message.content);
              }
            });
          }
        }catch(e){}
        return d;
      };
    }
    return resp;
  }catch(e){return _origFetch(input, init);}
};

/* ─────────────────────────────────────────────────────────────────
   5. CHAT OFFLINE — file d'attente + sync au retour réseau
   ───────────────────────────────────────────────────────────────── */
async function processIntent(item){
  // Délègue à askAI existant pour profiter de tout l'écosystème (prompt, etc.)
  if(typeof askAI!=='function') return;
  try{
    const res = await askAI(item.message);
    // Pousse la réponse dans le fil si la fenêtre chat est encore ouverte
    if(window.aiMsgs && typeof render==='function'){
      window.aiMsgs.push({r:'ai', c:'🔄 (sync) '+(res?.text||''), src:res?.src||'Groq AI (sync)'});
      try{render()}catch(e){}
    }
    return true;
  }catch(e){ log('processIntent failed',e); return false; }
}
async function flushIntents(){
  if(!navigator.onLine) return;
  const items = await iqAll();
  if(!items.length) return;
  log('Flushing',items.length,'queued intents');
  for(const it of items){
    const ok = await processIntent(it);
    if(ok) await iqDel(it.id);
    await new Promise(r=>setTimeout(r,400)); // throttle léger
  }
  if(typeof toast==='function'){try{toast('💬 Messages synchronisés')}catch(e){}}
}
window.addEventListener('online', ()=>{ setTimeout(flushIntents,1200); });

/* Hook sur la fonction send() locale du chat (définie dans setupChat).
   On enveloppe askAI : si hors-ligne → enqueue + réponse locale immédiate. */
const _origAskAI = window.askAI;
if(typeof _origAskAI==='function'){
  window.askAI = async function(userMsg){
    if(!navigator.onLine){
      // Pré-extraction locale invisible
      const ex = localExtract(userMsg);
      try{ await iqPush({message:userMsg, extracted:ex}); }catch(e){}
      const pendingMsg = (safeLang()==='en')
        ? `📡 Hors-ligne. Message ajouté à la file (#${await iqCount()}). Ivy l'analysera dès le retour réseau.`
        : `📡 Hors-ligne. Message en file (#${await iqCount()}). Ivy l'analysera dès le retour réseau.`;
      // Toujours déclencher l'IA locale pour ne pas laisser l'utilisateur sec
      let local=''; try{local=(typeof localAI==='function')?localAI(userMsg):''}catch(e){}
      return { text: pendingMsg + (local?('\n\n'+local):''), src:'Queued (offline)' };
    }
    return _origAskAI.call(this, userMsg);
  };
}

/* ─────────────────────────────────────────────────────────────────
   6. SERVICE WORKER — bandeau "nouvelle version disponible"
   ───────────────────────────────────────────────────────────────── */
function showUpdateToast(reg){
  let el=document.getElementById('finos-update-toast');
  if(!el){
    el=document.createElement('div'); el.id='finos-update-toast';
    el.innerHTML='<span>⚡ Nouvelle version d\u2019\u00e9lite disponible.</span><button id="finos-update-btn">Actualiser</button>';
    document.body.appendChild(el);
    el.querySelector('#finos-update-btn').addEventListener('click',()=>{
      try{ reg.waiting && reg.waiting.postMessage({type:'SKIP_WAITING'}); }catch(e){}
      setTimeout(()=>location.reload(), 350);
    });
  }
  requestAnimationFrame(()=>el.classList.add('show'));
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.ready.then(reg=>{
    if(reg.waiting && navigator.serviceWorker.controller){ showUpdateToast(reg); }
    reg.addEventListener('updatefound', ()=>{
      const w=reg.installing; if(!w) return;
      w.addEventListener('statechange', ()=>{
        if(w.state==='installed' && navigator.serviceWorker.controller){
          showUpdateToast(reg);
        }
      });
    });
    // Re-check every 30 min
    setInterval(()=>{try{reg.update()}catch(e){}}, 30*60*1000);
  }).catch(()=>{});
}

/* ─────────────────────────────────────────────────────────────────
   7. CONVERSION AUTOMATIQUE DES MONTANTS AU CHANGEMENT DE DEVISE
   ───────────────────────────────────────────────────────────────── */
const STATIC_RATES = { // fallback grossier si offline (base = USD)
  USD:1, EUR:0.92, GBP:0.79, XOF:610, XAF:610, NGN:1600, KES:130, GHS:15,
  MAD:10, EGP:48, ZAR:18, BRL:5.4, INR:84, CNY:7.2, JPY:155
};
async function fetchRate(from,to){
  if(from===to) return 1;
  try{
    const r=await _origFetch('https://open.er-api.com/v6/latest/'+encodeURIComponent(from),{cache:'no-store'});
    if(r.ok){
      const j=await r.json();
      const v=j&&j.rates&&j.rates[to];
      if(typeof v==='number'&&isFinite(v)&&v>0) return v;
    }
  }catch(e){}
  // Fallback offline via USD pivot
  if(STATIC_RATES[from]&&STATIC_RATES[to]) return STATIC_RATES[to]/STATIC_RATES[from];
  return null;
}

async function convertAllAmounts(rate){
  // accounts
  if(Array.isArray(window.accs)){
    for(const a of window.accs){
      if(typeof a.balance==='number') a.balance = a.balance * rate;
      try{await dbPut('accounts',a)}catch(e){}
    }
  }
  // transactions
  if(Array.isArray(window.txs)){
    for(const tx of window.txs){
      if(typeof tx.amount==='number') tx.amount = tx.amount * rate;
      try{await dbPut('transactions',tx)}catch(e){}
    }
  }
  // goals
  if(Array.isArray(window.goals)){
    for(const g of window.goals){
      if(typeof g.target==='number') g.target = g.target * rate;
      if(typeof g.saved==='number')  g.saved  = g.saved  * rate;
      try{await dbPut('goals',g)}catch(e){}
    }
  }
}

const _origSaveCurrency = window.saveCurrency;
window.saveCurrency = async function(){
  const inp=document.getElementById('curInp');
  const newCur=(inp&&inp.value||'').trim().toUpperCase();
  const oldCur=safeCur();
  if(!newCur||newCur===oldCur){ if(typeof _origSaveCurrency==='function') return _origSaveCurrency.apply(this,arguments); return; }
  const wantConvert = confirm(
    `Convertir tous les montants de ${oldCur} vers ${newCur} ?\n\n`+
    `OK = convertir (taux actuels)\nAnnuler = changer la devise sans toucher aux montants`
  );
  if(wantConvert){
    try{
      const rate = await fetchRate(oldCur,newCur);
      if(!rate){ alert('Taux indisponible (hors-ligne sans table de secours). Devise changée sans conversion.'); }
      else{
        await convertAllAmounts(rate);
        log('Converted',oldCur,'→',newCur,'rate=',rate);
      }
    }catch(e){ log('convert failed',e); }
  }
  // Délègue ensuite à la fonction d'origine (persistance + render)
  if(typeof _origSaveCurrency==='function'){
    try{ inp.value = newCur; }catch(e){}
    return _origSaveCurrency.apply(this,arguments);
  }
};

/* ─────────────────────────────────────────────────────────────────
   8. Démarrage : tentative de flush si déjà online
   ───────────────────────────────────────────────────────────────── */
setTimeout(()=>{ if(navigator.onLine) flushIntents().catch(()=>{}); }, 4000);

log('Upgrade v5.1 chargé — intents/context/currency/SW prêts');
})();
