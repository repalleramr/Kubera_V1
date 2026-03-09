
const STORAGE_KEY = 'kubera-warhunt-state-v1';
const screenTitles = {
  sangram:'⚔ SANGRAM', vyuha:'🛡 VYUHA', granth:'📜 GRANTH', drishti:'👁 DRISHTI',
  sopana:'🪜 SOPANA', yantra:'⚙ YANTRA', medha:'🧠 MEDHA'
};

let deferredPrompt = null;

const defaultConfig = {
  startBankroll: 30000,
  targetAmount: 500,
  targetPct: 1.67,
  stopLoss: 2000,
  minBet: 100,
  maxBet: 3000,
  coinSize: 100,
  targetPerNumber: 500,
  doubleLadder: 'on',
  maxSteps: 12,
  safetyReserve: 20000,
  capRule: 'on'
};

function roundToCoin(n, coin) {
  return Math.ceil(n / coin) * coin;
}
function formatMoney(n){
  const sign = n < 0 ? '-' : '';
  return `${sign}₹ ${Math.abs(n).toLocaleString('en-IN')}`;
}
function compactMoney(n){
  if (Math.abs(n) >= 1000) return `${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${n}`;
}
function createNumberState(){
  return {
    status:'inactive', step:0, phase:1, activationChakra:null,
    previousLoss:0, currentBet:0, lastWinBet:0, returned:false
  };
}
function createInitialState(){
  const numbers = {Y:{}, K:{}};
  ['Y','K'].forEach(side=>{
    for(let i=1;i<=9;i++) numbers[side][i]=createNumberState();
  });
  return {
    config: {...defaultConfig},
    liveBankroll: defaultConfig.startBankroll,
    currentChakra: 1,
    currentKumbhId: 1,
    kumbhCounter: 1,
    kumbhs: [{id:1, rows:[]}],
    drishti: [],
    selectedY: null,
    selectedK: null,
    lastRoundSnapshot: null,
    notifications: [],
    roundExposures: [],
    lockedNumbers: {Y:new Set(), K:new Set()},
    numbers
  };
}
let state = loadState();

function serializeState() {
  const copy = JSON.parse(JSON.stringify(state));
  copy.lockedNumbers = {Y:[...state.lockedNumbers.Y], K:[...state.lockedNumbers.K]};
  return copy;
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
}
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return createInitialState();
  try{
    const parsed = JSON.parse(raw);
    parsed.lockedNumbers = {
      Y:new Set(parsed.lockedNumbers?.Y || []),
      K:new Set(parsed.lockedNumbers?.K || [])
    };
    return parsed;
  }catch{
    return createInitialState();
  }
}

function getCurrentKumbh(){
  let k = state.kumbhs.find(x=>x.id === state.currentKumbhId);
  if(!k){
    k = {id:state.currentKumbhId, rows:[]};
    state.kumbhs.unshift(k);
  }
  return k;
}

function firstLadderBet(step, prevLoss){
  const cfg = state.config;
  let bet = cfg.minBet;
  let prevCandidate = bet;
  for(let s=1; s<=step; s++){
    if(s === 1){
      bet = cfg.minBet;
    }else{
      if(cfg.doubleLadder === 'off'){
        bet = Math.min(cfg.maxBet, roundToCoin(cfg.minBet * Math.pow(2, s-1), cfg.coinSize));
      }else{
        const canStay = (prevCandidate * 8) - prevLoss >= cfg.targetPerNumber;
        if(canStay){
          bet = prevCandidate;
        }else{
          bet = Math.min(cfg.maxBet, roundToCoin(prevCandidate * 2, cfg.coinSize));
          prevCandidate = bet;
        }
      }
    }
    prevCandidate = bet;
  }
  return Math.min(cfg.maxBet, roundToCoin(bet, cfg.coinSize));
}
function getBetForState(numState){
  const cfg = state.config;
  if(numState.phase === 2){
    const start = roundToCoin(cfg.maxBet / 4, cfg.coinSize);
    if(numState.step <= 5) return Math.min(cfg.maxBet, start);
    if(numState.step <= 10) return Math.min(cfg.maxBet, start * 2);
    if(numState.step <= 15) return Math.min(cfg.maxBet, start * 3);
    return cfg.maxBet;
  }
  return firstLadderBet(numState.step, numState.previousLoss);
}
function buildLaddersPreview(){
  const one = document.getElementById('ladderOne');
  const two = document.getElementById('ladderTwo');
  one.innerHTML=''; two.innerHTML='';
  let prevLoss = 0;
  for(let s=1; s<=state.config.maxSteps; s++){
    const bet = firstLadderBet(s, prevLoss);
    const item = document.createElement('div');
    item.className='ladder-item';
    item.innerHTML = `<span>S${s}</span><strong>${compactMoney(bet)}</strong>`;
    one.appendChild(item);
    prevLoss += bet;
  }
  for(let s=1; s<=20; s++){
    const st = {phase:2, step:s};
    const bet = getBetForState(st);
    const item = document.createElement('div');
    item.className='ladder-item';
    item.innerHTML = `<span>2S${s}</span><strong>${compactMoney(bet)}</strong>`;
    two.appendChild(item);
  }
}

function showToast(title, msg){
  const toast = document.getElementById('toast');
  toast.innerHTML = `<strong>${title}</strong><div>${msg}</div>`;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> toast.classList.add('hidden'), 2600);
}

function initBoards(){
  ['Y','K'].forEach(side=>{
    const holder = document.getElementById(`board${side}`);
    holder.innerHTML = '';
    for(let i=1;i<=10;i++){
      const num = i===10 ? 0 : i;
      const tile = document.createElement('button');
      tile.className = 'tile' + (num===0 ? ' zero':'');
      tile.innerHTML = `<div class="tile-number">${num}</div><div class="tile-meta">${side}</div>`;
      tile.addEventListener('click', ()=>selectResult(side, num));
      holder.appendChild(tile);
    }
  });
}

function renderBoardsSelection(){
  ['Y','K'].forEach(side=>{
    const holder = document.getElementById(`board${side}`);
    [...holder.children].forEach(btn=>{
      const num = Number(btn.querySelector('.tile-number').textContent);
      btn.classList.toggle('selected', state[`selected${side}`] === num);
    });
  });
  document.getElementById('pendingInput').textContent =
    state.selectedY !== null && state.selectedK !== null
      ? `Selected Y=${state.selectedY}, K=${state.selectedK}`
      : 'Select Y and K result';
}

function selectResult(side, num){
  state[`selected${side}`] = num;
  renderBoardsSelection();
  if(state.selectedY !== null && state.selectedK !== null){
    processChakra();
  }
}

function recordDrishti(record){
  state.drishti.unshift(record);
}
function statusColorForStep(step){
  return `state-step-${Math.min(step,15)}`;
}
function advanceOrCap(side, number, numState){
  const cfg = state.config;
  numState.previousLoss += numState.currentBet;
  if(numState.phase === 1){
    if(numState.currentBet >= cfg.maxBet && cfg.capRule === 'on'){
      numState.status = 'cap';
      numState.step = cfg.maxSteps;
      recordDrishti({
        side, number, activationChakra:numState.activationChakra, winChakra:'-',
        stepsToWin: numState.step, previousLoss:numState.previousLoss, winningBet:'-',
        netProfitLoss:-numState.previousLoss, status:'CAP'
      });
      showToast('CAP', `${side}${number} entered Rekha Bandha`);
      return;
    }
    numState.step += 1;
    if(numState.step > cfg.maxSteps && cfg.capRule === 'on'){
      numState.status = 'cap';
      numState.step = cfg.maxSteps;
      recordDrishti({
        side, number, activationChakra:numState.activationChakra, winChakra:'-',
        stepsToWin:numState.step, previousLoss:numState.previousLoss, winningBet:'-',
        netProfitLoss:-numState.previousLoss, status:'CAP'
      });
      showToast('CAP', `${side}${number} entered Rekha Bandha`);
      return;
    }
    numState.currentBet = getBetForState(numState);
  }else{
    numState.step += 1;
    numState.currentBet = getBetForState(numState);
  }
}
function ensureActivated(side, number){
  if(number === 0) return null;
  if(state.lockedNumbers[side].has(number)) return null;
  const ns = state.numbers[side][number];
  if(ns.status === 'cap'){
    return null;
  }
  if(ns.status === 'inactive'){
    ns.status = 'active';
    ns.step = 1;
    ns.phase = 1;
    ns.activationChakra = state.currentChakra;
    ns.previousLoss = 0;
    ns.currentBet = getBetForState(ns);
  }
  return ns;
}
function resolveWin(side, number, numState){
  const winBet = numState.currentBet;
  const payout = winBet * 8;
  const net = payout - numState.previousLoss;
  state.liveBankroll += net;
  numState.status = 'locked';
  numState.lastWinBet = winBet;
  state.lockedNumbers[side].add(number);
  recordDrishti({
    side, number, activationChakra:numState.activationChakra, winChakra:state.currentChakra,
    stepsToWin:numState.step, previousLoss:numState.previousLoss, winningBet:winBet,
    netProfitLoss:net, status:'WIN'
  });
  showToast('VIJAY DARSHANA', `${side}${number} achieved Lakshya Labha`);
}
function processSide(side, result){
  const sideStates = state.numbers[side];
  let exposure = 0;
  for(let n=1;n<=9;n++){
    const ns = sideStates[n];

    if(state.lockedNumbers[side].has(n) && result === n){
      result = 0;
    }

    if(ns.status === 'cap' && result === n){
      ns.returned = true;
      recordDrishti({
        side, number:n, activationChakra:state.currentChakra, winChakra:'-',
        stepsToWin:'-', previousLoss:'-', winningBet:'-', netProfitLoss:'-', status:'RETURNED'
      });
      showToast('CAP RETURNED', `${side}${n} returned from CAP`);
    }

    if(ns.status === 'active'){
      exposure += ns.currentBet;
    }
  }

  state.liveBankroll -= exposure;

  if(result !== 0){
    const returnedCap = sideStates[result].status === 'cap';
    if(returnedCap){
      // no immediate activation on same round
    }else if(!state.lockedNumbers[side].has(result)){
      ensureActivated(side, result);
    }
  }

  for(let n=1;n<=9;n++){
    const ns = sideStates[n];
    if(ns.returned){
      ns.status = 'active';
      ns.phase = 2;
      ns.step = 1;
      ns.activationChakra = state.currentChakra + 1;
      ns.previousLoss = 0;
      ns.currentBet = getBetForState(ns);
      ns.returned = false;
      continue;
    }
    if(ns.status !== 'active') continue;
    if(result === n){
      resolveWin(side, n, ns);
    }else{
      advanceOrCap(side, n, ns);
    }
  }

  if(result !== 0){
    const ns = sideStates[result];
    if(ns.status === 'active' && ns.activationChakra === state.currentChakra && result !== 0){
      // activation came this round; since it already didn't win on first appearance, advance to next step next zero/loss only
    }
  }
  return exposure;
}
function buildNextAhutiLine(side){
  const groups = {};
  for(let n=1;n<=9;n++){
    const ns = state.numbers[side][n];
    if(ns.status === 'active'){
      const bet = ns.currentBet;
      const label = `${n}(${ns.phase===2?'2S':'S'}${ns.step})`;
      if(!groups[bet]) groups[bet] = [];
      groups[bet].push(label);
    }
  }
  const amounts = Object.keys(groups).map(Number).sort((a,b)=>b-a);
  if(!amounts.length) return `${side} —`;
  return `${side}   ` + amounts.map(a => `${compactMoney(a)} on ${groups[a].join(' ')}`).join(' | ');
}
function currentExposure(){
  let total = 0;
  ['Y','K'].forEach(side=>{
    for(let n=1;n<=9;n++){
      const ns = state.numbers[side][n];
      if(ns.status === 'active') total += ns.currentBet;
    }
  });
  return total;
}
function processChakra(){
  state.lastRoundSnapshot = JSON.stringify(serializeState());
  const y = state.selectedY, k = state.selectedK;
  const exposureY = processSide('Y', y);
  const exposureK = processSide('K', k);
  const totalExposure = exposureY + exposureK;
  state.roundExposures.push(totalExposure);

  getCurrentKumbh().rows.unshift({
    chakra: state.currentChakra, y, k, ahuti: totalExposure, axyapatra: state.liveBankroll
  });

  if(state.liveBankroll <= state.config.startBankroll - state.config.stopLoss){
    showToast('TREASURY WARNING', 'Axyapatra approaching Raksha Rekha');
  } else if(state.liveBankroll < state.config.safetyReserve){
    showToast('TREASURY WARNING', 'Axyapatra below Raksha Nidhi');
  }

  state.currentChakra += 1;
  state.selectedY = null;
  state.selectedK = null;
  saveState();
  render();
}
function revertTo(obj){
  state = obj;
  state.lockedNumbers = {Y:new Set(obj.lockedNumbers.Y || []), K:new Set(obj.lockedNumbers.K || [])};
  saveState();
  render();
}
function undoLast(){
  if(!state.lastRoundSnapshot) return;
  const parsed = JSON.parse(state.lastRoundSnapshot);
  parsed.lockedNumbers = {Y:new Set(parsed.lockedNumbers.Y || []), K:new Set(parsed.lockedNumbers.K || [])};
  state = parsed;
  saveState();
  render();
}
function resetBoard(){
  ['Y','K'].forEach(side=>{
    for(let i=1;i<=9;i++) state.numbers[side][i] = createNumberState();
    state.lockedNumbers[side] = new Set();
  });
  state.currentChakra = 1;
  state.selectedY = null;
  state.selectedK = null;
  saveState();
  render();
  showToast('KUMBHA SHUDDHI', 'Board state reset');
}
function startPrayoga(){
  state.kumbhCounter += 1;
  state.currentKumbhId = state.kumbhCounter;
  state.kumbhs.unshift({id: state.currentKumbhId, rows:[]});
  ['Y','K'].forEach(side=>{
    for(let i=1;i<=9;i++) state.numbers[side][i] = createNumberState();
    state.lockedNumbers[side] = new Set();
  });
  state.currentChakra = 1;
  state.selectedY = null;
  state.selectedK = null;
  saveState();
  render();
  showToast('PRAYOGA', `#${String(state.currentKumbhId).padStart(2,'0')} Kumbh created`);
}
function deleteHistory(){
  if(!confirm('Delete Granth?')) return;
  state.kumbhs = [{id:1, rows:[]}];
  state.kumbhCounter = 1;
  state.currentKumbhId = 1;
  saveState();
  render();
}
function exportHistory(){
  const blob = new Blob([JSON.stringify({kumbhs:state.kumbhs}, null, 2)], {type:'application/json'});
  downloadBlob(blob, 'kubera_warhunt_granth.json');
}
function importHistory(file){
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const parsed = JSON.parse(e.target.result);
      if(Array.isArray(parsed.kumbhs)){
        state.kumbhs = parsed.kumbhs;
        state.kumbhCounter = Math.max(...parsed.kumbhs.map(k=>k.id),1);
        saveState();
        render();
      }
    }catch{
      alert('Invalid Granth file');
    }
  };
  reader.readAsText(file);
}
function exportCsv(){
  const header = 'Side,Number,ActivationChakra,WinChakra,StepsToWin,PreviousLoss,WinningBet,NetProfitLoss,Status\n';
  const rows = state.drishti.map(r=>[
    r.side, r.number, r.activationChakra, r.winChakra, r.stepsToWin,
    r.previousLoss, r.winningBet, r.netProfitLoss, r.status
  ].join(',')).join('\n');
  downloadBlob(new Blob([header + rows], {type:'text/csv'}), 'kubera_warhunt_drishti.csv');
}
function loadCsv(file){
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.trim().split(/\r?\n/);
    const data = lines.slice(1).map(line=>{
      const [side, number, activationChakra, winChakra, stepsToWin, previousLoss, winningBet, netProfitLoss, status] = line.split(',');
      return {side, number, activationChakra, winChakra, stepsToWin, previousLoss, winningBet, netProfitLoss, status};
    });
    state.drishti = data;
    saveState();
    render();
  };
  reader.readAsText(file);
}
function downloadBlob(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function renderSangram(){
  document.getElementById('liveBankroll').textContent = formatMoney(state.liveBankroll);
  const delta = state.liveBankroll - state.config.startBankroll;
  const pill = document.getElementById('bankrollDelta');
  pill.textContent = `${delta >=0 ? 'Dhana Labha' : 'Dhana Hani'} ${delta>=0?'+':''}${compactMoney(delta)}`;
  document.getElementById('chakraCounter').textContent = `Round : ${state.currentChakra}`;
  document.getElementById('nextAhutiY').textContent = buildNextAhutiLine('Y');
  document.getElementById('nextAhutiK').textContent = buildNextAhutiLine('K');
  document.getElementById('nextAhutiT').textContent = `T   ${compactMoney(currentExposure())}`;
  renderBoardsSelection();
}
function renderVyuha(){
  ['Y','K'].forEach(side=>{
    const holder = document.getElementById(`vyuha${side}`);
    holder.innerHTML = '';
    for(let n=1;n<=9;n++){
      const ns = state.numbers[side][n];
      const div = document.createElement('div');
      let cls = 'vtile';
      if(ns.status==='active') cls += ' active';
      if(ns.status==='locked') cls += ' locked';
      if(ns.status==='cap') cls += ' cap';
      const pct = ns.status==='active' ? Math.min(100, (ns.step / state.config.maxSteps) * 100) : 0;
      const meta = ns.status==='inactive' ? '-' :
                   ns.status==='locked' ? 'LOCKED' :
                   ns.status==='cap' ? 'CAP' :
                   `${ns.phase===2?'2S':'S'}${ns.step}`;
      div.className = cls;
      div.innerHTML = `
        <div class="num">${n}</div>
        <div class="state ${ns.status==='active' ? statusColorForStep(ns.step) : ''}">${meta}</div>
        <div class="progress"><span class="${statusColorForStep(ns.step)}" style="width:${pct}%; background:currentColor"></span></div>
      `;
      holder.appendChild(div);
    }
  });
}
function renderGranth(){
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  state.kumbhs.sort((a,b)=>b.id-a.id).forEach(k=>{
    const details = document.createElement('details');
    details.className = 'card kumbh-card';
    details.open = k.id === state.currentKumbhId;
    const rows = [...k.rows].sort((a,b)=>b.chakra-a.chakra).map(r=>`
      <tr><td>${r.chakra}</td><td>${r.y}</td><td>${r.k}</td><td>${compactMoney(r.ahuti)}</td><td>${compactMoney(r.axyapatra)}</td></tr>
    `).join('');
    details.innerHTML = `
      <summary>#${String(k.id).padStart(2,'0')} Kumbh</summary>
      <div class="table-wrap"><table><thead><tr><th>Chakra</th><th>Y</th><th>K</th><th>Āhuti</th><th>Axyapatra</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No Chakras yet</td></tr>'}</tbody></table></div>
    `;
    list.appendChild(details);
  });
}
function renderDrishti(){
  document.getElementById('sumChakras').textContent = Math.max(0, state.currentChakra - 1);
  document.getElementById('sumAhuti').textContent = compactMoney(state.roundExposures.reduce((a,b)=>a+b,0));
  const net = state.liveBankroll - state.config.startBankroll;
  document.getElementById('sumProfit').textContent = `${net>=0?'+':''}${compactMoney(net)}`;
  document.getElementById('sumExposure').textContent = compactMoney(Math.max(0, ...state.roundExposures, 0));
  const tbody = document.querySelector('#drishtiTable tbody');
  tbody.innerHTML = state.drishti.map(r=>`
    <tr>
      <td>${r.side}</td><td>${r.number}</td><td>${r.activationChakra}</td><td>${r.winChakra}</td>
      <td>${r.stepsToWin}</td><td>${r.previousLoss}</td><td>${r.winningBet}</td>
      <td>${r.netProfitLoss}</td><td>${r.status}</td>
    </tr>
  `).join('');
}
function renderYantra(){
  const c = state.config;
  cfgBankroll.value = c.startBankroll;
  cfgTargetAmount.value = c.targetAmount;
  cfgTargetPct.value = c.targetPct;
  cfgStopLoss.value = c.stopLoss;
  cfgMinBet.value = c.minBet;
  cfgMaxBet.value = c.maxBet;
  cfgCoinSize.value = c.coinSize;
  cfgTargetPerNumber.value = c.targetPerNumber;
  cfgDoubleLadder.value = c.doubleLadder;
  cfgMaxSteps.value = c.maxSteps;
  cfgSafetyReserve.value = c.safetyReserve;
  cfgCapRule.value = c.capRule;
}
function renderMedha(){
  const medha = document.getElementById('medhaContent');
  const capCount = state.drishti.filter(r=>r.status === 'CAP').length;
  const recentCaps = state.drishti.slice(0, 10).filter(r=>r.status === 'CAP').length;
  let storm = 'None';
  if(recentCaps >= 7) storm = 'HIGH';
  else if(recentCaps >= 5) storm = 'MEDIUM';
  else if(recentCaps >= 3) storm = 'LOW';
  const insights = [
    `Live Treasury: ${formatMoney(state.liveBankroll)}`,
    `Net Session: ${(state.liveBankroll - state.config.startBankroll) >= 0 ? 'Dhana Labha' : 'Dhana Hani'} ${compactMoney(state.liveBankroll - state.config.startBankroll)}`,
    `CAP count recorded: ${capCount}`,
    `Rudra Viplava risk: ${storm}`,
    `Highest Exposure: ${compactMoney(Math.max(0, ...state.roundExposures, 0))}`
  ];
  medha.innerHTML = insights.map(x=>`<div class="medha-item">${x}</div>`).join('');
}
function render(){
  renderSangram();
  renderVyuha();
  renderGranth();
  renderDrishti();
  renderYantra();
  renderMedha();
  buildLaddersPreview();
}
function applyYantra(){
  state.config.startBankroll = Number(cfgBankroll.value || 0);
  state.config.targetAmount = Number(cfgTargetAmount.value || 0);
  state.config.targetPct = Number(cfgTargetPct.value || 0);
  state.config.stopLoss = Number(cfgStopLoss.value || 0);
  state.config.minBet = Number(cfgMinBet.value || 0);
  state.config.maxBet = Number(cfgMaxBet.value || 0);
  state.config.coinSize = Number(cfgCoinSize.value || 100);
  state.config.targetPerNumber = Number(cfgTargetPerNumber.value || 0);
  state.config.doubleLadder = cfgDoubleLadder.value;
  state.config.maxSteps = Number(cfgMaxSteps.value || 12);
  state.config.safetyReserve = Number(cfgSafetyReserve.value || 0);
  state.config.capRule = cfgCapRule.value;
  saveState();
  render();
  showToast('YANTRA', 'Settings applied');
}
function syncTargetAmountFromPct(){
  const bankroll = Number(cfgBankroll.value || 0);
  const pct = Number(cfgTargetPct.value || 0);
  cfgTargetAmount.value = Math.round(bankroll * pct / 100);
}
function syncTargetPctFromAmount(){
  const bankroll = Number(cfgBankroll.value || 0);
  const amount = Number(cfgTargetAmount.value || 0);
  cfgTargetPct.value = bankroll ? ((amount / bankroll) * 100).toFixed(2) : 0;
}
function setScreen(name){
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active', x.dataset.screen===name));
  document.getElementById('screenTitle').textContent = screenTitles[name];
}

document.querySelectorAll('.nav-btn').forEach(btn=> btn.addEventListener('click', ()=>setScreen(btn.dataset.screen)));
document.getElementById('undoBtn').addEventListener('click', undoLast);
document.getElementById('resetBtn').addEventListener('click', resetBoard);
document.getElementById('prayogaBtn').addEventListener('click', startPrayoga);
document.getElementById('deleteHistoryBtn').addEventListener('click', deleteHistory);
document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);
document.getElementById('importHistoryInput').addEventListener('change', e=> e.target.files[0] && importHistory(e.target.files[0]));
document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
document.getElementById('loadCsvInput').addEventListener('change', e=> e.target.files[0] && loadCsv(e.target.files[0]));
document.getElementById('applyYantraBtn').addEventListener('click', applyYantra);
cfgTargetPct.addEventListener('input', syncTargetAmountFromPct);
cfgTargetAmount.addEventListener('input', syncTargetPctFromAmount);
cfgBankroll.addEventListener('input', ()=>{syncTargetAmountFromPct();});
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('hidden');
});
installBtn.addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('./service-worker.js'));
}
initBoards();
render();
