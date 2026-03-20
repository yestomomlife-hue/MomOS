
// ─── localStorage PERSISTENCE ────────────────────────────────────────────────
const LS='momos_v2_';
function lsGet(k,def=null){try{const v=localStorage.getItem(LS+k);return v!==null?JSON.parse(v):def}catch{return def}}
function lsSet(k,v){try{localStorage.setItem(LS+k,JSON.stringify(v))}catch{}}
function lsDel(k){try{localStorage.removeItem(LS+k)}catch{}}

// ─── APP STATE ────────────────────────────────────────────────────────────────
let S={
  user:         lsGet('user',   null),
  budget:       lsGet('budget', {takehome:'',tips:'',childsupport:'',alimony:'',snap:'',other_inc:'',rent:'',utils:'',childcare:'',kids_act:'',groceries:'',transport:'',health:'',debt:'',misc:''}),
  expenses:     lsGet('expenses',[]),
  handoffs:     lsGet('handoffs',[]),
  comms:        lsGet('comms',[]),
  dailylogs:    lsGet('dailylogs',[]),
  quickentries: lsGet('quickentries',[]),
  savings:      lsGet('savings',  {saved:0,months:3,goals:[]}),
  children:     lsGet('children', []),
  transition:   lsGet('transition', null),
};

function save(key){lsSet(key,S[key])}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function obNext(step){
  // Hide all steps
  document.querySelectorAll('.ob-step').forEach(s=>{
    s.classList.remove('active');
    s.style.display='none';
    s.style.visibility='hidden';
  });
  // Show target step
  const target = document.getElementById('ob-'+step);
  if(target){
    target.classList.add('active');
    target.style.display='flex';
    target.style.visibility='visible';
    // Scroll to top
    window.scrollTo(0,0);
    const wrap = document.getElementById('onboarding');
    if(wrap) wrap.scrollTop = 0;
  }
}
function obSkip(){
  if(!S.user) S.user={name:'Friend',coparent:'Co-parent',children:[]};
  save('user');
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('onboarding').style.display='none';
  const app = document.getElementById('main-app');
  app.style.display='flex';
  app.style.visibility='visible';
  bootApp();
}
function obFinish(){
  const name=(document.getElementById('ob-firstname').value.trim())||'Friend';
  const coparent=(document.getElementById('ob-coparent').value.trim())||'Co-parent';
  const c1=document.getElementById('ob-child1').value.trim();
  const c2=document.getElementById('ob-child2').value.trim();
  const children=[];
  if(c1) children.push({name:c1,dob:'',school:'',medical:'',allergies:'',notes:''});
  if(c2) children.push({name:c2,dob:'',school:'',medical:'',allergies:'',notes:''});

  // pre-fill income from onboarding
  const income=+(document.getElementById('ob-income').value)||0;
  const cs=+(document.getElementById('ob-cs').value)||0;
  const ben=+(document.getElementById('ob-benefits').value)||0;
  if(income) S.budget.takehome=income;
  if(cs) S.budget.childsupport=cs;
  if(ben) S.budget.snap=ben;

  // Pre-fill realistic starter budget based on income
  if(income > 0){
    const totalInc = income + cs + ben;
    // Typical single mom budget allocations
    S.budget.rent       = Math.round(totalInc * 0.30); // 30% housing
    S.budget.childcare  = Math.round(totalInc * 0.20); // 20% childcare
    S.budget.groceries  = Math.round(totalInc * 0.12); // 12% food
    S.budget.utils      = Math.round(totalInc * 0.06); // 6% utilities
    S.budget.transport  = Math.round(totalInc * 0.10); // 10% transport
    S.budget.health     = Math.round(totalInc * 0.03); // 3% health
    S.budget.kids_act   = Math.round(totalInc * 0.04); // 4% kids activities
    S.budget.misc       = Math.round(totalInc * 0.03); // 3% misc
    // Leave debt, savings blank for user to fill
  }
  save('budget');

  S.user={name,coparent,children};
  S.children=children;
  save('user'); save('children');
  // After onboarding, prompt user to set a PIN
  document.getElementById('onboarding').classList.add('hidden');
  promptPinSetup();
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
function bootApp(){
  // iOS PWA sometimes needs explicit visibility
  const ob = document.getElementById('onboarding');
  if(ob){ ob.classList.add('hidden'); ob.style.display='none'; }
  const app = document.getElementById('main-app');
  app.style.display='flex';
  app.style.visibility='visible';
  app.style.opacity='1';
  applyUserToUI();
  loadBudgetInputs();
  recalc();
  recalcSavings();
  buildCalendar('main-cal');
  // Ensure transition defaults load even on first run
  if(!S.transition) S.transition=[...TRANS_DEFAULTS.map(t=>({...t}))];
  buildTransition();
  buildTemplates();
  buildChildren();
  buildExpenseTable();
  buildHandoffTable();
  buildCommTable();
  buildDailyLogFeed();
  buildSavingsGoals();
  populateChildDropdowns();
  setTodayDates();
  updateDashboard();
  // Check if we should show install banner
  checkInstallBanner();
  // Init safety check-in widget
  initSafetyCheckin();
}

function applyUserToUI(){
  const u=S.user;
  if(!u) return;
  const init=u.name.charAt(0).toUpperCase();
  document.getElementById('sb-avatar').textContent=init;
  document.getElementById('sb-uname').textContent=u.name;
  const kids=u.children.map(c=>c.name).join(' & ');
  document.getElementById('sb-usub').textContent=kids?kids+' · MomOS':'Your app';
  ['leg-p1','d-p1name'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=u.name+"'s days"});
  ['leg-p2','d-p2name'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=(u.coparent||'Co-parent')+"'s days"});
  const p1n=document.getElementById('d-p1name'); if(p1n) p1n.textContent=u.name;
  const p2n=document.getElementById('d-p2name'); if(p2n) p2n.textContent=u.coparent||'Co-parent';
  ['exp-paidby-me','comm-by-me','dl-parent-me'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='Me ('+u.name+')'});
  ['exp-paidby-co','comm-by-co','dl-parent-co'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=u.coparent||'Co-parent'});
}

function setTodayDates(){
  const today=new Date().toISOString().split('T')[0];
  ['exp-date','ho-date','dl-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=today});
  const now=new Date().toISOString().slice(0,16);
  const cdt=document.getElementById('comm-dt');
  if(cdt) cdt.value=now;
}

function populateChildDropdowns(){
  const kids=S.children.length?S.children:S.user?.children||[];
  ['exp-child','ho-child','dl-child'].forEach(selId=>{
    const sel=document.getElementById(selId);
    if(!sel) return;
    const isHo=selId==='ho-child';
    sel.innerHTML='';
    if(!isHo){const opt=document.createElement('option');opt.value='';opt.textContent='N/A';sel.appendChild(opt);}
    else{const opt=document.createElement('option');opt.value='Both';opt.textContent='Both';sel.appendChild(opt);}
    kids.forEach(c=>{const opt=document.createElement('option');opt.value=c.name;opt.textContent=c.name;sel.appendChild(opt);});
    if(!isHo&&kids.length){const opt=document.createElement('option');opt.value='Both';opt.textContent='Both';sel.appendChild(opt);}
  });
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const PAGE_META={
  dashboard:{title:'Family Feed',sub:'Today\'s activity timeline'},
  budget:{title:'Budget',sub:'Income & expenses'},
  expenses:{title:'Expense Log',sub:'Every dollar documented'},
  savings:{title:'Savings Goals',sub:'Build your safety net'},
  calendar:{title:'Custody Calendar',sub:'Track schedule & deviations'},
  handoffs:{title:'Handoff Log',sub:'Every exchange documented'},
  comms:{title:'Communications',sub:'Log all co-parent contact'},
  dailylog:{title:'Log Entry',sub:'Quick-add meals, mood, activities'},
  transition:{title:'Transition Planner',sub:'Your fresh start roadmap'},
  children:{title:'Child Profiles',sub:'Medical info & school details'},
  export:{title:'Download Records',sub:'Export your data as spreadsheet files'},
  resources:{title:'Your Toolkit',sub:'Meal plans, calm talks & support'},
  privacy:{title:'Privacy Policy',sub:'How MomOS handles your information'},
};

function nav(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id)?.classList.add('active');
  document.querySelectorAll('.sb-item').forEach(i=>{
    i.classList.toggle('active',i.getAttribute('onclick')?.includes("'"+id+"'"));
  });
  // Bottom nav active state
  const bnMap={dashboard:'bn-feed',budget:'bn-money',expenses:'bn-money',savings:'bn-money',dailylog:'bn-log',calendar:'bn-kids',handoffs:'bn-kids',comms:'bn-kids',transition:'bn-plan',children:'bn-plan',templates:'bn-plan',export:'bn-plan',privacy:'bn-plan',resources:'bn-plan'};
  document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
  const activeBn=bnMap[id];
  if(activeBn) document.getElementById(activeBn)?.classList.add('active');

  const m=PAGE_META[id]||{};
  document.getElementById('tb-title').textContent=m.title||id;
  document.getElementById('tb-sub').textContent=m.sub||'';
  if(id==='dashboard') updateDashboard();
  if(id==='dailylog') buildDailyLogFeed();
  if(id==='savings') recalcSavings();
  if(id==='export'){refreshExportCounts();setPreview('custody');}
  if(id==='expenses'){buildReimbursementSummary();}
  if(id==='calendar'){buildCalendar('main-cal');}
  if(id==='privacy'){updatePinStatusUI();}
}

// ─── BUDGET ───────────────────────────────────────────────────────────────────
const BUDGET_FIELDS=['takehome','tips','childsupport','alimony','snap','other_inc','rent','utils','childcare','kids_act','groceries','transport','health','debt','misc'];
const INC_FIELDS=['takehome','tips','childsupport','alimony','snap','other_inc'];
const EXP_FIELDS=['rent','utils','childcare','kids_act','groceries','transport','health','debt','misc'];
const EXP_LABELS=['Rent','Utilities','Childcare','Kids activities','Groceries','Transport','Health','Debt','Everything else'];
const EXP_COLORS=['var(--rose)','var(--teal)','var(--lav)','var(--rose-lt)','var(--sage)','var(--gold)','var(--teal)','var(--lav-dk)','var(--t3)'];

function loadBudgetInputs(){
  BUDGET_FIELDS.forEach(f=>{
    const el=document.getElementById('b-'+f.replace('_','-'));
    if(el&&S.budget[f]) el.value=S.budget[f];
  });
}
function saveBudget(){
  BUDGET_FIELDS.forEach(f=>{
    const el=document.getElementById('b-'+f.replace('_','-'));
    if(el) S.budget[f]=+el.value||0;
  });
  save('budget');
  saveMonthlySnapshot();
  // Budget changes refresh feed on dashboard
  if(document.getElementById('page-dashboard')?.classList.contains('active')){
    updateDashboard();
  }
}
function getV(id){return +(document.getElementById(id)?.value)||0}
function fmt(n){return n===0||isNaN(n)?'—':'$'+Math.abs(Math.round(n)).toLocaleString()}
function fmtRaw(n){return '$'+Math.round(Math.abs(n)).toLocaleString()}
function pct(v,t){return t>0?Math.round(v/t*100)+'%':'—'}

function recalc(){
  saveBudget();
  const inc=INC_FIELDS.reduce((a,f)=>a+(+document.getElementById('b-'+f.replace('_','-'))?.value||0),0);
  const expVals=EXP_FIELDS.map(f=>+(document.getElementById('b-'+f.replace('_','-'))?.value)||0);
  const exp=expVals.reduce((a,v)=>a+v,0);
  const sur=inc-exp;

  ['b-inc-total','b-inc-total2'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=fmtRaw(inc)});
  ['b-exp-total','b-exp-total2'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=fmtRaw(exp)});

  // pct labels
  const pctMap={th:'takehome',cs:'childsupport',rent:'rent',utils:'utils',cc:'childcare',ka:'kids_act',groc:'groceries',tr:'transport',hl:'health',dt:'debt',ms:'misc'};
  Object.entries(pctMap).forEach(([k,f])=>{
    const el=document.getElementById('pct-'+k);
    const v=+(document.getElementById('b-'+f.replace('_','-'))?.value)||0;
    const total=f==='takehome'||f==='childsupport'?inc:exp;
    if(el) el.textContent=pct(v,total);
  });

  // Leftover banner
  const leftoverBanner = document.getElementById('leftover-banner');
  const leftoverAmt = document.getElementById('leftover-amount');
  const leftoverSub = document.getElementById('leftover-sub');
  if(leftoverBanner && (inc>0||exp>0)){
    leftoverBanner.style.display='block';
    const leftover = inc - exp;
    if(leftoverAmt){
      leftoverAmt.textContent = (leftover>=0?'+':'') + '$'+Math.abs(Math.round(leftover)).toLocaleString();
      leftoverAmt.style.color = leftover>=0?'var(--sage)':'var(--red)';
    }
    if(leftoverSub) leftoverSub.textContent = leftover>=0?'available to save or invest':'over budget this month';
  } else if(leftoverBanner){
    leftoverBanner.style.display='none';
  }

  // surplus
  const wrap=document.getElementById('surplus-row-wrap');
  if(wrap){
    if(inc===0&&exp===0){wrap.innerHTML='';return}
    const pos=sur>=0;
    wrap.innerHTML=`<div class="surplus-row ${pos?'sr-pos':'sr-neg'}">
      <div><div class="${pos?'sr-lbl-pos':'sr-lbl-neg'}">${pos?'Monthly surplus':'Monthly deficit'}</div>
      <div style="font-size:12px;color:${pos?'var(--sage-dk)':'var(--red)'};margin-top:3px">${pos?'Put this toward your emergency fund or savings goals':'Your expenses exceed your income — review what can be reduced'}</div></div>
      <div class="sr-amt ${pos?'sr-amt-pos':'sr-amt-neg'}">${pos?'+':''}${fmtRaw(sur)}</div></div>`;
  }

  // Budget gauge
  const gaugeEl = document.getElementById('budget-gauge-section');
  if(gaugeEl && (inc>0||exp>0)){
    const pct = inc>0 ? Math.min(Math.round(exp/inc*100),150) : 0;
    const over = pct > 100;
    const fillPct = Math.min(pct, 100);
    // Simple trend (compare to last month if available)
    const prevExp = lsGet('prev_month_exp', null);
    let trendHTML = '';
    if(prevExp !== null){
      const diff = exp - prevExp;
      const diffPct = prevExp>0 ? Math.round(Math.abs(diff)/prevExp*100) : 0;
      trendHTML = `<div class="trend-row">
        <span class="trend-arrow">${diff>0?'↑':'↓'}</span>
        <span style="color:${diff>0?'var(--red)':'var(--sage)'};font-weight:600">${diff>0?'+':''}$${Math.abs(Math.round(diff)).toLocaleString()} vs last month</span>
        <span style="color:var(--t3)">(${diffPct}% ${diff>0?'more':'less'} spending)</span>
      </div>`;
    }
    gaugeEl.innerHTML = `<div class="card mb-12">
      <div class="card-hdr"><div class="card-title">Monthly overview</div></div>
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13px;color:var(--t2)">Spending ${pct}% of income</span>
          <span style="font-size:13px;font-weight:600;color:${over?'var(--red)':'var(--sage)'}">${over?'Over budget':'On track'}</span>
        </div>
        <div class="gauge-track">
          <div class="gauge-fill ${over?'over':''}" style="width:${fillPct}%"></div>
        </div>
        <div class="gauge-labels">
          <span>$0</span>
          <span style="color:${over?'var(--red)':'var(--t3)'}">$${Math.round(exp).toLocaleString()} spent</span>
          <span>$${Math.round(inc).toLocaleString()} income</span>
        </div>
        ${trendHTML}
        ${buildSparkline()}
      </div>
    </div>`;
  } else if(gaugeEl){
    gaugeEl.innerHTML = '';
  }

  // bar chart
  const max=Math.max(...expVals,1);
  const bars=document.getElementById('b-bars');
  if(bars) bars.innerHTML=expVals.some(v=>v>0)?expVals.map((v,i)=>`
    <div class="bar-row">
      <div class="bar-lbl">${EXP_LABELS[i]}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/max*100)}%;background:${EXP_COLORS[i]}"></div></div>
      <div class="bar-val">$${Math.round(v).toLocaleString()}</div>
    </div>`).join(''):'<div class="empty" style="padding:20px"><div class="empty-sub">Enter expenses above to see breakdown</div></div>';

  recalcSavings();
  updateDashboard();
}

// ─── SAVINGS ────────────────────────────────────────────────────────────────
function recalcSavings(){
  const expVals=EXP_FIELDS.map(f=>+(document.getElementById('b-'+f.replace('_','-'))?.value)||0);
  const monthlyExp=expVals.reduce((a,v)=>a+v,0);
  const months=+(document.getElementById('sav-months')?.value)||3;
  const saved=+(document.getElementById('sav-saved')?.value)||0;
  const goal=monthlyExp*months;

  S.savings.saved=saved; S.savings.months=months;
  save('savings');

  const goalEl=document.getElementById('sav-goal');
  if(goalEl) goalEl.value=goal>0?'$'+Math.round(goal).toLocaleString():'Set budget first';

  const pctVal=goal>0?Math.min(Math.round(saved/goal*100),100):0;
  const prog=document.getElementById('sav-prog');
  if(prog) prog.style.width=pctVal+'%';
  const pctLbl=document.getElementById('sav-pct-lbl');
  if(pctLbl) pctLbl.textContent=pctVal+'% complete';
  const rem=document.getElementById('sav-remaining');
  if(rem&&goal>0) rem.textContent='$'+Math.round(Math.max(goal-saved,0)).toLocaleString()+' remaining';
}

function buildSavingsGoals(){
  const el=document.getElementById('sav-goals-list');
  if(!el) return;
  const goals=S.savings.goals||[];
  if(!goals.length){el.innerHTML='<div class="empty"><div class="empty-ic">🌟</div><div class="empty-title">No savings goals yet</div><div class="empty-sub">Add goals like a security deposit, vacation fund, or back-to-school budget</div></div>';return}
  el.innerHTML=goals.map((g,i)=>{
    const p=g.target>0?Math.min(Math.round((g.saved/g.target)*100),100):0;
    return `<div style="padding:14px 0;border-bottom:1px solid var(--bdr)">
      <div class="flex justify-between items-center mb-8"><div style="font-size:13px;font-weight:600">${g.name}</div><div style="font-size:12px;color:var(--t3)">$${(g.saved||0).toLocaleString()} / $${g.target.toLocaleString()}</div></div>
      <div class="progress-track mb-8"><div class="progress-fill pf-sage" style="width:${p}%"></div></div>
      <div class="flex justify-between"><div style="font-size:12px;color:var(--t3)">$${g.monthly||0}/month</div><div style="font-size:12px;font-weight:600;color:var(--sage)">${p}%</div></div>
    </div>`;}).join('');
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────
function saveExpense(){
  const desc=document.getElementById('exp-desc').value.trim();
  const amount=+(document.getElementById('exp-amount').value);
  if(!desc||!amount){showToast('Please add a description and amount','warn');return}
  const entry={id:Date.now(),date:document.getElementById('exp-date').value,child:document.getElementById('exp-child').value,category:document.getElementById('exp-cat').value,desc,amount,paidBy:document.getElementById('exp-paidby').value,reimbursement:document.getElementById('exp-reimb').value,status:document.getElementById('exp-reimb').value==='No'?'N/A':'Pending',photos:[...currentExpPhotos]};
  S.expenses.unshift(entry); save('expenses');
  currentExpPhotos=[];
  buildExpenseTable(); updateDashboard();
  showToast('Expense logged ✓','success');
  clearExpForm();
}
function clearExpForm(){
  ['exp-desc','exp-amount'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  currentExpPhotos=[];
  const prev=document.getElementById('exp-photo-preview');
  if(prev) prev.innerHTML='';
}
function buildExpenseTable(){
  const wrap=document.getElementById('exp-table-wrap');
  const badge=document.getElementById('exp-count-badge');
  if(badge) badge.textContent=S.expenses.length+' entr'+(S.expenses.length===1?'y':'ies');
  const sb=document.getElementById('sb-badge-exp');
  if(sb) sb.textContent=S.expenses.length;
  if(!wrap) return;
  if(!S.expenses.length){wrap.innerHTML='<div class="empty"><div class="empty-ic">🧾</div><div class="empty-title">No expenses logged yet</div><div class="empty-sub">Add your first expense above</div></div>';return}
  const bm={pending:'b-rose',paid:'b-sage','n/a':'b-grey'};
  wrap.innerHTML=`<div style="overflow-x:auto"><table class="tbl w-full"><thead><tr><th>Date</th><th>Child</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
    ${S.expenses.map(e=>`<tr>
      <td>${e.date}</td>
      <td>${e.child?`<span class="badge b-rose">${e.child}</span>`:''}</td>
      <td><span class="badge b-grey">${e.category}</span></td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.desc}</td>
      <td style="font-weight:600">$${(+e.amount).toFixed(2)}</td>
      <td><span class="badge ${bm[(e.status||'n/a').toLowerCase()]||'b-grey'}">${e.status}</span></td>
      <td style="white-space:nowrap">${e.photos&&e.photos.length?e.photos.map(p=>`<img class="receipt-thumb" src="${p}" onclick="openLightbox('${p}')" alt="Receipt">`).join('')+' ':''}<button class="btn btn-ghost btn-sm" onclick="deleteEntry('expenses',${e.id})">✕</button></td>
    </tr>`).join('')}
  </tbody></table></div>`;
  buildPendingReimb();
  buildReimbursementSummary();
}
function buildPendingReimb(){
  const el=document.getElementById('cal-pending');if(!el)return;
  const pending=S.expenses.filter(e=>e.status==='Pending'&&e.reimbursement!=='No');
  if(!pending.length){el.innerHTML='<div class="empty" style="padding:16px"><div class="empty-sub">No pending reimbursements</div></div>';return}
  const total=pending.reduce((a,e)=>a+(+e.amount*(e.reimbursement==='Yes — 50/50'?0.5:1)),0);
  el.innerHTML='<div class="card-body-sm">'+pending.map(e=>`<div class="flex justify-between items-center" style="padding:6px 0;border-bottom:1px solid var(--bdr);font-size:13px"><span>${e.desc.substring(0,30)}</span><span style="color:var(--rose);font-weight:600">$${(+e.amount*(e.reimbursement==='Yes — 50/50'?0.5:1)).toFixed(2)}</span></div>`).join('')+`<div class="flex justify-between items-center" style="padding:8px 0;font-weight:700;font-size:14px"><span>Total owed</span><span style="color:var(--rose)">$${total.toFixed(2)}</span></div></div>`;
}

// ─── HANDOFFS ────────────────────────────────────────────────────────────────
function saveHandoff(){
  const entry={id:Date.now(),date:document.getElementById('ho-date').value,child:document.getElementById('ho-child').value,location:document.getElementById('ho-location').value,scheduled:document.getElementById('ho-sched').value,actual:document.getElementById('ho-actual').value,ontime:document.getElementById('ho-ontime').value,notes:document.getElementById('ho-notes').value};
  S.handoffs.unshift(entry); save('handoffs');
  buildHandoffTable(); updateDashboard();
  if(document.getElementById('page-calendar')?.classList.contains('active')) buildCalendar('main-cal');
  const late=entry.ontime==='No';
  showToast(late?'⚠️ Late handoff documented':'Handoff logged ✓',late?'warn':'success');
  document.getElementById('ho-notes').value='';
}
function buildHandoffTable(){
  const wrap=document.getElementById('ho-table-wrap');
  const lates=S.handoffs.filter(h=>h.ontime==='No').length;
  const badge=document.getElementById('ho-late-badge');
  if(badge){badge.style.display=lates?'inline-flex':'none';badge.textContent=lates+' late handoff'+(lates===1?'':'s')}
  const sbBadge=document.getElementById('sb-badge-late');
  if(sbBadge) sbBadge.style.display=lates?'flex':'none';
  if(!wrap) return;
  if(!S.handoffs.length){wrap.innerHTML='<div class="empty"><div class="empty-ic">🤝</div><div class="empty-title">No handoffs logged yet</div><div class="empty-sub">Every custody exchange documented here is court-ready evidence</div></div>';return}
  wrap.innerHTML=`<div style="overflow-x:auto"><table class="tbl w-full"><thead><tr><th>Date</th><th>Child</th><th>Scheduled</th><th>Actual</th><th>On time?</th><th>Notes</th><th></th></tr></thead><tbody>
    ${S.handoffs.map(h=>`<tr style="${h.ontime==='No'?'background:var(--red-sf)':''}">
      <td>${h.date}</td><td>${h.child}</td><td>${h.scheduled}</td>
      <td style="${h.ontime==='No'?'font-weight:700;color:var(--red)':''}">${h.actual}</td>
      <td><span class="badge ${h.ontime==='Yes'?'b-sage':'b-red'}">${h.ontime}</span></td>
      <td style="font-size:12px;color:var(--t2);max-width:160px">${h.notes||''}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="deleteEntry('handoffs',${h.id})">✕</button></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

// ─── COMMUNICATIONS ───────────────────────────────────────────────────────────
function saveComm(){
  const topic=document.getElementById('comm-topic').value.trim();
  if(!topic){showToast('Please add a topic','warn');return}
  const entry={id:Date.now(),dt:document.getElementById('comm-dt').value,type:document.getElementById('comm-type').value,by:document.getElementById('comm-by').value,topic,summary:document.getElementById('comm-summary').value,photos:[...(window._commPhotosTemp||[])]};
  S.comms.unshift(entry); save('comms');
  window._commPhotosTemp=[];
  buildCommTable(); updateDashboard();
  showToast('Communication logged ✓','success');
  document.getElementById('comm-topic').value='';
  document.getElementById('comm-summary').value='';
  document.getElementById('comm-photo-preview').innerHTML='';
}
function buildCommTable(){
  const wrap=document.getElementById('comm-table-wrap');
  const badge=document.getElementById('comm-count-badge');
  if(badge) badge.textContent=S.comms.length+' entr'+(S.comms.length===1?'y':'ies');
  if(!wrap) return;
  if(!S.comms.length){wrap.innerHTML='<div class="empty"><div class="empty-ic">💬</div><div class="empty-title">No communications logged yet</div><div class="empty-sub">Document every text, call, and email with your co-parent</div></div>';return}
  // Use card-based layout instead of table to accommodate screenshots
  wrap.innerHTML=S.comms.map(c=>{
    const date=c.dt?c.dt.substring(0,10):'';
    const time=c.dt&&c.dt.includes('T')?c.dt.substring(11,16):'';
    const screenshots=(c.photos||[]);
    return `<div style="border-bottom:1px solid var(--bdr);padding:14px 18px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <span class="badge b-grey" style="font-size:11px">${c.type}</span>
            <span style="font-size:11px;color:var(--t3)">${date}${time?' · '+time:''}</span>
            <span style="font-size:11px;color:var(--t3)">From: ${c.by}</span>
          </div>
          <div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:2px">${c.topic}</div>
          ${c.summary?`<div style="font-size:12px;color:var(--t2);line-height:1.5">${c.summary}</div>`:''}
        </div>
        <button class="btn btn-ghost btn-sm" style="flex-shrink:0" onclick="deleteEntry('comms',${c.id})">✕</button>
      </div>
      ${screenshots.length?`
        <div style="margin-top:8px">
          <div style="font-size:11px;color:var(--t3);font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em">📎 ${screenshots.length} screenshot${screenshots.length>1?'s':''}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${screenshots.map((p,i)=>`
              <div style="position:relative;border-radius:var(--r-md);overflow:hidden;box-shadow:var(--sh-sm);cursor:pointer" onclick="openLightbox('${p}')">
                <img src="${p}" style="width:80px;height:80px;object-fit:cover;display:block">
                <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:white;font-size:9px;font-weight:600;text-align:center;padding:3px">TAP TO VIEW</div>
              </div>`).join('')}
          </div>
        </div>`:''}
    </div>`;
  }).join('');
}

// ─── DAILY LOG ────────────────────────────────────────────────────────────────
function pickMood(prefix,mood){
  document.querySelectorAll('#'+prefix+'-mood-picker .mood-opt').forEach(el=>{
    el.classList.toggle('selected',el.dataset.mood===mood);
  });
  const hidden=document.getElementById(prefix+'-mood');
  if(hidden) hidden.value=mood;
}

function saveDailyLog(){
  const child=document.getElementById('dl-child').value;
  if(!child){showToast('Please select a child','warn');return}
  const entry={id:Date.now(),date:document.getElementById('dl-date').value,child,parent:document.getElementById('dl-parent').value,breakfast:document.getElementById('dl-breakfast').value,lunch:document.getElementById('dl-lunch').value,dinner:document.getElementById('dl-dinner').value,hw:document.getElementById('dl-hw').value,bedtime:document.getElementById('dl-bedtime').value,activities:document.getElementById('dl-activities').value,mood:document.getElementById('dl-mood').value,notes:document.getElementById('dl-notes').value};
  S.dailylogs.unshift(entry); save('dailylogs');
  buildDailyLogFeed(); updateDashboard();
  showToast('Daily entry saved — check your Feed ✓','success');
  ['dl-breakfast','dl-lunch','dl-dinner','dl-activities','dl-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  document.getElementById('dl-mood').value='';
  document.querySelectorAll('#dl-mood-picker .mood-opt').forEach(el=>el.classList.remove('selected'));
}

function buildDailyLogTable(){buildDailyLogFeed();}  // alias for compatibility


// ─── REIMBURSEMENT SUMMARY ────────────────────────────────────────────────────
function buildReimbursementSummary(){
  const card = document.getElementById('reimb-summary-card');
  const body = document.getElementById('reimb-summary-body');
  if(!card || !body) return;

  const pending = S.expenses.filter(e=>e.status==='Pending' && e.reimbursement!=='No');
  if(!pending.length){ card.style.display='none'; return; }

  card.style.display='block';
  const coName = S.user?.coparent || 'Co-parent';

  // Calculate by category
  const byCat = {};
  let total = 0;
  pending.forEach(e=>{
    const mult = e.reimbursement==='Yes — 50/50' ? 0.5 : 1;
    const owed = (+e.amount||0) * mult;
    total += owed;
    if(!byCat[e.category]) byCat[e.category] = 0;
    byCat[e.category] += owed;
  });

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <div style="font-size:28px;font-weight:700;color:var(--rose)">$${total.toFixed(2)}</div>
        <div style="font-size:12px;color:var(--t3)">${pending.length} pending item${pending.length!==1?'s':''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:600;color:var(--t2)">Owed by</div>
        <div style="font-size:14px;font-weight:700;color:var(--t1)">${coName}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
      ${Object.entries(byCat).map(([cat,amt])=>`
        <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--bdr)">
          <span style="color:var(--t2)">${cat}</span>
          <span style="font-weight:600;color:var(--rose)">$${amt.toFixed(2)}</span>
        </div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--t3);padding:8px 10px;background:var(--surf2);border-radius:var(--r-sm)">
      Tap "Copy message" to send ${coName} a reimbursement request.
    </div>`;
}

function copyReimbursementMessage(){
  const coName = S.user?.coparent || 'Co-parent';
  const pending = S.expenses.filter(e=>e.status==='Pending' && e.reimbursement!=='No');
  let total = 0;
  let lines = [];
  pending.forEach(e=>{
    const mult = e.reimbursement==='Yes — 50/50' ? 0.5 : 1;
    const owed = (+e.amount||0)*mult;
    total += owed;
    lines.push(`• ${e.desc} (${e.date}): $${owed.toFixed(2)}`);
  });
  const msg = 'Hi ' + coName + ',\n\nAs per our agreement, the following expenses are pending reimbursement:\n\n' + lines.join('\n') + '\n\nTotal owed: $' + total.toFixed(2) + '\n\nPlease reimburse by [DATE]. Thank you.\n\nSent from MomOS';
  if(navigator.clipboard) navigator.clipboard.writeText(msg).then(()=>showToast('Reimbursement request copied ✓','success'));
}


// ─── LOG DEVIATION FROM FEED ─────────────────────────────────────────────────
function logDeviation(){
  document.getElementById('modal-title').textContent = '⚠️ Log a deviation';
  const today = new Date().toISOString().split('T')[0];
  const userName = S.user?.name||'You';
  const coName = S.user?.coparent||'Co-parent';
  document.getElementById('modal-body').innerHTML = `
    <div style="font-size:13px;color:var(--t2);margin-bottom:14px;padding:10px 12px;background:var(--red-sf);border-radius:var(--r-md);border-left:3px solid var(--red)">
      A deviation is when the co-parent changes the agreed schedule without notice. Log it here — it's timestamped and added to your custody record.
    </div>
    <div class="f-group mb-12"><label class="f-label">Date</label><input class="f-input" type="date" id="dev-date" value="${today}"></div>
    <div class="f-group mb-12"><label class="f-label">What happened?</label>
      <select class="f-select" id="dev-type">
        <option>Late pickup / dropoff</option>
        <option>No show — didn't arrive</option>
        <option>Returned child early</option>
        <option>Kept child extra days</option>
        <option>Changed location without notice</option>
        <option>Other schedule change</option>
      </select>
    </div>
    <div class="f-group mb-12"><label class="f-label">Child(ren) affected</label>
      <select class="f-select" id="dev-child">
        <option value="Both">Both</option>
        ${(S.children.length?S.children:S.user?.children||[]).map(c=>`<option>${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="f-group mb-12"><label class="f-label">Details</label>
      <textarea class="f-textarea" id="dev-notes" placeholder="e.g. ${coName} was scheduled for 3pm pickup. Did not arrive until 4:22pm with no notice given."></textarea>
    </div>`;

  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" style="background:var(--red);border-color:var(--red)" onclick="saveDeviation()">⚠️ Log deviation</button>`;
  openModal();
}

function saveDeviation(){
  const type = document.getElementById('dev-type')?.value||'';
  const notes = document.getElementById('dev-notes')?.value||'';
  const date = document.getElementById('dev-date')?.value||new Date().toISOString().split('T')[0];
  const child = document.getElementById('dev-child')?.value||'Both';
  if(!notes.trim()){showToast('Please describe what happened','warn');return;}

  // Save as a handoff entry marked as deviation
  const entry = {
    id:Date.now(),
    date,
    child,
    location:'',
    scheduled:'',
    actual:'',
    ontime:'No',
    deviation:true,
    deviationNote:type+' — '+notes,
    notes,
    source:'deviation'
  };
  S.handoffs.unshift(entry);
  save('handoffs');

  // Also mark the calendar day as deviation
  const calData = getCalData();
  const d = new Date(date+'T12:00:00');
  if(d.getFullYear()===calData.year && d.getMonth()===calData.month){
    calData.days[d.getDate()] = 'dev';
    saveCalData(calData);
    buildCalendar('main-cal');
  }

  closeModal();
  updateDashboard();
  buildHandoffTable();
  showToast('⚠️ Deviation logged and added to custody record','warn');
}

// ─── DELETE ENTRY ─────────────────────────────────────────────────────────────
function deleteEntry(type,id){
  S[type]=S[type].filter(e=>e.id!==id); save(type);
  if(type==='expenses'){buildExpenseTable();buildPendingReimb()}
  else if(type==='handoffs') buildHandoffTable();
  else if(type==='comms') buildCommTable();
  else if(type==='dailylogs'||type==='quickentries') buildDailyLogFeed();
  updateDashboard();
  showToast('Entry removed');
}

// ─── CALENDAR ────────────────────────────────────────────────────────────────
// Calendar state — stored in localStorage
function getCalData(){
  return lsGet('caldata', {
    year:2026, month:2, // 0-indexed month (2=March)
    days:{} // {1:'p1', 5:'p2', 12:'dev', etc}
  });
}
function saveCalData(data){ lsSet('caldata', data); }

function buildCalendar(id){
  const c=document.getElementById(id); if(!c) return;
  const calData = getCalData();
  const days=['Su','Mo','Tu','We','Th','Fr','Sa'];

  // Calculate first day of month offset
  const firstDay = new Date(calData.year, calData.month, 1).getDay();
  const daysInMonth = new Date(calData.year, calData.month+1, 0).getDate();
  const now = new Date();
  const isCurrentMonth = now.getFullYear()===calData.year && now.getMonth()===calData.month;

  let h = days.map(d=>`<div class="cal-hdr">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++) h+='<div></div>';

  let p1count=0, p2count=0;

  for(let day=1;day<=daysInMonth;day++){
    const owner = calData.days[day]||'unset';
    if(owner==='p1') p1count++;
    if(owner==='p2') p2count++;

    // Check if this day has any logged entries
    const dateStr = `${calData.year}-${String(calData.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const hasEntries = S.dailylogs.some(d=>d.date===dateStr) ||
                       (S.quickentries||[]).some(e=>e.date===dateStr) ||
                       S.handoffs.some(h=>h.date===dateStr) ||
                       S.expenses.some(e=>e.date===dateStr);

    let cls = 'cal-cell';
    if(owner==='p1') cls+=' p1';
    else if(owner==='p2') cls+=' p2';
    else if(owner==='dev') cls+=' dev';
    else cls+=' unset';
    if(hasEntries) cls+=' has-entries';
    if(isCurrentMonth && day===now.getDate()) cls+=' today';

    h+=`<div class="${cls}" onclick="openDaySheet(${day})">${day}</div>`;
  }

  c.innerHTML=h;

  // Update month title
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const titleEl = document.querySelector('#page-calendar .card-title');
  if(titleEl) titleEl.textContent = `Custody calendar · ${months[calData.month]} ${calData.year}`;

  const p1el=document.getElementById('cal-p1days');
  const p2el=document.getElementById('cal-p2days');
  if(p1el) p1el.textContent=p1count;
  if(p2el) p2el.textContent=p2count;

  // Update legend names
  const leg1=document.getElementById('leg-p1');
  const leg2=document.getElementById('leg-p2');
  if(leg1&&S.user) leg1.textContent=(S.user.name||'You')+"'s days";
  if(leg2&&S.user) leg2.textContent=(S.user.coparent||'Co-parent')+"'s days";
}

// ── CALENDAR NAVIGATION ───────────────────────────────────
function calPrev(){
  const d=getCalData();
  d.month--;
  if(d.month<0){d.month=11;d.year--;}
  saveCalData(d); buildCalendar('main-cal');
}
function calNext(){
  const d=getCalData();
  d.month++;
  if(d.month>11){d.month=0;d.year++;}
  saveCalData(d); buildCalendar('main-cal');
}
function calToday(){
  const now=new Date();
  const d=getCalData();
  d.year=now.getFullYear();
  d.month=now.getMonth();
  saveCalData(d);
  buildCalendar('main-cal');
  // Auto-open today's day sheet
  setTimeout(()=>openDaySheet(now.getDate()), 200);
}

// ─── TRANSITION ───────────────────────────────────────────────────────────────
const TRANS_DEFAULTS=[
  {label:'Open a private bank account (before leaving)',cost:0,priority:'high',done:false},
  {label:'Security deposit paid',cost:1800,priority:'high',done:false},
  {label:'First & last month\'s rent',cost:2400,priority:'high',done:false},
  {label:'Rekey / replace all locks on move-in day',cost:150,priority:'high',done:false},
  {label:'Get a PO Box to protect your address',cost:100,priority:'high',done:false},
  {label:'Renter\'s insurance active',cost:180,priority:'high',done:false},
  {label:'Health insurance enrolled (Medicaid / ACA)',cost:0,priority:'high',done:false},
  {label:'Driver\'s license — update to new address',cost:30,priority:'high',done:false},
  {label:'Social Security card replacement',cost:0,priority:'high',done:false},
  {label:'Kids enrolled at new school',cost:50,priority:'high',done:false},
  {label:'Attorney consultation booked',cost:500,priority:'high',done:false},
  {label:'Essential furniture sourced',cost:800,priority:'high',done:false},
  {label:'Internet set up (check Lifeline program)',cost:60,priority:'medium',done:false},
  {label:'Your own therapy sessions booked',cost:200,priority:'high',done:false},
  {label:'Kids\' therapy sessions started',cost:0,priority:'high',done:false},
  {label:'Emergency cash hidden in safe place',cost:300,priority:'high',done:false},
  {label:'Security camera or doorbell camera',cost:80,priority:'medium',done:false},
  {label:'New private email address',cost:0,priority:'high',done:false},
  {label:'New bank account open and active',cost:0,priority:'high',done:false},
  {label:'Grocery stock-up — first week',cost:200,priority:'high',done:false},
];
function buildTransition(){
  if(!S.transition) S.transition=[...TRANS_DEFAULTS.map(t=>({...t}))];
  const el=document.getElementById('trans-list'); if(!el) return;
  const done=S.transition.filter(t=>t.done).length;
  const est=S.transition.reduce((a,t)=>a+t.cost,0);
  const doneCost=S.transition.filter(t=>t.done).reduce((a,t)=>a+t.cost,0);
  const d1=document.getElementById('trans-done'); if(d1) d1.textContent=done+'/'+S.transition.length;
  const d2=document.getElementById('trans-est'); if(d2) d2.textContent='$'+est.toLocaleString();
  const d3=document.getElementById('trans-left'); if(d3) d3.textContent=(S.transition.length-done);
  const ins=document.getElementById('trans-insight');
  if(ins){
    const next=S.transition.find(t=>!t.done&&t.priority==='high');
    ins.textContent=next?`Next priority: "${next.label}" — take it one step at a time.`:'You\'ve completed all high-priority items. Amazing work.';
  }
  el.innerHTML=S.transition.map((t,i)=>`
    <div class="chk-item">
      <div class="chk-box ${t.done?'checked':''}" onclick="toggleTrans(${i})">
        ${t.done?'<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>':''}
      </div>
      <div style="flex:1">
        <div class="chk-lbl ${t.done?'done':''}">${t.label}</div>
        <div class="chk-meta"><span class="p-tag p-${t.priority}">${t.priority.toUpperCase()}</span>${t.cost===0?'<span style="color:var(--sage);font-size:11px;font-weight:600;margin-left:4px">Free</span>':''}</div>
      </div>
      ${t.cost>0?`<div style="font-size:12px;font-weight:600;color:var(--t2);flex-shrink:0">$${t.cost.toLocaleString()}</div>`:''}
    </div>`).join('');
}
function toggleTrans(i){
  S.transition[i].done=!S.transition[i].done; save('transition');
  buildTransition();
  showToast(S.transition[i].done?'✓ Step complete — keep going!':'Unchecked',S.transition[i].done?'success':'');
}

// ─── CHILDREN ────────────────────────────────────────────────────────────────
function buildChildren(){
  const el=document.getElementById('children-list'); if(!el) return;
  if(!S.children.length){el.innerHTML='<div class="card mb-14"><div class="card-body"><div class="empty"><div class="empty-ic">👧</div><div class="empty-title">No child profiles yet</div><div class="empty-sub">Add your children\'s medical info, school details, and allergies — all in one place</div></div></div></div>';return}
  el.innerHTML=S.children.map((c,i)=>`
    <div class="card mb-14">
      <div class="card-hdr" style="background:var(--rose-sf)">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:48px;height:48px;border-radius:50%;background:var(--rose-sf);border:2px solid var(--rose-br);display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden;flex-shrink:0">${c.photo?`<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover" onclick="openLightbox('${c.photo}')">`:`<span>${getChildEmoji(c)}</span>`}</div>
          <div><div class="card-title">${c.name}</div><div class="card-sub">${c.dob?'Born '+c.dob:''}</div></div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="openChildModal(${i})">Edit</button>
      </div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px;font-size:13px">
        ${c.school?`<div><div class="f-label mb-8">School / Daycare</div><div>${c.school}</div></div><div class="divider"></div>`:''}
        ${c.medical?`<div><div class="f-label mb-8" style="color:var(--red)">⚠️ Medical</div><div style="padding:10px 12px;background:var(--red-sf);border-radius:var(--r-md);border-left:3px solid var(--red)">${c.medical}</div></div><div class="divider"></div>`:''}
        ${c.allergies?`<div><div class="f-label mb-8" style="color:var(--gold-dk)">⚠️ Allergies</div><div style="padding:10px 12px;background:var(--gold-sf);border-radius:var(--r-md);border-left:3px solid var(--gold)">${c.allergies}</div></div><div class="divider"></div>`:''}
        ${c.notes?`<div><div class="f-label mb-8">Notes</div><div>${c.notes}</div></div>`:''}
      </div>
    </div>`).join('');
}
function openChildModal(idx=null){
  const child=idx!==null?S.children[idx]:{name:'',dob:'',school:'',medical:'',allergies:'',notes:'',photo:'',gender:''};
  document.getElementById('modal-title').textContent=idx!==null?'Edit child profile':'Add child profile';
  document.getElementById('modal-body').innerHTML=`
    <!-- Child photo -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
      <div id="ch-photo-preview" style="width:72px;height:72px;border-radius:50%;background:var(--rose-sf);border:2px solid var(--rose-br);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;overflow:hidden">
        ${child.photo ? `<img src="${child.photo}" style="width:100%;height:100%;object-fit:cover">` : '👧'}
      </div>
      <div style="flex:1">
        <label class="photo-attach-btn" for="ch-photo-input" style="margin-bottom:0">
          <span style="font-size:15px">📷</span> ${child.photo ? 'Change photo' : 'Add photo'}
        </label>
        <input type="file" id="ch-photo-input" accept="image/*" style="display:none" onchange="previewChildPhoto(this)">
        <div style="font-size:11px;color:var(--t3);margin-top:4px">Choose from your photo library</div>
      </div>
    </div>
    <div class="form-grid mb-12">
      <div class="f-group"><label class="f-label">Child's name</label><input class="f-input" id="ch-name" value="${child.name}" placeholder="First name"></div>
      <div class="f-group"><label class="f-label">Date of birth</label><input class="f-input" type="date" id="ch-dob" value="${child.dob}"></div>
    </div>
    <div class="f-group mb-12">
      <label class="f-label">Gender</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="gender-btn ${child.gender==='girl'?'gender-selected':''}" onclick="selectGender('girl')" id="gb-girl">👧 Girl</button>
        <button type="button" class="gender-btn ${child.gender==='boy'?'gender-selected':''}" onclick="selectGender('boy')" id="gb-boy">👦 Boy</button>
        <button type="button" class="gender-btn ${child.gender==='baby'?'gender-selected':''}" onclick="selectGender('baby')" id="gb-baby">👶 Baby</button>
        <button type="button" class="gender-btn ${(!child.gender||child.gender==='unspecified')?'gender-selected':''}" onclick="selectGender('unspecified')" id="gb-unspecified">🌟 Prefer not to say</button>
      </div>
      <input type="hidden" id="ch-gender" value="${child.gender||''}">
    </div>
    <div class="f-group mb-12"><label class="f-label">School / daycare</label><input class="f-input" id="ch-school" value="${child.school}" placeholder="e.g. Maplewood Elementary — Grade K"></div>
    <div class="f-group mb-12"><label class="f-label">Medical info / conditions</label><textarea class="f-textarea" id="ch-medical" placeholder="e.g. Mild asthma — Albuterol inhaler before exercise">${child.medical}</textarea></div>
    <div class="f-group mb-12"><label class="f-label">Allergies</label><input class="f-input" id="ch-allergies" value="${child.allergies}" placeholder="e.g. Peanuts — carries EpiPen at all times"></div>
    <div class="f-group"><label class="f-label">Special notes</label><textarea class="f-textarea" id="ch-notes" placeholder="Therapy, comfort items, routines, anything important">${child.notes}</textarea></div>`;
  const btn=document.getElementById('modal-save-btn');
  btn.onclick=()=>{
    const updated={name:document.getElementById('ch-name').value.trim(),dob:document.getElementById('ch-dob').value,school:document.getElementById('ch-school').value,medical:document.getElementById('ch-medical').value,allergies:document.getElementById('ch-allergies').value,notes:document.getElementById('ch-notes').value,photo:window._childPhotoTemp||(idx!==null?S.children[idx].photo:'')||'',gender:document.getElementById('ch-gender')?.value||''}; window._childPhotoTemp=null;
    if(!updated.name){showToast('Please add a name','warn');return}
    if(idx!==null) S.children[idx]=updated;
    else S.children.push(updated);
    save('children');
    buildChildren(); populateChildDropdowns();
    closeModal(); showToast('Profile saved ✓','success');
  };
  openModal();
}


// ─── GENDER & CHILD EMOJI ────────────────────────────────────────────────────
function getChildEmoji(child){
  if(!child) return '👧';
  // Auto baby: if under 18 months old
  if(child.dob){
    const birth = new Date(child.dob);
    const ageMonths = (Date.now() - birth.getTime()) / (1000*60*60*24*30.44);
    if(ageMonths <= 18) return '👶';
  }
  switch(child.gender){
    case 'boy': return '👦';
    case 'baby': return '👶';
    case 'girl': return '👧';
    default: return '🌟';
  }
}

function selectGender(gender){
  document.getElementById('ch-gender').value = gender;
  ['girl','boy','baby','unspecified'].forEach(g=>{
    const btn = document.getElementById('gb-'+g);
    if(btn) btn.classList.toggle('gender-selected', g===gender);
  });
}


// ─── RESOURCES MODULE ────────────────────────────────────────────────────────
let currentSeason = 'spring';
let currentWeek = 1;
let currentTalkTopic = null;

// ── MEAL PLANS DATA ──────────────────────────────────────────────────────────
const MEAL_PLANS = {
  spring: {
    week1: [
      {day:'Monday',emoji:'🌿',
       breakfast:{meal:'Greek yogurt parfait with berries & chia seeds',note:'Prep: 5 min',tags:['probiotic','protein','omega','fiber']},
       lunch:{meal:'Canned salmon & avocado wrap with spinach',note:'Whole wheat tortilla. Prep: 8 min',tags:['omega','protein','fiber']},
       dinner:{meal:'Lemon herb salmon with roasted broccoli & quinoa',note:'Prep: 10 min, cook 25 min',tags:['omega','protein','fiber']},
       snack:{meal:'Apple slices with almond butter & chia sprinkle',tags:['fiber','omega']}},
      {day:'Tuesday',emoji:'🌸',
       breakfast:{meal:'Overnight oats with walnuts, banana & flaxseed',note:'Make night before. Zero morning effort',tags:['omega','fiber']},
       lunch:{meal:'Lentil soup with whole grain bread',note:'Make big batch Monday. Prep: 5 min',tags:['protein','fiber']},
       dinner:{meal:'Chicken stir-fry with edamame, broccoli & brown rice',note:'Prep: 20 min. One pan',tags:['protein','omega','fiber']},
       snack:{meal:'Kefir smoothie with frozen berries',tags:['probiotic','protein']}},
      {day:'Wednesday',emoji:'🌱',
       breakfast:{meal:'Scrambled eggs with spinach on whole grain toast',note:'Protein + iron. Prep: 10 min',tags:['protein','fiber']},
       lunch:{meal:'Chickpea & cucumber salad with lemon olive oil',note:'No-cook. Prep: 5 min',tags:['protein','fiber']},
       dinner:{meal:'Sheet pan chicken thighs with sweet potato & kale',note:'Prep: 10 min, cook 30 min. High iron',tags:['protein','fiber']},
       snack:{meal:'Plain Greek yogurt with honey & walnuts',tags:['probiotic','protein','omega']}},
      {day:'Thursday',emoji:'🌼',
       breakfast:{meal:'Smoothie: spinach, banana, flaxseed, peanut butter & milk',note:'Blend & go. Prep: 5 min',tags:['omega','fiber','protein']},
       lunch:{meal:'Tuna & bean salad on whole grain crackers',note:'Canned tuna + white beans. Prep: 5 min',tags:['omega','protein','fiber']},
       dinner:{meal:'Turkey & lentil bolognese over whole wheat pasta',note:'Prep: 25 min. Freeze leftovers',tags:['protein','fiber']},
       snack:{meal:'Edamame with sea salt',tags:['omega','protein','fiber']}},
      {day:'Friday',emoji:'🎉',
       breakfast:{meal:'Banana oat pancakes with blueberries (2-ingredient)',note:'Banana + egg. Prep: 10 min',tags:['fiber','protein']},
       lunch:{meal:'Greek yogurt tzatziki with veggie sticks & whole grain pita',note:'No-cook. Prep: 5 min',tags:['probiotic','protein','fiber']},
       dinner:{meal:'Baked salmon with roasted asparagus & brown rice',note:'Prep: 5 min, cook 20 min',tags:['omega','protein','fiber']},
       snack:{meal:'Dark chocolate & walnut trail mix',tags:['omega','fiber']}},
      {day:'Saturday',emoji:'🌺',
       breakfast:{meal:'Avocado toast with smoked salmon & everything bagel seasoning',note:'Omega-3 powerhouse. Prep: 8 min',tags:['omega','protein','fiber']},
       lunch:{meal:'Black bean tacos with slaw, salsa & Greek yogurt (instead of sour cream)',note:'Prep: 15 min',tags:['probiotic','protein','fiber']},
       dinner:{meal:'One-pot chicken & white bean soup with kale',note:'Dump and simmer. Prep: 10 min',tags:['protein','fiber']},
       snack:{meal:'Cottage cheese with pineapple',tags:['probiotic','protein']}},
      {day:'Sunday',emoji:'☀️',
       breakfast:{meal:'Full veggie omelette with whole grain toast',note:'Meal prep day — cook grains & hard boil eggs',tags:['protein']},
       lunch:{meal:'Big grain bowl: quinoa, roasted veg, chickpeas, tahini',note:'Use Sunday prep. Nutrient-dense',tags:['protein','fiber','omega']},
       dinner:{meal:'Slow cooker lentil & vegetable curry with brown rice',note:'Set in morning. Freeze half',tags:['protein','fiber']},
       snack:{meal:'Chia pudding made with kefir & berries',tags:['omega','probiotic','fiber']}},
    ],
    week2: [
      {day:'Monday',emoji:'🌿',
       breakfast:{meal:'Chia pudding with mango & coconut (made night before)',note:'Zero morning effort. Omega-3 + fiber',tags:['omega','fiber']},
       lunch:{meal:'Leftover lentil curry bowl',note:'No cooking. Prep: 3 min',tags:['protein','fiber']},
       dinner:{meal:'Sardine pasta with garlic, capers & broccoli',note:'Budget omega-3 hero. Prep: 20 min',tags:['omega','protein','fiber']},
       snack:{meal:'Greek yogurt with granola & kiwi',tags:['probiotic','protein','fiber']}},
      {day:'Tuesday',emoji:'🌸',
       breakfast:{meal:'Peanut butter & banana overnight oats with flaxseed',note:'Make night before',tags:['omega','fiber','protein']},
       lunch:{meal:'Canned tuna nicoise salad with egg & green beans',note:'High protein, omega-rich. Prep: 10 min',tags:['omega','protein','fiber']},
       dinner:{meal:'Turkey meatballs with marinara & whole wheat spaghetti',note:'Make double, freeze half',tags:['protein','fiber']},
       snack:{meal:'Apple with almond butter',tags:['fiber','omega']}},
      {day:'Wednesday',emoji:'🌱',
       breakfast:{meal:'Kefir smoothie: kefir, frozen berries, banana, chia seeds',note:'Probiotic powerhouse. Prep: 5 min',tags:['probiotic','omega','fiber']},
       lunch:{meal:'Chickpea & spinach soup',note:'Prep: 15 min. Batch cook',tags:['protein','fiber']},
       dinner:{meal:'Baked cod with lemon, sweet potato mash & peas',note:'Prep: 10 min. Light & nutritious',tags:['protein','omega','fiber']},
       snack:{meal:'Walnuts & dried cranberries',tags:['omega','fiber']}},
      {day:'Thursday',emoji:'🌼',
       breakfast:{meal:'Egg & veggie breakfast burrito on whole wheat wrap',note:'Prep: 10 min. Wrap & go',tags:['protein','fiber']},
       lunch:{meal:'Hummus & roasted veggie sandwich on whole grain',note:'No cooking. Prep: 5 min',tags:['protein','fiber']},
       dinner:{meal:'Salmon patties with yogurt dill sauce & roasted broccoli',note:'Use canned salmon. Prep: 20 min',tags:['omega','protein','probiotic','fiber']},
       snack:{meal:'Edamame & kiwi',tags:['omega','protein','fiber']}},
      {day:'Friday',emoji:'🎉',
       breakfast:{meal:'Greek yogurt parfait with granola, berries & chia',note:'3 min prep',tags:['probiotic','protein','omega','fiber']},
       lunch:{meal:'Lentil & veggie wrap',note:'Leftover lentils + fresh veg',tags:['protein','fiber']},
       dinner:{meal:'Chicken & broccoli stir-fry with brown rice',note:'Prep: 20 min. Family favourite',tags:['protein','fiber']},
       snack:{meal:'Homemade trail mix: walnuts, pumpkin seeds, dried fruit',tags:['omega','fiber']}},
      {day:'Saturday',emoji:'🌺',
       breakfast:{meal:'Shakshuka (eggs in tomato sauce) with whole grain toast',note:'Impressive, easy. Prep: 20 min',tags:['protein','fiber']},
       lunch:{meal:'Smoked salmon & cream cheese bagel with cucumber',note:'Omega-3 luxury on a budget',tags:['omega','protein']}  ,
       dinner:{meal:'Slow cooker chicken & vegetable soup with lentils',note:'Set morning, ready at dinner',tags:['protein','fiber']},
       snack:{meal:'Cottage cheese with cucumber & dill',tags:['probiotic','protein']}},
      {day:'Sunday',emoji:'☀️',
       breakfast:{meal:'Waffles with Greek yogurt & mixed berries instead of syrup',note:'Probiotic swap',tags:['probiotic','protein']},
       lunch:{meal:'Big colourful salad: quinoa, chickpeas, roasted veg, tahini dressing',note:'Prep ahead',tags:['protein','fiber','omega']},
       dinner:{meal:'Sheet pan sausage, chickpeas & roasted vegetables',note:'One pan, minimal cleanup',tags:['protein','fiber']},
       snack:{meal:'Chia seed pudding with cinnamon & apple',tags:['omega','fiber']}},
    ]
  },
  summer: {
    week1: [
      {day:'Monday',emoji:'🌞',breakfast:{meal:'Smoothie bowl: frozen mango, Greek yogurt, chia seeds, granola',note:'Prep: 8 min. Probiotic + omega-3',tags:['probiotic','omega','fiber']},lunch:{meal:'Canned salmon & avocado rice bowl with cucumber',note:'No cooking. Prep: 8 min',tags:['omega','protein']},dinner:{meal:'Grilled chicken skewers with quinoa & tzatziki',note:'Prep: 15 min. High protein',tags:['protein','probiotic','fiber']},snack:{meal:'Frozen Greek yogurt bark with berries & walnuts',tags:['probiotic','omega']}},
      {day:'Tuesday',emoji:'🏖️',breakfast:{meal:'Overnight oats with peaches, chia seeds & kefir',note:'Make night before',tags:['probiotic','omega','fiber']},lunch:{meal:'Tuna & white bean salad in lettuce cups',note:'No-cook. Prep: 5 min',tags:['omega','protein','fiber']},dinner:{meal:'Salmon tacos with mango salsa & shredded cabbage',note:'Prep: 20 min. Omega-3 star',tags:['omega','protein','fiber']},snack:{meal:'Edamame with lime salt',tags:['omega','protein','fiber']}},
      {day:'Wednesday',emoji:'🌻',breakfast:{meal:'Cottage cheese with pineapple & flaxseed',note:'No cooking. Prep: 3 min',tags:['probiotic','protein','omega']},lunch:{meal:'Chickpea & roasted pepper wrap',note:'Prep: 8 min',tags:['protein','fiber']},dinner:{meal:'Shrimp stir-fry with snap peas, brown rice & sesame',note:'Prep: 20 min. Light & nutritious',tags:['protein','omega','fiber']},snack:{meal:'Kefir smoothie with berries',tags:['probiotic','protein']}},
      {day:'Thursday',emoji:'🌺',breakfast:{meal:'Whole grain toast with smashed avocado, egg & chilli flakes',note:'Prep: 10 min',tags:['protein','fiber']},lunch:{meal:'Greek salad with sardines & wholegrain pita',note:'Budget omega-3 hero',tags:['omega','protein','fiber']},dinner:{meal:'One-pan lemon garlic salmon with asparagus & new potatoes',note:'Prep: 5 min, cook 20 min',tags:['omega','protein','fiber']},snack:{meal:'Apple & peanut butter with chia sprinkle',tags:['fiber','omega']}},
      {day:'Friday',emoji:'🎊',breakfast:{meal:'Greek yogurt with tropical fruit, granola & coconut flakes',note:'3 min',tags:['probiotic','protein','fiber']},lunch:{meal:'Cold pasta salad with tuna, corn & cucumber',note:'Make ahead. Prep: 10 min',tags:['omega','protein']},dinner:{meal:'BBQ chicken thighs with sweet potato wedges & coleslaw',note:'Prep: 10 min. Family fave',tags:['protein','fiber']},snack:{meal:'Watermelon & feta (kids love this!)',tags:[]}},
      {day:'Saturday',emoji:'🏊',breakfast:{meal:'Banana pancakes with blueberry compote & Greek yogurt',note:'Prep: 15 min',tags:['probiotic','protein','fiber']},lunch:{meal:'Egg salad (with Greek yogurt instead of mayo) on whole grain',note:'Prep: 10 min. Probiotic swap',tags:['probiotic','protein','fiber']},dinner:{meal:'Baked cod with mango salsa, brown rice & green beans',note:'Prep: 15 min',tags:['omega','protein','fiber']},snack:{meal:'Chia pudding with coconut milk & mango',tags:['omega','fiber']}},
      {day:'Sunday',emoji:'🌅',breakfast:{meal:'Smoked salmon bagel with cream cheese & cucumber',note:'Omega-3 treat',tags:['omega','protein']},lunch:{meal:'Big summer grain bowl: farro, roasted veg, chickpeas, tahini',note:'Prep: 10 min',tags:['protein','fiber','omega']},dinner:{meal:'Slow cooker pulled chicken for the week (meal prep)',note:'Set morning',tags:['protein']},snack:{meal:'Frozen yogurt pops (blend yogurt, fruit & honey, freeze)',tags:['probiotic']}},
    ],
    week2: [
      {day:'Monday',emoji:'🌞',breakfast:{meal:'Kefir & berry smoothie with flaxseed',note:'Blend & go. Prep: 3 min',tags:['probiotic','omega','fiber']},lunch:{meal:'Leftover pulled chicken over big salad with chickpeas',note:'No cooking',tags:['protein','fiber']},dinner:{meal:'Teriyaki salmon with edamame & jasmine rice',note:'Prep: 20 min. Omega-3 dinner',tags:['omega','protein','omega']},snack:{meal:'Greek yogurt with honey & walnuts',tags:['probiotic','omega']}},
      {day:'Tuesday',emoji:'🏖️',breakfast:{meal:'Overnight chia pudding with almond milk & peaches',note:'Prep night before',tags:['omega','fiber']},lunch:{meal:'Tuna avocado bowl with cucumber & brown rice',note:'Prep: 8 min',tags:['omega','protein','fiber']},dinner:{meal:'Chicken & vegetable kabobs with tzatziki & pita',note:'Prep: 15 min',tags:['protein','probiotic']},snack:{meal:'Frozen edamame & mango chunks',tags:['omega','protein']}},
      {day:'Wednesday',emoji:'🌻',breakfast:{meal:'Scrambled eggs with smoked salmon & whole grain toast',note:'Omega-3 breakfast. Prep: 10 min',tags:['omega','protein','fiber']},lunch:{meal:'Lentil & tomato soup with crusty bread',note:'Batch cook. Prep: 5 min',tags:['protein','fiber']},dinner:{meal:'Prawn & avocado tacos with shredded cabbage & lime',note:'Prep: 15 min',tags:['protein','omega','fiber']},snack:{meal:'Cottage cheese with cucumber & mint',tags:['probiotic','protein']}},
      {day:'Thursday',emoji:'🌺',breakfast:{meal:'Smoothie: spinach, kefir, banana, chia, almond butter',note:'5 min. Nutrient-dense',tags:['probiotic','omega','fiber','protein']},lunch:{meal:'Chickpea & avocado smash on whole grain toast',note:'No-cook. Prep: 5 min',tags:['protein','fiber','omega']},dinner:{meal:'Sheet pan salmon with corn, peppers & potatoes',note:'Prep: 10 min, cook 25 min',tags:['omega','protein','fiber']},snack:{meal:'Apple slices with almond butter & chia',tags:['fiber','omega']}},
      {day:'Friday',emoji:'🎊',breakfast:{meal:'Waffles with Greek yogurt & fresh berries (instead of syrup)',note:'Probiotic swap!',tags:['probiotic','protein']},lunch:{meal:'Cobb salad: egg, avocado, bacon, tomato, blue cheese',note:'Prep: 10 min',tags:['protein','omega']},dinner:{meal:'Homemade fish tacos with canned salmon patties & slaw',note:'Budget omega-3',tags:['omega','protein','fiber']},snack:{meal:'Mango lassi (yogurt, mango, milk)',tags:['probiotic','protein']}},
      {day:'Saturday',emoji:'🏊',breakfast:{meal:'French toast with banana & Greek yogurt instead of syrup',note:'Prep: 15 min',tags:['probiotic','protein']},lunch:{meal:'Nicoise salad: canned tuna, egg, green beans, olives',note:'No cooking. Classic',tags:['omega','protein','fiber']},dinner:{meal:'Slow cooker beef & lentil stew',note:'Set morning. High iron + fiber',tags:['protein','fiber']},snack:{meal:'Dark chocolate & walnut bites',tags:['omega']}},
      {day:'Sunday',emoji:'🌅',breakfast:{meal:'Big brunch: eggs any style, avocado, wholegrain toast, fruit',note:'Weekend reset',tags:['protein','fiber']},lunch:{meal:'Rainbow grain bowl with leftover stew & fresh toppings',note:'Use leftovers creatively',tags:['protein','fiber']},dinner:{meal:'Whole baked salmon with roasted vegetables & lemon',note:'Prep 10 min, oven does the work',tags:['omega','protein','fiber']},snack:{meal:'Chia & coconut overnight pudding',tags:['omega','fiber']}},
    ]
  },
  fall: {
    week1: [
      {day:'Monday',emoji:'🍂',breakfast:{meal:'Pumpkin spice oatmeal with walnuts, chia seeds & yogurt',note:'Seasonal & cozy. Prep: 10 min',tags:['omega','fiber','probiotic']},lunch:{meal:'Lentil & root vegetable soup with sourdough',note:'Batch cook. Prep: 30 min',tags:['protein','fiber']},dinner:{meal:'Sheet pan salmon with Brussels sprouts & sweet potato',note:'Prep: 10 min, cook 25 min',tags:['omega','protein','fiber']},snack:{meal:'Apple with almond butter & chia sprinkle',tags:['fiber','omega']}},
      {day:'Tuesday',emoji:'🍁',breakfast:{meal:'Overnight oats with cinnamon, pear & flaxseed',note:'Make night before',tags:['omega','fiber']},lunch:{meal:'Leftover lentil soup',note:'No cooking',tags:['protein','fiber']},dinner:{meal:'Turkey & sweet potato hash with fried egg on top',note:'One pan. Prep: 20 min',tags:['protein','fiber']},snack:{meal:'Greek yogurt with pumpkin spice & granola',tags:['probiotic','protein','fiber']}},
      {day:'Wednesday',emoji:'🌾',breakfast:{meal:'Smoothie: kale, banana, kefir, almond butter & flax',note:'Prep: 5 min',tags:['probiotic','omega','fiber','protein']},lunch:{meal:'Roasted beet & feta salad with chickpeas & tahini',note:'Prep: 10 min if beets pre-roasted',tags:['protein','fiber','omega']},dinner:{meal:'Chicken & white bean soup with kale',note:'One pot. Prep: 15 min',tags:['protein','fiber']},snack:{meal:'Walnuts & dried cranberries',tags:['omega','fiber']}},
      {day:'Thursday',emoji:'🎃',breakfast:{meal:'Chia pudding with cinnamon, apple & walnuts (made night before)',note:'Zero morning effort',tags:['omega','fiber']},lunch:{meal:'Grilled turkey & avocado sandwich on whole grain',note:'Prep: 8 min',tags:['protein','fiber']},dinner:{meal:'Pumpkin & lentil curry with brown rice',note:'Budget-friendly. Prep: 25 min',tags:['protein','fiber']},snack:{meal:'Cottage cheese with pear & cinnamon',tags:['probiotic','protein']}},
      {day:'Friday',emoji:'🍂',breakfast:{meal:'Whole grain toast with almond butter, banana & chia seeds',note:'5 min',tags:['omega','fiber']},lunch:{meal:'Leftover pumpkin curry wrap with spinach',note:'No cooking',tags:['protein','fiber']},dinner:{meal:'Baked salmon with roasted root vegetables & quinoa',note:'Prep: 10 min, cook 25 min',tags:['omega','protein','fiber']},snack:{meal:'Hot apple cider & walnuts',tags:['omega']}},
      {day:'Saturday',emoji:'🍁',breakfast:{meal:'Dutch baby pancake with warm pear & Greek yogurt',note:'Impressive, one pan',tags:['probiotic','protein']},lunch:{meal:'Butternut squash & lentil soup',note:'Prep: 20 min. Fiber-packed',tags:['protein','fiber']},dinner:{meal:'Slow cooker chicken & chickpea stew',note:'Set morning, ready for dinner',tags:['protein','fiber']},snack:{meal:'Kefir & cinnamon smoothie with banana',tags:['probiotic','protein']}},
      {day:'Sunday',emoji:'🌾',breakfast:{meal:'Shakshuka with whole grain toast',note:'Eggs + tomatoes + spices. Prep: 20 min',tags:['protein','fiber']},lunch:{meal:'Harvest grain bowl: farro, roasted veg, egg, tahini',note:'Meal prep day',tags:['protein','fiber','omega']},dinner:{meal:'Beef & lentil chili (make big batch, freeze half)',note:'High protein + fiber',tags:['protein','fiber']},snack:{meal:'Chia pudding with kefir & pomegranate',tags:['omega','probiotic','fiber']}},
    ],
    week2: [
      {day:'Monday',emoji:'🍂',breakfast:{meal:'Banana bread (with flaxseed added) made Sunday',note:'Grab all week',tags:['omega','fiber']},lunch:{meal:'Leftover chili over baked potato with yogurt',note:'No cooking. Probiotic swap',tags:['probiotic','protein','fiber']},dinner:{meal:'One-pan sausage, lentils & fall vegetables',note:'Prep: 5 min, cook 30 min',tags:['protein','fiber']},snack:{meal:'Apple & almond butter',tags:['fiber','omega']}},
      {day:'Tuesday',emoji:'🍁',breakfast:{meal:'Greek yogurt with granola, pomegranate & chia seeds',note:'Quick & antioxidant-rich',tags:['probiotic','omega','fiber']},lunch:{meal:'Roasted tomato & mozzarella panini on whole grain',note:'Prep: 10 min',tags:['protein','fiber']},dinner:{meal:'Chicken & chickpea tikka masala with brown rice',note:'30 min weeknight winner',tags:['protein','fiber']},snack:{meal:'Dried mango, almonds & dark chocolate',tags:['omega','fiber']}},
      {day:'Wednesday',emoji:'🌾',breakfast:{meal:'Pumpkin smoothie: pumpkin puree, kefir, banana & spice',note:'Fall in a glass. Probiotic',tags:['probiotic','fiber']},lunch:{meal:'Leftover tikka masala & rice wrap',note:'No cooking',tags:['protein','fiber']},dinner:{meal:'Baked cod with roasted carrots, quinoa & tahini dressing',note:'Healthy, fast',tags:['protein','fiber','omega']},snack:{meal:'Warm apple cider & popcorn with nutritional yeast',tags:['fiber']}},
      {day:'Thursday',emoji:'🎃',breakfast:{meal:'Whole grain toast with peanut butter, banana & chia',note:'5 min',tags:['omega','fiber','protein']},lunch:{meal:'Roasted sweet potato & black bean bowl with yogurt',note:'Prep: 5 min',tags:['probiotic','protein','fiber']},dinner:{meal:'Turkey meatball & white bean soup with spinach',note:'Prep: 20 min. Freeze half',tags:['protein','fiber']},snack:{meal:'Cottage cheese & apple slices',tags:['probiotic','protein','fiber']}},
      {day:'Friday',emoji:'🍂',breakfast:{meal:'Oatmeal with walnuts, raisins & cinnamon',note:'Classic Friday warmth',tags:['omega','fiber']},lunch:{meal:'Tuna & avocado rice bowl with pickled cucumber',note:'Probiotic touch. Prep: 8 min',tags:['omega','protein']},dinner:{meal:'Homemade pizza on whole grain naan with veggie toppings',note:'Kids pick toppings',tags:['fiber']},snack:{meal:'Dark hot chocolate with almond milk & walnuts',tags:['omega']}},
      {day:'Saturday',emoji:'🍁',breakfast:{meal:'Baked oatmeal with cranberries, walnuts & Greek yogurt',note:'Bake once, eat all week',tags:['omega','probiotic','fiber']},lunch:{meal:'Minestrone soup with whole grain pasta & beans',note:'Batch cook',tags:['protein','fiber']},dinner:{meal:'Slow cooker chicken tacos with kefir lime crema',note:'Set morning. Probiotic twist',tags:['protein','probiotic']},snack:{meal:'Warm spiced nut & seed mix',tags:['omega','fiber']}},
      {day:'Sunday',emoji:'🌾',breakfast:{meal:'Full brunch: eggs, smoked salmon, avocado, whole grain toast',note:'Weekend celebration',tags:['omega','protein','fiber']},lunch:{meal:'Big chopped salad with chickpeas, walnuts & lemon tahini',note:'Prep: 10 min',tags:['protein','fiber','omega']},dinner:{meal:'Sunday roast chicken with root vegetables & gravy',note:'Leftovers = lunches all week',tags:['protein']},snack:{meal:'Chia jam on yogurt with whole grain crackers',tags:['omega','probiotic','fiber']}},
    ]
  },
  winter: {
    week1: [
      {day:'Monday',emoji:'❄️',breakfast:{meal:'Warm porridge with walnuts, banana & chia seeds',note:'Cozy comfort. Prep: 10 min',tags:['omega','fiber']},lunch:{meal:'Lentil & vegetable soup with whole grain bread',note:'Batch cook. Prep: 30 min',tags:['protein','fiber']},dinner:{meal:'Slow cooker salmon & white bean stew',note:'Set in morning. Prep: 10 min',tags:['omega','protein','fiber']},snack:{meal:'Hot cocoa with whole milk & walnut crumble',tags:['omega']}},
      {day:'Tuesday',emoji:'🌨️',breakfast:{meal:'Egg & spinach muffin cups (batch bake Sunday)',note:'Grab & go. High protein',tags:['protein']},lunch:{meal:'Leftover salmon stew over quinoa',note:'No cooking',tags:['omega','protein','fiber']},dinner:{meal:'Baked chicken thighs with roasted root vegetables & lentils',note:'One pan. Prep: 10 min',tags:['protein','fiber']},snack:{meal:'Greek yogurt with clementine & granola',tags:['probiotic','protein','fiber']}},
      {day:'Wednesday',emoji:'🏔️',breakfast:{meal:'Kefir smoothie: frozen berries, spinach, banana & flaxseed',note:'Even in winter. Prep: 5 min',tags:['probiotic','omega','fiber']},lunch:{meal:'Tomato & lentil soup with whole grain toast',note:'Prep: 15 min',tags:['protein','fiber']},dinner:{meal:'Turkey & vegetable meatballs with whole wheat pasta & marinara',note:'Prep: 25 min. Freeze half',tags:['protein','fiber']},snack:{meal:'Chia pudding with cinnamon & dried fruit',tags:['omega','fiber']}},
      {day:'Thursday',emoji:'⛄',breakfast:{meal:'Overnight chia oats with cranberry, orange & walnuts',note:'Prep night before',tags:['omega','fiber']},lunch:{meal:'Canned salmon patty on whole grain with avocado',note:'Budget omega-3. Prep: 10 min',tags:['omega','protein','fiber']},dinner:{meal:'Lemon herb cod with roasted broccoli & mashed sweet potato',note:'Soul-warming. Prep: 20 min',tags:['omega','protein','fiber']},snack:{meal:'Warm apple cider & walnuts',tags:['omega']}},
      {day:'Friday',emoji:'🌟',breakfast:{meal:'Cinnamon French toast with Greek yogurt & berries',note:'TGIF! Probiotic swap',tags:['probiotic','protein','fiber']},lunch:{meal:'Winter grain bowl: wild rice, roasted beets, feta, walnuts',note:'Prep: 10 min if rice pre-cooked',tags:['omega','fiber']},dinner:{meal:'Homemade chicken noodle soup with extra veg',note:'Soul food. Prep: 30 min',tags:['protein','fiber']},snack:{meal:'Popcorn with nutritional yeast & pumpkin seeds',tags:['fiber','omega']}},
      {day:'Saturday',emoji:'💫',breakfast:{meal:'Smoked salmon & scrambled egg on whole grain toast',note:'Omega-3 weekend treat',tags:['omega','protein','fiber']},lunch:{meal:'Warming lentil dhal with whole grain naan',note:'30 min. Impressive',tags:['protein','fiber']},dinner:{meal:'Slow cooker lamb & chickpea stew',note:'Set morning. Fiber-packed',tags:['protein','fiber']},snack:{meal:'Kefir with cinnamon & sliced pear',tags:['probiotic','fiber']}},
      {day:'Sunday',emoji:'❄️',breakfast:{meal:'Blueberry & chia seed pancakes with Greek yogurt',note:'Sunday special. Omega + probiotic',tags:['omega','probiotic','protein','fiber']},lunch:{meal:'Minestrone soup with beans & whole grain pasta',note:'Clear the fridge',tags:['protein','fiber']},dinner:{meal:'Beef & lentil lasagna (make double, freeze one)',note:'Feed the future you',tags:['protein','fiber']},snack:{meal:'Warm milk with turmeric & honey for the kids',tags:[]}},
    ],
    week2: [
      {day:'Monday',emoji:'❄️',breakfast:{meal:'Banana oat pancakes with almond butter & chia',note:'2 ingredients base. Prep: 10 min',tags:['omega','fiber']},lunch:{meal:'Leftover lasagna',note:'Best use of leftovers',tags:['protein','fiber']},dinner:{meal:'One-pot chicken, lentil & sweet potato soup',note:'Simple, satisfying. Prep: 20 min',tags:['protein','fiber']},snack:{meal:'Roasted pumpkin seeds & dried mango',tags:['omega','fiber']}},
      {day:'Tuesday',emoji:'🌨️',breakfast:{meal:'Greek yogurt with honey, granola & chia seeds',note:'Quick. Prep: 3 min',tags:['probiotic','omega','protein']},lunch:{meal:'Leftover chicken soup with added chickpeas',note:'Add canned chickpeas — done',tags:['protein','fiber']},dinner:{meal:'Baked salmon with miso glaze, broccoli & brown rice',note:'Probiotic miso. Prep: 15 min',tags:['omega','protein','probiotic','fiber']},snack:{meal:'Warm pear with cinnamon & walnuts',tags:['omega','fiber']}},
      {day:'Wednesday',emoji:'🏔️',breakfast:{meal:'Whole grain toast with avocado, smoked salmon & egg',note:'Omega-3 powerhouse. Prep: 10 min',tags:['omega','protein','fiber']},lunch:{meal:'Roasted red pepper & lentil soup',note:'Batch cook. Fiber-rich',tags:['protein','fiber']},dinner:{meal:'Turkey & vegetable stir-fry with brown rice & edamame',note:'Fast & nutritious. Prep: 20 min',tags:['protein','omega','fiber']},snack:{meal:'Clementine & dark chocolate with almonds',tags:['omega']}},
      {day:'Thursday',emoji:'⛄',breakfast:{meal:'Warm chia pudding with cinnamon, apple & kefir',note:'Make night before. Probiotic',tags:['omega','probiotic','fiber']},lunch:{meal:'Black bean & sweet potato quesadilla with yogurt dip',note:'Quick, budget-friendly',tags:['probiotic','protein','fiber']},dinner:{meal:'Baked cod with tahini, roasted carrots & mashed lentils',note:'Omega-3 & fiber combo',tags:['omega','protein','fiber']},snack:{meal:'Pear & brie on whole grain crackers',tags:['fiber']}},
      {day:'Friday',emoji:'🌟',breakfast:{meal:'Oat & walnut waffles with Greek yogurt & maple',note:'Friday treat',tags:['omega','probiotic','fiber']},lunch:{meal:'Canned salmon fish cakes with yogurt tartare',note:'Form patties, pan fry. Prep: 15 min',tags:['omega','protein','probiotic']},dinner:{meal:'Slow cooker white chicken chili with white beans',note:'Set morning, cozy dinner',tags:['protein','fiber']},snack:{meal:'Hot chocolate with whole milk & walnut crumble',tags:['omega']}},
      {day:'Saturday',emoji:'💫',breakfast:{meal:'Smoked salmon eggs Benedict (Greek yogurt hollandaise)',note:'Weekend treat',tags:['omega','protein','probiotic']},lunch:{meal:'French onion soup with whole grain croutons',note:'30 min. Impressive',tags:['fiber']},dinner:{meal:'Lamb kofta with yogurt tzatziki & whole grain flatbread',note:'Different, delicious',tags:['protein','probiotic','fiber']},snack:{meal:'Warm spiced nuts: walnuts, almonds, cashews',tags:['omega']}},
      {day:'Sunday',emoji:'❄️',breakfast:{meal:'Pancake stack with chia jam & Greek yogurt',note:'Sunday celebration. All the nutrients',tags:['omega','probiotic','fiber']},lunch:{meal:'Big bean & kale soup with whole grain bread',note:'Batch cook for week',tags:['protein','fiber']},dinner:{meal:'Sunday roast salmon with all the trimmings',note:'Worth the effort. Omega-3 hero',tags:['omega','protein','fiber']},snack:{meal:'Shortbread & warm kefir for kids',tags:['probiotic']}},
    ]
  }
};

// ── CALM TALKS DATA ──────────────────────────────────────────────────────────
const TALK_TOPICS = [
  {
    id:'why',
    icon:'💭',
    title:'Why don\'t we all live together?',
    age:'All ages',
    color:'var(--lav)',
    prompts:[
      {
        situation:'When they first ask',
        say:'Mummy and Daddy love you so much. Sometimes grown-ups realize they\'re better at loving their kids when they live in different homes. That doesn\'t change how much we both love you — that love never goes anywhere.',
        why:'Validates both parents, reassures the child they are loved, avoids blame'
      },
      {
        situation:'When they seem confused',
        say:'You know how some things just work better in different ways? Like how you sleep better with your special blanket? Our family works better this way — with two cozy homes where you\'re loved.',
        why:'Uses familiar concepts to make the abstract understandable'
      },
      {
        situation:'When they push for more explanation',
        say:'That\'s such a big question and you deserve a real answer. What I can tell you is: nothing you did caused this. This is a grown-up situation, and you are safe and so loved.',
        why:'Research shows children often blame themselves — explicitly clearing this is essential'
      }
    ]
  },
  {
    id:'fault',
    icon:'💔',
    title:'Is it my fault?',
    age:'Ages 3-10',
    color:'var(--rose)',
    prompts:[
      {
        situation:'When they ask directly',
        say:'Oh sweetheart, no. Absolutely not. This has nothing to do with anything you did or didn\'t do. You are perfect. This is a grown-up decision made by grown-ups.',
        why:'Research is clear: children must hear this explicitly and repeatedly'
      },
      {
        situation:'When they blame themselves indirectly ("I was too naughty")',
        say:'Hey, come here. When you were naughty — that was between me and you, and we dealt with it together. Mummy and Daddy\'s decisions are completely separate from that. You didn\'t cause this. You couldn\'t have.',
        why:'Connects to their specific fear without dismissing it'
      },
      {
        situation:'Ongoing reassurance',
        say:'You know what I was thinking about today? How much I love being your mum. Nothing will ever change that. Nothing.',
        why:'Unprompted reassurance is more powerful than reassurance in response to fear'
      }
    ]
  },
  {
    id:'feelings',
    icon:'🌊',
    title:'Big feelings about the other parent',
    age:'All ages',
    color:'var(--teal)',
    prompts:[
      {
        situation:'When they\'re angry at you',
        say:'I can see you\'re really angry right now. That makes sense. It\'s okay to feel angry — even at me. I\'m not going anywhere. Tell me what\'s going on.',
        why:'Authoritative parenting: hold boundaries AND validate emotion'
      },
      {
        situation:'When they say they love the other parent more',
        say:'Of course you love your dad — that\'s wonderful and exactly how it should be. And I love you. Both things can be true at the same time.',
        why:'Never make a child feel guilty for loving their other parent — this is critical for their wellbeing'
      },
      {
        situation:'When they miss the other parent',
        say:'Of course you miss him/her. That feeling means you love them so much. While they\'re not here right now, you can think about them whenever you want. Want to draw them a picture?',
        why:'Normalises the feeling, gives them agency and a concrete action'
      },
      {
        situation:'When they\'re upset and can\'t say why',
        say:'You look like you\'re carrying something heavy. You don\'t have to tell me. But I\'m right here whenever you\'re ready. Want a hug first?',
        why:'Removes pressure, maintains connection, offers physical comfort'
      }
    ]
  },
  {
    id:'transition',
    icon:'🧳',
    title:'Going between two homes',
    age:'All ages',
    color:'var(--gold)',
    prompts:[
      {
        situation:'Before a handoff (when they seem anxious)',
        say:'I know it feels a bit strange sometimes, going from one home to another. That feeling will get easier. And you know what? You carry our love with you wherever you go.',
        why:'Normalises the transition feeling, provides emotional security'
      },
      {
        situation:'When they don\'t want to go',
        say:'I hear you — it\'s hard sometimes. I\'ll be right here when you come back, just the same. And Dad loves spending time with you. How about we do something special when you get home?',
        why:'Acknowledges without overriding; gives something to look forward to'
      },
      {
        situation:'When they come back unsettled',
        say:'Welcome home, my love. Let\'s just sit together for a bit. No rush. Tell me one good thing and one hard thing about your time.',
        why:'Structured re-entry routine reduces transition trauma; research supports regular check-ins'
      },
      {
        situation:'When they compare the two homes',
        say:'It sounds like you had a great time. I love hearing that. Every home is different and that\'s okay. This is your home too.',
        why:'Avoids defensiveness; affirms both homes without competition'
      }
    ]
  },
  {
    id:'scared',
    icon:'🌙',
    title:'I\'m scared / bad dreams',
    age:'Ages 2-8',
    color:'var(--lav)',
    prompts:[
      {
        situation:'Bedtime anxiety',
        say:'I\'m right here. Let\'s take three big breaths together — in through your nose, out through your mouth. Good. You are safe. This house is safe. I am here.',
        why:'Co-regulation through breathing; trauma-informed approach to nighttime fear'
      },
      {
        situation:'After a bad dream',
        say:'That sounds really scary. Dreams can feel so real. You know what? That was just your brain practicing things — it wasn\'t real. You\'re safe now. Want me to stay until you fall asleep?',
        why:'Validates the experience without dismissing it; offers proximity'
      },
      {
        situation:'General anxiety',
        say:'What does your worry feel like in your body? Does it make your tummy feel funny? Let\'s check on that tummy together. \'Worry tummy, are you there? We\'re going to take care of you.\'',
        why:'Somatic awareness helps children locate and manage anxiety physically'
      }
    ]
  },
  {
    id:'anger',
    icon:'🔥',
    title:'When they\'re angry or acting out',
    age:'All ages',
    color:'var(--red)',
    prompts:[
      {
        situation:'Mid-meltdown',
        say:'I can see this is really big right now. I\'m not going anywhere. When you\'re ready, I\'m right here.',
        why:'Trauma-informed: don\'t punish dysregulation, co-regulate first'
      },
      {
        situation:'After they\'ve calmed down',
        say:'That was a lot of feelings. You worked through it. I\'m proud of you for coming back to calm. Can you tell me what happened in your body when you were so upset?',
        why:'Post-regulation reflection builds emotional intelligence over time'
      },
      {
        situation:'When they say hurtful things',
        say:'Those words sting a little. I know you didn\'t mean them the way they came out. When you feel better, I\'d love to talk about what was really going on.',
        why:'Models emotional honesty without shame or punishment'
      },
      {
        situation:'When behaviour is a pattern',
        say:'I\'ve noticed you seem to get really upset around [transition time / bedtime]. I wonder if your body is trying to tell us something. Let\'s figure it out together.',
        why:'Pattern recognition and collaborative problem solving reduces power struggles'
      }
    ]
  },
  {
    id:'questions',
    icon:'❓',
    title:'Questions you don\'t know how to answer',
    age:'All ages',
    color:'var(--sage)',
    prompts:[
      {
        situation:'When you don\'t know what to say',
        say:'That\'s such an important question and I want to give you a really good answer. Can I think about it and come back to you? I promise I will.',
        why:'Honesty builds trust more than a fumbled answer; always follow through'
      },
      {
        situation:'When they ask about the other parent\'s life',
        say:'That\'s something you could ask Dad/Mum directly — I think they\'d love that you\'re curious. I don\'t want to speak for them.',
        why:'Respects the other parent\'s relationship; avoids triangulation'
      },
      {
        situation:'When they ask if you\'ll get back together',
        say:'I know that would feel nice. We\'re not going to live together again, but we\'re both always going to be your parents. That part never changes.',
        why:'Clear and kind; false hope is more damaging than honest answers'
      },
      {
        situation:'When they ask if you\'re sad',
        say:'Sometimes I do feel sad. And that\'s okay — grown-ups have feelings too. But mostly I feel grateful because I get to be your mum every single day.',
        why:'Modeling emotional honesty without burdening the child with parental emotions'
      }
    ]
  }
];

// ── SUPPORT LINKS DATA ────────────────────────────────────────────────────────
const SUPPORT_LINKS = [
  {name:'National DV Hotline',detail:'1-800-799-7233 · Free · 24/7 · Call or text',color:'var(--rose)',icon:'🆘'},
  {name:'WomensLaw.org',detail:'Free legal information for survivors by state',color:'var(--lav)',icon:'⚖️'},
  {name:'Benefits.gov',detail:'Find every government benefit you qualify for',color:'var(--sage)',icon:'💰'},
  {name:'211.org',detail:'Local food, housing, and crisis support near you',color:'var(--teal)',icon:'🏠'},
  {name:'LawHelp.org',detail:'Free legal aid directory by state',color:'var(--gold)',icon:'📋'},
  {name:'OpenPathCollective.org',detail:'Affordable therapy — $30–$80 per session',color:'var(--lav)',icon:'💆'},
  {name:'SNAP / Food Stamps',detail:'benefits.gov/benefit/361 — food assistance',color:'var(--sage)',icon:'🥦'},
  {name:'WIC Program',detail:'Food & health support for moms & kids under 5',color:'var(--rose)',icon:'👶'},
  {name:'Child Support Portal',detail:'acf.hhs.gov/css — locate your state office',color:'var(--teal)',icon:'💳'},
  {name:'YWCA',detail:'Housing, safety, and support for women',color:'var(--gold)',icon:'🏡'},
  {name:'National Alliance on Mental Illness',detail:'nami.org — 1-800-950-6264',color:'var(--lav)',icon:'🧠'},
  {name:'Eating Disorder Support',detail:'National Alliance helpline: 1-866-662-1235',color:'var(--rose)',icon:'🌸'},
];

// ── RESOURCE FUNCTIONS ────────────────────────────────────────────────────────
function showResTab(tab){
  ['meals','talks','links'].forEach(t=>{
    document.getElementById('res-'+t).style.display = t===tab?'block':'none';
    document.getElementById('rtab-'+t).classList.toggle('active', t===tab);
  });
  if(tab==='talks') buildTalkTopics();
  if(tab==='links') buildSupportLinks();
  if(tab==='meals') renderMealPlan();
}

function showSeason(season){
  currentSeason = season;
  ['spring','summer','fall','winter'].forEach(s=>{
    document.getElementById('sbtn-'+s).classList.toggle('active',s===season);
  });
  renderMealPlan();
}

function showWeek(week){
  currentWeek = week;
  [1,2].forEach(w=>{
    document.getElementById('wbtn-'+w).classList.toggle('active',w===week);
  });
  renderMealPlan();
}

// Load custom edits from localStorage or use defaults
function getMealPlanKey(){ return 'momos_meal_'+currentSeason+'_w'+currentWeek; }

function getEditedPlan(){
  const saved = lsGet(getMealPlanKey(), null);
  return saved || MEAL_PLANS[currentSeason]?.['week'+currentWeek] || [];
}

function saveMealEdit(dayIdx, mealType, field, value){
  let plan = getEditedPlan();
  if(!plan[dayIdx]) return;
  if(!plan[dayIdx][mealType]) plan[dayIdx][mealType] = {};
  plan[dayIdx][mealType][field] = value;
  lsSet(getMealPlanKey(), plan);
}

function resetMealPlan(){
  if(!confirm('Reset this week to the default meal plan? Your edits will be lost.')) return;
  try{ localStorage.removeItem('momos_v2_'+getMealPlanKey()); } catch(e){}
  renderMealPlan();
  showToast('Meal plan reset to default','success');
}

function ntTag(tags){
  const map = {omega:'<span class="nutrition-tag nt-omega">🐟Ω3</span>',
               protein:'<span class="nutrition-tag nt-protein">💪P</span>',
               probiotic:'<span class="nutrition-tag nt-probiotic">🥛Pro</span>',
               fiber:'<span class="nutrition-tag nt-fiber">🌾F</span>'};
  return (tags||[]).map(t=>map[t]||'').join('');
}

function renderMealPlan(){
  const el = document.getElementById('meal-plan-display');
  if(!el) return;
  const plan = getEditedPlan();

  el.innerHTML = plan.map((d,di)=>`
    <div class="meal-day-card">
      <div class="meal-day-title">${d.emoji} ${d.day}</div>
      <div class="meal-row">
        <div class="meal-label">Breakfast</div>
        <div>
          <div><span class="meal-item-editable" contenteditable="true"
            onblur="saveMealEdit(${di},'breakfast','meal',this.textContent.trim())"
            >${d.breakfast.meal}</span>${ntTag(d.breakfast.tags)}</div>
          <div class="meal-time">${d.breakfast.note}</div>
        </div>
      </div>
      <div class="meal-row">
        <div class="meal-label">Lunch</div>
        <div>
          <div><span class="meal-item-editable" contenteditable="true"
            onblur="saveMealEdit(${di},'lunch','meal',this.textContent.trim())"
            >${d.lunch.meal}</span>${ntTag(d.lunch.tags)}</div>
          <div class="meal-time">${d.lunch.note}</div>
        </div>
      </div>
      <div class="meal-row">
        <div class="meal-label">Dinner</div>
        <div>
          <div><span class="meal-item-editable" contenteditable="true"
            onblur="saveMealEdit(${di},'dinner','meal',this.textContent.trim())"
            >${d.dinner.meal}</span>${ntTag(d.dinner.tags)}</div>
          <div class="meal-time">${d.dinner.note}</div>
        </div>
      </div>
      <div class="meal-row">
        <div class="meal-label">Snack</div>
        <div><span class="meal-item-editable" contenteditable="true" style="color:var(--sage-dk)"
          onblur="saveMealEdit(${di},'snack','meal',this.textContent.trim())"
          >${typeof d.snack==='string'?d.snack:(d.snack?.meal||d.snack)}</span>
          ${ntTag(d.snack?.tags||[])}
        </div>
      </div>
    </div>`).join('');
}


// ── SHOPPING LIST GENERATOR ──────────────────────────────────────────────────
// Maps meal ingredients to grocery categories
const SHOPPING_INGREDIENTS = {
  // Protein
  'salmon fillet':{cat:'Meat & Fish',qty:'2 fillets'},
  'canned salmon':{cat:'Pantry',qty:'2 cans'},
  'canned tuna':{cat:'Pantry',qty:'3 cans'},
  'sardines':{cat:'Pantry',qty:'1 can'},
  'chicken breast':{cat:'Meat & Fish',qty:'1.5 lbs'},
  'chicken thighs':{cat:'Meat & Fish',qty:'1.5 lbs'},
  'ground turkey':{cat:'Meat & Fish',qty:'1 lb'},
  'eggs':{cat:'Dairy & Eggs',qty:'1 dozen'},
  'chickpeas':{cat:'Pantry',qty:'2 cans'},
  'black beans':{cat:'Pantry',qty:'2 cans'},
  'lentils':{cat:'Pantry',qty:'1 bag dried'},
  'tofu':{cat:'Dairy & Eggs',qty:'1 block'},
  // Probiotics
  'greek yogurt':{cat:'Dairy & Eggs',qty:'32 oz plain'},
  'kefir':{cat:'Dairy & Eggs',qty:'1 quart'},
  'cottage cheese':{cat:'Dairy & Eggs',qty:'16 oz'},
  // Omega-3 sources
  'walnuts':{cat:'Nuts & Seeds',qty:'1 bag'},
  'chia seeds':{cat:'Nuts & Seeds',qty:'1 bag'},
  'flaxseed':{cat:'Nuts & Seeds',qty:'1 bag'},
  'edamame':{cat:'Frozen',qty:'1 bag frozen'},
  'peanut butter':{cat:'Pantry',qty:'1 jar natural'},
  'almond butter':{cat:'Pantry',qty:'1 jar'},
  // Fiber
  'oats':{cat:'Pantry',qty:'1 large container'},
  'whole grain bread':{cat:'Bakery',qty:'1 loaf'},
  'whole wheat tortillas':{cat:'Bakery',qty:'1 pack'},
  'brown rice':{cat:'Pantry',qty:'1 bag'},
  'quinoa':{cat:'Pantry',qty:'1 bag'},
  'sweet potato':{cat:'Produce',qty:'3 medium'},
  'broccoli':{cat:'Produce',qty:'1 head'},
  'spinach':{cat:'Produce',qty:'1 bag baby spinach'},
  'kale':{cat:'Produce',qty:'1 bunch'},
  'avocado':{cat:'Produce',qty:'3'},
  'banana':{cat:'Produce',qty:'1 bunch'},
  'apples':{cat:'Produce',qty:'6'},
  'berries':{cat:'Produce',qty:'1 pint or frozen bag'},
  // Pantry staples
  'olive oil':{cat:'Pantry',qty:'1 bottle'},
  'garlic':{cat:'Produce',qty:'1 head'},
  'onion':{cat:'Produce',qty:'3'},
  'canned tomatoes':{cat:'Pantry',qty:'2 cans'},
  'marinara sauce':{cat:'Pantry',qty:'1 jar'},
  'broth':{cat:'Pantry',qty:'32 oz carton'},
  'soy sauce':{cat:'Pantry',qty:'1 bottle'},
  'honey':{cat:'Pantry',qty:'1 jar'},
  'granola':{cat:'Pantry',qty:'1 bag'},
  'crackers':{cat:'Pantry',qty:'1 box whole grain'},
  // Dairy
  'milk':{cat:'Dairy & Eggs',qty:'1 gallon'},
  'cheese':{cat:'Dairy & Eggs',qty:'1 block or bag shredded'},
  'butter':{cat:'Dairy & Eggs',qty:'1 stick'},
  'cream cheese':{cat:'Dairy & Eggs',qty:'8 oz'},
  // Frozen
  'frozen peas':{cat:'Frozen',qty:'1 bag'},
  'frozen berries':{cat:'Frozen',qty:'1 bag'},
};

function showShoppingList(){
  const panel = document.getElementById('shopping-list-panel');
  if(!panel) return;

  const plan = getEditedPlan();

  // Collect all meal text
  const allMealText = [];
  plan.forEach(d=>{
    ['breakfast','lunch','dinner'].forEach(m=>{
      if(d[m]?.meal) allMealText.push(d[m].meal.toLowerCase());
    });
    const snack = typeof d.snack==='string'?d.snack:(d.snack?.meal||'');
    if(snack) allMealText.push(snack.toLowerCase());
  });
  const fullText = allMealText.join(' ');

  // Match ingredients
  const found = {};
  Object.entries(SHOPPING_INGREDIENTS).forEach(([ingredient, info])=>{
    if(fullText.includes(ingredient.toLowerCase())){
      if(!found[info.cat]) found[info.cat]=[];
      found[info.cat].push({name:ingredient, qty:info.qty, checked:false});
    }
  });

  // Add staples always included
  const staples = [
    {cat:'Pantry',name:'Salt, pepper, basic spices',qty:'check stock'},
    {cat:'Pantry',name:'Olive oil',qty:'check stock'},
    {cat:'Produce',name:'Garlic & onions',qty:'check stock'},
    {cat:'Dairy & Eggs',name:'Eggs',qty:'1 dozen minimum'},
    {cat:'Dairy & Eggs',name:'Greek yogurt (plain)',qty:'32 oz — probiotics'},
    {cat:'Nuts & Seeds',name:'Chia seeds',qty:'1 bag — omega-3 + fiber'},
    {cat:'Pantry',name:'Canned tuna or salmon',qty:'3-4 cans — omega-3'},
    {cat:'Pantry',name:'Oats',qty:'large container — fiber'},
  ];
  staples.forEach(s=>{
    if(!found[s.cat]) found[s.cat]=[];
    if(!found[s.cat].find(i=>i.name===s.name)){
      found[s.cat].push({name:s.name,qty:s.qty,checked:false});
    }
  });

  // Save shopping list to localStorage
  lsSet('shopping_list', found);

  // Render
  const cats = Object.keys(found).sort();
  const total = Object.values(found).reduce((a,c)=>a+c.length,0);

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="card">
      <div class="card-hdr" style="background:var(--sage-sf)">
        <div>
          <div class="card-title" style="color:var(--sage-dk)">🛒 Shopping list</div>
          <div class="card-sub">${total} items for this week</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="printShoppingList()">🖨️ Print</button>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('shopping-list-panel').style.display='none'">✕</button>
        </div>
      </div>
      <div class="card-body">
        <div style="font-size:12px;color:var(--t2);margin-bottom:12px;padding:8px 10px;background:var(--lav-sf);border-radius:var(--r-sm)">
          💡 Tap items to check them off as you shop. List is based on your meal plan meals.
        </div>
        ${cats.map(cat=>`
          <div class="shop-section">
            <div class="shop-section-title">${getCatEmoji(cat)} ${cat}</div>
            ${found[cat].map((item,i)=>`
              <div class="shop-item" id="si-${cat.replace(/[^a-z]/gi,'')}-${i}">
                <div class="shop-check" onclick="toggleShopItem('${cat}',${i})" id="sc-${cat.replace(/[^a-z]/gi,'')}-${i}"></div>
                <div class="shop-item-name" id="sn-${cat.replace(/[^a-z]/gi,'')}-${i}">${item.name}</div>
                <div class="shop-item-detail">${item.qty}</div>
              </div>`).join('')}
          </div>`).join('')}
        <button class="btn btn-ghost w-full" style="margin-top:8px;font-size:12px;color:var(--t3)" onclick="clearCheckedItems()">Clear checked items</button>
      </div>
    </div>`;

  panel.scrollIntoView({behavior:'smooth',block:'start'});
}

function getCatEmoji(cat){
  const map={'Produce':'🥦','Meat & Fish':'🐟','Dairy & Eggs':'🥚','Pantry':'🥫','Bakery':'🍞','Frozen':'🧊','Nuts & Seeds':'🥜'};
  return map[cat]||'🛒';
}

function toggleShopItem(cat, idx){
  const list = lsGet('shopping_list',{});
  if(!list[cat]||!list[cat][idx]) return;
  list[cat][idx].checked = !list[cat][idx].checked;
  lsSet('shopping_list',list);
  const safecat = cat.replace(/[^a-z]/gi,'');
  const check = document.getElementById('sc-'+safecat+'-'+idx);
  const name = document.getElementById('sn-'+safecat+'-'+idx);
  if(check) check.classList.toggle('checked',list[cat][idx].checked);
  if(name) name.classList.toggle('checked-item',list[cat][idx].checked);
}

function clearCheckedItems(){
  const list = lsGet('shopping_list',{});
  Object.keys(list).forEach(cat=>list[cat].forEach(item=>item.checked=false));
  lsSet('shopping_list',list);
  showShoppingList(); // re-render
}

function printShoppingList(){
  const list = lsGet('shopping_list',{});
  const cats = Object.keys(list).sort();
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>MomOS Shopping List</title>
  <style>
    body{font-family:sans-serif;padding:24px;max-width:600px;margin:0 auto;color:#1C1C1C}
    h1{color:#C15E7A;font-size:18px;margin-bottom:4px}
    .sub{color:#888;font-size:12px;margin-bottom:16px}
    .cat{margin-bottom:14px}
    .cat-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#888;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:8px}
    .item{display:flex;align-items:center;gap:10px;padding:4px 0;font-size:13px}
    .box{width:14px;height:14px;border:2px solid #ccc;border-radius:3px;flex-shrink:0}
    .qty{color:#aaa;font-size:11px;margin-left:auto}
    .footer{margin-top:20px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px;text-align:center}
    @media print{body{padding:10px}}
  </style></head><body>
  <h1>🛒 MomOS Shopping List</h1>
  <div class="sub">Week of ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} · Tap items to check off while shopping</div>
  ${cats.map(cat=>`
    <div class="cat">
      <div class="cat-title">${getCatEmoji(cat)} ${cat}</div>
      ${list[cat].map(item=>`
        <div class="item">
          <div class="box"></div>
          <span>${item.name}</span>
          <span class="qty">${item.qty}</span>
        </div>`).join('')}
    </div>`).join('')}
  <div class="footer">MomOS Toolkit · Generated ${new Date().toLocaleDateString()} · Shop smart, eat well 💜</div>
  <\/body><\/html>`;
  const blob = new Blob([html],{type:'text/html'});
  const url = URL.createObjectURL(blob);
  const w = window.open(url,'_blank');
  if(w){w.onload=()=>setTimeout(()=>w.print(),400);setTimeout(()=>URL.revokeObjectURL(url),60000);}
  showToast('Shopping list ready to print ✓','success');
}

function printMealPlan(){function printMealPlan(){
  const seasons = {spring:'🌸 Spring',summer:'☀️ Summer',fall:'🍂 Fall',winter:'❄️ Winter'};
  const plan = MEAL_PLANS[currentSeason]?.['week'+currentWeek] || [];
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>MomOS Meal Plan — ${seasons[currentSeason]} Week ${currentWeek}</title>
  <style>
    body{font-family:Georgia,serif;padding:30px;color:#1C1C1C;max-width:750px;margin:0 auto}
    h1{color:#C15E7A;font-size:20px;margin-bottom:4px}
    .sub{color:#888;font-size:12px;margin-bottom:20px}
    .day{page-break-inside:avoid;margin-bottom:16px;padding:12px 16px;border:1px solid #eee;border-radius:8px;background:#fafafa}
    .day-title{font-size:14px;font-weight:700;margin-bottom:8px;color:#1C1C1C}
    .row{display:flex;gap:12px;margin-bottom:4px;font-size:12px}
    .lbl{width:70px;font-weight:600;color:#888;text-transform:uppercase;font-size:10px;padding-top:2px;flex-shrink:0}
    .meal{color:#333;line-height:1.4}
    .note{color:#aaa;font-size:10px;margin-top:1px}
    .snack{color:#5C8F6E;font-size:12px;margin-top:4px}
    .footer{margin-top:24px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:12px;text-align:center}
    @media print{.day{page-break-inside:avoid}}
  </style></head><body>
  <h1>MomOS Meal Plan — ${seasons[currentSeason]} Week ${currentWeek}</h1>
  <div class="sub">Generated ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})} · 7-day nutritious meal plan for moms & kids</div>
  ${plan.map(d=>`
    <div class="day">
      <div class="day-title">${d.emoji} ${d.day}</div>
      <div class="row"><div class="lbl">Breakfast</div><div class="meal">${d.breakfast.meal}<div class="note">${d.breakfast.note}</div></div></div>
      <div class="row"><div class="lbl">Lunch</div><div class="meal">${d.lunch.meal}<div class="note">${d.lunch.note}</div></div></div>
      <div class="row"><div class="lbl">Dinner</div><div class="meal">${d.dinner.meal}<div class="note">${d.dinner.note}</div></div></div>
      <div class="snack">Snack: ${d.snack}</div>
    </div>`).join('')}
  <div class="footer">MomOS Toolkit · Printable meal plan · Nutritious, fast, kid-friendly · yestomomlife@gmail.com</div>
  <\/body><\/html>`;

  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const w = window.open(url,'_blank');
  if(w){ w.onload=()=>{ setTimeout(()=>w.print(),400); }; setTimeout(()=>URL.revokeObjectURL(url),60000); }
  showToast('Meal plan ready to print ✓','success');
}

function buildTalkTopics(){
  const list = document.getElementById('talk-topics-list');
  if(!list||list.children.length>0) return; // already built
  list.innerHTML = TALK_TOPICS.map(t=>`
    <button class="talk-topic-btn" id="ttbtn-${t.id}" onclick="showTalkTopic('${t.id}')">
      <span style="font-size:22px">${t.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700">${t.title}</div>
        <div style="font-size:11px;color:var(--t3);font-weight:400;margin-top:2px">For ${t.age}</div>
      </div>
      <span style="margin-left:auto;color:var(--t3)">›</span>
    </button>`).join('');
}

function showTalkTopic(id){
  const topic = TALK_TOPICS.find(t=>t.id===id);
  if(!topic) return;
  currentTalkTopic = id;

  document.querySelectorAll('.talk-topic-btn').forEach(b=>{
    b.classList.toggle('active',b.id==='ttbtn-'+id);
  });

  const content = document.getElementById('talk-content');
  content.style.display = 'block';
  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:12px 14px;background:var(--surf);border-radius:var(--r-lg);border:1px solid var(--bdr)">
      <span style="font-size:28px">${topic.icon}</span>
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--t1)">${topic.title}</div>
        <div style="font-size:11px;color:var(--t3)">For ${topic.age}</div>
      </div>
      <button onclick="hideTalkTopic()" style="margin-left:auto;font-size:18px;color:var(--t3);padding:4px">✕</button>
    </div>
    <div style="padding:10px 12px;background:var(--lav-sf);border-radius:var(--r-md);border-left:3px solid var(--lav);font-size:12px;color:var(--lav-dk);margin-bottom:12px;line-height:1.6">
      💜 Remember: you don't need to be perfect. Just being present, warm, and honest is what your child needs most. These are starting points — trust your instincts.
    </div>
    ${topic.prompts.map(p=>`
      <div class="prompt-card">
        <div class="prompt-situation">When: ${p.situation}</div>
        <div class="prompt-say">${p.say}</div>
        <div class="prompt-why">💡 Why this works: ${p.why}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="copyPrompt('${p.say.replace(/'/g,"\'")}')">Copy this response</button>
      </div>`).join('')}
    <div style="margin-top:12px;padding:12px 14px;background:var(--rose-sf);border-radius:var(--r-lg);font-size:12px;color:var(--rose-dk);line-height:1.6">
      ⚠️ <strong>Disclaimer:</strong> These prompts are based on trauma-informed and gentle authoritative parenting research. They are not a substitute for professional therapy. If your child is showing signs of significant distress, please consult a licensed child therapist.
    </div>`;

  // Scroll to content
  content.scrollIntoView({behavior:'smooth', block:'start'});
}

function hideTalkTopic(){
  document.getElementById('talk-content').style.display='none';
  document.querySelectorAll('.talk-topic-btn').forEach(b=>b.classList.remove('active'));
}

function copyPrompt(text){
  if(navigator.clipboard) navigator.clipboard.writeText(text).then(()=>showToast('Copied to clipboard ✓','success'));
  else showToast('Copied ✓','success');
}

function buildSupportLinks(){
  const grid = document.getElementById('support-links-grid');
  if(!grid||grid.children.length>0) return;
  grid.innerHTML = SUPPORT_LINKS.map(l=>`
    <div class="support-link-card" style="border-left:3px solid ${l.color}">
      <div style="font-size:20px;margin-bottom:4px">${l.icon}</div>
      <div class="support-link-name">${l.name}</div>
      <div class="support-link-detail">${l.detail}</div>
    </div>`).join('');
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
const TEMPLATES=[
  {cat:'Late pickups',title:'Documenting a late pickup',body:'Pickup was scheduled for [TIME] today. You arrived at [ACTUAL TIME], which is [X] minutes late. Please ensure on-time pickups going forward as this disrupts [CHILD\'s] routine and schedule.'},
  {cat:'Late pickups',title:'Pattern of lateness',body:'This is the [NUMBER] time pickup has been late this month. Our agreement states pickup at [TIME]. Please adhere to the schedule or we can discuss a permanent time adjustment through our lawyers.'},
  {cat:'Late pickups',title:'Missed pickup completely',body:'You did not arrive for scheduled pickup at [TIME] on [DATE]. I waited until [TIME] and received no communication. [CHILD] was upset. Please confirm future pickups 24 hours in advance.'},
  {cat:'Schedule changes',title:'Requesting a schedule swap',body:'Hi [NAME], I need to request a schedule change for [DATE] due to [REASON]. Can we switch to [ALTERNATIVE DATE/TIME]? Please let me know by [DEADLINE]. Thank you.'},
  {cat:'Schedule changes',title:'Confirming a schedule change',body:'Confirming our agreed schedule change: [CHILD] will be with you on [DATE/TIME] instead of [ORIGINAL]. I will handle [PICKUP/DROPOFF] at [LOCATION/TIME]. Thank you for being flexible.'},
  {cat:'Expenses & reimbursement',title:'Requesting reimbursement',body:'Per our agreement, [EXPENSE TYPE] is split [PERCENTAGE]. I paid $[AMOUNT] for [SPECIFIC EXPENSE] on [DATE]. Please reimburse me $[AMOUNT OWED] by [DATE]. Receipt attached.'},
  {cat:'Expenses & reimbursement',title:'Large expense notification',body:'[CHILD] needs [EXPENSE] estimated at $[AMOUNT]. Per our agreement, this requires mutual discussion. Please confirm your availability to discuss by [DATE].'},
  {cat:'Boundaries',title:'Requesting respectful communication',body:'I am committed to co-parenting respectfully for [CHILD\'s] sake. Please keep all communication focused on [CHILD] and free from personal attacks or unrelated topics.'},
  {cat:'Boundaries',title:'Custody agreement reminder',body:'Our custody agreement states [SPECIFIC CLAUSE]. Please follow the agreement as written. If you wish to discuss modifications, please address this through our attorneys.'},
  {cat:'Medical',title:'Sharing a medical update',body:'[CHILD] had a [TYPE OF APPOINTMENT] with [DOCTOR] on [DATE]. Diagnosis: [SUMMARY]. [Next steps/medications]. I am attaching the doctor\'s notes for your records.'},
];
function buildTemplates(){
  const el=document.getElementById('templates-list'); if(!el) return;
  const cats=[...new Set(TEMPLATES.map(t=>t.cat))];
  el.innerHTML=cats.map(cat=>{
    const items=TEMPLATES.filter(t=>t.cat===cat);
    return `<div class="card mb-14">
      <div class="card-hdr"><div class="card-title">${cat}</div></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:16px">
        ${items.map((t,ti)=>`<div>
          <div style="font-size:13px;font-weight:600;margin-bottom:6px">${t.title}</div>
          <div style="font-size:13px;color:var(--t2);background:var(--surf2);padding:12px 14px;border-radius:var(--r-md);line-height:1.6;border-left:3px solid var(--rose-br)">${t.body}</div>
          <button class="btn btn-ghost btn-sm mt-8" onclick="copyTemplate(${TEMPLATES.indexOf(t)})">Copy template</button>
        </div>`).join('<div class="divider"></div>')}
      </div>
    </div>`;
  }).join('');
}
function copyTemplate(i){
  const t=TEMPLATES[i];
  if(navigator.clipboard) navigator.clipboard.writeText(t.body).then(()=>showToast('Template copied to clipboard ✓','success'));
  else showToast('Template copied ✓','success');
}

// ─── FEED ENGINE ─────────────────────────────────────────────────────────────
// Assembles all entries into a Lilio-style chronological feed

const MOOD_MAP={great:{emoji:'😄',label:'Great day!'},good:{emoji:'😊',label:'Good day'},ok:{emoji:'😐',label:'Okay day'},upset:{emoji:'😢',label:'Upset'},sick:{emoji:'🤒',label:'Not feeling well'}};
const TYPE_META={
  food:     {ic:'🍽️', label:'Food',           cls:'fc-food'},
  dailysummary:{ic:'📋', label:'Daily log',    cls:'fc-activity'},
  activity: {ic:'🎨', label:'Activity',       cls:'fc-activity'},
  mood:     {ic:'😊', label:'Mood',           cls:'fc-mood'},
  note:     {ic:'📝', label:'Note',           cls:'fc-note'},
  medical:  {ic:'🏥', label:'Medical',        cls:'fc-medical'},
  milestone:{ic:'⭐', label:'Milestone',      cls:'fc-milestone'},
  handoff:  {ic:'🤝', label:'Handoff',        cls:'fc-handoff'},
  expense:  {ic:'💰', label:'Expense',        cls:'fc-expense'},
  budget:   {ic:'📊', label:'Budget snapshot',cls:'fc-expense'},
  comm:     {ic:'💬', label:'Communication', cls:'fc-note'},
};

function childInitials(name){
  if(!name||name==='Both') return '👨‍👩‍👧';
  // Look up gender
  const all = S.children.length ? S.children : (S.user?.children||[]);
  const child = all.find(c=>c.name===name);
  if(child) return getChildEmoji(child);
  return name.charAt(0).toUpperCase();
}
function childColor(name){
  const colors=['var(--rose)','var(--lav)','var(--teal)','var(--gold)'];
  if(!name) return colors[0];
  return colors[name.charCodeAt(0)%colors.length];
}
function getChildPhoto(name){
  // Look up child photo from profiles
  const all = S.children.length ? S.children : (S.user?.children||[]);
  const child = all.find(c=>c.name===name);
  return child?.photo||'';
}

function buildFeedCard(entry){
  const meta=TYPE_META[entry.type]||TYPE_META.note;
  const timeStr=entry.time||'';
  const child=entry.child||'';
  const avatarColor=childColor(child);
  const avatarText=childInitials(child);
  const childPhoto=getChildPhoto(child);

  let bodyHTML='';

  if(entry.type==='food'){
    const meals=[];
    if(entry.breakfast) meals.push({type:'Breakfast',food:entry.breakfast,ate:entry.breakfast_ate});
    if(entry.lunch) meals.push({type:'Lunch',food:entry.lunch,ate:entry.lunch_ate});
    if(entry.dinner) meals.push({type:'Dinner',food:entry.dinner,ate:entry.dinner_ate});
    if(entry.snack) meals.push({type:'Snack',food:entry.snack,ate:entry.snack_ate});
    if(meals.length){
      bodyHTML=`<div class="meal-grid">${meals.map(m=>`
        <div class="meal-item">
          <div class="meal-type">${m.type}</div>
          <div class="meal-food">${m.food}</div>
          ${m.ate?`<div class="meal-ate">Ate ${m.ate}</div>`:''}
        </div>`).join('')}</div>`;
    } else {
      bodyHTML=`<p>${entry.notes||'Meal logged'}</p>`;
    }
  } else if(entry.type==='mood'){
    const m=MOOD_MAP[entry.mood]||{emoji:'😊',label:entry.mood||'Good'};
    bodyHTML=`<div class="mood-display"><span class="mood-emoji">${m.emoji}</span><div><div class="mood-text">${entry.child} is feeling: ${m.label}</div>${entry.notes?`<p style="margin-top:4px;font-size:13px;color:var(--t2)">${entry.notes}</p>`:''}</div></div>`;
  } else if(entry.type==='dailysummary'){
    const moodEmoji={'great':'😄','good':'😊','ok':'😐','upset':'😢','sick':'🤒'};
    const meals=[];
    if(entry.breakfast) meals.push({label:'Breakfast',food:entry.breakfast});
    if(entry.lunch) meals.push({label:'Lunch',food:entry.lunch});
    if(entry.dinner) meals.push({label:'Dinner',food:entry.dinner});
    const photoHTML=(entry.photos||[]).map(p=>`<img class="feed-photo" src="${p}" onclick="openLightbox('${p}')" alt="Photo">`).join('');
    bodyHTML=`<div style="display:flex;flex-direction:column;gap:6px">
      ${meals.length?`<div style="display:grid;grid-template-columns:repeat(${Math.min(meals.length,3)},1fr);gap:6px;margin-bottom:4px">
        ${meals.map(m=>`<div style="background:var(--surf2);border-radius:var(--r-md);padding:7px 10px;font-size:12px">
          <div style="font-weight:600;color:var(--t3);font-size:10px;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px">${m.label}</div>
          <div style="color:var(--t1)">${m.food}</div>
        </div>`).join('')}
      </div>`:''}
      ${entry.activities?`<div style="font-size:12px;color:var(--teal);font-weight:500">🎨 ${entry.activities}</div>`:''}
      ${entry.mood?`<div style="font-size:12px;color:var(--t2)">${moodEmoji[entry.mood]||'😊'} Feeling ${entry.mood}</div>`:''}
      ${entry.hw&&entry.hw!=='N/A'?`<div style="font-size:12px;color:${entry.hw==='Yes'?'var(--sage)':'var(--rose)'}">📚 Homework: ${entry.hw}</div>`:''}
      ${entry.bedtime?`<div style="font-size:12px;color:var(--t3)">🌙 Bedtime: ${entry.bedtime}</div>`:''}
      ${entry.notes?`<div style="font-size:13px;color:var(--t2);padding:8px 10px;background:var(--surf2);border-radius:var(--r-md);margin-top:4px;line-height:1.5">${entry.notes}</div>`:''}
      ${photoHTML}
    </div>`;
  } else if(entry.type==='milestone'){
    bodyHTML=`<div class="milestone-card-inner"><div class="milestone-star">⭐</div><div class="milestone-text">${entry.notes||'Milestone reached!'}</div></div>`;
  } else if(entry.type==='handoff'){
    const late=entry.ontime==='No';
    const isDeviation=entry.deviation===true;
    bodyHTML=`<div style="display:flex;flex-direction:column;gap:6px">
      ${isDeviation?`<div style="background:var(--red-sf);border-left:3px solid var(--red);padding:8px 12px;border-radius:var(--r-sm);font-size:13px;color:var(--red);font-weight:700">⚠️ Schedule deviation — ${entry.deviationNote||'Unplanned change'}</div>`:
      late?`<div style="background:var(--red-sf);border-left:3px solid var(--red);padding:8px 12px;border-radius:var(--r-sm);font-size:13px;color:var(--red);font-weight:600">⏰ Late arrival — scheduled ${entry.scheduled}, arrived ${entry.actual}</div>`
      :`<div style="font-size:14px;font-weight:600;color:var(--sage-dk)">✓ On time · ${entry.scheduled}</div>`}
      <div style="display:flex;gap:8px;font-size:12px;color:var(--t3);flex-wrap:wrap">
        ${entry.child?`<span>👤 ${entry.child}</span>`:''}
        ${entry.location?`<span>📍 ${entry.location}</span>`:''}
      </div>
      ${entry.notes?`<div style="font-size:12px;color:var(--t2);padding:6px 10px;background:var(--surf2);border-radius:var(--r-sm)">${entry.notes}</div>`:''}
    </div>`;
  } else if(entry.type==='budget'){
    const surColor = entry.sur>=0?'var(--sage)':'var(--red)';
    const surSign = entry.sur>=0?'+':'';
    bodyHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
      <div style="padding:10px;background:var(--sage-sf);border-radius:var(--r-md)">
        <div style="font-size:11px;color:var(--sage-dk);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Income</div>
        <div style="font-size:18px;font-weight:700;color:var(--sage)">$${Math.round(entry.inc).toLocaleString()}</div>
      </div>
      <div style="padding:10px;background:var(--rose-sf);border-radius:var(--r-md)">
        <div style="font-size:11px;color:var(--rose-dk);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Expenses</div>
        <div style="font-size:18px;font-weight:700;color:var(--rose)">$${Math.round(entry.exp).toLocaleString()}</div>
      </div>
      <div style="padding:10px;background:${entry.sur>=0?'var(--sage-sf)':'var(--red-sf)'};border-radius:var(--r-md)">
        <div style="font-size:11px;color:${surColor};font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">${entry.sur>=0?'Surplus':'Deficit'}</div>
        <div style="font-size:18px;font-weight:700;color:${surColor}">${surSign}$${Math.round(Math.abs(entry.sur)).toLocaleString()}</div>
      </div>
    </div>`;
  } else if(entry.type==='expense'){
    const photoHTML2 = (entry.photos||[]).map(p=>`<img class="feed-photo" src="${p}" onclick="openLightbox('${p}')" alt="Receipt">`).join('');
    bodyHTML=`<div style="display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-size:14px;font-weight:600">${entry.desc||'Expense logged'}</div><div style="font-size:12px;color:var(--t3);margin-top:2px">${entry.category||''} · Paid by ${entry.paidBy||'—'}</div></div>
      <div style="font-size:18px;font-weight:700;color:var(--rose)">$${(+entry.amount||0).toFixed(2)}</div>
    </div>${photoHTML2}`;
  } else if(entry.type==='comm'){
    const screenshotHTML=(entry.photos||[]).map(p=>`<img class="feed-photo" src="${p}" onclick="openLightbox('${p}')" alt="Screenshot" style="border:1px solid var(--bdr)">`).join('');
    bodyHTML=`<div style="margin-bottom:${entry.photos?.length?'8px':'0'}">
      <div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:3px">${entry.topic||''}</div>
      ${entry.summary?`<div style="font-size:12px;color:var(--t2);line-height:1.5">${entry.summary}</div>`:''}
      <div style="font-size:11px;color:var(--t3);margin-top:4px">${entry.commType||''} · ${entry.by||''}</div>
    </div>${screenshotHTML}`;
  } else {
    // activity, note, medical
    bodyHTML=`<p class="activity-text">${entry.notes||entry.desc||''}</p>
      ${entry.activities?`<div style="margin-top:6px;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--teal);font-weight:600">🏃 ${entry.activities}</div>`:''}
      ${entry.hw&&entry.hw!=='N/A'?`<div style="margin-top:6px;font-size:12px;color:${entry.hw==='Yes'?'var(--sage)':'var(--rose)'};font-weight:600">${entry.hw==='Yes'?'✓ Homework done':'✗ Homework not done'}</div>`:''}
      ${entry.bedtime?`<div style="margin-top:4px;font-size:12px;color:var(--t3)">🌙 Bedtime: ${entry.bedtime}</div>`:''}`;
  }

  // Render photos if present
  const photos = entry.photos||[];
  const photoHTML = photos.length ? photos.map(p=>`<img class="feed-photo" src="${p}" onclick="openLightbox('${p}')" alt="Photo">`).join('') : '';

  return `<div class="feed-card ${meta.cls}" id="fc-${entry.id}">
    <div class="feed-card-hdr">
      <div class="feed-avatar" style="background:${avatarColor}20;color:${avatarColor};overflow:hidden;padding:0">${childPhoto?`<img src="${childPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onclick="openLightbox('${childPhoto}')">`:`<span style="font-size:18px;line-height:1">${avatarText}</span>`}</div>
      <div class="feed-type-badge">
        <span class="feed-type-ic">${meta.ic}</span>
        <span>${meta.label}</span>
        ${child?`<span style="font-size:12px;color:var(--t3);font-weight:400">· ${child}</span>`:''}
      </div>
      <span class="feed-time">${timeStr}</span>
    </div>
    <div class="feed-card-body">${bodyHTML}${photoHTML}</div>
    <div class="feed-card-footer">
      <span class="feed-action">♡ Like</span>
      <span class="feed-del" onclick="deleteFeedEntry(${entry.id})">Remove</span>
    </div>
  </div>`;
}

function buildFeed(containerId){
  const el=document.getElementById(containerId); if(!el) return;

  // Gather ALL feed-worthy entries
  const allEntries=[];

  // Daily logs — ONE summary card per entry (not multiple cards)
  S.dailylogs.forEach(d=>{
    allEntries.push({
      id:'dl_'+d.id,
      date:d.date,
      time:d.bedtime||'',
      type:'dailysummary',
      child:d.child,
      breakfast:d.breakfast,
      lunch:d.lunch,
      dinner:d.dinner,
      activities:d.activities,
      hw:d.hw,
      bedtime:d.bedtime,
      mood:d.mood,
      notes:d.notes,
      photos:d.photos||[],
      source:'dailylog',
      srcId:d.id
    });
  });

  // Quick entries (type already set)
  S.quickentries.forEach(e=>allEntries.push(e));

  // Handoffs
  S.handoffs.forEach(h=>{
    allEntries.push({id:'ho_'+h.id,date:h.date,time:h.actual||h.scheduled,type:'handoff',child:h.child,ontime:h.ontime,scheduled:h.scheduled,actual:h.actual,location:h.location,notes:h.notes,source:'handoff',srcId:h.id});
  });

  // Communications with screenshots
  S.comms.forEach(comm=>{
    if(comm.photos&&comm.photos.length){
      const dt=comm.dt||'';
      const date=dt?dt.split('T')[0]:'';
      const time=dt&&dt.includes('T')?dt.split('T')[1].substring(0,5):'';
      allEntries.push({id:'comm_'+comm.id,date,time,type:'comm',by:comm.by,commType:comm.type,topic:comm.topic,summary:comm.summary,photos:comm.photos,source:'comm',srcId:comm.id});
    }
  });

  // Expenses (notable ones — over $20 or with reimbursement)
  S.expenses.filter(e=>e.amount>=20||e.reimbursement!=='No').forEach(e=>{
    allEntries.push({id:'exp_'+e.id,date:e.date,time:'',type:'expense',child:e.child,desc:e.desc,amount:e.amount,category:e.category,paidBy:e.paidBy,status:e.status,photos:e.photos||[],source:'expense',srcId:e.id});
  });

  // Budget snapshot — show once if budget has been filled in
  const inc=INC_FIELDS.reduce((a,f)=>a+(S.budget[f]||0),0);
  const exp=EXP_FIELDS.reduce((a,f)=>a+(S.budget[f]||0),0);
  if(inc>0||exp>0){
    const today2=new Date().toISOString().split('T')[0];
    allEntries.push({id:'budget_snap',date:today2,time:'00:01',type:'budget',inc,exp,sur:inc-exp,source:'budget'});
  }

  if(!allEntries.length){
    el.innerHTML=`<div class="empty" style="padding:52px 20px"><div class="empty-ic">📖</div><div class="empty-title">Your family feed is empty</div><div class="empty-sub">Start logging daily entries, handoffs, and expenses — they'll all appear here in a beautiful timeline.</div><button class="btn btn-primary" style="margin-top:16px" onclick="openAddModal()">+ Log your first entry</button></div>`;
    return;
  }

  // Sort newest first
  allEntries.sort((a,b)=>new Date(b.date+' '+(b.time||'00:00'))-new Date(a.date+' '+(a.time||'00:00')));

  // Group by date
  const groups={};
  allEntries.forEach(e=>{
    if(!groups[e.date]) groups[e.date]=[];
    groups[e.date].push(e);
  });

  const today=new Date().toISOString().split('T')[0];
  const yesterday=new Date(Date.now()-86400000).toISOString().split('T')[0];

  let html='';
  Object.keys(groups).sort((a,b)=>new Date(b)-new Date(a)).forEach(date=>{
    const isToday=date===today;
    const isYesterday=date===yesterday;
    let label=date;
    if(isToday) label='Today';
    else if(isYesterday) label='Yesterday';
    else{
      try{const d=new Date(date+'T12:00:00');label=d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}catch{}
    }
    html+=`<div class="feed-date-group">
      <div class="feed-date-label ${isToday?'today-lbl':''}">${label}</div>`;

    // Daily report card for today
    if(isToday){
      const todayLogs=S.dailylogs.filter(d=>d.date===today);
      if(todayLogs.length){
        const reportLines=[];
        todayLogs.forEach(d=>{
          const meals=[d.breakfast,d.lunch,d.dinner].filter(Boolean);
          if(meals.length) reportLines.push(`<span class="report-line"><strong>${d.child}</strong> · Meals: ${meals.join(', ')}</span>`);
          if(d.activities) reportLines.push(`<span class="report-line"><strong>${d.child}</strong> · ${d.activities}</span>`);
          if(d.bedtime) reportLines.push(`<span class="report-line">🌙 Bedtime: ${d.bedtime}</span>`);
        });
        if(reportLines.length){
          html+=`<div class="report-card mb-12">
            <div class="report-card-hdr">
              <div class="report-card-icon">📋</div>
              <div class="report-card-title">Today's report is ready</div>
              <button class="report-card-btn" onclick="shareReport()">Share →</button>
            </div>
            <div class="report-card-body">${reportLines.join('')}</div>
          </div>`;
        }
      }
    }

    groups[date].forEach(entry=>{ html+=buildFeedCard(entry); });
    html+='</div>';
  });

  el.innerHTML=html;
}

function deleteFeedEntry(id){
  const sid=String(id);
  if(sid.startsWith('ho_')){const rid=+sid.replace('ho_','');S.handoffs=S.handoffs.filter(h=>h.id!==rid);save('handoffs');buildHandoffTable();}
  else if(sid.startsWith('exp_')){const rid=+sid.replace('exp_','');S.expenses=S.expenses.filter(e=>e.id!==rid);save('expenses');buildExpenseTable();}
  else if(sid.startsWith('dl_')){
    const rid=+sid.replace('dl_','');
    S.dailylogs=S.dailylogs.filter(d=>d.id!==rid);save('dailylogs');buildDailyLogTable();
  } else {
    S.quickentries=S.quickentries.filter(e=>e.id!=id);save('quickentries');
  }
  updateDashboard();
}

function shareReport(){
  const today=new Date().toISOString().split('T')[0];
  const logs=S.dailylogs.filter(d=>d.date===today);
  if(!logs.length){showToast('No entries for today yet');return}
  let text='📋 Daily Report — '+new Date().toLocaleDateString('en-US',{month:'long',day:'numeric'})+'\n\n';
  logs.forEach(d=>{
    text+=`👧 ${d.child} (with ${d.parent})\n`;
    if(d.breakfast) text+=`🍽 Breakfast: ${d.breakfast}\n`;
    if(d.lunch) text+=`🍽 Lunch: ${d.lunch}\n`;
    if(d.dinner) text+=`🍽 Dinner: ${d.dinner}\n`;
    if(d.activities) text+=`🎨 Activities: ${d.activities}\n`;
    if(d.mood) text+=`${MOOD_MAP[d.mood]?.emoji||'😊'} Mood: ${MOOD_MAP[d.mood]?.label||d.mood}\n`;
    if(d.hw&&d.hw!=='N/A') text+=`📚 Homework: ${d.hw}\n`;
    if(d.bedtime) text+=`🌙 Bedtime: ${d.bedtime}\n`;
    if(d.notes) text+=`📝 Notes: ${d.notes}\n`;
    text+='\n';
  });
  text+='Sent from MomOS 💜';
  if(navigator.share){navigator.share({title:'Daily Report',text}).catch(()=>{});}
  else if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>showToast('Report copied — paste into WhatsApp ✓','success'));}
  else showToast('Report ready to share','success');
}

// ─── QUICK ADD MODALS ────────────────────────────────────────────────────────
function openQuickAdd(type){
  const meta=TYPE_META[type];
  document.getElementById('modal-title').textContent='Log '+meta.label;
  const kids=S.children.length?S.children:S.user?.children||[];
  const kidOpts=kids.map(c=>`<option>${c.name}</option>`).join('')+'<option value="Both">Both</option>';
  const dateDefault=new Date().toISOString().split('T')[0];

  let formHTML=`
    <div class="form-grid form-grid-2 mb-12">
      <div class="f-group"><label class="f-label">Date</label><input class="f-input" type="date" id="qa-date" value="${dateDefault}"></div>
      <div class="f-group"><label class="f-label">Child</label><select class="f-select" id="qa-child">${kidOpts}</select></div>
    </div>`;

  if(type==='food'){
    formHTML+=`
      <div class="form-grid form-grid-2 mb-8">
        <div class="f-group"><label class="f-label">Meal type</label><select class="f-select" id="qa-meal-type"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></div>
        <div class="f-group"><label class="f-label">How much eaten?</label><select class="f-select" id="qa-ate"><option>All of it</option><option>Most of it</option><option>Some of it</option><option>Didn't eat</option></select></div>
      </div>
      <div class="f-group"><label class="f-label">What they ate</label><input class="f-input" id="qa-food-desc" placeholder="e.g. Cheese slices with ritz crackers and water"></div>`;
  } else if(type==='mood'){
    formHTML+=`
      <div class="f-group mb-12"><label class="f-label">How are they feeling?</label>
        <div class="mood-picker" id="qa-mood-picker">
          <div class="mood-opt" data-mood="great" onclick="pickMood('qa','great')">😄<span>Great</span></div>
          <div class="mood-opt" data-mood="good" onclick="pickMood('qa','good')">😊<span>Good</span></div>
          <div class="mood-opt" data-mood="ok" onclick="pickMood('qa','ok')">😐<span>Okay</span></div>
          <div class="mood-opt" data-mood="upset" onclick="pickMood('qa','upset')">😢<span>Upset</span></div>
          <div class="mood-opt" data-mood="sick" onclick="pickMood('qa','sick')">🤒<span>Sick</span></div>
        </div>
        <input type="hidden" id="qa-mood" value="">
      </div>
      <div class="f-group"><label class="f-label">Notes (optional)</label><textarea class="f-textarea" id="qa-notes" placeholder="What happened? Any context..." style="min-height:60px"></textarea></div>`;
  } else if(type==='milestone'){
    formHTML+=`<div class="f-group"><label class="f-label">Describe the milestone ⭐</label><textarea class="f-textarea" id="qa-notes" placeholder="e.g. Said 'more please' clearly for the first time!" style="min-height:80px"></textarea></div>`;
  } else {
    formHTML+=`<div class="f-group"><label class="f-label">${type==='medical'?'What happened / what was noted?':'Describe the activity or note'}</label><textarea class="f-textarea" id="qa-notes" placeholder="${type==='activity'?'e.g. Unicorn memory game — loved it!':type==='medical'?'e.g. Mild fever 99.8°F — gave Tylenol':'e.g. Had a great day, made a new friend'}" style="min-height:80px"></textarea></div>`;
  }

  // Add photo attachment to all quick-add types
  formHTML += `
    <div style="margin-top:12px">
      <label class="photo-attach-btn" for="qa-photo-input" style="margin-top:0">
        <span style="font-size:16px">📷</span> Add photo (optional)
      </label>
      <input type="file" id="qa-photo-input" accept="image/*" style="display:none" onchange="previewQAPhoto(this)">
      <div class="photo-preview-wrap" id="qa-photo-preview"></div>
    </div>`;

  document.getElementById('modal-body').innerHTML=formHTML;
  document.getElementById('modal-save-btn').onclick=()=>saveQuickEntry(type);
  document.getElementById('modal-footer').innerHTML='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modal-save-btn" onclick="saveQuickEntry(\''+type+'\')">Save</button>';
  openModal();
}

function pickMood(prefix,mood){
  document.querySelectorAll('#'+prefix+'-mood-picker .mood-opt').forEach(el=>{
    el.classList.toggle('selected',el.dataset.mood===mood);
  });
  const hidden=document.getElementById(prefix+'-mood');
  if(hidden) hidden.value=mood;
}

function saveQuickEntry(type){
  const date=document.getElementById('qa-date')?.value||new Date().toISOString().split('T')[0];
  const child=document.getElementById('qa-child')?.value||'';
  const notes=document.getElementById('qa-notes')?.value||'';
  const now=new Date();
  const time=now.getHours()+':'+(String(now.getMinutes()).padStart(2,'0'));

  let entry={id:Date.now(),date,time,type,child,notes,source:'quick'};

  if(type==='food'){
    const mealType=document.getElementById('qa-meal-type')?.value||'Snack';
    const ate=document.getElementById('qa-ate')?.value||'';
    const food=document.getElementById('qa-food-desc')?.value||'';
    if(!food){showToast('Please describe what they ate','warn');return}
    const mKey=mealType.toLowerCase();
    entry={...entry,[mKey]:food,[mKey+'_ate']:ate};
  } else if(type==='mood'){
    const mood=document.getElementById('qa-mood')?.value;
    if(!mood){showToast('Please select a mood','warn');return}
    entry.mood=mood;
  } else {
    if(!notes){showToast('Please add a description','warn');return}
  }

  entry.photos = [...currentQAPhotos];
  S.quickentries.unshift(entry); save('quickentries');
  currentQAPhotos = [];
  closeModal(); updateDashboard(); buildDailyLogFeed();
  showToast(TYPE_META[type].label+' logged ✓','success');
}

// ─── DAILY LOG FEED ──────────────────────────────────────────────────────────
function buildDailyLogFeed(){
  const wrap=document.getElementById('dl-feed-wrap'); if(!wrap) return;
  const badge=document.getElementById('dl-count-badge');
  const total=S.dailylogs.length+S.quickentries.length;
  if(badge) badge.textContent=total+' entr'+(total===1?'y':'ies');

  const allEntries=[];
  S.dailylogs.forEach(d=>{
    allEntries.push({id:'dl_'+d.id,date:d.date,time:d.bedtime||'',type:'dailysummary',child:d.child,breakfast:d.breakfast,lunch:d.lunch,dinner:d.dinner,activities:d.activities,hw:d.hw,bedtime:d.bedtime,mood:d.mood,notes:d.notes,photos:d.photos||[],source:'dailylog',srcId:d.id});
  });
  S.quickentries.forEach(e=>allEntries.push(e));
  allEntries.sort((a,b)=>new Date(b.date)-new Date(a.date));

  if(!allEntries.length){
    wrap.innerHTML='<div class="empty"><div class="empty-ic">📋</div><div class="empty-title">No entries yet</div><div class="empty-sub">Tap a quick-add button above to log your first entry</div></div>';
    return;
  }
  wrap.innerHTML=allEntries.map(e=>buildFeedCard(e)).join('');
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function updateDashboard(){
  const incVals=INC_FIELDS.map(f=>S.budget[f]||0);
  const expVals=EXP_FIELDS.map(f=>S.budget[f]||0);
  const inc=incVals.reduce((a,v)=>a+v,0);
  const exp=expVals.reduce((a,v)=>a+v,0);
  const sur=inc-exp;
  const hasData=inc>0||exp>0;

  // Finance strip
  const di=document.getElementById('d-inc'); if(di) di.textContent=hasData?fmtRaw(inc):'—';
  const de=document.getElementById('d-exp'); if(de) de.textContent=hasData?fmtRaw(exp):'—';
  const ds=document.getElementById('d-sur');
  if(ds){ds.textContent=hasData?(sur>=0?'+':'')+fmtRaw(sur):'—';ds.style.color=sur>=0?'var(--gold)':'var(--red)';}
  const df=document.getElementById('d-fund');
  const saved=S.savings.saved||0;
  const months=S.savings.months||3;
  const goal=exp*months;
  if(df) df.textContent=goal>0?(saved/exp).toFixed(1)+' mo':'—';

  // Build the main feed
  buildFeed('feed-container');
  // Check if backup reminder should show
  checkBackupReminder();
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function openModal(){document.getElementById('modal-bg').classList.remove('hidden')}
function closeModal(){document.getElementById('modal-bg').classList.add('hidden')}
function openAddModal(){
  document.getElementById('modal-title').textContent='What would you like to log?';
  document.getElementById('modal-body').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn btn-ghost w-full" style="justify-content:flex-start;gap:10px;padding:12px 14px;flex-direction:column;align-items:flex-start;height:auto" onclick="closeModal();openQuickAdd('food')"><span style="font-size:22px">🍽️</span><div><div style="font-size:13px;font-weight:600">Meal</div><div style="font-size:11px;color:var(--t3)">What they ate</div></div></button>
      <button class="btn btn-ghost w-full" style="justify-content:flex-start;gap:10px;padding:12px 14px;flex-direction:column;align-items:flex-start;height:auto" onclick="closeModal();openQuickAdd('activity')"><span style="font-size:22px">🎨</span><div><div style="font-size:13px;font-weight:600">Activity</div><div style="font-size:11px;color:var(--t3)">What they did</div></div></button>
      <button class="btn btn-ghost w-full" style="justify-content:flex-start;gap:10px;padding:12px 14px;flex-direction:column;align-items:flex-start;height:auto" onclick="closeModal();openQuickAdd('mood')"><span style="font-size:22px">😊</span><div><div style="font-size:13px;font-weight:600">Mood</div><div style="font-size:11px;color:var(--t3)">How they're feeling</div></div></button>
      <button class="btn btn-ghost w-full" style="justify-content:flex-start;gap:10px;padding:12px 14px;flex-direction:column;align-items:flex-start;height:auto" onclick="closeModal();openQuickAdd('milestone')"><span style="font-size:22px">⭐</span><div><div style="font-size:13px;font-weight:600">Milestone</div><div style="font-size:11px;color:var(--t3)">A big moment</div></div></button>
      <button class="btn btn-ghost w-full" style="justify-content:flex-start;gap:10px;padding:12px 14px;flex-direction:column;align-items:flex-start;height:auto" onclick="closeModal();nav('handoffs')"><span style="font-size:22px">🤝</span><div><div style="font-size:13px;font-weight:600">Handoff</div><div style="font-size:11px;color:var(--t3)">Custody exchange</div></div></button>
      <button class="btn btn-ghost w-full" style="justify-content:flex-start;gap:10px;padding:12px 14px;flex-direction:column;align-items:flex-start;height:auto" onclick="closeModal();nav('expenses')"><span style="font-size:22px">💰</span><div><div style="font-size:13px;font-weight:600">Expense</div><div style="font-size:11px;color:var(--t3)">Log a cost</div></div></button>
    </div>`;
  document.getElementById('modal-footer').innerHTML='<button class="btn btn-ghost w-full" onclick="closeModal()">Cancel</button>';
  openModal();
}
function openGoalModal(){
  document.getElementById('modal-title').textContent='Add savings goal';
  document.getElementById('modal-body').innerHTML=`
    <div class="form-grid mb-12"><div class="f-group"><label class="f-label">Goal name</label><input class="f-input" id="goal-name" placeholder="e.g. Security deposit fund"></div></div>
    <div class="form-grid form-grid-2 mb-12">
      <div class="f-group"><label class="f-label">Target amount</label><div class="dollar-wrap"><input class="f-input" type="number" id="goal-target" placeholder="0.00"></div></div>
      <div class="f-group"><label class="f-label">Monthly contribution</label><div class="dollar-wrap"><input class="f-input" type="number" id="goal-monthly" placeholder="0.00"></div></div>
    </div>
    <div class="f-group"><label class="f-label">Saved so far</label><div class="dollar-wrap"><input class="f-input" type="number" id="goal-saved" placeholder="0.00"></div></div>`;
  document.getElementById('modal-save-btn').onclick=()=>{
    const name=document.getElementById('goal-name').value.trim();
    if(!name){showToast('Please add a goal name','warn');return}
    S.savings.goals=S.savings.goals||[];
    S.savings.goals.push({name,target:+(document.getElementById('goal-target').value)||0,monthly:+(document.getElementById('goal-monthly').value)||0,saved:+(document.getElementById('goal-saved').value)||0});
    save('savings'); buildSavingsGoals(); closeModal(); showToast('Goal added ✓','success');
  };
  document.getElementById('modal-footer').innerHTML='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modal-save-btn">Save goal</button>';
  openModal();
}
document.getElementById('modal-bg').addEventListener('click',e=>{if(e.target===document.getElementById('modal-bg'))closeModal()});

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg,type=''){
  const wrap=document.getElementById('toast-wrap');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=msg;
  wrap.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(10px)';t.style.transition='all 0.3s';setTimeout(()=>t.remove(),300)},3000);
}

// ─── EXPORT ENGINE ───────────────────────────────────────────────────────────

function escapeCSV(val){
  if(val===null||val===undefined) return '';
  const s=String(val);
  if(s.includes(',')||s.includes('"')||s.includes('\n'))
    return '"'+s.replace(/"/g,'""')+'"';
  return s;
}
function rowToCSV(arr){ return arr.map(escapeCSV).join(',')+'\r\n'; }
function downloadCSV(filename,rows){
  const csv=rows.join('');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); document.body.removeChild(a); },200);
}
function getUserName(){ return S.user?.name||'Parent'; }
function getCoName(){   return S.user?.coparent||'Co-parent'; }
function fmtDate(d){
  if(!d) return '';
  try{ return new Date(d+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}); }
  catch{ return d; }
}

function buildCustodyCSV(){
  const rows=[],me=getUserName(),co=getCoName();
  rows.push(rowToCSV(['CUSTODY TRACKER — '+me]));
  rows.push(rowToCSV(['Generated: '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})]));
  rows.push(rowToCSV([]));
  const lates=S.handoffs.filter(h=>h.ontime==='No').length;
  rows.push(rowToCSV(['SUMMARY']));
  rows.push(rowToCSV(['Total handoffs documented',S.handoffs.length]));
  rows.push(rowToCSV(['Late / missed handoffs',lates]));
  rows.push(rowToCSV(['On-time handoffs',S.handoffs.length-lates]));
  rows.push(rowToCSV([]));
  rows.push(rowToCSV(['HANDOFF LOG']));
  rows.push(rowToCSV(['Date','Child','From','To','Location','Scheduled Time','Actual Time','On Time?','Deviation?','Notes']));
  if(S.handoffs.length){
    S.handoffs.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(h=>{
      rows.push(rowToCSV([fmtDate(h.date),h.child||'',me,co,h.location||'',h.scheduled||'',h.actual||'',h.ontime||'',h.ontime==='No'?'YES — DEVIATION':'No',h.notes||'']));
    });
  } else rows.push(rowToCSV(['No handoffs logged yet']));
  rows.push(rowToCSV([]));
  const relevant=(S.quickentries||[]).filter(e=>['mood','medical','milestone'].includes(e.type));
  if(relevant.length){
    rows.push(rowToCSV(['SUPPLEMENTAL CHILD RECORDS']));
    rows.push(rowToCSV(['Date','Child','Type','Details']));
    relevant.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(e=>{
      rows.push(rowToCSV([fmtDate(e.date),e.child||'',e.type?.toUpperCase()||'',e.notes||'']));
    });
    rows.push(rowToCSV([]));
  }
  rows.push(rowToCSV(['NOTE: This document was generated from MomOS. All entries are user-entered and timestamped.']));
  return rows;
}

function buildExpensesCSV(){
  const rows=[],me=getUserName();
  rows.push(rowToCSV(['EXPENSE LOG — '+me]));
  rows.push(rowToCSV(['Generated: '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})]));
  rows.push(rowToCSV([]));
  const cats={};
  S.expenses.forEach(e=>{ cats[e.category]=(cats[e.category]||0)+(+e.amount||0); });
  const grandTotal=S.expenses.reduce((a,e)=>a+(+e.amount||0),0);
  const pendingTotal=S.expenses.filter(e=>e.status==='Pending').reduce((a,e)=>{
    const mult=e.reimbursement==='Yes — 50/50'?0.5:e.reimbursement==='Yes — 100%'?1:0;
    return a+(+e.amount||0)*mult;
  },0);
  rows.push(rowToCSV(['SUMMARY BY CATEGORY']));
  rows.push(rowToCSV(['Category','Total Spent']));
  Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt])=>rows.push(rowToCSV([cat,'$'+amt.toFixed(2)])));
  rows.push(rowToCSV(['GRAND TOTAL','$'+grandTotal.toFixed(2)]));
  rows.push(rowToCSV(['Total Pending Reimbursement','$'+pendingTotal.toFixed(2)]));
  rows.push(rowToCSV([]));
  rows.push(rowToCSV(['FULL EXPENSE LOG']));
  rows.push(rowToCSV(['Date','Child','Category','Description','Amount','Paid By','Reimbursement','Amount Owed','Status']));
  if(S.expenses.length){
    S.expenses.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(e=>{
      const mult=e.reimbursement==='Yes — 50/50'?0.5:e.reimbursement==='Yes — 100%'?1:0;
      const owed=(+e.amount||0)*mult;
      rows.push(rowToCSV([fmtDate(e.date),e.child||'',e.category||'',e.desc||'','$'+(+e.amount||0).toFixed(2),e.paidBy||'',e.reimbursement||'No',owed>0?'$'+owed.toFixed(2):'—',e.status||'']));
    });
  } else rows.push(rowToCSV(['No expenses logged yet']));
  return rows;
}

function buildDailyCSV(){
  const rows=[],me=getUserName();
  rows.push(rowToCSV(['DAILY LOG — '+me]));
  rows.push(rowToCSV(['Generated: '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})]));
  rows.push(rowToCSV([]));
  const allEntries=[];
  S.dailylogs.forEach(d=>{
    allEntries.push({date:d.date,child:d.child,parent:d.parent,type:'FULL ENTRY',
      detail:[d.breakfast?'Breakfast: '+d.breakfast:'',d.lunch?'Lunch: '+d.lunch:'',d.dinner?'Dinner: '+d.dinner:'',
              d.activities?'Activities: '+d.activities:'',d.hw&&d.hw!=='N/A'?'HW: '+d.hw:'',
              d.bedtime?'Bedtime: '+d.bedtime:'',d.mood?'Mood: '+d.mood:'',d.notes?'Notes: '+d.notes:''].filter(Boolean).join(' | ')});
  });
  (S.quickentries||[]).forEach(e=>{
    let detail=e.notes||'';
    if(e.type==='food'){const parts=[];if(e.breakfast)parts.push('Breakfast: '+e.breakfast+(e.breakfast_ate?' ('+e.breakfast_ate+')':''));if(e.lunch)parts.push('Lunch: '+e.lunch);if(e.dinner)parts.push('Dinner: '+e.dinner);detail=parts.join(' | ');}
    else if(e.type==='mood'&&e.mood){const ml={great:'Great',good:'Good',ok:'Okay',upset:'Upset',sick:'Sick'};detail='Mood: '+(ml[e.mood]||e.mood)+(e.notes?' — '+e.notes:'');}
    allEntries.push({date:e.date,child:e.child,parent:me,type:e.type?.toUpperCase()||'NOTE',detail});
  });
  allEntries.sort((a,b)=>new Date(b.date)-new Date(a.date));
  rows.push(rowToCSV(['Date','Child','Parent','Entry Type','Details']));
  if(allEntries.length) allEntries.forEach(e=>rows.push(rowToCSV([fmtDate(e.date),e.child||'',e.parent||'',e.type,e.detail])));
  else rows.push(rowToCSV(['No daily entries logged yet']));
  return rows;
}

function buildCommsCSV(){
  const rows=[],me=getUserName();
  rows.push(rowToCSV(['COMMUNICATION LOG — '+me]));
  rows.push(rowToCSV(['Generated: '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})]));
  rows.push(rowToCSV([]));
  const types={};
  S.comms.forEach(c=>{ types[c.type]=(types[c.type]||0)+1; });
  if(Object.keys(types).length){
    rows.push(rowToCSV(['COMMUNICATION TYPES']));
    Object.entries(types).forEach(([t,n])=>rows.push(rowToCSV([t,n+' entries'])));
    rows.push(rowToCSV([]));
  }
  rows.push(rowToCSV(['Date','Time','Type','Initiated By','Topic','Summary']));
  if(S.comms.length){
    S.comms.slice().sort((a,b)=>new Date(b.dt||b.date)-new Date(a.dt||a.date)).forEach(c=>{
      const dt=c.dt||'',date=dt?fmtDate(dt.split('T')[0]):'',time=dt&&dt.includes('T')?dt.split('T')[1].substring(0,5):'';
      rows.push(rowToCSV([date,time,c.type||'',c.by||'',c.topic||'',c.summary||'']));
    });
  } else rows.push(rowToCSV(['No communications logged yet']));
  return rows;
}

function exportSheet(type){
  const me=(getUserName()||'Mom').replace(/\s+/g,'_');
  const date=new Date().toISOString().split('T')[0];
  const map={custody:[buildCustodyCSV,`${me}_Custody_Tracker_${date}.csv`],expenses:[buildExpensesCSV,`${me}_Expense_Log_${date}.csv`],daily:[buildDailyCSV,`${me}_Daily_Log_${date}.csv`],comms:[buildCommsCSV,`${me}_Communication_Log_${date}.csv`]};
  const [buildFn,filename]=map[type]||[null,null];
  if(!buildFn)return;
  downloadCSV(filename,buildFn());
  showToast('Downloading '+filename+' ✓','success');
}

function exportAll(){
  const me=(getUserName()||'Mom').replace(/\s+/g,'_');
  const date=new Date().toISOString().split('T')[0];
  [[buildCustodyCSV,`${me}_Custody_Tracker_${date}.csv`],[buildExpensesCSV,`${me}_Expense_Log_${date}.csv`],[buildDailyCSV,`${me}_Daily_Log_${date}.csv`],[buildCommsCSV,`${me}_Communication_Log_${date}.csv`]]
  .forEach(([fn,name],i)=>setTimeout(()=>downloadCSV(name,fn()),i*400));
  showToast('Downloading all 4 files ✓','success');
}

function refreshExportCounts(){
  const daily=S.dailylogs.length+(S.quickentries||[]).length;
  const p=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n+' entr'+(n===1?'y':'ies');};
  p('exc-custody-count',S.handoffs.length);
  p('exc-exp-count',S.expenses.length);
  p('exc-daily-count',daily);
  p('exc-comm-count',S.comms.length);
}

let currentPreview='custody';
function setPreview(type){
  currentPreview=type;
  ['custody','expenses','daily','comms'].forEach(t=>{
    const btn=document.getElementById('prev-btn-'+t);
    if(!btn)return;
    btn.style.color=t===type?'var(--rose)':'';
    btn.style.fontWeight=t===type?'600':'';
  });
  const titles={custody:'Custody Tracker',expenses:'Expense Log',daily:'Daily Log',comms:'Communications'};
  const titleEl=document.querySelector('#page-export .card .card-title');
  if(titleEl)titleEl.textContent='Preview — '+titles[type];
  const el=document.getElementById('export-preview');if(!el)return;

  if(type==='custody'){
    if(!S.handoffs.length){el.innerHTML='<div class="empty" style="padding:24px"><div class="empty-sub">No handoffs logged yet.</div></div>';return;}
    el.innerHTML=`<table class="prev-tbl"><thead><tr><th>Date</th><th>Child</th><th>Location</th><th>Scheduled</th><th>Actual</th><th>On Time?</th><th>Notes</th></tr></thead><tbody>
      ${S.handoffs.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8).map(h=>`<tr>
        <td>${fmtDate(h.date)}</td><td>${h.child||''}</td><td>${h.location||'—'}</td><td>${h.scheduled||''}</td>
        <td class="${h.ontime==='No'?'late':''}">${h.actual||''}</td>
        <td><span class="badge ${h.ontime==='Yes'?'b-sage':'b-red'}" style="font-size:10px">${h.ontime||''}</span></td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;color:var(--t3)">${h.notes||''}</td>
      </tr>`).join('')}</tbody></table>`;
  } else if(type==='expenses'){
    if(!S.expenses.length){el.innerHTML='<div class="empty" style="padding:24px"><div class="empty-sub">No expenses logged yet.</div></div>';return;}
    el.innerHTML=`<table class="prev-tbl"><thead><tr><th>Date</th><th>Child</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      ${S.expenses.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8).map(e=>`<tr>
        <td>${fmtDate(e.date)}</td><td>${e.child||''}</td><td>${e.category||''}</td><td>${e.desc||''}</td>
        <td style="font-weight:600">$${(+e.amount||0).toFixed(2)}</td>
        <td><span class="${e.status==='Pending'?'pending':e.status==='Paid'?'paid':''}">${e.status||''}</span></td>
      </tr>`).join('')}</tbody></table>`;
  } else if(type==='daily'){
    const all=[];
    S.dailylogs.forEach(d=>all.push({date:d.date,child:d.child,type:'Entry',detail:[d.breakfast,d.lunch,d.dinner].filter(Boolean).join(' / ')||d.notes||'—'}));
    (S.quickentries||[]).forEach(e=>{let det=e.notes||'';if(e.type==='food'&&(e.breakfast||e.lunch))det=[e.breakfast,e.lunch,e.dinner].filter(Boolean).join(' / ');all.push({date:e.date,child:e.child,type:e.type,detail:det});});
    all.sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(!all.length){el.innerHTML='<div class="empty" style="padding:24px"><div class="empty-sub">No daily entries yet.</div></div>';return;}
    el.innerHTML=`<table class="prev-tbl"><thead><tr><th>Date</th><th>Child</th><th>Type</th><th>Details</th></tr></thead><tbody>
      ${all.slice(0,10).map(e=>`<tr><td>${fmtDate(e.date)}</td><td>${e.child||''}</td><td><span class="badge b-lav" style="font-size:10px">${e.type}</span></td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${e.detail}</td></tr>`).join('')}</tbody></table>`;
  } else if(type==='comms'){
    if(!S.comms.length){el.innerHTML='<div class="empty" style="padding:24px"><div class="empty-sub">No communications logged yet.</div></div>';return;}
    el.innerHTML=`<table class="prev-tbl"><thead><tr><th>Date</th><th>Type</th><th>From</th><th>Topic</th></tr></thead><tbody>
      ${S.comms.slice().sort((a,b)=>new Date(b.dt||'')-new Date(a.dt||'')).slice(0,8).map(c=>`<tr>
        <td>${c.dt?fmtDate(c.dt.split('T')[0]):''}</td><td><span class="badge b-grey" style="font-size:10px">${c.type||''}</span></td><td>${c.by||''}</td><td>${c.topic||''}</td>
      </tr>`).join('')}</tbody></table>`;
  }
}

function copyPrivacyPolicy(){
  const el=document.getElementById('privacy-policy-text');
  if(!el)return;
  const text=el.innerText||el.textContent||'';
  if(navigator.clipboard){
    navigator.clipboard.writeText(text).then(()=>showToast('Privacy Policy copied to clipboard ✓','success'));
  } else showToast('Privacy Policy ready to copy','success');
}

// ─── PIN SETTINGS ────────────────────────────────────────────────────────────
function updatePinStatusUI(){
  const hasPin = !!localStorage.getItem('momos_pin');
  const statusEl = document.getElementById('pin-status-text');
  const changeBtn = document.getElementById('pin-change-btn');
  const removeBtn = document.getElementById('pin-remove-btn');
  const setupBtn = document.getElementById('pin-setup-btn');
  if(statusEl){
    statusEl.textContent = hasPin
      ? 'Your app is protected with a 4-digit PIN. Anyone who picks up your phone cannot access your data without it.'
      : 'No PIN set. Your app opens without any lock. Consider setting a PIN if others have access to your device.';
  }
  if(changeBtn) changeBtn.style.display = hasPin ? 'inline-flex' : 'none';
  if(removeBtn) removeBtn.style.display = hasPin ? 'inline-flex' : 'none';
  if(setupBtn) setupBtn.style.display = hasPin ? 'none' : 'inline-flex';
}

function setupPinFlow(){
  // Show PIN screen in setup mode
  pinMode = 'setup'; pinBuffer = '';
  document.getElementById('pin-title').textContent = 'Create a 4-digit PIN';
  document.getElementById('pin-sub').textContent = 'Choose a PIN only you know. You will need it every time you open MomOS.';
  document.getElementById('pin-forgot').innerHTML = '<span onclick="cancelPinSetup()" style="color:var(--t3);cursor:pointer;font-size:12px">Cancel</span>';
  document.getElementById('pin-forgot').style.display = 'block';
  updatePinDots();
  showPinScreen();
}

function cancelPinSetup(){
  hidePinScreen();
  document.getElementById('main-app').style.display = 'flex';
}

function changePinFlow(){
  // First verify old PIN, then set new one
  pinMode = 'change-verify'; pinBuffer = '';
  document.getElementById('pin-title').textContent = 'Enter current PIN';
  document.getElementById('pin-sub').textContent = 'Enter your current PIN to verify, then you can set a new one.';
  document.getElementById('pin-forgot').innerHTML = '<span onclick="cancelPinSetup()" style="color:var(--t3);cursor:pointer;font-size:12px">Cancel</span>';
  document.getElementById('pin-forgot').style.display = 'block';
  updatePinDots();
  showPinScreen();
}

function removePinFlow(){
  if(confirm('Remove PIN protection?\n\nYour app will open without a lock. Make sure your device itself is password protected.')){
    localStorage.removeItem('momos_pin');
    updatePinStatusUI();
    showToast('PIN removed','success');
  }
}

// ─── PRIVACY POLICY FUNCTIONS ────────────────────────────────────────────────
function deleteAllData(){
  if(!confirm('This will permanently delete ALL your MomOS data from this device — your budget, expenses, handoffs, daily logs, and everything else.\n\nThis cannot be undone. Have you downloaded your records first?\n\nTap OK to delete everything.')) return;
  const keys=['user','budget','expenses','handoffs','comms','dailylogs','quickentries','savings','children','transition'];
  keys.forEach(k=>localStorage.removeItem('momos_v2_'+k));
  showToast('All data deleted. Reloading app...','warn');
  setTimeout(()=>location.reload(), 2000);
}

function exportPrivacyPDF(){
  // Build a clean printable version of the policy
  const policyHTML=`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>MomOS Privacy Policy</title>
  <style>
    body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1C1C1C;line-height:1.7}
    h1{font-size:24px;color:#C15E7A;border-bottom:2px solid #C15E7A;padding-bottom:10px}
    h2{font-size:16px;color:#1C1C1C;margin-top:28px;margin-bottom:8px}
    p{margin:8px 0;font-size:14px;color:#444}
    ul{margin:8px 0;padding-left:20px}
    li{font-size:14px;color:#444;margin-bottom:4px}
    .meta{font-size:12px;color:#888;margin-bottom:24px}
    .highlight{background:#EBF4EE;border-left:3px solid #5C8F6E;padding:10px 14px;border-radius:4px;margin:12px 0}
    .warning{background:#F0EBFA;border-left:3px solid #7B5EA7;padding:10px 14px;border-radius:4px;margin:12px 0}
    @media print{body{margin:20px}}
  </style></head><body>
  <h1>💜 MomOS — Privacy Policy</h1>
  <div class="meta">Last updated: March 2026 · Version 1.0 · Document generated: ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>

  <h2>Who we are</h2>
  <p>MomOS is a personal co-parenting and budget management application designed for single mothers and parents navigating co-parenting situations, including those leaving difficult or abusive relationships. This app was created with your safety and privacy as the first priority.</p>

  <h2>What information this app stores</h2>
  <p>MomOS stores the following information <strong>only on your device</strong> using local storage:</p>
  <ul>
    <li>Your name and your co-parent's name (for personalisation only)</li>
    <li>Your children's names, dates of birth, school and medical information</li>
    <li>Budget and expense information (income, monthly expenses, logged expenses)</li>
    <li>Co-parenting records (handoffs, communications, custody calendar, daily logs)</li>
    <li>Transition planner progress</li>
  </ul>

  <div class="highlight">
  <h2 style="margin-top:0">Where your data lives — this is important</h2>
  <p><strong>All data is stored locally on your device only.</strong> In MomOS v1.0, your information is never sent to any server, cloud service, or third party. It does not leave your phone or computer.</p>
  <ul>
    <li>✓ We cannot see your data</li>
    <li>✓ We do not sell your data</li>
    <li>✓ We do not share your data with anyone</li>
    <li>✓ No account or email address is required</li>
    <li>⚠ If you clear your browser data or uninstall the app, your data will be deleted. Back up using Download Records regularly.</li>
  </ul>
  </div>

  <h2>Children's information</h2>
  <p>MomOS allows storage of information about minor children. This is stored entirely on your device and never transmitted externally. We comply with COPPA. The app is intended for use by parents and guardians only.</p>

  <div class="warning">
  <h2 style="margin-top:0">Sensitive and safety-related information</h2>
  <p>We understand many users may be in vulnerable situations. We strongly recommend:</p>
  <ul>
    <li>Use a device your co-parent or abuser does not have access to</li>
    <li>Set a PIN or Face ID lock on your device</li>
    <li>Regularly download your records to secure cloud storage</li>
    <li>If you need to leave quickly, export everything using Download Records</li>
  </ul>
  <p><strong>If you are in immediate danger: National DV Hotline 1-800-799-7233</strong></p>
  </div>

  <h2>Third-party services</h2>
  <p>MomOS v1.0 uses Google Fonts (fonts.googleapis.com) to load display fonts only. No personal data from MomOS is shared with Google. No analytics, advertising, or tracking services are used.</p>

  <h2>Your rights</h2>
  <ul>
    <li><strong>Access:</strong> All your data is visible within the app at any time</li>
    <li><strong>Export:</strong> Download Records feature exports everything as CSV</li>
    <li><strong>Delete:</strong> Clear browser/app data to permanently remove all MomOS data</li>
    <li><strong>Correction:</strong> Edit any entry directly within the app</li>
  </ul>

  <h2>Legal compliance</h2>
  <p><strong>GDPR:</strong> No personal data is transmitted from your device. If future versions add cloud sync, this policy will be updated and you will be notified before any data is transmitted.</p>
  <p><strong>CCPA:</strong> MomOS does not sell personal information.</p>
  <p><strong>COPPA:</strong> MomOS is not directed at children under 13. All users must be adults.</p>

  <h2>Changes to this policy</h2>
  <p>If we make significant changes — particularly if future versions introduce cloud sync — we will notify you prominently within the app before the change takes effect.</p>

  <h2>Contact us</h2>
  <p>Email: yestomomlife@gmail.com | Website: verdant-custard-e888c5.netlify.app</p>
  <p style="font-size:12px;color:#888;margin-top:24px;border-top:1px solid #eee;padding-top:12px">MomOS Privacy Policy v1.0 · Generated ${new Date().toLocaleDateString()}</p>
  <\/body><\/html>`;

  const blob=new Blob([policyHTML],{type:'text/html'});
  const url=URL.createObjectURL(blob);
  const w=window.open(url,'_blank');
  if(w){
    w.onload=()=>{ w.print(); };
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  showToast('Privacy policy opened — use Print → Save as PDF','success');
}


// ─── PIN LOCK SYSTEM ─────────────────────────────────────────────────────────
let pinBuffer = '';
let pinMode = 'enter'; // 'setup' | 'enter' | 'confirm'
let pinSetupTemp = '';

function initPin(){
  const stored = localStorage.getItem('momos_pin');
  if(stored){
    // Has a PIN — show lock screen
    pinMode = 'enter';
    document.getElementById('pin-title').textContent = 'Enter your PIN';
    document.getElementById('pin-sub').textContent = 'Your app is protected. Enter your 4-digit PIN to continue.';
    document.getElementById('pin-forgot').style.display = 'block';
    showPinScreen();
  } else if(localStorage.getItem('momos_v2_user')){
    // Returning user, no PIN set — go straight in
    hidePinScreen();
  } else {
    // Brand new user — onboarding will handle it
    hidePinScreen();
  }
}

function showPinScreen(){
  document.getElementById('pin-screen').classList.remove('hidden');
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('main-app').style.display = 'none';
}

function hidePinScreen(){
  document.getElementById('pin-screen').classList.add('hidden');
}

function pinKey(k){
  if(pinBuffer.length >= 4) return;
  pinBuffer += k;
  updatePinDots();
  if(pinBuffer.length === 4) setTimeout(checkPin, 120);
}

function pinDel(){
  pinBuffer = pinBuffer.slice(0,-1);
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
}

function updatePinDots(state=''){
  for(let i=0;i<4;i++){
    const dot = document.getElementById('pd-'+i);
    dot.className = 'pin-dot';
    if(i < pinBuffer.length) dot.classList.add(state || 'filled');
  }
}

function checkPin(){
  if(pinMode === 'enter'){
    const stored = localStorage.getItem('momos_pin');
    if(pinBuffer === stored){
      // Correct — enter app
      hidePinScreen();
      if(localStorage.getItem('momos_v2_user')){
        document.getElementById('main-app').style.display = 'flex';
        bootApp();
      } else {
        document.getElementById('onboarding').classList.remove('hidden');
      }
    } else {
      // Wrong PIN
      updatePinDots('error');
      document.getElementById('pin-error').textContent = 'Incorrect PIN. Try again.';
      setTimeout(()=>{
        pinBuffer = '';
        updatePinDots();
        document.getElementById('pin-error').textContent = '';
      }, 800);
    }
  } else if(pinMode === 'setup'){
    // First entry — store temp and ask to confirm
    pinSetupTemp = pinBuffer;
    pinBuffer = '';
    updatePinDots();
    pinMode = 'confirm';
    document.getElementById('pin-title').textContent = 'Confirm your PIN';
    document.getElementById('pin-sub').textContent = 'Enter the same 4-digit PIN again to confirm.';
    document.getElementById('pin-forgot').style.display = 'none';
  } else if(pinMode === 'change-verify'){
    const stored = localStorage.getItem('momos_pin');
    if(pinBuffer === stored){
      pinBuffer = ''; pinSetupTemp = '';
      pinMode = 'change-new'; updatePinDots();
      document.getElementById('pin-title').textContent = 'Enter new PIN';
      document.getElementById('pin-sub').textContent = 'Choose your new 4-digit PIN.';
    } else {
      updatePinDots('error');
      document.getElementById('pin-error').textContent = 'Incorrect PIN.';
      setTimeout(()=>{ pinBuffer=''; updatePinDots(); document.getElementById('pin-error').textContent=''; }, 800);
    }
  } else if(pinMode === 'change-new'){
    pinSetupTemp = pinBuffer; pinBuffer = '';
    updatePinDots(); pinMode = 'change-confirm';
    document.getElementById('pin-title').textContent = 'Confirm new PIN';
    document.getElementById('pin-sub').textContent = 'Enter your new PIN again to confirm.';
  } else if(pinMode === 'change-confirm'){
    if(pinBuffer === pinSetupTemp){
      localStorage.setItem('momos_pin', pinBuffer);
      hidePinScreen();
      document.getElementById('main-app').style.display = 'flex';
      updatePinStatusUI();
      showToast('PIN updated successfully 🔒','success');
    } else {
      updatePinDots('error');
      document.getElementById('pin-error').textContent = "PINs don't match. Try again.";
      setTimeout(()=>{ pinBuffer=''; pinSetupTemp=''; pinMode='change-new'; updatePinDots();
        document.getElementById('pin-title').textContent='Enter new PIN';
        document.getElementById('pin-error').textContent=''; }, 1000);
    }
  } else if(pinMode === 'confirm'){
    if(pinBuffer === pinSetupTemp){
      // PINs match — save and enter app
      localStorage.setItem('momos_pin', pinBuffer);
      hidePinScreen();
      showToast('PIN set successfully 🔒','success');
      document.getElementById('main-app').style.display = 'flex';
      bootApp();
    } else {
      // Mismatch
      updatePinDots('error');
      document.getElementById('pin-error').textContent = "PINs don't match. Starting over.";
      setTimeout(()=>{
        pinBuffer = ''; pinSetupTemp = '';
        pinMode = 'setup';
        updatePinDots();
        document.getElementById('pin-title').textContent = 'Create a 4-digit PIN';
        document.getElementById('pin-sub').textContent = 'This PIN protects your app. Choose something only you know.';
        document.getElementById('pin-error').textContent = '';
      }, 1000);
    }
  }
}

function pinForgot(){
  if(confirm('This will delete ALL your data and reset the app.\n\nMake sure you have downloaded your records first.\n\nAre you sure?')){
    const keys=['user','budget','expenses','handoffs','comms','dailylogs','quickentries','savings','children','transition'];
    keys.forEach(k=>localStorage.removeItem('momos_v2_'+k));
    localStorage.removeItem('momos_pin');
    showToast('App reset. Please set up again.','warn');
    setTimeout(()=>location.reload(), 1500);
  }
}

// Called at end of obFinish() — prompt to set a PIN
function promptPinSetup(){
  pinMode = 'setup';
  pinBuffer = '';
  document.getElementById('pin-title').textContent = 'Create a 4-digit PIN';
  document.getElementById('pin-sub').textContent = 'Protect your app with a PIN. Only you can open it.\n\nYou can skip this and set it later in Settings.';
  document.getElementById('pin-forgot').style.display = 'none';
  document.getElementById('pin-forgot').innerHTML = '<span onclick="skipPinSetup()" style="color:var(--t3);cursor:pointer;font-size:12px">Skip for now — set PIN later in Settings</span>';
  document.getElementById('pin-forgot').style.display = 'block';
  showPinScreen();
}

function skipPinSetup(){
  hidePinScreen();
  document.getElementById('main-app').style.display = 'flex';
  bootApp();
}

// ─── PHOTO SYSTEM ─────────────────────────────────────────────────────────────

// Current photos being added (temp store during form fill)
let currentExpPhotos = [];   // for expense form
let currentQAPhotos = [];    // for quick-add modal

function resizeAndEncodePhoto(file, maxPx=800){
  return new Promise((resolve)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      const img = new Image();
      img.onload = ()=>{
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if(w > maxPx || h > maxPx){
          if(w > h){ h = Math.round(h*maxPx/w); w = maxPx; }
          else{ w = Math.round(w*maxPx/h); h = maxPx; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function previewExpPhoto(input){
  const file = input.files[0]; if(!file) return;
  resizeAndEncodePhoto(file).then(b64=>{
    currentExpPhotos.push(b64);
    renderPhotoPreview('exp-photo-preview', currentExpPhotos, 'exp');
  });
  input.value = '';
}

function previewCommPhotos(input){
  // Allow multiple screenshots
  const files = Array.from(input.files);
  if(!files.length) return;
  const promises = files.map(f=>resizeAndEncodePhoto(f, 1200)); // higher res for screenshots
  Promise.all(promises).then(results=>{
    results.forEach(b64=>{ window._commPhotosTemp = window._commPhotosTemp||[]; window._commPhotosTemp.push(b64); });
    renderPhotoPreview('comm-photo-preview', window._commPhotosTemp, 'comm');
  });
  input.value='';
}

function previewQAPhoto(input){
  const file = input.files[0]; if(!file) return;
  resizeAndEncodePhoto(file).then(b64=>{
    currentQAPhotos.push(b64);
    renderPhotoPreview('qa-photo-preview', currentQAPhotos, 'qa');
  });
  input.value = '';
}

function renderPhotoPreview(containerId, photos, prefix){
  const el = document.getElementById(containerId); if(!el) return;
  el.innerHTML = photos.map((p,i)=>`
    <div class="photo-thumb">
      <img src="${p}" alt="Photo ${i+1}" onclick="openLightbox('${p}')">
      <div class="photo-thumb-del" onclick="removePhoto('${prefix}',${i})">✕</div>
    </div>`).join('');
}

function previewChildPhoto(input){
  const file = input.files[0]; if(!file) return;
  resizeAndEncodePhoto(file, 400).then(b64=>{
    window._childPhotoTemp = b64;
    const preview = document.getElementById('ch-photo-preview');
    if(preview){
      preview.innerHTML = `<img src="${b64}" style="width:100%;height:100%;object-fit:cover">`;
    }
    const btn = input.previousElementSibling;
    if(btn) btn.innerHTML = '<span style="font-size:15px">📷</span> Change photo';
  });
  input.value = '';
}

function removePhoto(prefix, idx){
  if(prefix==='exp'){ currentExpPhotos.splice(idx,1); renderPhotoPreview('exp-photo-preview',currentExpPhotos,'exp'); }
  else if(prefix==='comm'){ (window._commPhotosTemp||[]).splice(idx,1); renderPhotoPreview('comm-photo-preview',window._commPhotosTemp||[],'comm'); }
  else { currentQAPhotos.splice(idx,1); renderPhotoPreview('qa-photo-preview',currentQAPhotos,'qa'); }
}

function openLightbox(src){
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.remove('hidden');
}

function closeLightbox(){
  document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightbox-img').src = '';
}

// Keyboard ESC to close lightbox
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeLightbox(); });


// ─── DAY DETAIL SHEET ────────────────────────────────────────────────────────
let currentDaySheetDay = null;

function openDaySheet(day){
  currentDaySheetDay = day;
  const calData = getCalData();
  const year = calData.year;
  const month = calData.month;
  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  // Date label
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const d = new Date(year, month, day);
  document.getElementById('ds-date').textContent = `${months[month]} ${day}, ${year}`;
  document.getElementById('ds-dayname').textContent = weekdays[d.getDay()];

  // Who badge
  const owner = calData.days[day]||'unset';
  const whoEl = document.getElementById('ds-who');
  const userName = S.user?.name||'You';
  const coName = S.user?.coparent||'Co-parent';
  if(owner==='p1'){ whoEl.textContent=userName+"'s day"; whoEl.style.background='var(--rose-sf)'; whoEl.style.color='var(--rose-dk)'; }
  else if(owner==='p2'){ whoEl.textContent=coName+"'s day"; whoEl.style.background='var(--sage-sf)'; whoEl.style.color='var(--sage-dk)'; }
  else if(owner==='dev'){ whoEl.textContent='⚠️ Deviation'; whoEl.style.background='var(--red-sf)'; whoEl.style.color='var(--red)'; }
  else { whoEl.textContent='Not set'; whoEl.style.background='var(--surf3)'; whoEl.style.color='var(--t3)'; }

  // Update action buttons active state
  ['p1','p2','dev'].forEach(o=>{
    const btn=document.getElementById('cab-'+o);
    if(btn) btn.classList.toggle('active', owner===o);
  });

  // Build body content
  const body = document.getElementById('ds-body');
  let html = '';
  let hasAnything = false;

  // ── Handoffs ──
  const handoffs = S.handoffs.filter(h=>h.date===dateStr);
  if(handoffs.length){
    hasAnything=true;
    html+=`<div class="day-section-lbl">🤝 Handoffs</div>`;
    handoffs.forEach(h=>{
      const late=h.ontime==='No';
      html+=`<div class="day-entry-row">
        <div class="day-entry-ic">${late?'⚠️':'✓'}</div>
        <div class="day-entry-content">
          <div style="font-weight:600;color:${late?'var(--red)':'var(--sage)'}">${late?'Late handoff':'On time'} · ${h.child}</div>
          <div class="day-entry-meta">Scheduled ${h.scheduled} · Arrived ${h.actual}${h.location?' · '+h.location:''}</div>
          ${h.notes?`<div style="font-size:12px;color:var(--t2);margin-top:3px">${h.notes}</div>`:''}
        </div>
      </div>`;
    });
  }

  // ── Daily log entries ──
  const logs = S.dailylogs.filter(d=>d.date===dateStr);
  if(logs.length){
    hasAnything=true;
    html+=`<div class="day-section-lbl">📋 Daily log</div>`;
    logs.forEach(l=>{
      const meals=[l.breakfast&&'🍳 '+l.breakfast, l.lunch&&'🥪 '+l.lunch, l.dinner&&'🍽 '+l.dinner].filter(Boolean);
      html+=`<div class="day-entry-row">
        <div class="day-entry-ic">👧</div>
        <div class="day-entry-content">
          <div style="font-weight:600">${l.child} <span style="font-size:11px;color:var(--t3);font-weight:400">with ${l.parent}</span></div>
          ${meals.length?`<div class="day-entry-meta">${meals.join(' · ')}</div>`:''}
          ${l.activities?`<div class="day-entry-meta">🎨 ${l.activities}</div>`:''}
          ${l.mood?`<div class="day-entry-meta">${{'great':'😄','good':'😊','ok':'😐','upset':'😢','sick':'🤒'}[l.mood]||'😊'} Mood: ${l.mood}</div>`:''}
          ${l.hw&&l.hw!=='N/A'?`<div class="day-entry-meta">📚 Homework: ${l.hw}</div>`:''}
          ${l.bedtime?`<div class="day-entry-meta">🌙 Bedtime: ${l.bedtime}</div>`:''}
          ${l.notes?`<div style="font-size:12px;color:var(--t2);margin-top:4px;padding:6px 8px;background:var(--surf2);border-radius:var(--r-sm)">${l.notes}</div>`:''}
        </div>
      </div>`;
    });
  }

  // ── Quick entries ──
  const quick = (S.quickentries||[]).filter(e=>e.date===dateStr);
  if(quick.length){
    hasAnything=true;
    html+=`<div class="day-section-lbl">📝 Logged entries</div>`;
    const moodEmoji={'great':'😄','good':'😊','ok':'😐','upset':'😢','sick':'🤒'};
    quick.forEach(e=>{
      const icons={food:'🍽️',activity:'🎨',mood:'😊',note:'📝',medical:'🏥',milestone:'⭐'};
      let detail=e.notes||'';
      if(e.type==='food'){const meals=[];if(e.breakfast)meals.push(e.breakfast);if(e.lunch)meals.push(e.lunch);if(e.dinner)meals.push(e.dinner);detail=meals.join(' · ');}
      else if(e.type==='mood'&&e.mood){detail=(moodEmoji[e.mood]||'😊')+' '+e.mood+(e.notes?' — '+e.notes:'');}
      html+=`<div class="day-entry-row">
        <div class="day-entry-ic">${icons[e.type]||'📝'}</div>
        <div class="day-entry-content">
          <div style="font-weight:600">${e.type.charAt(0).toUpperCase()+e.type.slice(1)} · ${e.child||''}</div>
          <div class="day-entry-meta">${detail}</div>
          ${(e.photos||[]).length?`<div style="display:flex;gap:4px;margin-top:6px">${e.photos.map(p=>`<img src="${p}" style="width:48px;height:48px;border-radius:var(--r-sm);object-fit:cover;cursor:pointer" onclick="openLightbox('${p}')">`).join('')}</div>`:''}
        </div>
      </div>`;
    });
  }

  // ── Expenses ──
  const expenses = S.expenses.filter(e=>e.date===dateStr);
  if(expenses.length){
    hasAnything=true;
    html+=`<div class="day-section-lbl">💰 Expenses</div>`;
    expenses.forEach(e=>{
      html+=`<div class="day-entry-row">
        <div class="day-entry-ic">💰</div>
        <div class="day-entry-content">
          <div style="font-weight:600">${e.desc}</div>
          <div class="day-entry-meta">$${(+e.amount).toFixed(2)} · ${e.category} · Paid by ${e.paidBy}</div>
          ${e.reimbursement!=='No'?`<div class="day-entry-meta" style="color:var(--rose)">Reimbursement: ${e.reimbursement}</div>`:''}
        </div>
        <div style="font-size:14px;font-weight:700;color:var(--rose);flex-shrink:0">$${(+e.amount).toFixed(2)}</div>
      </div>`;
    });
  }

  // ── Communications ──
  const comms = S.comms.filter(c=>c.dt&&c.dt.startsWith(dateStr));
  if(comms.length){
    hasAnything=true;
    html+=`<div class="day-section-lbl">💬 Communications</div>`;
    comms.forEach(c=>{
      html+=`<div class="day-entry-row">
        <div class="day-entry-ic">💬</div>
        <div class="day-entry-content">
          <div style="font-weight:600">${c.topic}</div>
          <div class="day-entry-meta">${c.type} · ${c.by}</div>
          ${c.summary?`<div style="font-size:12px;color:var(--t2);margin-top:3px">${c.summary}</div>`:''}
          ${(c.photos||[]).length?`<div style="display:flex;gap:4px;margin-top:6px">${c.photos.map(p=>`<img src="${p}" style="width:48px;height:48px;border-radius:var(--r-sm);object-fit:cover;cursor:pointer" onclick="openLightbox('${p}')">`).join('')}</div>`:''}
        </div>
      </div>`;
    });
  }

  if(!hasAnything){
    html=`<div class="day-empty">
      <div style="font-size:28px;margin-bottom:8px">📅</div>
      <div style="font-weight:600;color:var(--t2);margin-bottom:4px">Nothing logged for this day</div>
      <div>Use the buttons below to add entries, handoffs, or expenses for this date.</div>
    </div>`;
  }

  body.innerHTML=html;

  // Show the sheet
  document.getElementById('day-sheet').classList.remove('hidden');
  document.body.style.overflow='hidden';
}

function closeDaySheet(e){
  if(e&&e.target!==document.getElementById('day-sheet')) return;
  document.getElementById('day-sheet').classList.add('hidden');
  document.body.style.overflow='';
  currentDaySheetDay=null;
}


// ─── CUSTODY SCHEDULE SETUP ──────────────────────────────────────────────────
let selectedPattern = '2-2-3';
let scheduleStartParent = 'p1';
let scheduleStartDay = 1;

const PATTERNS = {
  '2-2-3': {
    name: '2-2-3 Rotating',
    desc: 'Mon-Tue with one parent, Wed-Thu with other, Fri-Sun alternating',
    sequence: [2,2,3], // days per parent, repeating
    label: 'Most common for young kids'
  },
  'alt-week': {
    name: 'Alternating Weeks',
    desc: 'Full week with one parent, full week with other, alternating',
    sequence: [7,7],
    label: 'Common for school-age kids'
  },
  '3-4-4-3': {
    name: '3-4-4-3 Rotating',
    desc: '3 days, then 4 days, then 4 days, then 3 days, repeating',
    sequence: [3,4,4,3],
    label: 'More time with each parent'
  },
  '5-2': {
    name: '5-2 Split',
    desc: 'Weekdays with one parent, weekends with other',
    sequence: [5,2],
    label: 'Works well around school'
  },
  'custom': {
    name: 'Custom',
    desc: 'Set each day manually by tapping',
    sequence: [],
    label: 'Full control day by day'
  }
};

function openScheduleSetup(){
  const calData = getCalData();
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = months[calData.month];
  const daysInMonth = new Date(calData.year, calData.month+1, 0).getDate();
  const userName = S.user?.name || 'Me';
  const coName = S.user?.coparent || 'Co-parent';

  document.getElementById('modal-title').textContent = `Set ${monthName} Schedule`;

  document.getElementById('modal-body').innerHTML = `
    <div style="font-size:13px;color:var(--t2);margin-bottom:14px">
      Choose a custody pattern for <strong>${monthName} ${calData.year}</strong>. 
      This fills the whole month automatically. You can still tap individual days to make changes.
    </div>

    <div style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Custody pattern</div>
    <div class="schedule-pattern-grid" id="pattern-grid">
      ${Object.entries(PATTERNS).map(([key,p])=>`
        <div class="pattern-card ${key===selectedPattern?'selected':''}" onclick="selectPattern('${key}')">
          <div class="pattern-name">${p.name}</div>
          <div class="pattern-desc">${p.label}</div>
          ${key!=='custom'?`<div class="pattern-visual">${generatePatternVisual(p.sequence)}</div>`:''}
        </div>`).join('')}
    </div>

    <div id="custom-note" style="display:${selectedPattern==='custom'?'block':'none'};padding:10px 12px;background:var(--surf2);border-radius:var(--r-md);font-size:12px;color:var(--t2);margin-bottom:14px">
      Custom mode: close this and tap each day individually on the calendar to assign it.
    </div>

    <div id="pattern-options" style="display:${selectedPattern==='custom'?'none':'block'}">
      <div style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Who starts first?</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="cal-action-btn cab-p1 ${scheduleStartParent==='p1'?'active':''}" 
          id="start-p1-btn" onclick="setStartParent('p1')" style="flex:1;padding:10px">
          👤 ${userName} starts
        </button>
        <button class="cal-action-btn cab-p2 ${scheduleStartParent==='p2'?'active':''}" 
          id="start-p2-btn" onclick="setStartParent('p2')" style="flex:1;padding:10px">
          👤 ${coName} starts
        </button>
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Starting from day</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <select class="f-select" id="start-day-sel" onchange="scheduleStartDay=+this.value" style="flex:1">
          ${Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>`<option value="${d}" ${d===scheduleStartDay?'selected':''}>${monthName} ${d}</option>`).join('')}
        </select>
        <div style="font-size:12px;color:var(--t3)">Pattern begins here</div>
      </div>

      <div style="padding:10px 14px;background:var(--rose-sf);border-radius:var(--r-md);border-left:3px solid var(--rose);font-size:12px;color:var(--rose-dk);margin-bottom:4px">
        ⚠️ This will overwrite any days you've already set in ${monthName}. 
        Days marked as <strong>Deviation</strong> will be preserved.
      </div>
    </div>
  `;

  document.getElementById('modal-save-btn').textContent = selectedPattern==='custom' ? 'Got it' : 'Apply schedule';
  document.getElementById('modal-save-btn').onclick = () => {
    if(selectedPattern==='custom'){ closeModal(); return; }
    applySchedulePattern();
  };
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="modal-save-btn" onclick="${selectedPattern==='custom'?'closeModal()':'applySchedulePattern()'}">
      ${selectedPattern==='custom'?'Got it':'Apply schedule'}
    </button>`;
  openModal();
}

function generatePatternVisual(sequence){
  const colors=['var(--rose)','var(--sage)','var(--rose)','var(--sage)'];
  let html=''; let pIdx=0;
  sequence.forEach((days,si)=>{
    for(let i=0;i<days;i++){
      html+=`<div class="pv-block" style="background:${colors[si%2]}"></div>`;
    }
  });
  return html;
}

function selectPattern(key){
  selectedPattern=key;
  // Re-render modal body
  openScheduleSetup();
}

function setStartParent(parent){
  scheduleStartParent=parent;
  const calData=getCalData();
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  // Update button states
  const p1btn=document.getElementById('start-p1-btn');
  const p2btn=document.getElementById('start-p2-btn');
  if(p1btn) p1btn.classList.toggle('active',parent==='p1');
  if(p2btn) p2btn.classList.toggle('active',parent==='p2');
}

function applySchedulePattern(){
  const pattern = PATTERNS[selectedPattern];
  if(!pattern||!pattern.sequence.length){ closeModal(); return; }

  const calData = getCalData();
  const daysInMonth = new Date(calData.year, calData.month+1, 0).getDate();
  const startDay = scheduleStartDay || 1;
  const startParent = scheduleStartParent || 'p1';
  const sequence = pattern.sequence;

  // Build the pattern from startDay
  let currentParentIdx = startParent==='p1' ? 0 : 1; // 0=p1, 1=p2
  let seqIdx = 0;
  let daysInCurrentBlock = 0;

  // Figure out where we are in the sequence at startDay
  for(let day=1; day<=daysInMonth; day++){
    if(day < startDay) continue; // skip before start

    // Assign parent for this day — preserve deviations
    const existingOwner = calData.days[day];
    if(existingOwner !== 'dev'){ // preserve deviations
      calData.days[day] = currentParentIdx===0 ? 'p1' : 'p2';
    }

    daysInCurrentBlock++;
    if(daysInCurrentBlock >= sequence[seqIdx % sequence.length]){
      seqIdx++;
      currentParentIdx = currentParentIdx===0 ? 1 : 0;
      daysInCurrentBlock = 0;
    }
  }

  saveCalData(calData);
  buildCalendar('main-cal');
  closeModal();
  showToast(`${pattern.name} schedule applied ✓`,'success');
}

// ── ENHANCED setDayOwner — deviation detection ────────────────────────────────
// Override the existing setDayOwner to detect deviations automatically
const _originalSetDayOwner = window.setDayOwner;

function setDayOwner(owner){
  if(!currentDaySheetDay) return;
  const calData = getCalData();
  const existingOwner = calData.days[currentDaySheetDay];

  // Auto-deviation: if user is CHANGING from one parent to the other
  // and there was already a pattern assignment, flag as deviation
  if(owner !== 'unset' && owner !== 'dev' && existingOwner && existingOwner !== 'unset' && existingOwner !== owner && existingOwner !== 'dev'){
    // They're swapping from p1 to p2 or vice versa — this is a deviation
    // Ask if it's an agreed change or unexpected
    const userName = S.user?.name||'You';
    const coName = S.user?.coparent||'Co-parent';
    const fromLabel = existingOwner==='p1' ? userName : coName;
    const toLabel = owner==='p1' ? userName : coName;

    // Show deviation choice
    showDeviationChoice(currentDaySheetDay, existingOwner, owner, fromLabel, toLabel);
    return;
  }

  // Normal assignment — no deviation
  applyDayOwner(currentDaySheetDay, owner);
}

function showDeviationChoice(day, fromOwner, toOwner, fromLabel, toLabel){
  const calData = getCalData();
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateLabel = `${months[calData.month]} ${day}`;

  document.getElementById('modal-title').textContent = 'Schedule change';
  document.getElementById('modal-body').innerHTML = `
    <div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6">
      <strong>${dateLabel}</strong> is currently assigned to <strong>${fromLabel}</strong>.<br>
      You are changing it to <strong>${toLabel}</strong>.<br><br>
      Is this an agreed change or an unexpected deviation?
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-ghost w-full" style="justify-content:flex-start;gap:10px;padding:12px 14px;text-align:left" 
        onclick="applyDayOwnerAndClose(${day},'${toOwner}',false)">
        <span style="font-size:20px">🤝</span>
        <div>
          <div style="font-size:13px;font-weight:600">Agreed schedule change</div>
          <div style="font-size:11px;color:var(--t3)">Both parents agreed to swap this day</div>
        </div>
      </button>
      <button class="btn btn-ghost w-full" style="justify-content:flex-start;gap:10px;padding:12px 14px;text-align:left;border-color:var(--red-sf)" 
        onclick="applyDayOwnerAndClose(${day},'dev',false)">
        <span style="font-size:20px">⚠️</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--red)">Unexpected deviation</div>
          <div style="font-size:11px;color:var(--t3)">This was not agreed — log as deviation for court records</div>
        </div>
      </button>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = '<button class="btn btn-ghost w-full" onclick="closeModal()">Cancel</button>';
  openModal();
}

function applyDayOwnerAndClose(day, owner, wasDeviation){
  closeModal();
  currentDaySheetDay = day;
  applyDayOwner(day, owner);
  if(owner==='dev'){
    showToast('⚠️ Deviation logged — this day is flagged red','warn');
  }
}

function applyDayOwner(day, owner){
  const calData = getCalData();
  if(owner==='unset') delete calData.days[day];
  else calData.days[day] = owner;
  saveCalData(calData);
  buildCalendar('main-cal');

  // Update who badge in open day sheet
  const whoEl = document.getElementById('ds-who');
  if(whoEl){
    const userName = S.user?.name||'You';
    const coName = S.user?.coparent||'Co-parent';
    if(owner==='p1'){ whoEl.textContent=userName+"'s day"; whoEl.style.background='var(--rose-sf)'; whoEl.style.color='var(--rose-dk)'; }
    else if(owner==='p2'){ whoEl.textContent=coName+"'s day"; whoEl.style.background='var(--sage-sf)'; whoEl.style.color='var(--sage-dk)'; }
    else if(owner==='dev'){ whoEl.textContent='⚠️ Deviation'; whoEl.style.background='var(--red-sf)'; whoEl.style.color='var(--red)'; }
    else { whoEl.textContent='Not set'; whoEl.style.background='var(--surf3)'; whoEl.style.color='var(--t3)'; }
  }

  // Update action buttons active state
  ['p1','p2','dev'].forEach(o=>{
    const btn=document.getElementById('cab-'+o);
    if(btn) btn.classList.toggle('active', owner===o);
  });

  const userName = S.user?.name||'You';
  const coName = S.user?.coparent||'Co-parent';
  const labels = {p1:userName+"'s day", p2:coName+"'s day", dev:'Deviation marked', unset:'Day cleared'};
  showToast((labels[owner]||'Updated')+' ✓','success');
}



// ─── ANDROID PWA INSTALL ─────────────────────────────────────────────────────
// Android supports beforeinstallprompt — capture it for a better install experience
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // Stop auto mini-infobar
  deferredPrompt = e;
  // Show our custom install banner instead
  const dismissed = localStorage.getItem('momos_install_dismissed');
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  if(!dismissed || (Date.now() - +dismissed) > fourteenDays){
    setTimeout(()=>{
      const banner = document.getElementById('install-banner');
      if(banner) {
        banner.classList.remove('hidden');
        // Update banner for Android — can do one-tap install
        const btns = banner.querySelector('.install-banner-btns');
        if(btns) btns.innerHTML = `
          <button class="btn btn-primary" style="flex:1" onclick="androidInstall()">📲 Install app now</button>
          <button class="btn btn-ghost" onclick="dismissInstallBanner()">Not now</button>`;
      }
    }, 5000);
  }
});

function androidInstall(){
  if(deferredPrompt){
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choice=>{
      if(choice.outcome==='accepted'){
        showToast('MomOS installed! Check your home screen ✓','success');
        dismissInstallBanner();
      }
      deferredPrompt = null;
    });
  } else {
    showInstallGuide(); // Fall back to manual guide
  }
}

window.addEventListener('appinstalled', ()=>{
  showToast('MomOS installed successfully 💜','success');
  dismissInstallBanner();
  deferredPrompt = null;
});

// ─── INSTALL BANNER ──────────────────────────────────────────────────────────
function checkInstallBanner(){
  // Only show on mobile, only if not already installed as PWA
  const isInstalled = window.navigator.standalone === true ||
                      window.matchMedia('(display-mode: standalone)').matches;
  const dismissed = localStorage.getItem('momos_install_dismissed');
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if(isInstalled || !isMobile) return; // Already installed or desktop

  // Show after 30 seconds on first visit, or if not dismissed in 14 days
  const lastDismissed = dismissed ? +dismissed : 0;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  if(!dismissed || (Date.now() - lastDismissed) > fourteenDays){
    setTimeout(()=>{
      const banner = document.getElementById('install-banner');
      if(banner) banner.classList.remove('hidden');
    }, 8000); // Show after 8 seconds — let them see the app first
  }
}

function dismissInstallBanner(){
  localStorage.setItem('momos_install_dismissed', Date.now());
  const banner = document.getElementById('install-banner');
  if(banner) banner.classList.add('hidden');
}

function showInstallGuide(){
  document.getElementById('install-banner').classList.add('hidden');
  document.getElementById('install-guide').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideInstallGuide(){
  document.getElementById('install-guide').classList.add('hidden');
  document.body.style.overflow = '';
}


// ─── SAFETY CHECK-IN ─────────────────────────────────────────────────────────
function logSafetyCheckin(status){
  const now = new Date();
  const entry = {
    id: Date.now(),
    date: now.toISOString().split('T')[0],
    time: now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),
    status,
    timestamp: now.toISOString()
  };

  const checkins = lsGet('safety_checkins', []);
  checkins.unshift(entry);
  // Keep last 90 days
  lsSet('safety_checkins', checkins.slice(0, 90));
  lsSet('safety_last_checkin', now.toISOString().split('T')[0]);

  const body = document.getElementById('safety-checkin-body');
  if(status === 'safe'){
    body.innerHTML = `<div class="safety-logged safe">✓ Logged safe at ${entry.time} — ${entry.date}</div>
    <div style="font-size:11px;color:var(--t3);margin-top:6px;text-align:center">Come back tomorrow for your next check-in</div>`;
    showToast('Safety check-in logged ✓','success');
  } else {
    body.innerHTML = `<div class="safety-logged unsafe">⚠️ Logged at ${entry.time}</div>
    <div style="margin-top:10px;padding:12px;background:var(--red-sf);border-radius:var(--r-md);font-size:13px;color:var(--red)">
      <div style="font-weight:700;margin-bottom:6px">You are not alone. Help is available right now.</div>
      <div style="margin-bottom:8px">📞 <strong>National DV Hotline: 1-800-799-7233</strong><br>Free · 24/7 · Confidential · Call or text</div>
      <div style="font-size:12px">Text START to <strong>88788</strong> if you cannot call safely</div>
    </div>`;
    showToast('Help is available — 1-800-799-7233','warn');
  }
}

function initSafetyCheckin(){
  const lastCheckin = lsGet('safety_last_checkin', null);
  const today = new Date().toISOString().split('T')[0];
  const body = document.getElementById('safety-checkin-body');
  if(!body) return;

  if(lastCheckin === today){
    // Already checked in today
    const checkins = lsGet('safety_checkins', []);
    const todayEntry = checkins.find(c=>c.date===today);
    if(todayEntry){
      body.innerHTML = `<div class="safety-logged ${todayEntry.status}">${todayEntry.status==='safe'?'✓ Logged safe':'⚠️ Logged — help available'} at ${todayEntry.time}</div>
      ${todayEntry.status==='unsafe'?`<div style="margin-top:8px;font-size:12px;color:var(--red);font-weight:600">📞 DV Hotline: 1-800-799-7233</div>`:''}`;
    }
  }
  // else show buttons (default state)
}

// ─── BACKUP REMINDER ─────────────────────────────────────────────────────────
function checkBackupReminder(){
  const lastBackup = localStorage.getItem('momos_last_backup_check');
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const el = document.getElementById('backup-reminder');
  if(!el) return;
  // Show if never backed up or 7+ days since last dismissal
  if(!lastBackup || (now - +lastBackup) > sevenDays){
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

function dismissBackupReminder(){
  localStorage.setItem('momos_last_backup_check', Date.now());
  const el = document.getElementById('backup-reminder');
  if(el) el.style.display = 'none';
}


// ─── COURT-READY PDF EXPORT ───────────────────────────────────────────────────
function exportCourtPDF(type){
  const me = getUserName();
  const co = getCoName();
  const date = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const titles = {
    custody: 'Custody & Handoff Log',
    expenses: 'Expense & Reimbursement Log',
    comms: 'Communication Log',
    full: 'Complete Co-Parenting Record'
  };

  let bodyHTML = '';

  if(type==='custody'||type==='full'){
    const lates = S.handoffs.filter(h=>h.ontime==='No').length;
    bodyHTML += `
      <div class="pdf-section">
        <h2>Custody & Handoff Log</h2>
        <div class="pdf-summary">
          <span>Total handoffs: <strong>${S.handoffs.length}</strong></span>
          <span>On time: <strong>${S.handoffs.length-lates}</strong></span>
          <span>Late/missed: <strong style="color:red">${lates}</strong></span>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Child</th><th>Scheduled</th><th>Actual</th><th>On Time?</th><th>Notes</th></tr></thead>
          <tbody>
            ${S.handoffs.length ? S.handoffs.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(h=>`
              <tr class="${h.ontime==='No'?'late-row':''}">
                <td>${fmtDate(h.date)}</td>
                <td>${h.child||''}</td>
                <td>${h.scheduled||''}</td>
                <td><strong>${h.actual||''}</strong></td>
                <td>${h.ontime==='No'?'<span class="late-flag">LATE</span>':'✓'}</td>
                <td>${h.notes||''}</td>
              </tr>`).join('') : '<tr><td colspan="6">No handoffs logged</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  if(type==='expenses'||type==='full'){
    const total = S.expenses.reduce((a,e)=>a+(+e.amount||0),0);
    const pending = S.expenses.filter(e=>e.status==='Pending').reduce((a,e)=>{
      return a+(+e.amount||0)*(e.reimbursement==='Yes — 50/50'?0.5:1);
    },0);
    bodyHTML += `
      <div class="pdf-section">
        <h2>Expense & Reimbursement Log</h2>
        <div class="pdf-summary">
          <span>Total expenses: <strong>$${total.toFixed(2)}</strong></span>
          <span>Pending reimbursement from ${co}: <strong style="color:#C15E7A">$${pending.toFixed(2)}</strong></span>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Paid By</th><th>Reimbursement</th><th>Status</th></tr></thead>
          <tbody>
            ${S.expenses.length ? S.expenses.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e=>`
              <tr>
                <td>${fmtDate(e.date)}</td>
                <td>${e.desc||''}</td>
                <td>${e.category||''}</td>
                <td><strong>$${(+e.amount||0).toFixed(2)}</strong></td>
                <td>${e.paidBy||''}</td>
                <td>${e.reimbursement||'No'}</td>
                <td>${e.status==='Pending'?'<span class="pending-flag">PENDING</span>':e.status||''}</td>
              </tr>`).join('') : '<tr><td colspan="7">No expenses logged</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  if(type==='comms'||type==='full'){
    bodyHTML += `
      <div class="pdf-section">
        <h2>Communication Log</h2>
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>From</th><th>Topic</th><th>Summary</th></tr></thead>
          <tbody>
            ${S.comms.length ? S.comms.slice().sort((a,b)=>new Date(b.dt||'')-new Date(a.dt||'')).map(c=>{
              const dt=c.dt||''; const d=dt?fmtDate(dt.split('T')[0]):''; const t=dt.includes('T')?dt.split('T')[1].substring(0,5):'';
              return `<tr><td>${d}</td><td>${t}</td><td>${c.type||''}</td><td>${c.by||''}</td><td>${c.topic||''}</td><td>${c.summary||''}</td></tr>`;
            }).join('') : '<tr><td colspan="6">No communications logged</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>MomOS — ${titles[type]||'Records'}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Georgia,serif;color:#1C1C1C;padding:30px;font-size:12px;line-height:1.5}
    .pdf-header{border-bottom:3px solid #C15E7A;padding-bottom:16px;margin-bottom:20px}
    .pdf-header h1{font-size:20px;color:#C15E7A;margin-bottom:4px}
    .pdf-meta{font-size:11px;color:#666;display:flex;gap:20px;flex-wrap:wrap;margin-top:8px}
    .pdf-meta span{display:flex;gap:4px}
    .pdf-disclaimer{font-size:10px;color:#888;border:1px solid #ddd;padding:8px 10px;border-radius:4px;margin-bottom:20px;line-height:1.6}
    .pdf-section{margin-bottom:28px}
    .pdf-section h2{font-size:15px;color:#1C1C1C;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #ddd}
    .pdf-summary{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:10px;padding:8px 10px;background:#f9f4f6;border-radius:4px;font-size:11px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#f2edf0;padding:6px 8px;text-align:left;border:1px solid #ddd;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.04em}
    td{padding:6px 8px;border:1px solid #eee;vertical-align:top}
    tr:nth-child(even) td{background:#fafafa}
    .late-row td{background:#fdeaea!important}
    .late-flag{color:red;font-weight:700;font-size:10px}
    .pending-flag{color:#C15E7A;font-weight:700;font-size:10px}
    .pdf-footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#888;text-align:center}
    @media print{body{padding:15px}.pdf-header{page-break-after:avoid}table{page-break-inside:auto}tr{page-break-inside:avoid}}
  </style></head><body>
  <div class="pdf-header">
    <h1>MomOS — ${titles[type]||'Records'}</h1>
    <div class="pdf-meta">
      <span>Prepared by: <strong>${me}</strong></span>
      <span>Co-parent: <strong>${co}</strong></span>
      <span>Generated: <strong>${date}</strong></span>
      <span>Total records: <strong>${S.handoffs.length + S.expenses.length + S.comms.length}</strong></span>
    </div>
  </div>
  <div class="pdf-disclaimer">
    ⚠️ <strong>Legal disclaimer:</strong> This document was generated by MomOS, a personal organisation tool. It does not constitute legal advice or official court documentation. All entries are user-entered. Please consult a qualified family law attorney for legal matters. This document may be used as supporting evidence when presented alongside proper legal counsel.
  </div>
  ${bodyHTML}
  <div class="pdf-footer">MomOS Co-Parenting Documentation Tool · Generated ${date} · All data stored privately on user device · yestomomlife@gmail.com</div>
  <\/body><\/html>`;

  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if(w){
    w.onload = ()=>{ setTimeout(()=>w.print(), 500); };
    setTimeout(()=>URL.revokeObjectURL(url), 120000);
  }
  showToast('PDF ready — use Print → Save as PDF','success');
}


// ─── MONTHLY TREND TRACKING ───────────────────────────────────────────────────
function saveMonthlySnapshot(){
  // Called when budget is saved — stores this month's totals
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const inc = INC_FIELDS.reduce((a,f)=>a+(S.budget[f]||0),0);
  const exp = EXP_FIELDS.reduce((a,f)=>a+(S.budget[f]||0),0);
  if(inc===0 && exp===0) return;
  const history = lsGet('monthly_history', {});
  history[key] = {inc, exp, sur:inc-exp};
  lsSet('monthly_history', history);
  lsSet('prev_month_exp', exp); // for trend arrow
}

function buildSparkline(){
  const history = lsGet('monthly_history', {});
  const keys = Object.keys(history).sort().slice(-6); // last 6 months
  if(keys.length < 2) return ''; // need at least 2 points

  const w = 280, h = 60, pad = 10;
  const incVals = keys.map(k=>history[k].inc);
  const expVals = keys.map(k=>history[k].exp);
  const allVals = [...incVals, ...expVals];
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;

  const toY = v => pad + (h - pad*2) * (1 - (v - minVal) / range);
  const toX = (i, total) => pad + (w - pad*2) * (i / (total-1));

  const incPath = keys.map((k,i)=>`${i===0?'M':'L'}${toX(i,keys.length).toFixed(1)},${toY(incVals[i]).toFixed(1)}`).join(' ');
  const expPath = keys.map((k,i)=>`${i===0?'M':'L'}${toX(i,keys.length).toFixed(1)},${toY(expVals[i]).toFixed(1)}`).join(' ');

  const months = keys.map(k=>{
    const [y,m]=k.split('-');
    return new Date(+y,+m-1,1).toLocaleDateString('en-US',{month:'short'});
  });

  return `<div style="margin-top:12px">
    <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">6-month trend</div>
    <svg viewBox="0 0 ${w} ${h+20}" style="width:100%;height:auto;display:block">
      <!-- Income line -->
      <path d="${incPath}" fill="none" stroke="var(--sage)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Expense line -->
      <path d="${expPath}" fill="none" stroke="var(--rose)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4,2"/>
      <!-- Month labels -->
      ${months.map((m,i)=>`<text x="${toX(i,keys.length).toFixed(1)}" y="${h+16}" text-anchor="middle" font-size="9" fill="#9A9A9A">${m}</text>`).join('')}
      <!-- Dots on latest -->
      <circle cx="${toX(keys.length-1,keys.length).toFixed(1)}" cy="${toY(incVals[incVals.length-1]).toFixed(1)}" r="3" fill="var(--sage)"/>
      <circle cx="${toX(keys.length-1,keys.length).toFixed(1)}" cy="${toY(expVals[expVals.length-1]).toFixed(1)}" r="3" fill="var(--rose)"/>
    </svg>
    <div style="display:flex;gap:16px;justify-content:center;margin-top:4px">
      <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--sage)"><div style="width:16px;height:2px;background:var(--sage);border-radius:1px"></div>Income</div>
      <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--rose)"><div style="width:16px;height:2px;background:var(--rose);border-radius:1px;border-top:2px dashed var(--rose)"></div>Expenses</div>
    </div>
  </div>`;
}

// ─── MOBILE MORE MENU ────────────────────────────────────────────────────────
function showMobileMenu(){
  const m=document.getElementById('mobile-more-menu');
  if(m) m.style.display=m.style.display==='none'?'block':'none';
}
function hideMobileMenu(){
  const m=document.getElementById('mobile-more-menu');
  if(m) m.style.display='none';
  document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('bn-plan')?.classList.add('active');
}

// ─── SERVICE WORKER REGISTRATION ────────────────────────────────────────────
// Service worker disabled - using direct loading for reliability
if('serviceWorker' in navigator){
  // Unregister ALL service workers to clear any cached broken versions
  navigator.serviceWorker.getRegistrations().then(regs=>{
    regs.forEach(reg=>reg.unregister());
  });
}

// ─── INIT ────────────────────────────────────────────────────────────────────
function initApp(){
  if(window._appInitDone) return; // prevent double init
  window._appInitDone = true;

  // Build static content immediately — no user data needed
  buildTemplates();
  buildCalendar('main-cal');
  if(!S.transition) S.transition=[...TRANS_DEFAULTS.map(t=>({...t}))];
  buildTransition();

  const hasPin = !!localStorage.getItem('momos_pin');
  const hasUser = !!localStorage.getItem('momos_v2_user');

  if(hasPin){
    // Show PIN screen
    initPin();
  } else if(hasUser){
    // Returning user — go straight to app
    const ob = document.getElementById('onboarding');
    if(ob){ ob.style.display='none'; ob.classList.add('hidden'); }
    const app = document.getElementById('main-app');
    if(app){ app.style.display='flex'; app.style.visibility='visible'; }
    bootApp();
  } else {
    // New user — show onboarding step 1
    const ob = document.getElementById('onboarding');
    if(ob){ ob.style.display='flex'; ob.classList.remove('hidden'); }
    const app = document.getElementById('main-app');
    if(app){ app.style.display='none'; }
    // Force step 1 visible
    const ob1 = document.getElementById('ob-1');
    if(ob1){ ob1.style.display='flex'; ob1.classList.add('active'); }
    document.querySelectorAll('.ob-step').forEach(s=>{
      if(s.id !== 'ob-1'){ s.style.display='none'; s.classList.remove('active'); }
    });
  }
}

// ─── LAUNCH ──────────────────────────────────────────────────────────────────
function startMomOS(){
  if(window._appStarted) return;
  window._appStarted = true;
  var ob1 = document.getElementById('ob-1');
  if(ob1){ ob1.style.display='flex'; ob1.classList.add('active'); }
  initApp();
}

// Fire on DOMContentLoaded, load, and immediately if already ready
document.addEventListener('DOMContentLoaded', startMomOS);
window.addEventListener('load', startMomOS);
window.addEventListener('pageshow', function(e){ if(e.persisted) startMomOS(); });
if(document.readyState !== 'loading') startMomOS();
}
