const STORAGE_KEY = 'kubera-warhunt-v1';
const defaultSettings = {
  bankroll: 30000, targetDollar: 500, targetPercent: 1.67, stopLoss: 2000,
  min: 100, max: 3000, coin: 100, targetNum: 500, keypadMode: 'combined',
  maxSteps: 30, reserve: 20000, capRule: 'on'
};

const titles = {sangram:'⚔ SANGRAM', vyuha:'🛡 VYUHA', granth:'📜 GRANTH', drishti:'👁 DRISHTI', sopana:'🪜 SOPANA', yantra:'⚙ YANTRA', medha:'🧠 MEDHA'};
let state = loadState();
let pending = {Y:null, K:null};
let historyStack = [];
let deferredPrompt;

function freshNumber(){return {status:'I', step:0, ladder:1, activeAt:null, prevLoss:0, winningBet:0, lastNet:0, locked:false, capReturned:false};}
function createSide(){ const s={}; for(let i=1;i<=9;i++) s[i]=freshNumber(); return s; }
function freshState(){
  return {
    settings:{...defaultSettings}, liveBankroll: defaultSettings.bankroll, currentChakra:0,
    numbers:{Y:createSide(), K:createSide()}, history:[], drishti:[], granth:[], currentKumbh:null,
    summary:{totalAhuti:0,maxExposure:0}, ladder: buildLadder(defaultSettings.min, defaultSettings.max, defaultSettings.coin, defaultSettings.maxSteps),
  };
}
function loadState(){
  try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw){ const parsed = JSON.parse(raw); return reviveState(parsed);} }catch{}
  return freshState();
}
function reviveState(s){
  const base = freshState();
  return {
    ...base, ...s,
    settings:{...defaultSettings, ...(s.settings||{})},
    numbers:s.numbers || base.numbers,
    summary:{...base.summary, ...(s.summary||{})},
    ladder:s.ladder || buildLadder((s.settings||defaultSettings).min,(s.settings||defaultSettings).max,(s.settings||defaultSettings).coin,(s.settings||defaultSettings).maxSteps||30),
  };
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function buildLadder(minBet,maxBet,coin,maxSteps){
  const rows=[]; let current=minBet; let losses=0;
  for(let step=1; step<=maxSteps; step++){
    if(step===1){ current = minBet; }
    else {
      const prevBet = rows[rows.length-1].bet;
      const prevLosses = rows[rows.length-1].ifLoseTotal * -1;
      const canStay = (prevBet*9) - prevLosses >= state?.settings?.targetNum || ((prevBet*9) - prevLosses >= defaultSettings.targetNum);
      current = canStay ? prevBet : Math.min(maxBet, prevBet*2);
      current = Math.ceil(current/coin)*coin;
      current = Math.min(current,maxBet);
    }
    losses += current;
    rows.push({step:`S${step}`, bet:current, winReturn:current*9, netProfit:(current*9)-losses, ifLoseTotal:-losses});
  }
  return rows;
}
function secondLadderBet(step){
  const start = Math.ceil((state.settings.max/4)/state.settings.coin)*state.settings.coin;
  if(step<=5) return start;
  if(step<=10) return Math.min(state.settings.max, start*2);
  if(step<=15) return Math.min(state.settings.max, start*3);
  return state.settings.max;
}

function fmtMoney(n){ return '₹ ' + Number(n).toLocaleString('en-IN'); }
function fmtShort(n){ return Number.isInteger(n) ? `${n}` : n.toFixed(2); }
function q(id){ return document.getElementById(id); }

function setupInstall(){
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; q('installBtn').classList.remove('hidden'); });
  q('installBtn').addEventListener('click', async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; q('installBtn').classList.add('hidden'); });
  if('serviceWorker' in navigator) window.addEventListener('load', ()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
}

function renderBoards(){ ['Y','K'].forEach(side=>{
  const host = q(side==='Y'?'boardY':'boardK'); if(!host.dataset.ready){ host.innerHTML=''; for(let i=1;i<=10;i++){ const n=i===10?0:i; const b=document.createElement('button'); b.className='tile'+(n===0?' zero':''); b.dataset.side=side; b.dataset.num=n; b.addEventListener('click', ()=>handleTap(side,n)); host.appendChild(b);} host.dataset.ready='1'; }
  Array.from(host.children).forEach(el=>{ const n=Number(el.dataset.num); if(n===0){ el.className='tile zero'; el.innerHTML=`<div class="num">0</div><div class="meta">0</div>`; return; }
    const info=state.numbers[side][n]; const metaClass = info.step?`step${Math.min(info.step,6)}`:'';
    let code = info.status;
    if(info.status==='A' && info.step>0) code = `S${info.step}`;
    el.className=`tile state-${info.status}` + (n===0?' zero':'');
    el.innerHTML=`<div class="num">${n}</div><div class="meta ${metaClass}">${code}</div>`;
  });
 });
}
function renderVyuha(){ ['Y','K'].forEach(side=>{ const host=q(side==='Y'?'vyuhaY':'vyuhaK'); host.innerHTML=''; for(let n=1;n<=9;n++){ const info=state.numbers[side][n]; const code = info.status==='A'?`S${info.step}`:info.status; const div=document.createElement('div'); div.className='state-cell'; div.innerHTML=`<div class="num">${n}</div><div class="meta">${code}</div>`; host.appendChild(div);} }); }
function renderSangram(){ q('bankValue').textContent = fmtMoney(state.liveBankroll); q('chakraValue').textContent = `Round : ${state.currentChakra}`;
  q('nextY').textContent = formatNextAhuti('Y'); q('nextK').textContent = formatNextAhuti('K'); q('nextT').textContent = `T ${fmtShort(nextExposureTotal())}`; }
function formatNextAhuti(side){
  const groups = new Map();
  for(let n=1;n<=9;n++){
    const info=state.numbers[side][n];
    if(info.status==='A' || info.status==='B'){
      const bet = currentBetFor(info);
      if(!groups.has(bet)) groups.set(bet, []);
      groups.get(bet).push(`${n}(S${info.step})`);
    }
  }
  const parts = [...groups.entries()].sort((a,b)=>b[0]-a[0]).map(([bet,arr])=>`${bet} on ${arr.join(' ')}`);
  return `${side} ${parts.join(' | ') || '-'}`;
}
function currentBetFor(info){
  if(info.ladder===2) return secondLadderBet(info.step||1);
  const idx = Math.max(0,(info.step||1)-1);
  return state.ladder[idx]?.bet || state.settings.max;
}
function nextExposureTotal(){ let t=0; ['Y','K'].forEach(side=>{ for(let n=1;n<=9;n++){ const info=state.numbers[side][n]; if(info.status==='A' || info.status==='B') t += currentBetFor(info); }}); return t; }
function renderGranth(){ const host=q('granthList'); host.innerHTML=''; const kumbhs=[...(state.granth||[])].reverse(); if(!kumbhs.length){ host.innerHTML='<div class="kumbh">No Kumbh history yet.</div>'; return; }
  kumbhs.forEach(k=>{ const wrap=document.createElement('div'); wrap.className='kumbh'; let rows=[...k.rows].reverse().map(r=>`<tr><td>${r.chakra}</td><td>${r.y??'-'}</td><td>${r.k??'-'}</td><td>${r.ahuti}</td><td>${r.axyapatra}</td></tr>`).join(''); wrap.innerHTML=`<div class="label">#${String(k.id).padStart(2,'0')} Kumbh</div><div class="table-wrap"><table><thead><tr><th>Chakra</th><th>Y</th><th>K</th><th>Āhuti</th><th>Axyapatra</th></tr></thead><tbody>${rows}</tbody></table></div>`; host.appendChild(wrap);}); }
function renderDrishti(){ q('sumChakras').textContent = state.currentChakra; q('sumAhuti').textContent = state.summary.totalAhuti; q('sumProfit').textContent = (state.liveBankroll - state.settings.bankroll); q('sumExposure').textContent = state.summary.maxExposure;
  const tb=q('drishtiTable').querySelector('tbody'); tb.innerHTML=''; [...state.drishti].reverse().forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.side}</td><td>${r.number}</td><td>${r.activationChakra}</td><td>${r.winChakra}</td><td>${r.steps}</td><td>${r.prevLoss}</td><td>${r.winBet}</td><td>${r.net}</td><td>${r.status}</td>`; tb.appendChild(tr);}); }
function renderSopana(){ const tb=q('ladderTable').querySelector('tbody'); tb.innerHTML=''; state.ladder.forEach((r,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.step}</td><td><input type="number" data-ladder-index="${idx}" value="${r.bet}"></td><td>${r.winReturn}</td><td>${r.netProfit}</td><td>${r.ifLoseTotal}</td>`; tb.appendChild(tr); }); }
function renderYantra(){ const s=state.settings; q('setBankroll').value=s.bankroll; q('setTargetDollar').value=s.targetDollar; q('setTargetPercent').value=s.targetPercent; q('setStopLoss').value=s.stopLoss; q('setMin').value=s.min; q('setMax').value=s.max; q('setCoin').value=s.coin; q('setTargetNum').value=s.targetNum; q('setKeypadMode').value=s.keypadMode; q('setMaxSteps').value=s.maxSteps; q('setReserve').value=s.reserve; q('setCapRule').value=s.capRule; }
function renderMedha(){
  const active = []; const cap=[]; ['Y','K'].forEach(side=>{ for(let n=1;n<=9;n++){ const info=state.numbers[side][n]; if(info.status==='A' || info.status==='B') active.push(`${side}${n} S${info.step}`); if(info.status==='C') cap.push(`${side}${n}`); }});
  q('medhaPanel').innerHTML = `<div class="medha-item"><div class="label">Active Formation</div><div>${active.join(' | ') || 'None'}</div></div><div class="medha-item"><div class="label">CAP Numbers</div><div>${cap.join(' | ') || 'None'}</div></div>`;
}
function renderAll(){ renderBoards(); renderVyuha(); renderSangram(); renderGranth(); renderDrishti(); renderSopana(); renderYantra(); renderMedha(); saveState(); }

function showToast(title, text, kind=''){ const layer=q('toastLayer'); const el=document.createElement('div'); el.className=`toast ${kind}`; el.innerHTML=`<div class="title">${title}</div><div>${text}</div>`; layer.appendChild(el); setTimeout(()=>el.remove(),3900); }

function ensureKumbh(){ if(!state.currentKumbh){ const nextId = (state.granth.at(-1)?.id || 0) + 1; state.currentKumbh = {id:nextId, rows:[]}; state.granth.push(state.currentKumbh);} }
function startPrayoga(){ if(state.currentKumbh?.rows?.length || state.currentChakra===0){ ensureKumbh(); } else { ensureKumbh(); } showToast('SANGRAM AARAMBHA', `#${String(state.currentKumbh.id).padStart(2,'0')} Kumbh ready`); renderAll(); }
function clearCurrentSession(){ state.liveBankroll = state.settings.bankroll; state.currentChakra = 0; state.numbers = {Y:createSide(), K:createSide()}; state.drishti = []; state.summary={totalAhuti:0,maxExposure:0}; pending={Y:null,K:null}; if(state.currentKumbh){ state.currentKumbh.rows=[]; } showToast('KUMBHA SHUDDHI', 'Current session cleared'); renderAll(); }
function recordSnapshot(){ historyStack.push(JSON.stringify(state)); if(historyStack.length>20) historyStack.shift(); }
function undoLast(){ const prev=historyStack.pop(); if(!prev) return; state=reviveState(JSON.parse(prev)); renderAll(); showToast('CHAKRA PUNARAVRITTI', 'Last chakra reverted'); }

function handleTap(side,num){ if(num===0){ processRound(side,0); return; }
  if(state.settings.keypadMode==='combined'){
    pending[side]=num;
    const other = side==='Y'?'K':'Y';
    showToast(`${side} SELECTED`, `${side}${num} ready`, '');
    if(pending[side]!==null && pending[other]!==null){ processRound('both', {Y:pending.Y, K:pending.K}); pending={Y:null,K:null}; }
  } else {
    processRound(side,num);
  }
}

function processRound(mode,payload){
  recordSnapshot();
  ensureKumbh();
  const round = {y:null,k:null};
  let roundExposure = nextExposureTotal();
  const notes=[];
  if(mode==='both'){ round.y=payload.Y; round.k=payload.K; processSide('Y', payload.Y, notes); processSide('K', payload.K, notes); }
  else if(mode==='Y'){ round.y=payload; processSide('Y', payload, notes); }
  else if(mode==='K'){ round.k=payload; processSide('K', payload, notes); }
  state.currentChakra += 1;
  if(roundExposure>0){ state.liveBankroll -= roundExposure; state.summary.totalAhuti += roundExposure; state.summary.maxExposure = Math.max(state.summary.maxExposure, roundExposure); }
  // add winning returns after deduction
  notes.filter(n=>n.type==='win').forEach(n=>{ state.liveBankroll += n.returnAmount; });
  state.currentKumbh.rows.push({chakra:state.currentChakra, y:round.y, k:round.k, ahuti:roundExposure, axyapatra:state.liveBankroll});
  if(state.liveBankroll <= state.settings.bankroll - state.settings.stopLoss || state.liveBankroll < state.settings.reserve){ showToast('TREASURY WARNING', 'Axyapatra approaching Raksha Rekha', 'warn'); }
  notes.forEach(n=>{
    if(n.type==='win') showToast('VIJAY DARSHANA', `${n.side}${n.number} won at S${n.step} | Āhuti ${n.bet} | Net ${n.net>0?'+':''}${n.net}`, 'win');
    if(n.type==='capreturn') showToast('CAP RETURNED', `${n.side}${n.number} now B → second ladder from next chakra`, 'cap');
    if(n.type==='cap') showToast('REKHA BANDHA', `${n.side}${n.number} entered CAP`, 'warn');
  });
  renderAll();
}

function processSide(side,result,notes){
  if(result===0 || result==null){ applyZero(side); return; }
  // locked acts as zero
  const hit = state.numbers[side][result];
  if(hit.status==='L'){ applyZero(side); return; }
  // advance all active numbers on non-winning result after handling winner/cap return cases
  // Winner / activation / capreturn for hit number
  if(hit.status==='I'){
    hit.status='A'; hit.step=1; hit.ladder=1; hit.activeAt=state.currentChakra+1; hit.prevLoss=0; hit.winningBet=0; hit.lastNet=0;
  } else if(hit.status==='A' || hit.status==='B'){
    const bet = currentBetFor(hit); const totalSpent = hit.prevLoss + bet; const returnAmt = bet*9; const net = returnAmt - totalSpent;
    hit.status='L'; hit.winningBet = bet; hit.lastNet = net; state.drishti.push({side, number:result, activationChakra:hit.activeAt ?? '-', winChakra:state.currentChakra+1, steps:hit.step, prevLoss:hit.prevLoss, winBet:bet, net, status:'WIN'});
    notes.push({type:'win', side, number:result, step:hit.step, bet, net, returnAmount:returnAmt});
  } else if(hit.status==='C'){
    hit.status='B'; hit.step=1; hit.ladder=2; hit.activeAt=state.currentChakra+1; hit.prevLoss=0; notes.push({type:'capreturn', side, number:result});
  }
  // advance and lose all other active/back-on-track numbers except the winner/hit if it just won/activated
  for(let n=1;n<=9;n++){
    if(n===result) continue;
    const info=state.numbers[side][n];
    if(info.status==='A' || info.status==='B') loseStep(side,n,info,notes);
  }
}
function applyZero(side){ for(let n=1;n<=9;n++){ const info=state.numbers[side][n]; if(info.status==='A' || info.status==='B') loseStep(side,n,info,[]); } }
function loseStep(side,n,info,notes){ const bet=currentBetFor(info); info.prevLoss += bet; info.step += 1;
  if(info.ladder===1){
    if(info.step > state.settings.maxSteps || (bet>=state.settings.max && state.settings.capRule==='on')){
      info.status='C'; info.step = state.settings.maxSteps; state.drishti.push({side, number:n, activationChakra:info.activeAt ?? '-', winChakra:'-', steps:state.settings.maxSteps, prevLoss:info.prevLoss, winBet:'-', net:-info.prevLoss, status:'CAP'}); notes?.push?.({type:'cap', side, number:n});
    }
  } else if(info.ladder===2){
    if(info.step > 15) info.step = 15;
    info.status='B';
  }
}

function setupTabs(){ document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click', ()=>switchTab(btn.dataset.target))); }
function switchTab(target){ document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active', b.dataset.target===target)); document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active', s.id===`screen-${target}`)); q('screenTitle').textContent = titles[target]; }
function setupControls(){
  q('prayogaBtn').addEventListener('click', startPrayoga); q('kumbhaBtn').addEventListener('click', clearCurrentSession); q('undoBtn').addEventListener('click', undoLast);
  q('applyYantraBtn').addEventListener('click', ()=>{ const s=state.settings; s.bankroll=Number(q('setBankroll').value)||30000; s.targetDollar=Number(q('setTargetDollar').value)||500; s.targetPercent=Number(q('setTargetPercent').value)||1.67; s.stopLoss=Number(q('setStopLoss').value)||2000; s.min=Number(q('setMin').value)||100; s.max=Number(q('setMax').value)||3000; s.coin=Number(q('setCoin').value)||100; s.targetNum=Number(q('setTargetNum').value)||500; s.keypadMode=q('setKeypadMode').value; s.maxSteps=Number(q('setMaxSteps').value)||30; s.reserve=Number(q('setReserve').value)||20000; s.capRule=q('setCapRule').value; state.ladder = buildLadder(s.min,s.max,s.coin,s.maxSteps); state.liveBankroll=s.bankroll; renderAll(); showToast('YANTRA APPLIED', 'Settings saved'); });
  q('saveLadderBtn').addEventListener('click', ()=>{ document.querySelectorAll('[data-ladder-index]').forEach(inp=>{ const i=Number(inp.dataset.ladderIndex); const bet=Number(inp.value)||0; state.ladder[i].bet=bet; state.ladder[i].winReturn=bet*9; const lossTotal = state.ladder.slice(0,i+1).reduce((a,r,idx)=>a + (idx===i?bet:r.bet),0); state.ladder[i].ifLoseTotal=-lossTotal; state.ladder[i].netProfit = state.ladder[i].winReturn - lossTotal; }); renderAll(); showToast('SOPANA SAVED', 'Editable ladder updated'); });
  q('resetLadderBtn').addEventListener('click', ()=>{ state.ladder = buildLadder(state.settings.min,state.settings.max,state.settings.coin,state.settings.maxSteps); renderAll(); showToast('SOPANA RESET', 'Default ladder restored'); });
  q('exportCsvBtn').addEventListener('click', exportDrishtiCsv); q('loadCsvBtn').addEventListener('click', ()=>q('loadCsvFile').click()); q('loadCsvFile').addEventListener('change', importDrishtiCsv);
  q('exportGranthBtn').addEventListener('click', exportGranthJson); q('importGranthBtn').addEventListener('click', ()=>q('importGranthFile').click()); q('importGranthFile').addEventListener('change', importGranthJson); q('deleteGranthBtn').addEventListener('click', ()=>{ state.granth=[]; state.currentKumbh=null; renderAll(); showToast('GRANTH PURGED', 'All Kumbh history removed'); });
}

function exportDrishtiCsv(){ const header='Side,Number,ActivationChakra,WinChakra,StepsToWin,PreviousLoss,WinningBet,NetProfitLoss,Status\n'; const rows=state.drishti.map(r=>[r.side,r.number,r.activationChakra,r.winChakra,r.steps,r.prevLoss,r.winBet,r.net,r.status].join(',')).join('\n'); downloadFile('drishti.csv', header+rows, 'text/csv'); }
function importDrishtiCsv(e){ const file=e.target.files[0]; if(!file) return; file.text().then(txt=>{ const lines=txt.trim().split(/\r?\n/).slice(1); state.drishti=lines.filter(Boolean).map(l=>{ const [side,number,activationChakra,winChakra,steps,prevLoss,winBet,net,status]=l.split(','); return {side, number, activationChakra, winChakra, steps, prevLoss, winBet, net, status}; }); renderAll(); showToast('DRISHTI LOADED', 'CSV imported'); }); e.target.value=''; }
function exportGranthJson(){ downloadFile('granth.json', JSON.stringify(state.granth,null,2), 'application/json'); }
function importGranthJson(e){ const file=e.target.files[0]; if(!file) return; file.text().then(txt=>{ state.granth = JSON.parse(txt); renderAll(); showToast('GRANTH LOADED', 'History imported'); }); e.target.value=''; }
function downloadFile(name, content, type){ const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }

setupInstall(); setupTabs(); setupControls(); startPrayoga(); renderAll();
