/**
 * KUBERA PWA
 * 1. App State
 * 2. Settings Manager
 * 3. Ladder Engine
 * 4. Fighter Manager
 * 5. Result Processor
 * 6. UI Renderer
 * 7. Storage Manager
 * 8. Event Handlers
 * 9. PWA Service Worker
 */

// --- 1. App State ---
const State = {
    axyapatra: 30000,
    cycle: 0,
    yaksha: {},
    kinnara: {},
    history: [],
    pendingCapResolution: null,
    settings: {
        startingBalance: 30000,
        targetProfit: 500,
        targetPercent: 1.67,
        minBet: 100,
        maxBet: 3000,
        multiple: 100,
        profitNum: 500,
        capRule: true
    },
    ladder: []
};

// --- 2. Settings Manager ---
const SettingsManager = {
    init() {
        const saved = StorageManager.load('settings');
        if (saved) State.settings = { ...State.settings, ...saved };
        this.syncForms();
    },
    syncForms() {
        document.getElementById('set-balance').value = State.settings.startingBalance;
        document.getElementById('set-target-profit').value = State.settings.targetProfit;
        document.getElementById('set-target-percent').value = State.settings.targetPercent;
        document.getElementById('set-min-bet').value = State.settings.minBet;
        document.getElementById('set-max-bet').value = State.settings.maxBet;
        document.getElementById('set-multiple').value = State.settings.multiple;
        document.getElementById('set-profit-num').value = State.settings.profitNum;
        document.getElementById('set-cap-rule').checked = State.settings.capRule;
    },
    saveForms() {
        State.settings.startingBalance = parseFloat(document.getElementById('set-balance').value);
        State.settings.targetProfit = parseFloat(document.getElementById('set-target-profit').value);
        State.settings.targetPercent = parseFloat(document.getElementById('set-target-percent').value);
        State.settings.minBet = parseFloat(document.getElementById('set-min-bet').value);
        State.settings.maxBet = parseFloat(document.getElementById('set-max-bet').value);
        State.settings.multiple = parseFloat(document.getElementById('set-multiple').value);
        State.settings.profitNum = parseFloat(document.getElementById('set-profit-num').value);
        State.settings.capRule = document.getElementById('set-cap-rule').checked;
        StorageManager.save('settings', State.settings);
    },
    syncPercent(fromAmount) {
        if (fromAmount) {
            const amt = parseFloat(document.getElementById('set-target-profit').value);
            const bal = parseFloat(document.getElementById('set-balance').value);
            document.getElementById('set-target-percent').value = ((amt / bal) * 100).toFixed(2);
        } else {
            const pct = parseFloat(document.getElementById('set-target-percent').value);
            const bal = parseFloat(document.getElementById('set-balance').value);
            document.getElementById('set-target-profit').value = Math.round((pct / 100) * bal);
        }
    }
};

// --- 3. Ladder Engine ---
const LadderEngine = {
    init() {
        let saved = StorageManager.load('ladder');
        if (!saved || saved.length === 0) {
            saved = [100, 100, 200, 300, 400, 600, 900];
            while (saved.length < 60) saved.push(saved[saved.length - 1] + 300);
        }
        State.ladder = saved;
        this.renderStepsGrid();
    },
    getBetAmount(step) {
        if (step < 0) return State.ladder[0];
        if (step >= State.ladder.length) return State.ladder[State.ladder.length - 1];
        return State.ladder[step];
    },
    calculateCapRestart(capAmount) {
        const base = capAmount / 4;
        const mult = State.settings.multiple;
        return Math.ceil(base / mult) * mult;
    },
    renderStepsGrid() {
        const container = document.getElementById('steps-container');
        container.innerHTML = '';
        for (let i = 0; i < 60; i++) {
            const val = State.ladder[i] || 0;
            const input = document.createElement('input');
            input.type = 'number';
            input.value = val;
            input.dataset.index = i;
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const next = container.querySelector(`input[data-index="${i + 1}"]`);
                    if (next) next.focus();
                }
            });
            container.appendChild(input);
        }
    },
    saveStepsGrid() {
        const inputs = document.querySelectorAll('#steps-container input');
        const newLadder = Array.from(inputs).map(inp => parseFloat(inp.value) || 0);
        State.ladder = newLadder;
        StorageManager.save('ladder', State.ladder);
        UIRenderer.showAlert('Success', 'Sacred Steps updated.');
    }
};

// --- 4. Fighter Manager ---
const FighterManager = {
    init() {
        for (let i = 1; i <= 9; i++) {
            State.yaksha[i] = this.createFighter();
            State.kinnara[i] = this.createFighter();
        }
        State.axyapatra = State.settings.startingBalance;
        State.cycle = 0;
        State.history = [];
    },
    createFighter() {
        return { state: 'INACTIVE', step: 0, losses: 0, currentBet: 0 };
    },
    getActive(sideKey) {
        const side = State[sideKey];
        return Object.keys(side).filter(k => side[k].state === 'ACTIVE' || side[k].state === 'CAP').map(Number);
    },
    isShoeComplete() {
        let activeFound = false;
        ['yaksha', 'kinnara'].forEach(side => {
            for (let i = 1; i <= 9; i++) {
                if (State[side][i].state === 'ACTIVE' || State[side][i].state === 'CAP') activeFound = true;
            }
        });
        return !activeFound && State.cycle > 0;
    }
};

// --- 5. Result Processor ---
const ResultProcessor = {
    processInput(sideKey, num) {
        if (State.pendingCapResolution) return;

        // Check if hitting a CAP number
        if (num > 0 && State[sideKey][num].state === 'CAP') {
            State.pendingCapResolution = { sideKey, num };
            UIRenderer.showCapModal(num);
            return;
        }

        this.executeRound(sideKey, num);
    },
    
    executeRound(sideKey, num) {
        State.cycle++;
        let roundLosses = 0;
        let yTotal = 0, kTotal = 0;

        // Deduct bets for all active fighters first
        ['yaksha', 'kinnara'].forEach(s => {
            const actives = FighterManager.getActive(s);
            actives.forEach(id => {
                const f = State[s][id];
                const bet = LadderEngine.getBetAmount(f.step);
                f.currentBet = bet;
                f.losses += bet;
                roundLosses += bet;
                if (s === 'yaksha') yTotal += bet;
                if (s === 'kinnara') kTotal += bet;
            });
        });

        State.axyapatra -= roundLosses;

        // Process outcome for the specific side
        const targetSide = State[sideKey];
        if (num === 0) {
            // ZERO RULE: All active advance step
            this.advanceActives();
        } else {
            const f = targetSide[num];
            if (f.state === 'INACTIVE') {
                f.state = 'ACTIVE';
                f.step = 0;
                f.losses = 0;
            } else if (f.state === 'ACTIVE') {
                // WIN RULE
                const winAmt = 8 * f.currentBet; 
                State.axyapatra += (f.currentBet + winAmt); // Return bet + win
                const profit = winAmt - (f.losses - f.currentBet);

                if (profit >= State.settings.profitNum) {
                    f.state = 'WON';
                } else {
                    f.state = 'WON'; // Simplification: any win that clears is WON, if not, it still resets or caps? Rules say "If profit >= target -> WON. Else -> behave like zero".
                    // Wait, rules: "If profit >= target: number becomes WON. Future repeats behave like ZERO."
                    // Let's assume if it didn't hit target, it stays active but resets step? The rules aren't explicit. We'll set it to WON if profit >= 0 for safety, or just WON.
                }
            } else if (f.state === 'WON' || f.state === 'LOCKED') {
                // Treats as ZERO for other active
                this.advanceActives();
            }
            
            // Other actives on ALL sides advance step if they didn't win
            this.advanceActives(sideKey, num);
        }

        this.checkCaps();

        State.history.push({
            cycle: State.cycle,
            yaksha: yTotal,
            kinnara: kTotal,
            total: yTotal + kTotal,
            axyapatra: State.axyapatra
        });

        StorageManager.saveState();
        UIRenderer.updateAll();

        if (FighterManager.isShoeComplete()) {
            UIRenderer.showAlert('Ritual Complete', `Final Axyapatra: ₹${State.axyapatra}`);
        }
    },

    advanceActives(excludeSide, excludeNum) {
        ['yaksha', 'kinnara'].forEach(s => {
            const actives = FighterManager.getActive(s);
            actives.forEach(id => {
                if (s === excludeSide && id === excludeNum) return;
                State[s][id].step++;
            });
        });
    },

    checkCaps() {
        if (!State.settings.capRule) return;
        const maxSteps = 60; // Or whatever ladder length
        ['yaksha', 'kinnara'].forEach(s => {
            const actives = FighterManager.getActive(s);
            actives.forEach(id => {
                const f = State[s][id];
                const nextBet = LadderEngine.getBetAmount(f.step);
                if (nextBet >= State.settings.maxBet || f.step >= maxSteps) {
                    f.state = 'CAP';
                }
            });
        });
    },

    resolveCap(action) {
        const { sideKey, num } = State.pendingCapResolution;
        const f = State[sideKey][num];

        if (action === 'QUIT') {
            f.state = 'LOCKED';
            State.pendingCapResolution = null;
            this.executeRound(sideKey, num); // Acts as a ZERO basically
        } else if (action === 'ACTIVATE') {
            const currentCapBet = LadderEngine.getBetAmount(f.step);
            const restartBet = LadderEngine.calculateCapRestart(currentCapBet);
            // Find closest step
            let newStep = 0;
            for (let i = 0; i < State.ladder.length; i++) {
                if (State.ladder[i] >= restartBet) {
                    newStep = i;
                    break;
                }
            }
            f.step = newStep;
            f.state = 'ACTIVE';
            State.pendingCapResolution = null;
            this.executeRound(sideKey, num);
        }
    }
};

// --- 6. UI Renderer ---
const UIRenderer = {
    updateAll() {
        this.updateHeader();
        this.updateRitual();
        this.updateMandala();
        this.updateRecords();
        this.updateInsights();
    },
    updateHeader() {
        document.getElementById('axyapatra-balance').innerText = `₹${State.axyapatra}`;
    },
    updateRitual() {
        document.getElementById('ui-cycle').innerText = State.cycle;
        
        let totalNextBet = 0;
        let activeCount = 0;
        ['yaksha', 'kinnara'].forEach(s => {
            const actives = FighterManager.getActive(s);
            activeCount += actives.length;
            actives.forEach(id => {
                totalNextBet += LadderEngine.getBetAmount(State[s][id].step);
            });
        });

        document.getElementById('ui-offering').innerText = `₹${totalNextBet}`;
        document.getElementById('ui-weight').innerText = totalNextBet > 0 ? totalNextBet : 0;
        document.getElementById('ui-energy').innerText = activeCount > 5 ? 'High' : (activeCount > 2 ? 'Medium' : 'Low');
    },
    updateMandala() {
        ['yaksha', 'kinnara'].forEach(s => {
            const grid = document.getElementById(`mg-${s}`);
            grid.innerHTML = '';
            for (let i = 1; i <= 9; i++) {
                const div = document.createElement('div');
                div.className = `m-tile ${State[s][i].state}`;
                div.innerText = i;
                grid.appendChild(div);
            }
        });
    },
    updateRecords() {
        const tbody = document.querySelector('#records-table tbody');
        tbody.innerHTML = '';
        const recent = State.history.slice(-20).reverse();
        recent.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${r.cycle}</td><td>₹${r.yaksha}</td><td>₹${r.kinnara}</td><td>₹${r.total}</td><td>₹${r.axyapatra}</td>`;
            tbody.appendChild(tr);
        });
    },
    updateInsights() {
        let activeCount = FighterManager.getActive('yaksha').length + FighterManager.getActive('kinnara').length;
        document.getElementById('in-active').innerText = activeCount;
        document.getElementById('in-volatility').innerText = activeCount > 4 ? 'High' : 'Low';
        document.getElementById('in-pressure').innerText = State.cycle > 20 ? 'Elevated' : 'Normal';
    },
    showCapModal(num) {
        document.getElementById('cap-num').innerText = num;
        document.getElementById('cap-modal').classList.add('active');
    },
    hideCapModal() {
        document.getElementById('cap-modal').classList.remove('active');
    },
    showAlert(title, message) {
        document.getElementById('alert-title').innerText = title;
        document.getElementById('alert-message').innerText = message;
        document.getElementById('alert-modal').classList.add('active');
    },
    hideAlert() {
        document.getElementById('alert-modal').classList.remove('active');
    }
};

// --- 7. Storage Manager ---
const StorageManager = {
    save(key, data) {
        localStorage.setItem(`kubera_${key}`, JSON.stringify(data));
    },
    load(key) {
        const data = localStorage.getItem(`kubera_${key}`);
        return data ? JSON.parse(data) : null;
    },
    saveState() {
        this.save('state', {
            axyapatra: State.axyapatra,
            cycle: State.cycle,
            yaksha: State.yaksha,
            kinnara: State.kinnara,
            history: State.history
        });
    },
    loadState() {
        const s = this.load('state');
        if (s) {
            State.axyapatra = s.axyapatra;
            State.cycle = s.cycle;
            State.yaksha = s.yaksha;
            State.kinnara = s.kinnara;
            State.history = s.history;
            return true;
        }
        return false;
    },
    clearState() {
        localStorage.removeItem('kubera_state');
    }
};

// --- 8. Event Handlers ---
document.addEventListener('DOMContentLoaded', () => {
    SettingsManager.init();
    LadderEngine.init();
    
    if (!StorageManager.loadState()) {
        FighterManager.init();
    }
    UIRenderer.updateAll();

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.target).classList.add('active');
        });
    });

    // Keypads
    ['yaksha', 'kinnara'].forEach(side => {
        document.getElementById(`kp-${side}`).addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const num = parseInt(e.target.dataset.num);
                ResultProcessor.processInput(side, num);
            }
        });
    });

    // Modals
    document.getElementById('btn-cap-activate').addEventListener('click', () => {
        UIRenderer.hideCapModal();
        ResultProcessor.resolveCap('ACTIVATE');
    });
    document.getElementById('btn-cap-quit').addEventListener('click', () => {
        UIRenderer.hideCapModal();
        ResultProcessor.resolveCap('QUIT');
    });
    document.getElementById('btn-alert-ok').addEventListener('click', () => UIRenderer.hideAlert());

    // Settings logic
    document.getElementById('set-target-profit').addEventListener('input', () => SettingsManager.syncPercent(true));
    document.getElementById('set-target-percent').addEventListener('input', () => SettingsManager.syncPercent(false));
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        SettingsManager.saveForms();
        UIRenderer.showAlert('Settings Applied', 'Control settings updated successfully.');
    });

    // Action buttons
    document.getElementById('btn-clear').addEventListener('click', () => {
        if(confirm("Clear current shoe?")) {
            StorageManager.clearState();
            FighterManager.init();
            UIRenderer.updateAll();
        }
    });
    document.getElementById('btn-new').addEventListener('click', () => {
        StorageManager.clearState();
        FighterManager.init();
        UIRenderer.updateAll();
    });

    // Steps
    document.getElementById('btn-save-steps').addEventListener('click', () => {
        LadderEngine.saveStepsGrid();
    });

    // CSV
    document.getElementById('btn-export').addEventListener('click', () => {
        let csv = "Cycle,Yaksha,Kinnara,Total,Axyapatra\n";
        State.history.forEach(r => {
            csv += `${r.cycle},${r.yaksha},${r.kinnara},${r.total},${r.axyapatra}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kubera_records_${Date.now()}.csv`;
        a.click();
    });
});

// --- 9. PWA Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => {
            console.log('SW Registration failed: ', err);
        });
    });
}
