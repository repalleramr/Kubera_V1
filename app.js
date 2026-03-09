
const STORAGE_KEY = "kubera_warhunt_state_v2";
const TAB_TITLES = {
  sangram:"⚔ SANGRAM", vyuha:"🛡 VYUHA", granth:"📜 GRANTH",
  drishti:"👁 DRISHTI", sopana:"🪜 SOPANA", yantra:"⚙ YANTRA", medha:"🧠 MEDHA"
};

const defaultSettings = {
  startBankroll: 30000,
  targetProfit: 500,
  minBet: 100,
  maxBet: 3000,
  coinSize: 100,
  maxSteps: 30,
  secondMaxSteps: 15,
  keypadMode: "combined"
};

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function money(n){
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}₹ ${abs.toLocaleString("en-IN")}`;
}
function shortMoney(n){
  if (Math.abs(n) >= 1000) return (n/1000).toFixed(n%1000===0?0:1)+"k";
  return String(n);
}
function roundToCoin(v, coin){ return Math.max(coin, Math.ceil(v/coin)*coin); }

function createSideState(){
  const nums = {};
  for(let i=1;i<=9;i++){
    nums[i] = {
      number:i,
      state:"inactive", // inactive active locked cap second-active cap-waiting
      step:0,
      phase:1,
      activatedAt:null,
      previousLoss:0,
      winningBet:0,
      capReturnPending:false
    };
  }
  return nums;
}

function computeFirstLadder(settings){
  const steps = [];
  let bet = roundToCoin(settings.minBet, settings.coinSize);
  for(let s=1;s<=settings.maxSteps;s++){
    const prevLoss = steps.reduce((a,b)=>a+b,0);
    let current = bet;
    if (((current * 8) - prevLoss) < settings.targetProfit) {
      current = Math.min(settings.maxBet, bet * 2);
      current = roundToCoin(current, settings.coinSize);
      bet = current;
    }
    current = Math.min(settings.maxBet, current);
    steps.push(current);
    bet = current;
  }
  return steps;
}

function computeSecondLadder(settings){
  const start = roundToCoin(settings.maxBet / 4, settings.coinSize);
  const out = [];
  for(let s=1;s<=settings.secondMaxSteps;s++){
    let bet = start;
    if (s >= 6 && s <= 10) bet = Math.min(settings.maxBet, start * 2);
    else if (s >= 11 && s <= 15) bet = Math.min(settings.maxBet, start * 3);
    else if (s > 15) bet = settings.maxBet;
    out.push(Math.min(settings.maxBet, roundToCoin(bet, settings.coinSize)));
  }
  return out;
}

function currentBetFor(numState, settings, ladders){
  if (numState.phase === 2) return ladders.second[Math.min(numState.step, settings.secondMaxSteps)-1] || settings.maxBet;
  return ladders.first[Math.min(numState.step, settings.maxSteps)-1] || settings.maxBet;
}

let state = loadState();

function createNewState(preserveGranth=true){
  const prevGranth = preserveGranth && state ? state.granth : [];
  const prevKumbhCounter = preserveGranth && state ? state.kumbhCounter : 1;
  return {
    settings: clone(defaultSettings),
    liveBankroll: defaultSettings.startBankroll,
    chakra: 0,
    activeTab: "sangram",
    pending: {Y:null, K:null},
    currentKumbhId: prevKumbhCounter,
    kumbhCounter: prevKumbhCounter,
    sides: { Y:createSideState(), K:createSideState() },
    notifications: [],
    granth: prevGranth || [],
    drishti: [],
    totalAhuti: 0,
    maxExposure: 0,
    historyStack: [],
    lastRound:null
  };
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const s = createNewState(false);
    s.granth = [];
    s.currentKumbhId = 1;
    s.kumbhCounter = 1;
    return s;
  }
  try{
    const s = JSON.parse(raw);
    s.settings = {...clone(defaultSettings), ...(s.settings||{})};
    if (!s.sides || !s.sides.Y || !s.sides.K) s.sides = {Y:createSideState(), K:createSideState()};
    if (!s.pending) s.pending = {Y:null,K:null};
    if (!Array.isArray(s.notifications)) s.notifications = [];
    if (!Array.isArray(s.granth)) s.granth = [];
    if (!Array.isArray(s.drishti)) s.drishti = [];
    if (!Array.isArray(s.historyStack)) s.historyStack = [];
    if (!s.currentKumbhId) s.currentKumbhId = 1;
    if (!s.kumbhCounter) s.kumbhCounter = 1;
    return s;
  }catch(e){
    return createNewState(false);
  }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function getLadders(){ return { first: computeFirstLadder(state.settings), second: computeSecondLadder(state.settings) }; }

function snapshotState(){
  return JSON.stringify({
    liveBankroll: state.liveBankroll,
    chakra: state.chakra,
    pending: state.pending,
    sides: state.sides,
    drishti: state.drishti,
    totalAhuti: state.totalAhuti,
    maxExposure: state.maxExposure,
    granth: state.granth,
    currentKumbhId: state.currentKumbhId,
    kumbhCounter: state.kumbhCounter,
    lastRound: state.lastRound
  });
}
function restoreSnapshot(raw){
  const s = JSON.parse(raw);
  Object.assign(state, s);
}

function notify(type, title, lines){
  state.notifications.unshift({ type, title, lines, ts:Date.now() });
  state.notifications = state.notifications.slice(0, 6);
}

function stepClass(step){
  if (step <= 1) return "step-1";
  if (step === 2) return "step-2";
  if (step === 3) return "step-3";
  if (step === 4) return "step-4";
  if (step === 5) return "step-5";
  return "step-high";
}

function allActiveForExposure(side){
  return Object.values(state.sides[side]).filter(n => n.state === "active" || n.state === "second-active");
}

function processSideResult(side, result, roundNotifications){
  const sideState = state.sides[side];
  const ladders = getLadders();
  const activeBefore = allActiveForExposure(side);
  const betsByNum = {};
  let exposure = 0;
  for (const n of activeBefore){
    const bet = currentBetFor(n, state.settings, ladders);
    betsByNum[n.number] = bet;
    exposure += bet;
  }

  let winEntries = [];
  let capReturns = [];

  if (result === 0){
    for (const n of activeBefore){
      n.previousLoss += betsByNum[n.number];
      n.step += 1;
      if (n.phase === 1 && n.step > state.settings.maxSteps){
        n.state = "cap";
        n.step = state.settings.maxSteps;
        n.capReturnPending = true;
        state.drishti.unshift({
          Side:side, Number:n.number, ActivationChakra:n.activatedAt, WinChakra:"-",
          StepsToWin:n.step, PreviousLoss:n.previousLoss, WinningBet:"-", NetProfitLoss:-n.previousLoss, Status:"CAP"
        });
      } else if (n.phase === 2 && n.step > state.settings.secondMaxSteps){
        n.step = state.settings.secondMaxSteps;
      }
    }
    return { exposure, winEntries, capReturns };
  }

  const target = sideState[result];

  for (const n of activeBefore){
    if (n.number === result){
      const bet = betsByNum[n.number];
      const net = (bet * 8) - n.previousLoss;
      n.winningBet = bet;
      n.state = "locked";
      n.lockedAt = state.chakra + 1;
      winEntries.push({
        side, number:n.number, step:n.step, phase:n.phase, bet, net
      });
      state.liveBankroll += bet * 8;
      state.drishti.unshift({
        Side:side, Number:n.number, ActivationChakra:n.activatedAt, WinChakra:state.chakra+1,
        StepsToWin:n.step, PreviousLoss:n.previousLoss, WinningBet:bet, NetProfitLoss:net, Status:"WIN"
      });
    } else {
      n.previousLoss += betsByNum[n.number];
      n.step += 1;
      if (n.phase === 1 && n.step > state.settings.maxSteps){
        n.state = "cap";
        n.step = state.settings.maxSteps;
        n.capReturnPending = true;
        state.drishti.unshift({
          Side:side, Number:n.number, ActivationChakra:n.activatedAt, WinChakra:"-",
          StepsToWin:n.step, PreviousLoss:n.previousLoss, WinningBet:"-", NetProfitLoss:-n.previousLoss, Status:"CAP"
        });
      } else if (n.phase === 2 && n.step > state.settings.secondMaxSteps){
        n.step = state.settings.secondMaxSteps;
      }
    }
  }

  if (target.state === "inactive"){
    target.state = "active";
    target.phase = 1;
    target.step = 1;
    target.activatedAt = state.chakra + 1;
    target.previousLoss = 0;
    target.winningBet = 0;
  } else if (target.state === "cap"){
    target.capReturnPending = true;
    capReturns.push({side, number:target.number});
    notify("warn", "CAP RETURNED", [`${side}${target.number} returned from CAP`, `2nd ladder starts next round`]);
  } else if (target.state === "locked"){
    // locked behaves as zero; nothing
  }
  return { exposure, winEntries, capReturns };
}

function activateCapReturns(){
  for (const side of ["Y","K"]){
    for (const n of Object.values(state.sides[side])){
      if (n.state === "cap" && n.capReturnPending){
        n.state = "second-active";
        n.phase = 2;
        n.step = 1;
        n.activatedAt = state.chakra + 1;
        n.previousLoss = 0;
        n.winningBet = 0;
        n.capReturnPending = false;
      }
    }
  }
}

function processRound(y, k){
  state.historyStack.push(snapshotState());
  state.notifications = [];
  activateCapReturns();

  let totalExposure = 0;
  const wins = [];

  if (typeof y === "number"){
    const outY = processSideResult("Y", y, wins);
    totalExposure += outY.exposure;
    wins.push(...outY.winEntries);
  }
  if (typeof k === "number"){
    const outK = processSideResult("K", k, wins);
    totalExposure += outK.exposure;
    wins.push(...outK.winEntries);
  }

  state.liveBankroll -= totalExposure;
  state.totalAhuti += totalExposure;
  state.maxExposure = Math.max(state.maxExposure, totalExposure);
  state.chakra += 1;
  state.lastRound = { y, k, exposure: totalExposure, bankroll: state.liveBankroll };

  const kumbh = getCurrentKumbh();
  kumbh.rows.unshift({
    chakra: state.chakra,
    y: typeof y === "number" ? y : "-",
    k: typeof k === "number" ? k : "-",
    ahuti: totalExposure,
    axyapatra: state.liveBankroll
  });

  if (wins.length){
    const lines = wins.map(w => `${w.side}${w.number} → ${w.phase===2?`2S${w.step}`:`S${w.step}`} → Āhuti ${w.bet} → Net ${w.net>=0?"+":""}${w.net}`);
    notify("win", "VIJAY DARSHANA", lines);
  }

  if (state.liveBankroll <= state.settings.startBankroll - 2000){
    notify("warn", "SANKATA SUCHANA", [`Axyapatra approaching Raksha Rekha`, `Live ${money(state.liveBankroll)}`]);
  }

  saveState();
  render();
}

function getCurrentKumbh(){
  let kumbh = state.granth.find(k => k.id === state.currentKumbhId);
  if (!kumbh){
    kumbh = { id: state.currentKumbhId, rows: [] };
    state.granth.unshift(kumbh);
  }
  return kumbh;
}

function resetBoardForKumbha(){
  state.historyStack.push(snapshotState());
  state.liveBankroll = state.settings.startBankroll;
  state.chakra = 0;
  state.pending = {Y:null, K:null};
  state.sides = { Y:createSideState(), K:createSideState() };
  state.drishti = [];
  state.totalAhuti = 0;
  state.maxExposure = 0;
  state.notifications = [];
  state.lastRound = null;
  notify("warn", "KUMBHA SHUDDHI", ["Current board cleared", "Axyapatra reset to starting bankroll"]);
  saveState();
  render();
}

function startPrayoga(){
  state.historyStack.push(snapshotState());
  state.currentKumbhId = state.kumbhCounter + 1;
  state.kumbhCounter = state.currentKumbhId;
  resetBoardForKumbha();
}

function handleKeypadTap(side, value, btn){
  if (state.settings.keypadMode === "combined"){
    state.pending[side] = value;
    if (btn){
      document.querySelectorAll(`#board${side} .key`).forEach(k=>k.classList.remove("active-pick"));
      btn.classList.add("active-pick");
    }
    if (state.pending.Y !== null && state.pending.K !== null){
      const y = state.pending.Y;
      const k = state.pending.K;
      state.pending = {Y:null, K:null};
      processRound(y, k);
    } else {
      saveState(); render();
    }
  } else {
    processRound(side === "Y" ? value : null, side === "K" ? value : null);
  }
}

function bindBoards(){
  ["Y","K"].forEach(side => {
    const board = document.getElementById(`board${side}`);
    board.innerHTML = "";
    for (let i=1;i<=9;i++){
      const btn = document.createElement("button");
      btn.className = "key";
      btn.textContent = i;
      btn.addEventListener("click", ()=>handleKeypadTap(side, i, btn));
      board.appendChild(btn);
    }
    const zero = document.createElement("button");
    zero.className = "key zero";
    zero.textContent = "0";
    zero.addEventListener("click", ()=>handleKeypadTap(side, 0, zero));
    board.appendChild(zero);
  });
}

function renderTab(){
  document.getElementById("screenTitle").textContent = TAB_TITLES[state.activeTab];
  document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".bottom-nav .nav").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === state.activeTab);
  });
  document.getElementById(`tab-${state.activeTab}`).classList.add("active");
}

function renderTop(){
  document.getElementById("liveBankroll").textContent = money(state.liveBankroll);
  document.getElementById("chakraBadge").textContent = `Chakra ${state.chakra}`;
  document.getElementById("chakraValue").textContent = state.chakra;
  document.getElementById("bankrollStatus").textContent = state.settings.keypadMode === "combined" ? "Combined mode" : "Individual mode";
}

function groupAhuti(side){
  const ladders = getLadders();
  const nums = allActiveForExposure(side).map(n => ({
    number:n.number,
    stepLabel: n.phase===2 ? `2S${n.step}` : `S${n.step}`,
    bet: currentBetFor(n, state.settings, ladders)
  }));
  nums.sort((a,b)=>b.bet-a.bet || a.number-b.number);
  const groups = {};
  nums.forEach(n => {
    groups[n.bet] ||= [];
    groups[n.bet].push(`${n.number}(${n.stepLabel})`);
  });
  const parts = Object.keys(groups).sort((a,b)=>Number(b)-Number(a)).map(bet => `${bet} on ${groups[bet].join(" ")}`);
  return { text: parts.join(" | "), total: nums.reduce((a,b)=>a+b.bet,0) };
}

function renderAhuti(){
  const y = groupAhuti("Y");
  const k = groupAhuti("K");
  document.getElementById("nextAhutiY").textContent = `Y ${y.text || "—"}`;
  document.getElementById("nextAhutiK").textContent = `K ${k.text || "—"}`;
  document.getElementById("nextAhutiT").textContent = `T ${shortMoney(y.total + k.total)}`;
  document.getElementById("pendingY").textContent = `Pending: ${state.pending.Y===null ? "-" : state.pending.Y}`;
  document.getElementById("pendingK").textContent = `Pending: ${state.pending.K===null ? "-" : state.pending.K}`;
}

function renderNotifications(){
  const box = document.getElementById("notificationArea");
  box.innerHTML = "";
  state.notifications.forEach(n => {
    const el = document.createElement("div");
    el.className = `notice ${n.type}`;
    el.innerHTML = `<div class="notice-title">${n.title}</div>${n.lines.map(l => `<div>${l}</div>`).join("")}`;
    box.appendChild(el);
  });
}

function renderVyuha(){
  ["Y","K"].forEach(side => {
    const el = document.getElementById(`vyuha${side}`);
    el.innerHTML = "";
    for(let i=1;i<=9;i++){
      const n = state.sides[side][i];
      const div = document.createElement("div");
      let cls = "formation-tile ";
      let meta = "-";
      if (n.state === "inactive") cls += "inactive";
      if (n.state === "active" || n.state === "second-active"){ cls += "state-active"; meta = n.phase===2 ? `2S${n.step}` : `S${n.step}`; }
      if (n.state === "locked"){ cls += "state-locked"; meta = "LOCKED"; }
      if (n.state === "cap"){ cls += "state-cap"; meta = "CAP"; }
      div.className = cls;
      div.innerHTML = `<div class="n ${stepClass(n.step)}">${i}</div><div class="m">${meta}</div>`;
      el.appendChild(div);
    }
  });
}

function renderGranth(){
  const list = document.getElementById("granthList");
  list.innerHTML = "";
  if (!state.granth.length){
    list.innerHTML = "<div class='kumbh-card'>No Kumbh history yet.</div>";
    return;
  }
  state.granth.sort((a,b)=>b.id-a.id).forEach(k => {
    const card = document.createElement("div");
    card.className = "kumbh-card";
    let rows = k.rows.slice(0,12).map(r=>`<tr><td>${r.chakra}</td><td>${r.y}</td><td>${r.k}</td><td>${r.ahuti}</td><td>${r.axyapatra}</td></tr>`).join("");
    card.innerHTML = `<div class="kumbh-title">#${String(k.id).padStart(2,"0")} Kumbh</div>
      <div class="table-wrap"><table><thead><tr><th>Chakra</th><th>Y</th><th>K</th><th>Āhuti</th><th>Axyapatra</th></tr></thead><tbody>${rows || "<tr><td colspan='5'>Empty</td></tr>"}</tbody></table></div>`;
    list.appendChild(card);
  });
}

function renderDrishti(){
  document.getElementById("sumChakras").textContent = state.chakra;
  document.getElementById("sumAhuti").textContent = state.totalAhuti;
  document.getElementById("sumNet").textContent = (state.liveBankroll - state.settings.startBankroll >= 0 ? "+" : "") + (state.liveBankroll - state.settings.startBankroll);
  document.getElementById("sumMaxExposure").textContent = state.maxExposure;
  const body = document.getElementById("drishtiBody");
  body.innerHTML = "";
  state.drishti.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.Side}</td><td>${r.Number}</td><td>${r.ActivationChakra}</td><td>${r.WinChakra}</td><td>${r.StepsToWin}</td><td>${r.PreviousLoss}</td><td>${r.WinningBet}</td><td>${r.NetProfitLoss}</td><td>${r.Status}</td>`;
    body.appendChild(tr);
  });
}

function renderSopana(){
  document.getElementById("firstStepCount").textContent = state.settings.maxSteps;
  document.getElementById("secondStepCount").textContent = state.settings.secondMaxSteps;
  const ladders = getLadders();
  const tbody = document.getElementById("sopanaTable");
  tbody.innerHTML = "";
  const maxLen = Math.max(ladders.first.length, ladders.second.length);
  for(let i=0;i<maxLen;i++){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i<ladders.first.length ? `S${i+1}` : ""}</td><td>${i<ladders.first.length ? ladders.first[i] : ""}</td><td>${i<ladders.second.length ? `2S${i+1}` : ""}</td><td>${i<ladders.second.length ? ladders.second[i] : ""}</td>`;
    tbody.appendChild(tr);
  }
}

function renderYantra(){
  document.getElementById("setBankroll").value = state.settings.startBankroll;
  document.getElementById("setTargetProfit").value = state.settings.targetProfit;
  document.getElementById("setMinBet").value = state.settings.minBet;
  document.getElementById("setMaxBet").value = state.settings.maxBet;
  document.getElementById("setCoinSize").value = state.settings.coinSize;
  document.getElementById("setMaxSteps").value = state.settings.maxSteps;
  document.getElementById("setSecondMaxSteps").value = state.settings.secondMaxSteps;
  document.getElementById("setKeypadMode").value = state.settings.keypadMode;
}

function renderMedha(){
  const caps = state.drishti.filter(r => r.Status === "CAP").length;
  const winCount = state.drishti.filter(r => r.Status === "WIN").length;
  const maxStepY = Math.max(0,...Object.values(state.sides.Y).map(n=>n.step));
  const maxStepK = Math.max(0,...Object.values(state.sides.K).map(n=>n.step));
  document.getElementById("medhaInsights").innerHTML = `
    <div>Wins recorded: <b>${winCount}</b></div>
    <div>CAP records: <b>${caps}</b></div>
    <div>Highest live Y step: <b>${maxStepY}</b></div>
    <div>Highest live K step: <b>${maxStepK}</b></div>
    <div>Current mode: <b>${state.settings.keypadMode}</b></div>
  `;
}

function render(){
  renderTab();
  renderTop();
  renderAhuti();
  renderNotifications();
  renderVyuha();
  renderGranth();
  renderDrishti();
  renderSopana();
  renderYantra();
  renderMedha();
}

function applyYantra(){
  const oldStart = state.settings.startBankroll;
  state.settings.startBankroll = Number(document.getElementById("setBankroll").value) || defaultSettings.startBankroll;
  state.settings.targetProfit = Number(document.getElementById("setTargetProfit").value) || defaultSettings.targetProfit;
  state.settings.minBet = Number(document.getElementById("setMinBet").value) || defaultSettings.minBet;
  state.settings.maxBet = Number(document.getElementById("setMaxBet").value) || defaultSettings.maxBet;
  state.settings.coinSize = Number(document.getElementById("setCoinSize").value) || defaultSettings.coinSize;
  state.settings.maxSteps = Number(document.getElementById("setMaxSteps").value) || 30;
  state.settings.secondMaxSteps = 15;
  state.settings.keypadMode = document.getElementById("setKeypadMode").value;
  if (state.liveBankroll === oldStart) state.liveBankroll = state.settings.startBankroll;
  saveState();
  render();
}

function exportCsv(){
  const headers = ["Side","Number","ActivationChakra","WinChakra","StepsToWin","PreviousLoss","WinningBet","NetProfitLoss","Status"];
  const rows = state.drishti.map(r => headers.map(h => r[h]).join(","));
  downloadFile("kubera_drishti.csv", [headers.join(","), ...rows].join("\n"), "text/csv");
}
function loadCsv(file){
  const reader = new FileReader();
  reader.onload = () => {
    const lines = String(reader.result).trim().split(/\r?\n/);
    const headers = lines.shift().split(",");
    state.drishti = lines.filter(Boolean).map(line => {
      const values = line.split(",");
      const obj = {};
      headers.forEach((h,i) => obj[h] = values[i]);
      return obj;
    });
    saveState(); render();
  };
  reader.readAsText(file);
}
function exportGranth(){ downloadFile("kubera_granth.json", JSON.stringify(state.granth, null, 2), "application/json"); }
function importGranth(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      state.granth = JSON.parse(String(reader.result));
      saveState(); render();
    }catch(e){ alert("Invalid Granth file"); }
  };
  reader.readAsText(file);
}
function downloadFile(name, content, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function bindEvents(){
  document.querySelectorAll(".bottom-nav .nav").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      saveState(); render();
    });
  });
  document.getElementById("kumbhaBtn").addEventListener("click", resetBoardForKumbha);
  document.getElementById("prayogaBtn").addEventListener("click", startPrayoga);
  document.getElementById("undoBtn").addEventListener("click", () => {
    const snap = state.historyStack.pop();
    if (!snap) return;
    restoreSnapshot(snap);
    saveState(); render();
  });
  document.getElementById("applyYantraBtn").addEventListener("click", applyYantra);
  document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
  document.getElementById("loadCsvInput").addEventListener("change", e => e.target.files[0] && loadCsv(e.target.files[0]));
  document.getElementById("exportGranthBtn").addEventListener("click", exportGranth);
  document.getElementById("importGranthInput").addEventListener("change", e => e.target.files[0] && importGranth(e.target.files[0]));
  document.getElementById("deleteGranthBtn").addEventListener("click", () => {
    if (confirm("Delete Granth?\nThis removes all Kumbh history.")){
      state.granth = [];
      saveState(); render();
    }
  });

  let deferredPrompt;
  window.addEventListener("beforeinstallprompt",(e)=>{
    e.preventDefault(); deferredPrompt=e;
    document.getElementById("installBtn").classList.remove("hidden");
  });
  document.getElementById("installBtn").addEventListener("click", async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null;
  });
  if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js")); }
}

bindBoards();
bindEvents();
render();
saveState();
