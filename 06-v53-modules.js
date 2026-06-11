/* ============================================================
   FINANCE AI OS v5.3 — Modules institutionnels (additifs)
   1. NBA  2. Stress Test  3. Health Score
   4. Recurring patterns  5. Cashflow projection  6. Ivy memory
   ============================================================ */
(function(){
'use strict';

/* ---------- Traductions additionnelles ---------- */
const ADD_I18N = {
  fr: {
    health_score:'Santé financière',
    health_critique:'Critique', health_fragile:'Fragile',
    health_stable:'Stable', health_solide:'Solide', health_elite:'Élite',
    health_axis_reserve:'Réserve', health_axis_retention:'Rétention',
    health_axis_regular:'Régularité', health_axis_goal:'Objectif',
    health_axis_behavior:'Comportement',
    nba_title:'Action prioritaire du jour',
    stress_title:'Stress Test — 30 jours',
    stress_choc:'Scénario choc', stress_base:'Rythme actuel',
    stress_optimal:'Scénario optimal',
    stress_short:'Données < 14j — simulation approximative',
    stress_msg:"Ce test ne prédit pas l'avenir — il révèle ta marge de manœuvre.",
    recurring_title:'Dépenses récurrentes détectées',
    recurring_weekly:'hebdo', recurring_monthly:'mensuel',
    recurring_total:'Total récurrent détecté',
    projection_title:'Projection cashflow — 30j',
    projection_alert:'Solde projeté négatif dans {n}j au rythme actuel.',
    streak_label:'jours consécutifs'
  },
  en: {
    health_score:'Financial Health',
    health_critique:'Critical', health_fragile:'Fragile',
    health_stable:'Stable', health_solide:'Solid', health_elite:'Elite',
    health_axis_reserve:'Reserve', health_axis_retention:'Retention',
    health_axis_regular:'Regularity', health_axis_goal:'Goal',
    health_axis_behavior:'Behavior',
    nba_title:"Today's priority action",
    stress_title:'Stress Test — 30 days',
    stress_choc:'Shock scenario', stress_base:'Current pace',
    stress_optimal:'Optimal scenario',
    stress_short:'Data < 14d — rough simulation',
    stress_msg:"This test doesn't predict the future — it reveals your margin.",
    recurring_title:'Recurring expenses detected',
    recurring_weekly:'weekly', recurring_monthly:'monthly',
    recurring_total:'Total recurring',
    projection_title:'Cashflow projection — 30d',
    projection_alert:'Projected negative balance in {n}d at current pace.',
    streak_label:'consecutive days'
  },
  es: {
    health_score:'Salud financiera',
    health_critique:'Crítico', health_fragile:'Frágil',
    health_stable:'Estable', health_solide:'Sólido', health_elite:'Élite',
    health_axis_reserve:'Reserva', health_axis_retention:'Retención',
    health_axis_regular:'Regularidad', health_axis_goal:'Objetivo',
    health_axis_behavior:'Comportamiento',
    nba_title:'Acción prioritaria del día',
    stress_title:'Stress Test — 30 días',
    stress_choc:'Escenario de choque', stress_base:'Ritmo actual',
    stress_optimal:'Escenario óptimo',
    stress_short:'Datos < 14d — simulación aproximada',
    stress_msg:'Esta prueba no predice el futuro — revela tu margen.',
    recurring_title:'Gastos recurrentes detectados',
    recurring_weekly:'semanal', recurring_monthly:'mensual',
    recurring_total:'Total recurrente',
    projection_title:'Proyección de flujo — 30d',
    projection_alert:'Saldo proyectado negativo en {n}d al ritmo actual.',
    streak_label:'días consecutivos'
  },
  pt: {
    health_score:'Saúde financeira',
    health_critique:'Crítico', health_fragile:'Frágil',
    health_stable:'Estável', health_solide:'Sólido', health_elite:'Elite',
    health_axis_reserve:'Reserva', health_axis_retention:'Retenção',
    health_axis_regular:'Regularidade', health_axis_goal:'Objetivo',
    health_axis_behavior:'Comportamento',
    nba_title:'Ação prioritária do dia',
    stress_title:'Stress Test — 30 dias',
    stress_choc:'Cenário de choque', stress_base:'Ritmo atual',
    stress_optimal:'Cenário ótimo',
    stress_short:'Dados < 14d — simulação aproximada',
    stress_msg:'Este teste não prevê o futuro — revela a tua margem.',
    recurring_title:'Despesas recorrentes detectadas',
    recurring_weekly:'semanal', recurring_monthly:'mensal',
    recurring_total:'Total recorrente',
    projection_title:'Projeção de cashflow — 30d',
    projection_alert:'Saldo projetado negativo em {n}d ao ritmo atual.',
    streak_label:'dias consecutivos'
  }
};
try{
  if(typeof I18N==='object' && I18N){
    Object.keys(ADD_I18N).forEach(lg=>{
      if(I18N[lg]){
        Object.keys(ADD_I18N[lg]).forEach(k=>{
          if(I18N[lg][k]===undefined) I18N[lg][k]=ADD_I18N[lg][k];
        });
      }
    });
  }
}catch(e){ console.warn('[v5.3 i18n] fail',e); }

function T(k){ try{ return (typeof t==='function')?t(k):k; }catch(e){return k;} }
function fmt(v){ try{ return fmtFull(v); }catch(e){ return Math.round(v||0); } }
function curU(){ try{ return cur(); }catch(e){ return 'XAF'; } }

/* ============================================================
   MODULE 1 — NEXT BEST ACTION
   ============================================================ */
window.computeNextBestAction = function computeNextBestAction(){
  try{
    if(typeof computeKPIs!=='function') return null;
    const k = computeKPIs();
    if(k.isSilent) return null;

    // 1. Runway critique (Bug 1: ne déclencher que sur données réelles)
    if(
      k.safetyDays!==9999 &&
      k.safetyDays<7 &&
      !k.isShortHistory &&
      k.burnRate>0 &&
      (txs||[]).length>=5
    ){
      const s=k.safetyDays>1?'s':'';
      return {priority:1,
        action: L('Stoppe toute dépense élastique.','Stop all discretionary spending.','Para todos los gastos discrecionales.','Para todos os gastos discricionários.'),
        reason: L('Runway: '+k.safetyDays+' jour'+s+' au rythme actuel.','Runway: '+k.safetyDays+'d at current pace.','Autonomía: '+k.safetyDays+'d al ritmo actual.','Autonomia: '+k.safetyDays+'d ao ritmo atual.'),
        impact:'critical'};
    }

    // 2. Evaporation post-revenu
    try{
      const recentInc = (txs||[]).filter(t=>t.type==='income').sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      if(recentInc){
        const hSince = (Date.now()-new Date(recentInc.date).getTime())/3600000;
        if(hSince<48 && (k.evaporationRate||0)>60){
          const block = Math.round(recentInc.amount*0.20);
          return {priority:2,
            action: L('Bloque '+fmt(block)+' '+curU()+' en épargne maintenant.','Lock '+fmt(block)+' '+curU()+' into savings now.','Bloquea '+fmt(block)+' '+curU()+' en ahorros ahora.','Bloqueia '+fmt(block)+' '+curU()+' em poupança agora.'),
            reason: L('Évaporation '+k.evaporationRate+'% détectée sur revenu récent.','Evaporation '+k.evaporationRate+'% detected on recent income.','Evaporación '+k.evaporationRate+'% detectada sobre ingreso reciente.','Evaporação '+k.evaporationRate+'% detectada na receita recente.'),
            impact:'high'};
        }
      }
    }catch(e){}

    // 3. Objectif prioritaire + surplus
    try{
      const pg = (typeof getPriorityGoal==='function')?getPriorityGoal():null;
      if(pg){
        const gap = pg.target - pg.saved;
        const surplus = Math.max(0,(k.inc30/30) - k.burnRate);
        if(gap>0 && surplus>0){
          const transfer = Math.min(Math.round(surplus), Math.round(gap));
          return {priority:3,
            action: L('Vire '+fmt(transfer)+' '+curU()+' vers "'+pg.name+'" aujourd\'hui.','Transfer '+fmt(transfer)+' '+curU()+' to "'+pg.name+'" today.','Transfiere '+fmt(transfer)+' '+curU()+' a "'+pg.name+'" hoy.','Transfere '+fmt(transfer)+' '+curU()+' para "'+pg.name+'" hoje.'),
            reason: L('Surplus journalier disponible: '+fmt(surplus)+' '+curU()+'.','Daily surplus available: '+fmt(surplus)+' '+curU()+'.','Excedente diario: '+fmt(surplus)+' '+curU()+'.','Excedente diário: '+fmt(surplus)+' '+curU()+'.'),
            impact:'medium'};
        }
      }
    }catch(e){}

    // 4. Pression élevée
    if(k.pressureDataOK && k.pressureIdx>40){
      return {priority:4,
        action: L('Pause 24h sur dépenses non essentielles.','24h pause on non-essential spending.','Pausa 24h en gastos no esenciales.','Pausa 24h em gastos não essenciais.'),
        reason: L('Indice de pression à +'+k.pressureIdx+'%.','Pressure index at +'+k.pressureIdx+'%.','Índice de presión +'+k.pressureIdx+'%.','Índice de pressão +'+k.pressureIdx+'%.'),
        impact:'medium'};
    }

    // 5. Pas de saisie + soir
    const today = (txs||[]).filter(tx=>new Date(tx.date).toDateString()===new Date().toDateString());
    if(today.length===0 && new Date().getHours()>=18){
      return {priority:5,
        action: L('Note tes dépenses du jour avant de dormir.','Log today\'s expenses before sleeping.','Anota tus gastos del día antes de dormir.','Anota as despesas do dia antes de dormir.'),
        reason: L('Aucune saisie depuis ce matin — ton cerveau oublie 60% des dépenses.','No entries since this morning — your brain forgets 60% of expenses.','Sin entradas desde la mañana — tu cerebro olvida 60% de los gastos.','Sem registros desde a manhã — o cérebro esquece 60% das despesas.'),
        impact:'low'};
    }

    // 6. Rétention élevée
    if(k.retention!==null && k.retention>=70){
      const invest = Math.round(((k.inc30||0)*0.10));
      return {priority:6,
        action: L('Investis 10% de tes revenus du mois ('+fmt(invest)+' '+curU()+').','Invest 10% of monthly income ('+fmt(invest)+' '+curU()+').','Invierte 10% de tus ingresos del mes ('+fmt(invest)+' '+curU()+').','Investe 10% das receitas do mês ('+fmt(invest)+' '+curU()+').'),
        reason: L('Tu retiens '+k.retention+'% — capitalise.','You retain '+k.retention+'% — capitalize.','Retienes '+k.retention+'% — capitaliza.','Retém '+k.retention+'% — capitalize.'),
        impact:'low'};
    }
    return null;
  }catch(e){ console.warn('[NBA] fail',e); return null; }
};

window.renderNBACard = function renderNBACard(kpi){
  try{
    const nba = window.computeNextBestAction();
    if(!nba) return '';
    return `<div class="card" style="border-color:rgba(99,102,241,.35);background:linear-gradient(135deg,rgba(99,102,241,.10),rgba(16,185,129,.05));margin-bottom:12px">
      <div class="ch">⚡ ${T('nba_title').toUpperCase()}</div>
      <div style="font-size:14px;font-weight:700;color:var(--acc3);line-height:1.5;margin-bottom:6px">${nba.action}</div>
      <div class="tm" style="font-size:11px">${nba.reason}</div>
    </div>`;
  }catch(e){ console.warn('[NBA render] fail',e); return ''; }
};

/* ============================================================
   MODULE 2 — STRESS TEST
   ============================================================ */
window.runStressTest = function runStressTest(){
  try{
    const k = computeKPIs();
    const burn = Math.max(0, k.burnRate||0);
    const incDaily = Math.max(0, (k.inc30||0)/30);
    const start = (k.activeBalance||0) + (k.savingsBalance||0);

    function simulate(incFactor, expFactor){
      const incJ = incDaily*incFactor;
      const expJ = burn*expFactor;
      let solde = start, runway = '30j+', soldeFin = start;
      for(let j=1;j<=30;j++){
        solde = solde + incJ - expJ;
        if(solde<=0 && runway==='30j+') runway = j+'j';
      }
      soldeFin = solde;
      return {runway, soldeFin};
    }
    const choc = simulate(0.70, 1.20);
    const baseline = {runway: k.safetyDays===9999?'30j+':(k.safetyDays>=30?'30j+':k.safetyDays+'j')};
    const optimal = simulate(1.20, 0.90);
    const epargneGen = Math.max(0, optimal.soldeFin - start);
    return {choc, baseline, optimal:{...optimal, epargneGeneree:epargneGen}, isShort:k.isShortHistory};
  }catch(e){ console.warn('[StressTest] fail',e); return null; }
};

window.openStressTestModal = function openStressTestModal(){
  try{
    const r = window.runStressTest();
    if(!r){ openModal('<h3>🔬 Stress Test</h3><p class="tm">'+L('Données insuffisantes.','Insufficient data.','Datos insuficientes.','Dados insuficientes.')+'</p>'); return; }
    const k = computeKPIs();
    function bar(label, color){
      const n = parseInt(label)||30;
      const w = Math.min(100, (n/30)*100);
      return `<div style="height:4px;background:var(--surf3);border-radius:2px;overflow:hidden;margin-top:6px"><div style="height:100%;width:${w}%;background:${color}"></div></div>`;
    }
    const narrow = (window.innerWidth||400)<380;
    const grid = narrow?'1fr':'1fr 1fr 1fr';
    const recommandedBuffer = Math.round((k.burnRate||0)*30);
    const dataDays = k.dataDays||0;
    const subChoc = L('-30% revenus, +20% dépenses — ex: perte d\'un client, urgence médicale.','-30% income, +20% expenses — e.g. lost client, medical emergency.','-30% ingresos, +20% gastos — ej: pérdida de cliente, urgencia médica.','-30% receitas, +20% despesas — ex: perda de cliente, urgência médica.');
    const subBase = L('Si tu continues exactement comme ces 30 derniers jours.','If you continue exactly as the last 30 days.','Si continúas igual que los últimos 30 días.','Se continuares como nos últimos 30 dias.');
    const subOpt  = L('+20% revenus, -10% dépenses — ex: nouvelle mission, coupe du superflu.','+20% income, -10% expenses — e.g. new gig, cutting fluff.','+20% ingresos, -10% gastos — ej: nueva misión, recorte de lo superfluo.','+20% receitas, -10% despesas — ex: nova missão, corte do supérfluo.');
    const meanings = `<div class="card" style="margin-top:12px;padding:12px;background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.3)">
      <div style="font-size:11px;font-weight:800;color:var(--acc3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">💡 ${L('Ce que ça signifie pour toi','What this means for you','Lo que significa para ti','O que isto significa para ti')}</div>
      <div style="font-size:12px;color:var(--txt2);line-height:1.6;margin-bottom:6px">🔴 ${L('Si le pire arrive : tu tiens','If the worst happens: you last','Si pasa lo peor: aguantas','Se o pior acontecer: aguentas')} <strong>${r.choc.runway}</strong>. ${L('Vise un fond d\'urgence de','Target an emergency fund of','Apunta a un fondo de emergencia de','Apontar a um fundo de emergência de')} <strong style="color:var(--acc3)">${fmtFull(recommandedBuffer)}</strong> (≈30j ${L('de dépenses','of expenses','de gastos','de despesas')}).</div>
      <div style="font-size:12px;color:var(--txt2);line-height:1.6">🟢 ${L('Si tu optimises : tu peux générer','If you optimize: you can generate','Si optimizas: puedes generar','Se otimizares: podes gerar')} <strong style="color:var(--grn)">+${fmtFull(r.optimal.epargneGeneree)}</strong> ${L('ce mois.','this month.','este mes.','este mês.')}</div>
    </div>`;
    openModal(`
      <h3>🔬 ${T('stress_title')}</h3>
      ${r.isShort?`<div class="al al-w" style="margin-bottom:10px">⚠️ ${L('Les chiffres se baseront sur seulement '+dataDays+' jours — résultats indicatifs.','Numbers based on only '+dataDays+' days — indicative results.','Los números se basan en solo '+dataDays+' días — resultados indicativos.','Os números baseiam-se em apenas '+dataDays+' dias — resultados indicativos.')}</div>`:''}
      <div style="display:grid;grid-template-columns:${grid};gap:8px;margin:10px 0">
        <div class="card" style="padding:10px;border-color:rgba(244,63,94,.35)">
          <div style="font-size:18px">🔴</div>
          <div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase">${T('stress_choc')}</div>
          <div class="mono fw8" style="font-size:18px;color:var(--red);margin-top:4px">${r.choc.runway}</div>
          <div class="tm" style="font-size:10px;margin-top:3px">${L('Solde J+30','Bal D+30','Saldo D+30','Saldo D+30')} : <strong style="color:${r.choc.soldeFin>=0?'var(--grn)':'var(--red)'}">${fmtFull(r.choc.soldeFin)}</strong></div>
          <div class="tm" style="font-size:10px;margin-top:3px;font-style:italic">${subChoc}</div>
          ${bar(r.choc.runway,'var(--red)')}
        </div>
        <div class="card" style="padding:10px;border-color:rgba(251,191,36,.35)">
          <div style="font-size:18px">🟡</div>
          <div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase">${T('stress_base')}</div>
          <div class="mono fw8" style="font-size:18px;color:var(--ylw);margin-top:4px">${r.baseline.runway}</div>
          <div class="tm" style="font-size:10px;margin-top:3px;font-style:italic">${subBase}</div>
          ${bar(r.baseline.runway,'var(--ylw)')}
        </div>
        <div class="card" style="padding:10px;border-color:rgba(16,185,129,.35)">
          <div style="font-size:18px">🟢</div>
          <div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase">${T('stress_optimal')}</div>
          <div class="mono fw8" style="font-size:14px;color:var(--grn);margin-top:4px">+${fmtFull(r.optimal.epargneGeneree)}</div>
          <div class="tm" style="font-size:10px;margin-top:3px">${L('Solde J+30','Bal D+30','Saldo D+30','Saldo D+30')} : <strong style="color:var(--grn)">${fmtFull(r.optimal.soldeFin)}</strong></div>
          <div class="tm" style="font-size:10px;margin-top:3px;font-style:italic">${subOpt}</div>
          ${bar('30j','var(--grn)')}
        </div>
      </div>
      ${meanings}
      <div class="tm" style="font-size:11px;text-align:center;margin-top:8px;font-style:italic">${T('stress_msg')}</div>
      <button class="btn" onclick="closeModal()" style="margin-top:12px">OK</button>
    `);
  }catch(e){ console.warn('[StressTest modal] fail',e); }
};

/* ============================================================
   MODULE 3 — HEALTH SCORE
   ============================================================ */
window.computeFinancialHealthScore = function computeFinancialHealthScore(kpi){
  try{
    const k = kpi || computeKPIs();
    const safetyDays = k.safetyDays===9999?9999:k.safetyDays;
    const reserve = safetyDays>=30?20:safetyDays>=14?15:safetyDays>=7?10:safetyDays>=3?5:0;
    const retention = k.retention===null?10
      :k.retention>=50?20:k.retention>=30?15:k.retention>=10?10:k.retention>=0?5:0;
    const regular = k.isSilent?0
      :k.dataDays>=21?20:k.dataDays>=14?15:k.dataDays>=7?10:k.dataDays>=3?5:2;
    let goal = 8;
    try{
      const pg = (typeof getPriorityGoal==='function')?getPriorityGoal():null;
      if(pg){
        const pct = pg.target>0?(pg.saved/pg.target)*100:0;
        goal = pct>=75?20:pct>=50?15:pct>=25?10:pct>0?5:2;
      }
    }catch(e){}
    let behavior;
    if(k.isShortHistory){ behavior=10; }
    else {
      const d = k.dopamineIdx||0;
      behavior = d<20?20:d<40?15:d<60?10:d<80?5:0;
    }
    const total = reserve+retention+regular+goal+behavior;
    const label = total<40?T('health_critique'):total<60?T('health_fragile'):total<75?T('health_stable'):total<90?T('health_solide'):T('health_elite');
    const color = total<40?'var(--red)':total<60?'#f59e0b':total<75?'var(--ylw)':total<90?'var(--acc3)':'var(--grn)';
    return {score:total, label, color, axes:{reserve, retention, regular, goal, behavior}};
  }catch(e){ console.warn('[HealthScore] fail',e); return null; }
};

window.renderHealthScoreCard = function renderHealthScoreCard(kpi){
  try{
    if(!(txs||[]).length) return '';
    const h = window.computeFinancialHealthScore(kpi);
    if(!h) return '';
    const axes = [
      {k:'reserve', l:T('health_axis_reserve'), v:h.axes.reserve},
      {k:'retention', l:T('health_axis_retention'), v:h.axes.retention},
      {k:'regular', l:T('health_axis_regular'), v:h.axes.regular},
      {k:'goal', l:T('health_axis_goal'), v:h.axes.goal},
      {k:'behavior', l:T('health_axis_behavior'), v:h.axes.behavior}
    ];
    const bars = axes.map(a=>{
      const pct = Math.round((a.v/20)*100);
      const c = a.v>=15?'var(--grn)':a.v>=10?'var(--ylw)':a.v>=5?'var(--org)':'var(--red)';
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="height:36px;width:6px;background:var(--surf3);border-radius:3px;display:flex;align-items:flex-end;overflow:hidden">
          <div style="width:100%;height:${pct}%;background:${c};border-radius:3px"></div>
        </div>
        <div style="font-size:9px;color:var(--mut);font-weight:600;text-align:center;line-height:1.1">${a.l}</div>
      </div>`;
    }).join('');
    return `<div class="card" onclick="openHealthDetailModal()" style="text-align:center;padding:16px 12px;margin-bottom:12px;cursor:pointer">
      <div style="font-size:11px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">${T('health_score')}</div>
      <div style="font-size:48px;font-weight:900;font-family:var(--mono);color:${h.color};line-height:1">${h.score}</div>
      <div style="font-size:12px;color:${h.color};font-weight:700;margin:4px 0 10px">${h.label}</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;justify-items:center">${bars}</div>
    </div>`;
  }catch(e){ console.warn('[HealthScore render] fail',e); return ''; }
};

window.openHealthDetailModal = function openHealthDetailModal(){
  try{
    const h = window.computeFinancialHealthScore();
    if(!h){ return; }
    const labels = {
      reserve:T('health_axis_reserve'), retention:T('health_axis_retention'),
      regular:T('health_axis_regular'), goal:T('health_axis_goal'),
      behavior:T('health_axis_behavior')
    };
    const tips = {
      reserve:'Augmente ton coussin de sécurité — vise 30j de runway.',
      retention:'Garde ≥30% de tes revenus pour viser un meilleur score.',
      regular:'Saisis chaque jour pendant 14j pour stabiliser tes KPIs.',
      goal:'Définis un objectif prioritaire et progresse régulièrement.',
      behavior:'Réduis les achats impulsifs et nocturnes.'
    };
    const rows = Object.keys(h.axes).map(k=>{
      const v = h.axes[k];
      const c = v>=15?'var(--grn)':v>=10?'var(--ylw)':v>=5?'var(--org)':'var(--red)';
      return `<div style="margin:10px 0;padding:10px;background:var(--surf2);border-radius:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:700;font-size:13px">${labels[k]}</span>
          <span class="mono fw8" style="color:${c}">${v}/20</span>
        </div>
        <div style="height:5px;background:var(--surf3);border-radius:3px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;width:${(v/20)*100}%;background:${c}"></div>
        </div>
        ${v<15?`<div class="tm" style="font-size:11px">${tips[k]}</div>`:''}
      </div>`;
    }).join('');
    openModal(`
      <h3>${T('health_score')} — <span style="color:${h.color}">${h.score}/100</span></h3>
      <div style="font-size:12px;color:${h.color};font-weight:700;margin-bottom:8px">${h.label}</div>
      ${rows}
      <button class="btn" onclick="closeModal()" style="margin-top:8px">OK</button>
    `);
  }catch(e){ console.warn('[Health modal] fail',e); }
};

/* ============================================================
   MODULE 4 — RECURRING PATTERNS
   ============================================================ */
window.detectRecurringPatterns = function detectRecurringPatterns(){
  try{
    if(!(txs||[]).length) return [];
    const exp = txs.filter(t=>t.type==='expense');
    if(exp.length<3) return [];
    // Group by categoryId + amount bucket (±5%)
    const groups = {};
    exp.forEach(t=>{
      const bucket = Math.round(t.amount/10)*10;
      const key = t.categoryId+'|'+bucket;
      if(!groups[key]) groups[key]={txs:[],catId:t.categoryId,amounts:[]};
      groups[key].txs.push(t);
      groups[key].amounts.push(t.amount);
    });
    const results = [];
    Object.values(groups).forEach(g=>{
      if(g.txs.length<2) return;
      const sorted = g.txs.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
      const intervals=[];
      for(let i=1;i<sorted.length;i++){
        intervals.push((new Date(sorted[i].date)-new Date(sorted[i-1].date))/86400000);
      }
      const avg = intervals.reduce((s,v)=>s+v,0)/intervals.length;
      const amount = g.amounts.reduce((s,v)=>s+v,0)/g.amounts.length;
      const total = g.amounts.reduce((s,v)=>s+v,0);
      let freq=null;
      if(avg>=6 && avg<=8 && sorted.length>=3) freq='weekly';
      else if(avg>=27 && avg<=33 && sorted.length>=2) freq='monthly';
      if(!freq) return;
      const last = new Date(sorted[sorted.length-1].date);
      const next = new Date(last.getTime() + avg*86400000);
      let catName = g.catId;
      try{ catName = catById(g.catId).name; }catch(e){}
      let catIcon = '💸';
      try{ catIcon = catById(g.catId).icon||'💸'; }catch(e){}
      results.push({
        categoryId:g.catId, categoryName:catName, categoryIcon:catIcon,
        amount, frequency:freq, occurrences:sorted.length,
        totalSpent:total, nextExpectedDate:next
      });
    });
    return results.sort((a,b)=>b.totalSpent-a.totalSpent).slice(0,8);
  }catch(e){ console.warn('[Recurring] fail',e); return []; }
};

window.renderRecurringCard = function renderRecurringCard(kpi){
  try{
    if(kpi && kpi.isShortHistory) return '';
    const list = window.detectRecurringPatterns();
    if(!list.length) return '';
    const monthlyTotal = list.reduce((s,p)=>s + (p.frequency==='weekly'?p.amount*4.33:p.amount), 0);
    const rows = list.map(p=>{
      const nxt = p.nextExpectedDate.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
      const freqLbl = p.frequency==='weekly'?T('recurring_weekly'):T('recurring_monthly');
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--surf3)">
        <div>
          <div style="font-weight:700;font-size:13px">${p.categoryIcon} ${p.categoryName}</div>
          <div class="tm" style="font-size:11px">${freqLbl} · ${p.occurrences}× · Prochaine: ${nxt}</div>
        </div>
        <div style="font-weight:800;font-family:var(--mono);color:var(--red)">-${fmt(p.amount)}</div>
      </div>`;
    }).join('');
    return `<div class="card">
      <div class="ch">🔁 ${T('recurring_title').toUpperCase()}</div>
      ${rows}
      <div style="font-size:11px;color:var(--mut);margin-top:8px">${T('recurring_total')} : <strong>${fmt(monthlyTotal)} ${curU()}</strong> / mois</div>
    </div>`;
  }catch(e){ console.warn('[Recurring render] fail',e); return ''; }
};

/* ============================================================
   MODULE 5 — CASHFLOW PROJECTION
   ============================================================ */
window.buildCashflowProjection = function buildCashflowProjection(period){
  try{
    period = period || 'month';
    const STEPS = period==='day' ? 24 : period==='week' ? 7 : 30;
    const k = computeKPIs();
    const burn = Math.max(0, k.burnRate||0);
    const incDaily = Math.max(0, (k.inc30||0)/30);
    const burnPerStep = period==='day' ? burn/24 : burn;
    const incPerStep  = period==='day' ? incDaily/24 : incDaily;
    const start = (k.activeBalance||0);
    const incomeEvents = {};
    const expenseEvents = {};
    const now = Date.now();
    // Expected cycle income (only inject if it falls in projection window)
    try{
      if(k.cycleContext && k.cycleContext.daysToNextExpected>0 && k.cycleContext.expectedCycleIncome){
        const dDays = k.cycleContext.daysToNextExpected;
        let stepIdx = period==='day' ? -1 /* hors fenêtre 24h */ : Math.min(STEPS-1, Math.max(0, dDays));
        if(period==='week' && dDays>=7) stepIdx = -1;
        if(stepIdx>=0) incomeEvents[stepIdx] = (incomeEvents[stepIdx]||0) + k.cycleContext.expectedCycleIncome;
      }
    }catch(e){}
    // Recurring expenses
    try{
      const rec = (typeof window.detectRecurringPatterns==='function') ? window.detectRecurringPatterns() : [];
      rec.forEach(r=>{
        const days = Math.round((r.nextExpectedDate.getTime()-now)/86400000);
        let stepIdx = -1;
        if(period==='day'){
          const hours = Math.round((r.nextExpectedDate.getTime()-now)/3600000);
          if(hours>=0 && hours<24) stepIdx = hours;
        } else if(period==='week'){
          if(days>=0 && days<7) stepIdx = days;
        } else {
          if(days>=0 && days<30) stepIdx = days;
        }
        if(stepIdx>=0) expenseEvents[stepIdx] = (expenseEvents[stepIdx]||0) + r.amount;
      });
    }catch(e){}
    const series = [];
    let solde = start;
    for(let j=0;j<STEPS;j++){
      solde += incPerStep - burnPerStep;
      if(incomeEvents[j]) solde += incomeEvents[j];
      if(expenseEvents[j]) solde -= expenseEvents[j];
      series.push({day:j, solde, incEvent:!!incomeEvents[j], expEvent:!!expenseEvents[j]});
    }
    return {series, start, incomeEvents, expenseEvents, steps:STEPS, period};
  }catch(e){ console.warn('[Projection] fail',e); return null; }
};

window.renderProjectionCard = function renderProjectionCard(kpi, period){
  try{
    period = period || 'month';
    const totalTx = (txs||[]).length;
    if(!totalTx){ return ''; }
    if(totalTx<5){
      return `<div class="card"><div class="ch">📈 ${T('projection_title').toUpperCase()}</div>
        <div class="tm" style="font-size:12px;padding:10px 0;text-align:center">📊 ${L('Ajoute au moins 5 transactions pour activer la projection.','Add at least 5 transactions to activate the projection.','Añade al menos 5 transacciones para activar la proyección.','Adicione pelo menos 5 transações para ativar a projeção.')}</div></div>`;
    }
    const proj = window.buildCashflowProjection(period);
    if(!proj) return '';
    const STEPS = proj.steps;
    const unitLabel = period==='day' ? 'H' : 'J';
    const W=300, H=80, pad=8;
    // v6.3 — projection enrichie : scénario central + bande pessimiste/optimiste + événements prédits
    const base = proj.series.map(p=>p.solde);
    const burnU = Math.max(1, (kpi && kpi.burnRate) || Math.abs((base[STEPS-1]-proj.start)/(STEPS||1)) || 1);
    const spread = (i)=> burnU*0.4*(i+1); // incertitude cumulée
    const pess = base.map((v,i)=> v - spread(i));
    const opt  = base.map((v,i)=> v + spread(i));
    const vals = [...base, ...pess, ...opt, proj.start, 0];
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const range = (maxV-minV)||1;
    const xs = (i)=> pad + (i/((STEPS-1)||1))*(W-2*pad);
    const ys = (v)=> pad + (1 - (v-minV)/range)*(H-2*pad);
    const yZero = ys(0);
    const toPath = (arr)=> arr.map((v,i)=> (i===0?'M':'L')+xs(i).toFixed(1)+','+ys(v).toFixed(1)+' ').join('');
    const line = toPath(base);
    const pessLine = toPath(pess);
    const optLine = toPath(opt);
    // Bande de confiance (entre optimiste et pessimiste)
    let band = 'M';
    opt.forEach((v,i)=>{ band += (i===0?'':'L')+xs(i).toFixed(1)+','+ys(v).toFixed(1)+' '; });
    for(let i=STEPS-1;i>=0;i--){ band += 'L'+xs(i).toFixed(1)+','+ys(pess[i]).toFixed(1)+' '; }
    band += 'Z';
    let negArea = '';
    base.forEach((v,i)=>{
      const x = xs(i);
      if(v<0){ negArea += (negArea===''?'M':'L')+x.toFixed(1)+','+yZero.toFixed(1)+' L'+x.toFixed(1)+','+ys(v).toFixed(1)+' '; }
    });
    // Événements prédits : revenus (▲ vert) et dépenses (● rouge), avec libellé montant
    const markers = proj.series.map((p,i)=>{
      let m='';
      if(p.incEvent){
        const amt=proj.incomeEvents[i]||0;
        m += `<polygon points="${xs(i)},${(ys(p.solde)-6).toFixed(1)} ${(xs(i)-4).toFixed(1)},${(ys(p.solde)+1).toFixed(1)} ${(xs(i)+4).toFixed(1)},${(ys(p.solde)+1).toFixed(1)}" fill="var(--grn)"/>`;
        if(amt) m += `<text x="${xs(i).toFixed(1)}" y="${(ys(p.solde)-8).toFixed(1)}" fill="var(--grn)" font-size="7" text-anchor="middle" font-family="var(--mono)">+${Math.round(amt/1000)}k</text>`;
      }
      if(p.expEvent){
        const amt=proj.expenseEvents[i]||0;
        m += `<circle cx="${xs(i).toFixed(1)}" cy="${ys(p.solde).toFixed(1)}" r="2.6" fill="var(--red)"/>`;
        if(amt) m += `<text x="${xs(i).toFixed(1)}" y="${(ys(p.solde)+12).toFixed(1)}" fill="var(--red)" font-size="7" text-anchor="middle" font-family="var(--mono)">-${Math.round(amt/1000)}k</text>`;
      }
      return m;
    }).join('');
    const nbInc = Object.keys(proj.incomeEvents||{}).length;
    const nbExp = Object.keys(proj.expenseEvents||{}).length;
    const negDay = base.findIndex(v=>v<0);
    const negAlert = (negDay>=0 && negDay<Math.ceil(STEPS/2)) ? `<div class="al al-d" style="margin-top:8px">⚠️ ${T('projection_alert').replace('{n}',negDay)}</div>` : '';
    const finalSolde = base[STEPS-1];
    const finalPess = pess[STEPS-1], finalOpt = opt[STEPS-1];
    const shortBanner = (kpi && kpi.isShortHistory) ? `<div class="tm" style="font-size:10px;margin-top:6px;font-style:italic">📊 ${L('Basé sur '+kpi.dataDays+'j — projection indicative.','Based on '+kpi.dataDays+'d — indicative projection.','Basado en '+kpi.dataDays+'d — proyección indicativa.','Baseado em '+kpi.dataDays+'d — projeção indicativa.')}</div>` : '';
    const legend = `<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:9px;color:var(--mut);margin-top:6px">
      <span><span style="display:inline-block;width:10px;height:2px;background:var(--acc3);vertical-align:middle"></span> ${L('Scénario central','Central scenario','Escenario central','Cenário central')}</span>
      <span><span style="display:inline-block;width:10px;height:8px;background:rgba(99,102,241,.18);vertical-align:middle"></span> ${L('Marge basse↔haute','Low↔high range','Margen bajo↔alto','Margem baixa↔alta')}</span>
      <span style="color:var(--grn)">▲ ${L('Revenu prévu','Predicted income','Ingreso previsto','Receita prevista')} (${nbInc})</span>
      <span style="color:var(--red)">● ${L('Dépense prévue','Predicted expense','Gasto previsto','Despesa prevista')} (${nbExp})</span>
    </div>`;
    return `<div class="card">
      <div class="ch">📈 ${T('projection_title').toUpperCase()} · ${unitLabel}+${STEPS}</div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:80px;display:block">
        <line x1="${pad}" y1="${yZero}" x2="${W-pad}" y2="${yZero}" stroke="var(--red)" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/>
        <path d="${band}" fill="rgba(99,102,241,.14)" stroke="none"/>
        <path d="${negArea}" fill="rgba(239,68,68,.15)"/>
        <path d="${optLine}" fill="none" stroke="var(--grn)" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/>
        <path d="${pessLine}" fill="none" stroke="var(--red)" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/>
        <path d="${line}" fill="none" stroke="var(--acc3)" stroke-width="2" stroke-linejoin="round"/>
        ${markers}
      </svg>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--mut);margin-top:4px">
        <span>${unitLabel}+0 : ${fmtFull(proj.start)}</span>
        <span style="color:${finalSolde>=0?'var(--grn)':'var(--red)'};font-weight:700">${unitLabel}+${STEPS} : ${fmtFull(finalSolde)}</span>
      </div>
      <div style="font-size:9px;color:var(--mut);margin-top:2px;text-align:right">${L('fourchette','range','rango','intervalo')}: ${fmtFull(finalPess)} → ${fmtFull(finalOpt)}</div>
      ${legend}
      ${shortBanner}
      ${negAlert}
    </div>`;
  }catch(e){ console.warn('[Projection render] fail',e); return ''; }
};

/* ============================================================
   MODULE 6 — IVY MEMORY ENRICHED
   ============================================================ */
function computeStreak(){
  try{
    const days = new Set((txs||[]).map(tx=>new Date(tx.date).toDateString()));
    let cur=0, longest=0;
    // currentStreak: starting today going back
    let d = new Date(); d.setHours(0,0,0,0);
    while(days.has(d.toDateString())){ cur++; d.setDate(d.getDate()-1); }
    // longestStreak: sorted unique days
    const sorted = [...days].map(s=>new Date(s).getTime()).sort((a,b)=>a-b);
    let run=1;
    for(let i=1;i<sorted.length;i++){
      const diff = Math.round((sorted[i]-sorted[i-1])/86400000);
      if(diff===1) run++; else { if(run>longest) longest=run; run=1; }
    }
    if(run>longest) longest=run;
    return {currentStreak:cur, longestStreak:longest};
  }catch(e){ return {currentStreak:0, longestStreak:0}; }
}

function computeWeeklyRetentions(){
  try{
    const buckets = {};
    (txs||[]).forEach(tx=>{
      const d = new Date(tx.date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay()+6)%7));
      monday.setHours(0,0,0,0);
      const key = monday.toISOString().slice(0,10);
      if(!buckets[key]) buckets[key]={inc:0,exp:0};
      if(tx.type==='income') buckets[key].inc+=tx.amount;
      else if(tx.type==='expense') buckets[key].exp+=tx.amount;
    });
    const weeks = Object.entries(buckets).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8);
    let best={pct:-Infinity,week:null}, worst={pct:Infinity,week:null};
    weeks.forEach(([k,v])=>{
      if(v.inc<=0) return;
      const pct = Math.round(((v.inc-v.exp)/v.inc)*100);
      if(pct>best.pct) best={pct, week:k};
      if(pct<worst.pct) worst={pct, week:k};
    });
    return {bestWeek:best.week?best:null, worstWeek:worst.week?worst:null};
  }catch(e){ return {bestWeek:null, worstWeek:null}; }
}

window.updateIvyMemory = async function updateIvyMemory(){
  try{
    if(typeof ALADDIN==='undefined' || !ALADDIN.getIvyState) return;
    const state = await ALADDIN.getIvyState();
    const streaks = computeStreak();
    const weeks = computeWeeklyRetentions();
    let avgBurn = 0;
    try{ avgBurn = computeKPIs().burnRate||0; }catch(e){}
    const profile = state.userProfile || {};
    profile.currentStreak = streaks.currentStreak;
    profile.longestStreak = Math.max(streaks.longestStreak, profile.longestStreak||0);
    profile.bestWeekRetention = weeks.bestWeek?weeks.bestWeek.pct:(profile.bestWeekRetention||null);
    profile.worstWeekRetention = weeks.worstWeek?weeks.worstWeek.pct:(profile.worstWeekRetention||null);
    profile.avgDailyBurn = Math.round(avgBurn);
    // Personal record: best single-day savings (income-expense)
    try{
      const byDay = {};
      (txs||[]).forEach(tx=>{
        const key = new Date(tx.date).toDateString();
        if(!byDay[key]) byDay[key]={inc:0,exp:0};
        if(tx.type==='income') byDay[key].inc+=tx.amount;
        else if(tx.type==='expense') byDay[key].exp+=tx.amount;
      });
      let recAmt = 0, recDate = null;
      Object.entries(byDay).forEach(([k,v])=>{
        const net = v.inc - v.exp;
        if(net>recAmt){ recAmt=net; recDate=k; }
      });
      if(recAmt > (profile.personalRecordEpargne?.amount||0)){
        profile.personalRecordEpargne = {amount:Math.round(recAmt), date:recDate};
      }
    }catch(e){}
    state.userProfile = profile;
    await ALADDIN.saveIvyState(state);
  }catch(e){ console.warn('[IvyMemory] fail',e); }
};

window.getIvyMemorySnapshot = async function getIvyMemorySnapshot(){
  try{
    if(typeof ALADDIN==='undefined' || !ALADDIN.getIvyState) return null;
    const state = await ALADDIN.getIvyState();
    return state.userProfile || null;
  }catch(e){ return null; }
};

/* Hook saveTx to update memory after each save */
try{
  if(typeof saveTx==='function'){
    const _origSaveTx = saveTx;
    window.saveTx = async function(){
      const r = await _origSaveTx.apply(this, arguments);
      try{ await window.updateIvyMemory(); }catch(e){}
      return r;
    };
  }
}catch(e){ console.warn('[IvyMemory hook] fail',e); }

/* Wrap buildCtx to inject ivyMemoire + depensesRecurrentes */
try{
  if(typeof buildCtx==='function'){
    const _origBuildCtx = buildCtx;
    window.buildCtx = async function(){
      const json = await _origBuildCtx.apply(this, arguments);
      try{
        const p = JSON.parse(json);
        const mem = await window.getIvyMemorySnapshot();
        if(mem){
          p.ivyMemoire = {
            currentStreak: mem.currentStreak||0,
            longestStreak: mem.longestStreak||0,
            bestWeekRetention: mem.bestWeekRetention,
            worstWeekRetention: mem.worstWeekRetention,
            avgDailyBurn: mem.avgDailyBurn,
            personalRecordEpargne: mem.personalRecordEpargne||null
          };
        }
        try{
          const rec = window.detectRecurringPatterns().slice(0,5).map(r=>({
            categorie:r.categoryName, montant:Math.round(r.amount),
            frequence:r.frequency, occurrences:r.occurrences,
            prochaineDate:r.nextExpectedDate.toISOString().slice(0,10)
          }));
          if(rec.length) p.depensesRecurrentes = rec;
        }catch(e){}
        return JSON.stringify(p);
      }catch(e){ return json; }
    };
  }
}catch(e){ console.warn('[buildCtx wrap] fail',e); }

/* Initial memory update on boot */
setTimeout(()=>{ try{ window.updateIvyMemory(); }catch(e){} }, 2000);

console.log('[v5.3] 6 modules institutionnels chargés');
})();
