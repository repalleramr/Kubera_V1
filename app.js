
const STORAGE_KEY = 'kubera-warhunt-final-v2';

const defaultSettings = {
  bankroll: 30000,
  targetDollar: 500,
  targetPercent: 1.67,
  stopLoss: 2000,
  min: 100,
  max: 3000,
  coinSize: 100,
  targetPerNumber: 500,
  doubleLadder: 'on',
  maxSteps: 30,
  secondMaxSteps: 15,
  safetyReserve: 20000,
  capRule: 'on',
  keypadMode: 'combined',
};

const screenTitles = {
  sangram: '⚔ SANGRAM',
  vyuha: '🛡 VYUHA',
  granth: '📜 GRANTH',
  drishti: '👁 DRISHTI',
  sopana: '🪜 SOPANA',
  yantra: '⚙ YANTRA',
  medha: '🧠 MEDHA',
};

let app = loadApp();
let historyStack = [];

function loadApp() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return freshApp();
}

function freshApp() {
  return {
    settings: { ...defaultSettings },
    liveBankroll: defaultSettings.bankroll,
    currentChakra: 1,
    currentScreen: 'sangram',
    pendingCombined: { Y: null, K: null },
    sideChakra: { Y: 1, K: 1 },
    currentSessionId: 1,
    granth: [{ id: 1, rows: [] }],
    drishti: [],
    numberState: buildNumberState(),
    summary: { totalAhuti: 0, maxExposure: 0 },
  };
}

function buildNumberState() {
  const obj = { Y: {}, K: {} };
  ['Y', 'K'].forEach(side => {
    for (let n = 1; n <= 9; n++) {
      obj[side][n] = {
        state: 'inactive', // inactive active locked cap pendingSecond
        ladder: 1,
        step: 0,
        previousLoss: 0,
        activationChakra: null,
      };
    }
  });
  return obj;
}

function saveApp() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
}

function formatCurrency(v) {
  return '₹ ' + Number(v || 0).toLocaleString('en-IN');
}

function roundCoin(value) {
  const c = Number(app.settings.coinSize);
  return Math.max(c, Math.ceil(value / c) * c);
}

function getFirstLadderBet(step) {
  let bet = Number(app.settings.min);
  const target = Number(app.settings.targetPerNumber);
  if (step <= 1) return bet;
  for (let s = 2; s <= step; s++) {
    const prevLoss = totalLossForFixedBetPath(s - 1, bet);
    if ((bet * 8) - prevLoss < target) bet = Math.min(Number(app.settings.max), bet * 2);
  }
  return Math.min(Number(app.settings.max), bet);
}

function totalLossForFixedBetPath(steps, startBet) {
  let bet = startBet;
  let loss = 0;
  const target = Number(app.settings.targetPerNumber);
  for (let s = 1; s <= steps; s++) {
    if (s > 1) {
      const prevLoss = loss;
      if ((bet * 8) - prevLoss < target) bet = Math.min(Number(app.settings.max), bet * 2);
    }
    loss += bet;
  }
  return loss;
}

function getSecondLadderBet(step) {
  const max = Number(app.settings.max);
  const start = roundCoin(max / 4);
  let tier = Math.floor((step - 1) / 5) + 1;
  let bet = Math.min(max, start * tier);
  return bet > max ? max : bet;
}

function currentBetFor(side, n) {
  const rec = app.numberState[side][n];
  if (rec.state !== 'active') return 0;
  return rec.ladder === 1 ? getFirstLadderBet(rec.step) : getSecondLadderBet(rec.step);
}

function stateCode(st) {
  if (st.state === 'inactive') return { code: 'I', step: '—', cls: '' };
  if (st.state === 'locked') return { code: 'L', step: '—', cls: 'locked-state' };
  if (st.state === 'cap') return { code: 'C', step: '—', cls: 'cap-state' };
  if (st.state === 'pendingSecond') return { code: 'B', step: '—', cls: 'back-state' };
  if (st.state === 'active' && st.ladder === 2) return { code: 'B', step: `2S${st.step}`, cls: 'back-state active-state' };
  if (st.state === 'active') return { code: 'A', step: `S${st.step}`, cls: 'active-state' };
  return { code: '?', step: '—', cls: '' };
}

function render() {
  document.getElementById('screenTitle').textContent = screenTitles[app.currentScreen];
  document.getElementById('liveBankroll').textContent = formatCurrency(app.liveBankroll);
  document.getElementById('chakraValue').textContent = `Round : ${app.currentChakra}`;

  document.querySelectorAll('.screen').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === app.currentScreen);
  });
  document.querySelectorAll('.nav-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.target === app.currentScreen);
  });

  renderKeypads();
  renderVyuha();
  renderAhuti();
  renderGranth();
  renderDrishti();
  renderSettings();
  renderLadders();
  saveApp();
}

function renderKeypads() {
  buildPad('yakshaPad', 'Y');
  buildPad('kinnaraPad', 'K');
}

function buildPad(id, side) {
  const wrap = document.getElementById(id);
  wrap.innerHTML = '';
  [1,2,3,4,5,6,7,8,9,0].forEach(num => {
    const b = document.createElement('button');
    b.className = 'tile-btn' + (num === 0 ? ' zero' : '');
    if (num !== 0) {
      const st = app.numberState[side][num];
      const meta = stateCode(st);
      if (meta.cls) meta.cls.split(' ').forEach(c => c && b.classList.add(c));
      b.innerHTML = `
        <div class="num">${num}</div>
        <div class="badge">${meta.code}</div>
        <div class="sub">${meta.step}</div>`;
    } else {
      b.innerHTML = `<div class="num">0</div><div class="badge">Z</div><div class="sub">ZERO</div>`;
    }
    b.addEventListener('click', () => onKeypadTap(side, num));
    wrap.appendChild(b);
  });
}

function renderVyuha() {
  ['Y', 'K'].forEach(side => {
    const wrap = document.getElementById(side === 'Y' ? 'vyuhaY' : 'vyuhaK');
    wrap.innerHTML = '';
    for (let n = 1; n <= 9; n++) {
      const st = app.numberState[side][n];
      const meta = stateCode(st);
      const tile = document.createElement('div');
      tile.className = `state-tile ${st.state === 'pendingSecond' ? 'back' : st.state}`;
      tile.innerHTML = `<div class="n">${n}</div><div class="state-badge">${meta.code}</div><div class="s">${meta.step}</div>`;
      wrap.appendChild(tile);
    }
  });
}

function renderAhuti() {
  const mapSide = (side) => {
    const groups = {};
    for (let n = 1; n <= 9; n++) {
      const st = app.numberState[side][n];
      if (st.state === 'active') {
        const bet = currentBetFor(side, n);
        if (!groups[bet]) groups[bet] = [];
        groups[bet].push(`${n}(${st.ladder === 2 ? '2' : ''}S${st.step})`);
      }
    }
    const sorted = Object.keys(groups).map(Number).sort((a, b) => b - a);
    const text = sorted.length ? sorted.map(b => `${b} on ${groups[b].join(' ')}`).join(' | ') : '—';
    const total = sorted.reduce((sum, b) => sum + (b * groups[b].length), 0);
    return { text, total };
  };
  const y = mapSide('Y');
  const k = mapSide('K');
  document.getElementById('nextY').textContent = `Y  ${y.text}`;
  document.getElementById('nextK').textContent = `K  ${k.text}`;
  document.getElementById('nextT').textContent = `T  ${(y.total + k.total).toLocaleString('en-IN')}`;
}

function renderGranth() {
  const wrap = document.getElementById('granthList');
  wrap.innerHTML = '';
  [...app.granth].sort((a,b)=>b.id-a.id).forEach(k => {
    const card = document.createElement('div');
    card.className = 'kumbh-card';
    const rows = [...k.rows].sort((a,b)=>b.seq-a.seq);
    card.innerHTML = `<div class="kumbh-title">#${String(k.id).padStart(2,'0')} Kumbh</div>`;
    if (!rows.length) {
      card.innerHTML += '<div class="note">No chakras yet</div>';
    } else {
      const inner = document.createElement('div');
      inner.className = 'table-wrap';
      inner.innerHTML = `<table><thead><tr><th>Chakra</th><th>Y</th><th>K</th><th>Āhuti</th><th>Axyapatra</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.seq}</td><td>${r.Y ?? '-'}</td><td>${r.K ?? '-'}</td><td>${r.exposure}</td><td>${r.bankroll}</td></tr>`).join('')}</tbody></table>`;
      card.appendChild(inner);
    }
    wrap.appendChild(card);
  });
}

function renderDrishti() {
  document.getElementById('summaryChakras').textContent = Math.max(0, app.currentChakra - 1);
  document.getElementById('summaryAhuti').textContent = app.summary.totalAhuti.toLocaleString('en-IN');
  const net = app.liveBankroll - Number(app.settings.bankroll);
  document.getElementById('summaryNet').textContent = `${net >= 0 ? '+' : ''}${net.toLocaleString('en-IN')}`;
  document.getElementById('summaryMax').textContent = app.summary.maxExposure.toLocaleString('en-IN');
  const body = document.getElementById('drishtiBody');
  body.innerHTML = [...app.drishti].reverse().map(r => `<tr><td>${r.side}</td><td>${r.number}</td><td>${r.activationChakra}</td><td>${r.winChakra ?? '-'}</td><td>${r.steps}</td><td>${r.previousLoss}</td><td>${r.winningBet ?? '-'}</td><td>${r.net >= 0 ? '+' : ''}${r.net}</td><td>${r.status}</td></tr>`).join('');
}

function renderSettings() {
  const s = app.settings;
  mapField('setBankroll', s.bankroll);
  mapField('setTargetDollar', s.targetDollar);
  mapField('setTargetPercent', s.targetPercent);
  mapField('setStopLoss', s.stopLoss);
  mapField('setMin', s.min);
  mapField('setMax', s.max);
  mapField('setCoinSize', s.coinSize);
  mapField('setTargetPerNumber', s.targetPerNumber);
  mapField('setDoubleLadder', s.doubleLadder);
  mapField('setMaxSteps', s.maxSteps);
  mapField('setSafetyReserve', s.safetyReserve);
  mapField('setCapRule', s.capRule);
  mapField('setKeypadMode', s.keypadMode);
}

function mapField(id, value) {
  const el = document.getElementById(id);
  if (el && document.activeElement !== el) el.value = value;
}

function renderLadders() {
  const first = document.getElementById('firstLadderList');
  const second = document.getElementById('secondLadderList');
  first.innerHTML = '';
  second.innerHTML = '';
  for (let i = 1; i <= 30; i++) {
    const d = document.createElement('div');
    d.textContent = `S${i} = ${getFirstLadderBet(i)}`;
    first.appendChild(d);
  }
  for (let i = 1; i <= 15; i++) {
    const d = document.createElement('div');
    d.textContent = `2S${i} = ${getSecondLadderBet(i)}`;
    second.appendChild(d);
  }
}

function pushNotice(title, lines, kind='success') {
  const area = document.getElementById('notificationArea');
  const box = document.createElement('div');
  box.className = `notice ${kind}`;
  box.innerHTML = `<div class="title">${title}</div><div>${lines.map(line => `<div>${line}</div>`).join('')}</div>`;
  area.prepend(box);
  while (area.children.length > 5) area.removeChild(area.lastChild);
}

function activatePendingSecond(side, seq) {
  for (let n = 1; n <= 9; n++) {
    const st = app.numberState[side][n];
    if (st.state === 'pendingSecond') {
      st.state = 'active';
      st.ladder = 2;
      st.step = 1;
      st.previousLoss = 0;
      st.activationChakra = seq;
    }
  }
}

function onKeypadTap(side, num) {
  snapshot();
  if (app.settings.keypadMode === 'combined') {
    app.pendingCombined[side] = num;
    if (app.pendingCombined.Y !== null && app.pendingCombined.K !== null) {
      processRound({ Y: app.pendingCombined.Y, K: app.pendingCombined.K, seq: app.currentChakra });
      app.pendingCombined = { Y: null, K: null };
      app.currentChakra += 1;
    }
  } else {
    processIndividual(side, num);
  }
  render();
}

function processIndividual(side, num) {
  const seq = app.sideChakra[side];
  activatePendingSecond(side, seq);
  const exposure = sideExposure(side);
  app.liveBankroll -= exposure;
  app.summary.totalAhuti += exposure;
  app.summary.maxExposure = Math.max(app.summary.maxExposure, exposure);
  const notices = processSideResult(side, num, seq, true);
  ensureCurrentKumbh().rows.push({ seq, Y: side === 'Y' ? num : '-', K: side === 'K' ? num : '-', exposure, bankroll: app.liveBankroll });
  showNotices(notices);
  app.sideChakra[side] += 1;
  app.currentChakra = Math.max(app.sideChakra.Y, app.sideChakra.K);
  warnLevels();
}

function processRound(round) {
  activatePendingSecond('Y', round.seq);
  activatePendingSecond('K', round.seq);
  const yExposure = sideExposure('Y');
  const kExposure = sideExposure('K');
  const totalExposure = yExposure + kExposure;
  app.liveBankroll -= totalExposure;
  app.summary.totalAhuti += totalExposure;
  app.summary.maxExposure = Math.max(app.summary.maxExposure, totalExposure);

  const notices = [];
  notices.push(...processSideResult('Y', round.Y, round.seq, false));
  notices.push(...processSideResult('K', round.K, round.seq, false));

  ensureCurrentKumbh().rows.push({ seq: round.seq, Y: round.Y, K: round.K, exposure: totalExposure, bankroll: app.liveBankroll });
  showNotices(notices);
  warnLevels();
}

function showNotices(notices) {
  if (!notices.length) return;
  const wins = notices.filter(n => n.type === 'win');
  const caps = notices.filter(n => n.type === 'cap');
  const warns = notices.filter(n => n.type === 'warn');
  if (wins.length) pushNotice('VIJAY DARSHANA', wins.map(w => `${w.side}${w.number} → ${w.stage} → Āhuti ${w.bet} → Net ${w.net >= 0 ? '+' : ''}${w.net}`), 'success');
  caps.forEach(c => pushNotice('CAP RETURNED', [`${c.side}${c.number} now B → second ladder from next chakra`], 'warn'));
  warns.forEach(w => pushNotice('TREASURY WARNING', [w.text], 'warn'));
}

function sideExposure(side) {
  let total = 0;
  for (let n = 1; n <= 9; n++) {
    const st = app.numberState[side][n];
    if (st.state === 'active') total += currentBetFor(side, n);
  }
  return total;
}

function processSideResult(side, result, seq, soloMode) {
  const notices = [];
  if (result === 0) {
    zeroAdvance(side, seq);
    return notices;
  }

  const target = app.numberState[side][result];
  if (target.state === 'locked') {
    zeroAdvance(side, seq);
    return notices;
  }
  if (target.state === 'cap') {
    target.state = 'pendingSecond';
    target.step = 0;
    target.previousLoss = 0;
    notices.push({ type: 'cap', side, number: result });
    zeroAdvance(side, seq, result);
    return notices;
  }

  for (let n = 1; n <= 9; n++) {
    if (n === result) continue;
    const st = app.numberState[side][n];
    if (st.state === 'active') loseStep(side, n, seq);
  }

  if (target.state === 'inactive') {
    target.state = 'active';
    target.ladder = 1;
    target.step = 1;
    target.previousLoss = 0;
    target.activationChakra = seq;
    return notices;
  }

  if (target.state === 'pendingSecond') {
    return notices;
  }

  if (target.state === 'active') {
    const bet = currentBetFor(side, result);
    const net = (bet * 8) - target.previousLoss;
    app.liveBankroll += bet * 8;
    app.drishti.push({
      side,
      number: result,
      activationChakra: target.activationChakra,
      winChakra: seq,
      steps: target.step,
      previousLoss: target.previousLoss,
      winningBet: bet,
      net,
      status: 'WIN'
    });
    notices.push({ type: 'win', side, number: result, stage: `${target.ladder === 2 ? '2' : ''}S${target.step}`, bet, net });
    target.state = 'locked';
    target.step = 0;
    target.previousLoss = 0;
    return notices;
  }

  return notices;
}

function zeroAdvance(side, seq, skipCapReturnNumber = null) {
  for (let n = 1; n <= 9; n++) {
    if (n === skipCapReturnNumber) continue;
    const st = app.numberState[side][n];
    if (st.state === 'active') loseStep(side, n, seq);
  }
}

function loseStep(side, n, seq) {
  const st = app.numberState[side][n];
  if (st.state !== 'active') return;
  const bet = currentBetFor(side, n);
  st.previousLoss += bet;
  if (st.ladder === 1) {
    if (bet >= Number(app.settings.max) && app.settings.capRule === 'on') {
      st.state = 'cap';
      app.drishti.push({
        side,
        number: n,
        activationChakra: st.activationChakra,
        winChakra: null,
        steps: st.step,
        previousLoss: st.previousLoss,
        winningBet: null,
        net: -st.previousLoss,
        status: 'CAP'
      });
      st.step = 0;
      st.previousLoss = 0;
      return;
    }
    st.step = Math.min(Number(app.settings.maxSteps), st.step + 1);
  } else {
    st.step = Math.min(15, st.step + 1);
  }
}

function warnLevels() {
  if (app.liveBankroll <= Number(app.settings.bankroll) - Number(app.settings.stopLoss)) {
    pushNotice('TREASURY WARNING', ['Axyapatra approaching Raksha Rekha'], 'warn');
  }
  if (app.liveBankroll < Number(app.settings.safetyReserve)) {
    pushNotice('TREASURY WARNING', ['Axyapatra below Raksha Nidhi'], 'warn');
  }
}

function ensureCurrentKumbh() {
  let current = app.granth.find(k => k.id === app.currentSessionId);
  if (!current) {
    current = { id: app.currentSessionId, rows: [] };
    app.granth.push(current);
  }
  return current;
}

function snapshot() {
  historyStack.push(JSON.stringify(app));
  if (historyStack.length > 30) historyStack.shift();
}

function undoLast() {
  if (!historyStack.length) return;
  app = JSON.parse(historyStack.pop());
  render();
}

function kumbhaReset() {
  if (!confirm('Kumbha reset current session?')) return;
  const settings = { ...app.settings };
  const granth = app.granth;
  const currentSessionId = app.currentSessionId;
  app.numberState = buildNumberState();
  app.pendingCombined = { Y: null, K: null };
  app.liveBankroll = Number(settings.bankroll);
  app.currentChakra = 1;
  app.sideChakra = { Y: 1, K: 1 };
  app.summary = { totalAhuti: 0, maxExposure: 0 };
  app.drishti = [];
  const current = granth.find(k => k.id === currentSessionId);
  if (current) current.rows = [];
  render();
}

function prayogaNewSession() {
  if (!confirm('Start new Prayoga session?')) return;
  app.currentSessionId += 1;
  app.granth.push({ id: app.currentSessionId, rows: [] });
  app.numberState = buildNumberState();
  app.pendingCombined = { Y: null, K: null };
  app.liveBankroll = Number(app.settings.bankroll);
  app.currentChakra = 1;
  app.sideChakra = { Y: 1, K: 1 };
  app.summary = { totalAhuti: 0, maxExposure: 0 };
  app.drishti = [];
  render();
}

function applyYantra() {
  const s = app.settings;
  s.bankroll = Number(document.getElementById('setBankroll').value || defaultSettings.bankroll);
  s.targetDollar = Number(document.getElementById('setTargetDollar').value || defaultSettings.targetDollar);
  s.targetPercent = Number(document.getElementById('setTargetPercent').value || defaultSettings.targetPercent);
  s.stopLoss = Number(document.getElementById('setStopLoss').value || defaultSettings.stopLoss);
  s.min = Number(document.getElementById('setMin').value || defaultSettings.min);
  s.max = Number(document.getElementById('setMax').value || defaultSettings.max);
  s.coinSize = Number(document.getElementById('setCoinSize').value || defaultSettings.coinSize);
  s.targetPerNumber = Number(document.getElementById('setTargetPerNumber').value || defaultSettings.targetPerNumber);
  s.doubleLadder = document.getElementById('setDoubleLadder').value;
  s.maxSteps = 30;
  s.safetyReserve = Number(document.getElementById('setSafetyReserve').value || defaultSettings.safetyReserve);
  s.capRule = document.getElementById('setCapRule').value;
  s.keypadMode = document.getElementById('setKeypadMode').value;
  if (document.activeElement?.id === 'setTargetDollar') {
    s.targetPercent = +((s.targetDollar / s.bankroll) * 100).toFixed(2);
  } else {
    s.targetDollar = Math.round((s.bankroll * s.targetPercent) / 100);
  }
  render();
  pushNotice('YANTRA APPLIED', ['Settings updated for next input'], 'success');
}

function exportHistory() {
  const blob = new Blob([JSON.stringify(app.granth, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'kubera_warhunt_granth.json');
}

function importHistory(file) {
  file.text().then(text => {
    try {
      app.granth = JSON.parse(text);
      render();
    } catch {
      alert('Invalid Granth file');
    }
  });
}

function clearHistory() {
  if (!confirm('Delete Granth?')) return;
  app.granth = [{ id: 1, rows: [] }];
  app.currentSessionId = 1;
  render();
}

function exportCsv() {
  const header = 'Side,Number,ActivationChakra,WinChakra,StepsToWin,PreviousLoss,WinningBet,NetProfitLoss,Status\n';
  const rows = app.drishti.map(r => [r.side, r.number, r.activationChakra, r.winChakra ?? '-', r.steps, r.previousLoss, r.winningBet ?? '-', r.net, r.status].join(',')).join('\n');
  downloadBlob(new Blob([header + rows], { type: 'text/csv' }), 'kubera_warhunt_drishti.csv');
}

function loadCsv(file) {
  file.text().then(text => {
    const lines = text.trim().split(/\r?\n/).slice(1);
    app.drishti = lines.filter(Boolean).map(line => {
      const [side, number, activationChakra, winChakra, steps, previousLoss, winningBet, net, status] = line.split(',');
      return { side, number: Number(number), activationChakra, winChakra: winChakra === '-' ? null : winChakra, steps: Number(steps), previousLoss: Number(previousLoss), winningBet: winningBet === '-' ? null : Number(winningBet), net: Number(net), status };
    });
    render();
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function setupEvents() {
  document.getElementById('bottomNav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    app.currentScreen = btn.dataset.target;
    render();
  });
  document.getElementById('undoBtn').addEventListener('click', undoLast);
  document.getElementById('kumbhaBtn').addEventListener('click', kumbhaReset);
  document.getElementById('prayogaBtn').addEventListener('click', prayogaNewSession);
  document.getElementById('applyYantraBtn').addEventListener('click', applyYantra);
  document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);
  document.getElementById('importHistoryFile').addEventListener('change', e => e.target.files[0] && importHistory(e.target.files[0]));
  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
  document.getElementById('loadCsvFile').addEventListener('change', e => e.target.files[0] && loadCsv(e.target.files[0]));
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

setupEvents();
render();
registerSW();
