// #005 - 2026-03-08 15:12:46 PM IST

// ==========================================
// KUBERA 💰 WARHUNT - Core Engine Logic
// ==========================================

// --- Configuration & Global State ---
let settings = {
    axyapatra: 30000,
    targetUsd: 1000,
    targetPct: 10,
    stopLoss: 10000,
    minBet: 100,
    maxBet: 5000,
    multiple: 1,
    isDouble: false,
    maxSteps: 5,
    safetyReserve: 5000,
    capRule: true,
    payoutMultiplier: 9
};

let ladder = [];

let appState = {
    currentShoe: 1,
    chakra: 1,
    bankroll: 30000,
    yNums: {}, 
    kNums: {}
};

let stateHistory = []; // For Undo
let allShoesHistory = []; // Granth history
let pendingY = null;
let pendingK = null;

// Analytics (Drishti) tracking per shoe
let drishtiStats = {
    roundsPlayed: 0,
    totalBets: 0,
    netProfit: 0,
    maxExposure: 0,
    numData: {} // side_num -> { activationRound, repeatRound, winStep, netProfit, capOccurrence }
};

// --- Initialization ---
function init() {
    initNumbersState();
    initDrishtiData();
    bindEvents();
    syncSettingsFromUI();
    rebuildLadder();
    appState.bankroll = settings.axyapatra;
    updateAllUI();
    injectModalStyles();
}

function initNumbersState() {
    appState.yNums = {};
    appState.kNums = {};
    for (let i = 1; i <= 9; i++) {
        appState.yNums[i] = { state: 'INACTIVE', step: 0 };
        appState.kNums[i] = { state: 'INACTIVE', step: 0 };
    }
}

function initDrishtiData() {
    drishtiStats.numData = {};
    ['Y', 'K'].forEach(side => {
        for (let i = 1; i <= 9; i++) {
            drishtiStats.numData[`${side}_${i}`] = {
                activationRound: '-',
                repeatRound: '-',
                winStep: '-',
                netProfit: 0,
                capOccurrence: 0
            };
        }
    });
}

// --- DOM / Event Binding ---
function bindEvents() {
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const side = e.target.getAttribute('data-side');
            const val = parseInt(e.target.getAttribute('data-val'), 10);
            handleInput(side, val);
        });
    });

    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-clear').addEventListener('click', clearKumbha);
    document.getElementById('btn-new').addEventListener('click', startNewShoe);
    document.getElementById('btn-apply-yantra').addEventListener('click', applyYantra);
    
    // Yantra linked inputs
    const elAxyapatra = document.getElementById('set-axyapatra');
    const elTargetUsd = document.getElementById('set-target-usd');
    const elTargetPct = document.getElementById('set-target-pct');

    elTargetUsd.addEventListener('input', (e) => {
        let axy = parseFloat(elAxyapatra.value) || 0;
        let val = parseFloat(e.target.value) || 0;
        if(axy > 0) elTargetPct.value = ((val / axy) * 100).toFixed(2);
    });

    elTargetPct.addEventListener('input', (e) => {
        let axy = parseFloat(elAxyapatra.value) || 0;
        let val = parseFloat(e.target.value) || 0;
        elTargetUsd.value = ((val / 100) * axy).toFixed(2);
    });

    // Granth Export
    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', exportCSV);

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const target = e.target.closest('.nav-btn');
            target.classList.add('active');
            document.getElementById(target.getAttribute('data-target')).classList.add('active');
            updateAllUI();
        });
    });
}

// --- Modals & Notifications ---
function injectModalStyles() {
    if (document.getElementById('kubera-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'kubera-modal-styles';
    style.innerHTML = `
        .kubera-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #ffd700; color: #000; padding: 10px 20px; border-radius: 4px; z-index: 10000; font-weight: bold; animation: fadeOut 3s forwards; pointer-events: none; text-transform: uppercase;}
        .kubera-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .kubera-modal { background: #0a1128; border: 2px solid #ff4500; padding: 20px; border-radius: 8px; text-align: center; color: white; width: 80%; max-width: 400px; text-transform: uppercase;}
        .kubera-modal h3 { color: #ff4500; margin-bottom: 15px; }
        .kubera-modal-btns { display: flex; gap: 10px; margin-top: 20px; }
        .kubera-modal-btns button { flex: 1; padding: 10px; background: #111d40; color: white; border: 1px solid #ffd700; cursor: pointer; border-radius: 4px; font-weight: bold;}
        .kubera-modal-btns button:hover { background: #ffd700; color: black; }
        @keyframes fadeOut { 0% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
    `;
    document.head.appendChild(style);
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'kubera-toast';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function showModal(title, msg, onContinue, onEnd) {
    const overlay = document.createElement('div');
    overlay.className = 'kubera-overlay';
    
    let buttonsHTML = '';
    if (onContinue || onEnd) {
        buttonsHTML = `<div class="kubera-modal-btns">
            ${onContinue ? `<button id="k-mod-cont">Continue</button>` : ''}
            ${onEnd ? `<button id="k-mod-end">End</button>` : ''}
        </div>`;
    } else {
        buttonsHTML = `<div class="kubera-modal-btns"><button id="k-mod-ok">Acknowledge</button></div>`;
    }

    overlay.innerHTML = `
        <div class="kubera-modal">
            <h3>${title}</h3>
            <p>${msg}</p>
            ${buttonsHTML}
        </div>
    `;
    document.body.appendChild(overlay);

    if (onContinue) {
        document.getElementById('k-mod-cont').addEventListener('click', () => { overlay.remove(); onContinue(); });
    }
    if (onEnd) {
        document.getElementById('k-mod-end').addEventListener('click', () => { overlay.remove(); onEnd(); });
    }
    if (!onContinue && !onEnd) {
        document.getElementById('k-mod-ok').addEventListener('click', () => overlay.remove());
    }
}

// --- Engine Execution ---
function handleInput(side, val) {
    if (side === 'Y') pendingY = val;
    if (side === 'K') pendingK = val;
    highlightPending();

    if (pendingY !== null && pendingK !== null) {
        processChakra(pendingY, pendingK);
        pendingY = null;
        pendingK = null;
        highlightPending();
    }
}

function highlightPending() {
    document.querySelectorAll('.num-btn').forEach(btn => {
        let side = btn.getAttribute('data-side');
        let val = parseInt(btn.getAttribute('data-val'), 10);
        if ((side === 'Y' && val === pendingY) || (side === 'K' && val === pendingK)) {
            btn.style.boxShadow = 'inset 0 0 10px #ffd700';
            btn.style.background = '#ffd700';
            btn.style.color = 'black';
        } else {
            btn.style.boxShadow = '';
            btn.style.background = '';
            btn.style.color = '';
        }
    });
}

function getBet(step) {
    if (step < 1) return 0;
    let s = Math.min(step, settings.maxSteps);
    return ladder[s - 1] ? ladder[s - 1].amount : 0;
}

function processChakra(yVal, kVal) {
    // 1. Snapshot for Undo
    stateHistory.push(JSON.parse(JSON.stringify(appState)));

    // 2. Compute current exposure & deduct
    let roundExposure = 0;
    let roundBetsCount = 0;

    const calcExposure = (dict) => {
        for (let i = 1; i <= 9; i++) {
            if (dict[i].state === 'ACTIVE') {
                roundExposure += getBet(dict[i].step);
                roundBetsCount++;
            }
        }
    };
    calcExposure(appState.yNums);
    calcExposure(appState.kNums);

    appState.bankroll -= roundExposure;
    drishtiStats.totalBets += roundBetsCount;
    drishtiStats.roundsPlayed++;
    if (roundExposure > drishtiStats.maxExposure) drishtiStats.maxExposure = roundExposure;

    // Record total exposure deducted to analytics stats
    const applyCostToDrishti = (sideStr, dict) => {
        for(let i=1; i<=9; i++) {
            if (dict[i].state === 'ACTIVE') {
                drishtiStats.numData[`${sideStr}_${i}`].netProfit -= getBet(dict[i].step);
            }
        }
    };
    applyCostToDrishti('Y', appState.yNums);
    applyCostToDrishti('K', appState.kNums);

    // 3. Process outcomes
    let isCapReturnTriggered = false;

    const processSide = (val, dict, sideStr) => {
        if (val === 0) {
            // Neutral Loss: all active advance
            for (let i = 1; i <= 9; i++) {
                if (dict[i].state === 'ACTIVE') advanceStep(dict[i], `${sideStr}_${i}`);
            }
            return;
        }

        for (let i = 1; i <= 9; i++) {
            let obj = dict[i];
            let stat = drishtiStats.numData[`${sideStr}_${i}`];

            if (i === val) {
                if (obj.state === 'INACTIVE') {
                    obj.state = 'ACTIVE';
                    obj.step = 1;
                    stat.activationRound = appState.chakra;
                } 
                else if (obj.state === 'ACTIVE') {
                    // Win
                    let winAmt = getBet(obj.step) * settings.payoutMultiplier;
                    appState.bankroll += winAmt;
                    stat.netProfit += winAmt;
                    stat.repeatRound = appState.chakra;
                    stat.winStep = obj.step;
                    obj.state = 'LOCKED';
                    showToast("TREASURY TRIUMPH");
                }
                else if (obj.state === 'CAP') {
                    isCapReturnTriggered = true;
                }
                // LOCKED does nothing
            } else {
                if (obj.state === 'ACTIVE') {
                    advanceStep(obj, `${sideStr}_${i}`);
                }
            }
        }
    };

    function advanceStep(obj, statKey) {
        obj.step++;
        if (obj.step > settings.maxSteps) {
            if (settings.capRule) {
                obj.state = 'CAP';
                obj.step = settings.maxSteps; // Hold at max for display
                drishtiStats.numData[statKey].capOccurrence++;
            } else {
                obj.step = settings.maxSteps; // Remains ACTIVE, bets max
            }
        }
    }

    processSide(yVal, appState.yNums, 'Y');
    processSide(kVal, appState.kNums, 'K');

    // 4. Update Granth History
    addHistoryRow(appState.chakra, yVal, kVal, roundExposure, appState.bankroll);
    
    // Increment Chakra
    appState.chakra++;
    drishtiStats.netProfit = appState.bankroll - settings.axyapatra;

    // 5. Post-round checks
    checkThresholds();
    updateAllUI();

    if (isCapReturnTriggered) {
        showModal("CAP RETURNED", "A capped number has returned.", 
            () => {}, // Continue
            () => clearKumbha() // End
        );
    }
}

function checkThresholds() {
    if (appState.bankroll <= settings.stopLoss) {
        showModal("TREASURY WARNING", `Bankroll reached Stop Loss (₹${settings.stopLoss})`);
    } else if (appState.bankroll <= settings.safetyReserve) {
        showModal("TREASURY WARNING", `Bankroll reached Safety Reserve (₹${settings.safetyReserve})`);
    }
}

// --- Undo / Clear / New ---

function undo() {
    if (stateHistory.length === 0) {
        showToast("No history to undo");
        return;
    }
    appState = stateHistory.pop();
    
    const tbody = document.getElementById('history-body');
    if (tbody.firstElementChild) tbody.removeChild(tbody.firstElementChild);
    
    drishtiStats.roundsPlayed = Math.max(0, drishtiStats.roundsPlayed - 1);
    
    updateAllUI();
    showToast("UNDO SUCCESSFUL");
}

function clearKumbha() {
    appState.chakra = 1;
    initNumbersState();
    stateHistory = [];
    document.getElementById('history-body').innerHTML = '';
    pendingY = null;
    pendingK = null;
    highlightPending();
    updateAllUI();
    showToast("KUMBHA RESET");
}

function startNewShoe() {
    // Archive current shoe to history
    const tbody = document.getElementById('history-body');
    if (tbody.children.length > 0) {
        allShoesHistory.push({
            shoe: appState.currentShoe,
            html: tbody.innerHTML
        });
    }

    appState.currentShoe++;
    appState.chakra = 1;
    initNumbersState();
    stateHistory = [];
    tbody.innerHTML = '';
    pendingY = null;
    pendingK = null;
    highlightPending();
    updateAllUI();
    showToast("NEW KUMBHA STARTED");
}

// --- Yantra & Sopana Logic ---

function syncSettingsFromUI() {
    settings.axyapatra = parseInt(document.getElementById('set-axyapatra').value) || 30000;
    settings.targetUsd = parseInt(document.getElementById('set-target-usd').value) || 1000;
    settings.targetPct = parseInt(document.getElementById('set-target-pct').value) || 10;
    settings.stopLoss = parseInt(document.getElementById('set-stop-loss').value) || 10000;
    settings.minBet = parseInt(document.getElementById('set-min-bet').value) || 100;
    settings.maxBet = parseInt(document.getElementById('set-max-bet').value) || 5000;
    settings.multiple = parseInt(document.getElementById('set-multiple').value) || 1;
    settings.isDouble = document.getElementById('set-double-ladder').checked;
    settings.maxSteps = parseInt(document.getElementById('set-max-steps').value) || 5;
    settings.safetyReserve = parseInt(document.getElementById('set-safety').value) || 5000;
    settings.capRule = document.getElementById('set-cap-rule').checked;
}

function applyYantra() {
    syncSettingsFromUI();
    rebuildLadder();
    updateAllUI();
    document.getElementById('start-bankroll').innerText = settings.axyapatra;
    showToast("YANTRA APPLIED");
}

function rebuildLadder() {
    ladder = [];
    let currentAmt = settings.minBet * settings.multiple;
    for (let i = 1; i <= Math.max(10, settings.maxSteps); i++) {
        ladder.push({ step: i, amount: Math.min(currentAmt, settings.maxBet) });
        if (settings.isDouble) {
            currentAmt *= 2;
        } else {
            currentAmt += (settings.minBet * settings.multiple);
        }
    }
}

// --- UI Rendering ---

const formatCompact = (num) => {
    if (num >= 1000) return (num % 1000 === 0) ? (num / 1000) + 'k' : (num / 1000).toFixed(1) + 'k';
    return num;
};

const formatCurrency = (num) => new Intl.NumberFormat('en-IN').format(num);

function updateAllUI() {
    document.getElementById('live-bankroll').innerText = formatCurrency(appState.bankroll);
    document.getElementById('current-chakra').innerText = appState.chakra;
    
    renderYKTPanel();
    renderVyuha();
    renderSopana();
    renderDrishti();
}

function renderYKTPanel() {
    let yStr = [], kStr = [], tAmt = 0;

    const mapNextBets = (dict, arr) => {
        for (let i = 1; i <= 9; i++) {
            if (dict[i].state === 'ACTIVE') {
                let amt = getBet(dict[i].step);
                arr.push(`${formatCompact(amt)} on ${i}(<span class="step-s${Math.min(dict[i].step, 5)}">S${dict[i].step}</span>)`);
                tAmt += amt;
            }
        }
    };

    mapNextBets(appState.yNums, yStr);
    mapNextBets(appState.kNums, kStr);

    document.querySelector('#y-plan .content').innerHTML = yStr.length ? yStr.join(' | ') : '--';
    document.querySelector('#k-plan .content').innerHTML = kStr.length ? kStr.join(' | ') : '--';
    document.querySelector('#t-plan .content').innerText = formatCompact(tAmt);
}

function renderVyuha() {
    const yGrid = document.getElementById('vyuha-y');
    const kGrid = document.getElementById('vyuha-k');
    if (!yGrid || !kGrid) return;
    
    yGrid.innerHTML = '';
    kGrid.innerHTML = '';

    const createTile = (num, obj) => {
        let css = obj.state.toLowerCase(); // inactive, active, cap, locked
        if (obj.state === 'LOCKED') css = 'won'; // Map LOCKED to won visual if preferred, or locked
        
        let pct = (obj.step / settings.maxSteps) * 100;
        if (pct > 100) pct = 100;
        if (obj.state === 'INACTIVE' || obj.state === 'LOCKED') pct = 0;

        return `
            <div class="vyuha-tile ${css}" style="position:relative; overflow:hidden;">
                <div style="position:absolute; bottom:0; left:0; width:100%; height:${pct}%; background:rgba(255,255,255,0.1); z-index:1;"></div>
                <div style="position:relative; z-index:2; text-align:center;">
                    <span style="font-size:1.2rem;">${num}</span><br>
                    <span style="font-size:0.6rem; opacity:0.7;">S${obj.step}</span>
                </div>
            </div>`;
    };

    for (let i = 1; i <= 9; i++) {
        yGrid.innerHTML += createTile(i, appState.yNums[i]);
        kGrid.innerHTML += createTile(i, appState.kNums[i]);
    }
}

function renderSopana() {
    const tbody = document.getElementById('ladder-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let displayLimit = Math.max(settings.maxSteps, ladder.length);
    for (let i = 0; i < displayLimit; i++) {
        if (!ladder[i]) break;
        tbody.innerHTML += `
            <tr>
                <td>S${ladder[i].step}</td>
                <td><input type="number" class="ladder-input" data-idx="${i}" value="${ladder[i].amount}"></td>
            </tr>`;
    }

    document.querySelectorAll('.ladder-input').forEach(inp => {
        inp.addEventListener('change', (e) => {
            let idx = parseInt(e.target.getAttribute('data-idx'));
            ladder[idx].amount = parseInt(e.target.value) || 0;
            updateAllUI();
        });
    });
}

function renderDrishti() {
    if(document.getElementById('stat-rounds')) document.getElementById('stat-rounds').innerText = drishtiStats.roundsPlayed;
    if(document.getElementById('stat-bets')) document.getElementById('stat-bets').innerText = drishtiStats.totalBets;
    if(document.getElementById('stat-profit')) document.getElementById('stat-profit').innerText = formatCurrency(drishtiStats.netProfit);
    if(document.getElementById('stat-exposure')) document.getElementById('stat-exposure').innerText = formatCurrency(drishtiStats.maxExposure);
}

function addHistoryRow(chakra, y, k, bet, bank) {
    const r = `<tr>
        <td>${chakra}</td>
        <td>${y === 0 ? '0' : y}</td>
        <td>${k === 0 ? '0' : k}</td>
        <td>${bet}</td>
        <td>${formatCurrency(bank)}</td>
    </tr>`;
    document.getElementById('history-body').insertAdjacentHTML('afterbegin', r);
}

// --- Export CSV ---
function exportCSV() {
    let csv = "Side,Number,ActivationRound,RepeatRound,WinStep,NetProfit,CapOccurrence\n";
    ['Y', 'K'].forEach(side => {
        for (let i = 1; i <= 9; i++) {
            let d = drishtiStats.numData[`${side}_${i}`];
            csv += `${side},${i},${d.activationRound},${d.repeatRound},${d.winStep},${d.netProfit},${d.capOccurrence}\n`;
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'KUBERA_WARHUNT_Drishti.csv');
    a.click();
}

// Launch
init();
