const STORAGE_KEY = "kubera_warhunt_state_v1";
const defaultSettings = {
  axyapatra: 30000,
  targetUsd: 500,
  targetPct: 1.67,
  stopLoss: 2000,
  minBet: 100,
  maxBet: 3000,
  multiple: 100,
  targetNumber: 500,
  doubleLadder: true,
  maxSteps: 12,
  safety: 20000,
  capRule: true
};
const makeNumState = () => ({ state: "INACTIVE", step: 1 });
let state = {
  settings: { ...defaultSettings },
  startBankroll: 30000,
  bankroll: 30000,
  chakra: 0,
  totalBetAmount: 0,
  maxExposure: 0,
  netProfit: 0,
  yNums: {},
  kNums: {},
  history: [],
  ladder: [],
  pendingY: null,
  pendingK: null
};
let undoStack = [];
const el = id => document.getElementById(id);
function roundUpToMultiple(value, multiple) {
  if (multiple <= 0) return value;
  return Math.ceil(value / multiple) * multiple;
}
function compact(n) {
  n = Number(n || 0);
  if (n >= 1000) return n % 1000 === 0 ? (n / 1000) + "k" : (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}
function money(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function initStates() {
  for (let i = 1; i <= 9; i++) {
    state.yNums[i] = makeNumState();
    state.kNums[i] = makeNumState();
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { initStates(); state.ladder = generateLadder(); return; }
  try {
    const parsed = JSON.parse(raw);
    state = { ...state, ...parsed, settings: { ...defaultSettings, ...(parsed.settings || {}) } };
    if (!state.yNums || !state.kNums) initStates();
    for (let i = 1; i <= 9; i++) {
      if (!state.yNums[i]) state.yNums[i] = makeNumState();
      if (!state.kNums[i]) state.kNums[i] = makeNumState();
    }
    if (!Array.isArray(state.ladder) || state.ladder.length === 0) state.ladder = generateLadder();
  } catch {
    initStates();
    state.ladder = generateLadder();
  }
}
function generateLadder() {
  const s = state.settings;
  const ladder = [];
  let prevLoss = 0;
  let current = roundUpToMultiple(Math.max(s.minBet, s.multiple), s.multiple);
  for (let i = 1; i <= s.maxSteps; i++) {
    current = Math.max(s.minBet, roundUpToMultiple(current, s.multiple));
    current = Math.min(current, s.maxBet);
    ladder.push({ step: i, amount: current });
    const netAtThisStep = (8 * current) - prevLoss;
    prevLoss += current;
    if (i < s.maxSteps) {
      if (s.doubleLadder) {
        if (netAtThisStep < s.targetNumber) current = Math.min(s.maxBet, roundUpToMultiple(current * 2, s.multiple));
      } else {
        const required = Math.max(s.minBet, roundUpToMultiple((s.targetNumber + prevLoss) / 8, s.multiple));
        current = Math.min(s.maxBet, required);
      }
    }
  }
  return ladder;
}
function getBetAmount(step) {
  if (!state.ladder.length) return 0;
  const safe = Math.min(Math.max(step, 1), state.settings.maxSteps);
  return state.ladder[safe - 1].amount;
}
function findStepForAmount(amount) {
  let idx = state.ladder.findIndex(item => item.amount >= amount);
  if (idx === -1) idx = state.ladder.length - 1;
  return idx + 1;
}
function setToggle(btn, isOn) { btn.classList.toggle("on", isOn); btn.textContent = isOn ? "ON" : "OFF"; }
function bindToggles() {
  const doubleBtn = el("set-double-ladder");
  const capBtn = el("set-cap-rule");
  doubleBtn.addEventListener("click", () => setToggle(doubleBtn, !doubleBtn.classList.contains("on")));
  capBtn.addEventListener("click", () => setToggle(capBtn, !capBtn.classList.contains("on")));
}
function bindTargetLinking() {
  const a = el("set-axyapatra");
  const usd = el("set-target-usd");
  const pct = el("set-target-pct");
  usd.addEventListener("input", () => {
    const start = parseFloat(a.value) || 0;
    const val = parseFloat(usd.value) || 0;
    pct.value = start > 0 ? ((val / start) * 100).toFixed(2) : "0";
  });
  pct.addEventListener("input", () => {
    const start = parseFloat(a.value) || 0;
    const val = parseFloat(pct.value) || 0;
    usd.value = Math.round((val / 100) * start);
  });
  a.addEventListener("input", () => {
    const start = parseFloat(a.value) || 0;
    const val = parseFloat(usd.value) || 0;
    pct.value = start > 0 ? ((val / start) * 100).toFixed(2) : "0";
  });
}
function showModal(title, message, actions) {
  el("modal-title").textContent = title;
  el("modal-message").textContent = message;
  const container = el("modal-actions");
  container.innerHTML = "";
  actions.forEach(a => {
    const b = document.createElement("button");
    b.className = "modal-btn" + (a.primary ? " primary" : "") + (a.danger ? " danger" : "");
    b.textContent = a.label;
    b.onclick = () => { hideModal(); if (a.onClick) a.onClick(); };
    container.appendChild(b);
  });
  el("modal-overlay").classList.remove("hidden");
}
function hideModal() { el("modal-overlay").classList.add("hidden"); }
function applyYantra(showNote = true) {
  state.settings.axyapatra = parseInt(el("set-axyapatra").value || "30000", 10);
  state.settings.targetUsd = parseFloat(el("set-target-usd").value || "500");
  state.settings.targetPct = parseFloat(el("set-target-pct").value || "1.67");
  state.settings.stopLoss = parseInt(el("set-stop-loss").value || "2000", 10);
  state.settings.minBet = parseInt(el("set-min-bet").value || "100", 10);
  state.settings.maxBet = parseInt(el("set-max-bet").value || "3000", 10);
  state.settings.multiple = parseInt(el("set-multiple").value || "100", 10);
  state.settings.targetNumber = parseInt(el("set-target-number").value || "500", 10);
  state.settings.doubleLadder = el("set-double-ladder").classList.contains("on");
  state.settings.maxSteps = parseInt(el("set-max-steps").value || "12", 10);
  state.settings.safety = parseInt(el("set-safety").value || "20000", 10);
  state.settings.capRule = el("set-cap-rule").classList.contains("on");
  state.startBankroll = state.settings.axyapatra;
  state.bankroll = state.startBankroll;
  state.ladder = generateLadder();
  resetKumbha(true);
  saveState();
  if (showNote) showModal("Yantra Aligned", "Sacred settings have been applied successfully.", [{ label: "OK", primary: true }]);
}
function resetKumbha(silent = false) {
  state.bankroll = state.startBankroll;
  state.chakra = 0;
  state.totalBetAmount = 0;
  state.maxExposure = 0;
  state.netProfit = 0;
  state.pendingY = null;
  state.pendingK = null;
  state.history = [];
  initStates();
  undoStack = [];
  renderAll();
  saveState();
  if (!silent) showModal("New Kumbha Begun", "The treasury cycle has been renewed.", [{ label: "OK", primary: true }]);
}
function bindControls() {
  el("btn-undo").addEventListener("click", () => {
    if (!undoStack.length) {
      showModal("No Chakra to Reverse", "There is no recent battle entry to withdraw.", [{ label: "OK", primary: true }]);
      return;
    }
    state = undoStack.pop();
    renderAll();
    saveState();
    showModal("Last Chakra Reversed", "The previous battle entry has been withdrawn.", [{ label: "OK", primary: true }]);
  });
  el("btn-clear").addEventListener("click", () => {
    showModal("Clear Kumbha?", "All Chakra history will be removed.", [
      { label: "Cancel" },
      { label: "Clear", danger: true, onClick: () => resetKumbha(true) }
    ]);
  });
  el("btn-new").addEventListener("click", () => {
    showModal("Begin a New Kumbha?", "A fresh treasury cycle will start.", [
      { label: "Cancel" },
      { label: "Begin", primary: true, onClick: () => resetKumbha(true) }
    ]);
  });
  el("btn-apply-yantra").addEventListener("click", () => applyYantra(true));
}
function bindNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      btn.classList.add("active");
      el(btn.dataset.target).classList.add("active");
      if (btn.dataset.target === "vyuha") renderVyuha();
      if (btn.dataset.target === "sopana") renderSopana();
    });
  });
}
function updateKeypadVisuals() {
  document.querySelectorAll(".num-btn").forEach(btn => {
    const side = btn.dataset.side;
    const val = parseInt(btn.dataset.val, 10);
    const selected = (side === "Y" && val === state.pendingY) || (side === "K" && val === state.pendingK);
    btn.classList.toggle("selected", selected);
  });
}
function bindKeypads() {
  document.querySelectorAll(".num-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const side = btn.dataset.side;
      const val = parseInt(btn.dataset.val, 10);
      if (side === "Y") state.pendingY = val;
      if (side === "K") state.pendingK = val;
      updateKeypadVisuals();
      if (state.pendingY !== null && state.pendingK !== null) {
        undoStack.push(clone(state));
        processChakra(state.pendingY, state.pendingK);
        state.pendingY = null;
        state.pendingK = null;
        updateKeypadVisuals();
      }
    });
  });
}
function activeNumbersForSide(sideKey) {
  const dict = sideKey === "Y" ? state.yNums : state.kNums;
  const arr = [];
  for (let i = 1; i <= 9; i++) {
    const obj = dict[i];
    if (obj.state === "ACTIVE") arr.push({ num: i, step: obj.step, amount: getBetAmount(obj.step) });
  }
  return arr.sort((a, b) => b.step - a.step || a.num - b.num);
}
function sideExposure(sideKey) { return activeNumbersForSide(sideKey).reduce((sum, x) => sum + x.amount, 0); }
function renderYKTPanel() {
  const yArr = activeNumbersForSide("Y");
  const kArr = activeNumbersForSide("K");
  const rowHTML = arr => {
    if (!arr.length) return "-";
    return arr.map(item => {
      const cls = "step-s" + Math.min(item.step, 5);
      return `<span class="plan-item ${cls}"><span class="amt">${compact(item.amount)}</span> on ${item.num}(<span class="step">S${item.step}</span>)</span>`;
    }).join(" | ");
  };
  el("y-plan").innerHTML = rowHTML(yArr);
  el("k-plan").innerHTML = rowHTML(kArr);
  el("t-plan").textContent = compact(sideExposure("Y") + sideExposure("K"));
}
function renderChakraPanel() {
  el("current-chakra").textContent = state.chakra;
  el("chakra-y-active").textContent = activeNumbersForSide("Y").length;
  el("chakra-k-active").textContent = activeNumbersForSide("K").length;
  el("chakra-y-net").textContent = money(sideExposure("Y"));
  el("chakra-k-net").textContent = money(sideExposure("K"));
}
function renderVyuha() {
  const buildGrid = (container, dict) => {
    container.innerHTML = "";
    for (let i = 1; i <= 9; i++) {
      const obj = dict[i];
      const tile = document.createElement("div");
      const css = obj.state === "ACTIVE" ? "active" : obj.state === "CAP" ? "cap" : obj.state === "LOCKED" ? "locked" : "inactive";
      tile.className = "vyuha-tile " + css;
      const num = document.createElement("div");
      num.className = "v-num";
      num.textContent = i;
      const meta = document.createElement("div");
      meta.className = "v-meta";
      if (obj.state === "ACTIVE") meta.innerHTML = `<span class="step-s${Math.min(obj.step, 5)}">S${obj.step}</span> ACTIVE`;
      else meta.textContent = obj.state;
      tile.appendChild(num);
      tile.appendChild(meta);
      container.appendChild(tile);
    }
  };
  buildGrid(el("vyuha-y"), state.yNums);
  buildGrid(el("vyuha-k"), state.kNums);
}
function renderHistory() {
  const body = el("history-body");
  body.innerHTML = "";
  state.history.slice().reverse().forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.chakra}</td><td>${r.y}</td><td>${r.k}</td><td>${r.bet}</td><td>${money(r.bankroll)}</td>`;
    body.appendChild(tr);
  });
}
function renderDrishti() {
  el("stat-rounds").textContent = state.chakra;
  el("stat-bets").textContent = money(state.totalBetAmount);
  el("stat-profit").textContent = money(state.netProfit);
  el("stat-exposure").textContent = money(state.maxExposure);
}
function renderSopana() {
  const body = el("ladder-body");
  body.innerHTML = "";
  state.ladder.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>S${row.step}</td><td><input type="number" data-idx="${idx}" value="${row.amount}"></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("change", () => {
      const idx = parseInt(inp.dataset.idx, 10);
      const val = parseInt(inp.value || "0", 10);
      state.ladder[idx].amount = val;
      renderYKTPanel();
      saveState();
    });
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        const next = body.querySelector(`input[data-idx="${parseInt(inp.dataset.idx, 10) + 1}"]`);
        if (next) { next.focus(); next.select(); }
      }
    });
  });
}
function renderHeader() {
  el("start-bankroll").textContent = Number(state.startBankroll).toLocaleString("en-IN");
  el("live-bankroll").textContent = Number(state.bankroll).toLocaleString("en-IN");
}
function syncYantraUI() {
  el("set-axyapatra").value = state.settings.axyapatra;
  el("set-target-usd").value = state.settings.targetUsd;
  el("set-target-pct").value = state.settings.targetPct;
  el("set-stop-loss").value = state.settings.stopLoss;
  el("set-min-bet").value = state.settings.minBet;
  el("set-max-bet").value = state.settings.maxBet;
  el("set-multiple").value = state.settings.multiple;
  el("set-target-number").value = state.settings.targetNumber;
  el("set-max-steps").value = state.settings.maxSteps;
  el("set-safety").value = state.settings.safety;
  setToggle(el("set-double-ladder"), state.settings.doubleLadder);
  setToggle(el("set-cap-rule"), state.settings.capRule);
}
function renderAll() {
  renderHeader();
  renderYKTPanel();
  renderChakraPanel();
  renderVyuha();
  renderHistory();
  renderDrishti();
  renderSopana();
  syncYantraUI();
  updateKeypadVisuals();
}
function capPrompt(sideKey, num) {
  const dict = sideKey === "Y" ? state.yNums : state.kNums;
  const quarterCap = roundUpToMultiple(Math.max(state.settings.minBet, getBetAmount(state.settings.maxSteps) / 4), state.settings.multiple);
  const restartStep = findStepForAmount(quarterCap);
  showModal("Sacred Limit Reached",
    `${sideKey === "Y" ? "Yaksha" : "Kinnara"} ${num} has returned from CAP.\nChoose its fate.`,
    [
      { label: "Abandon", danger: true, onClick: () => { dict[num].state = "LOCKED"; dict[num].step = 1; renderAll(); saveState(); } },
      { label: "Activate", primary: true, onClick: () => { dict[num].state = "ACTIVE"; dict[num].step = restartStep; renderAll(); saveState(); } }
    ]
  );
}
function processSide(sideKey, inputVal) {
  const dict = sideKey === "Y" ? state.yNums : state.kNums;
  if (inputVal === 0) return { exposure: 0, capHits: [] };
  let exposure = 0;
  const capHits = [];
  for (let i = 1; i <= 9; i++) if (dict[i].state === "ACTIVE") exposure += getBetAmount(dict[i].step);
  for (let i = 1; i <= 9; i++) {
    const obj = dict[i];
    if (obj.state === "ACTIVE") {
      const bet = getBetAmount(obj.step);
      if (i === inputVal) {
        state.bankroll += bet * 9;
        obj.state = "LOCKED";
        obj.step = 1;
      } else {
        obj.step += 1;
        if (obj.step > state.settings.maxSteps) {
          if (state.settings.capRule) {
            obj.state = "CAP";
            obj.step = state.settings.maxSteps;
          } else {
            obj.state = "ACTIVE";
            obj.step = state.settings.maxSteps;
          }
        }
      }
    }
  }
  const current = dict[inputVal];
  if (current.state === "INACTIVE" || current.state === "LOCKED") {
    current.state = "ACTIVE";
    current.step = 1;
  } else if (current.state === "CAP" && state.settings.capRule) {
    capHits.push({ sideKey, num: inputVal });
  }
  return { exposure, capHits };
}
function checkGoalGuards() {
  if (state.bankroll >= state.startBankroll + state.settings.targetUsd) {
    showModal("Treasury Triumph", "The target has been achieved.\nThe Kumbha may now be closed in profit.", [{ label: "OK", primary: true }]);
  } else if (state.bankroll <= state.startBankroll - state.settings.stopLoss) {
    showModal("Treasury Shield Broken", "The stop loss has been reached.\nWithdraw from the Sangram and preserve the reserve.", [{ label: "OK", primary: true }]);
  } else if ((state.bankroll - (sideExposure("Y") + sideExposure("K"))) < state.settings.safety) {
    showModal("Reserve Warning", "Safety Reserve is under pressure.", [{ label: "OK", primary: true }]);
  }
}
function processChakra(yIn, kIn) {
  if (yIn === 0 && kIn === 0) {
    state.history.push({ chakra: state.chakra + 1, y: 0, k: 0, bet: 0, bankroll: state.bankroll });
    state.chakra += 1;
    renderAll();
    saveState();
    return;
  }
  let exposure = 0;
  let capHits = [];
  const y = processSide("Y", yIn);
  const k = processSide("K", kIn);
  exposure = y.exposure + k.exposure;
  capHits = y.capHits.concat(k.capHits);
  state.bankroll -= exposure;
  state.totalBetAmount += exposure;
  state.maxExposure = Math.max(state.maxExposure, exposure);
  state.netProfit = state.bankroll - state.startBankroll;
  state.chakra += 1;
  state.history.push({ chakra: state.chakra, y: yIn, k: kIn, bet: exposure, bankroll: state.bankroll });
  renderAll();
  saveState();
  checkGoalGuards();
  if (capHits.length) {
    const hit = capHits[0];
    capPrompt(hit.sideKey, hit.num);
  }
}
function exportCSV() {
  let csv = "Chakra,Yaksha,Kinnara,Bet,Axyapatra\n";
  state.history.forEach(r => { csv += `${r.chakra},${r.y},${r.k},${r.bet},${r.bankroll}\n`; });
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kubera_granth.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportJSON() {
  const blob = new Blob([JSON.stringify(state.history, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kubera_granth.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportPDF() {
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Kubera Granth</title></head><body><h2>KUBERA WARHUNT - Granth</h2>${document.querySelector(".table-container").outerHTML}</body></html>`);
  w.document.close();
  w.print();
}
function bindImportExport() {
  el("btn-export").addEventListener("click", () => {
    showModal("Export Granth", "Choose the format for sealing your record.", [
      { label: "CSV", onClick: exportCSV },
      { label: "JSON", onClick: exportJSON },
      { label: "PDF", primary: true, onClick: exportPDF }
    ]);
  });
  el("btn-import").addEventListener("click", () => {
    showModal("Import Granth?", "Importing a record will replace the current Kumbha.", [
      { label: "Cancel" },
      { label: "Import", primary: true, onClick: () => el("file-import").click() }
    ]);
  });
  el("file-import").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
    } catch {}
    try {
      if (name.endsWith(".json")) {
        const text = await file.text();
        const rows = JSON.parse(text);
        importRows(rows);
      } else if (name.endsWith(".csv")) {
        const text = await file.text();
        const lines = text.trim().split(/\r?\n/);
        const rows = lines.slice(1).map(line => {
          const [chakra, y, k, bet, axyapatra] = line.split(",");
          return { chakra: Number(chakra), y: Number(y), k: Number(k), bet: Number(bet), bankroll: Number(axyapatra) };
        });
        importRows(rows);
      } else {
        showModal("Granth Rejected", "Excel import is not supported in this build.\nUse CSV or JSON.", [{ label: "OK", primary: true }]);
      }
    } catch {
      showModal("Granth Rejected", "The selected record is not in a valid sacred format.", [{ label: "OK", primary: true }]);
    } finally {
      e.target.value = "";
    }
  });
}
function importRows(rows) {
  if (!rows || !rows.length) {
    showModal("Empty Granth", "No usable Chakra records were found in the selected file.", [{ label: "OK", primary: true }]);
    return;
  }
  resetKumbha(true);
  for (const row of rows) {
    undoStack.push(clone(state));
    processChakra(Number(row.y), Number(row.k));
  }
  showModal("Granth Restored", "The sacred record has been loaded.\nLIVE AXYAPATRA has been renewed.", [{ label: "OK", primary: true }]);
}
function bootstrap() {
  loadState();
  bindToggles();
  bindTargetLinking();
  bindControls();
  bindNavigation();
  bindKeypads();
  bindImportExport();
  renderAll();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}
bootstrap();
