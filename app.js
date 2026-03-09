(function () {
  const SETTINGS = {
    startingBankroll: 30000,
    liveBankroll: 30000,
    coinSize: 100,
    minBet: 100,
    maxBet: 3000,
    targetProfit: 500,
    firstMaxSteps: 30,
    secondMaxSteps: 15,
  };

  const state = {
    chakra: 1,
    pending: { Y: null, K: null },
    history: [],
    drishti: [],
    maxExposure: 0,
    totalAhuti: 0,
    sideData: { Y: {}, K: {} },
  };

  const sides = ['Y', 'K'];
  for (const side of sides) {
    for (let n = 1; n <= 9; n++) {
      state.sideData[side][n] = createNumberState();
    }
  }

  function createNumberState() {
    return {
      state: 'inactive', // inactive | active | locked | cap | cap_returned
      phase: 1,
      step: 0,
      losses: 0,
      activationChakra: null,
      pendingSecond: false,
    };
  }

  function currency(n) {
    return `₹ ${Math.round(n).toLocaleString('en-IN')}`;
  }

  function compact(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(n);
  }

  function nextDoubledLevel(amount) {
    let bet = SETTINGS.minBet;
    while (bet <= amount) bet *= 2;
    return Math.min(bet, SETTINGS.maxBet);
  }

  function roundUpToCoin(value) {
    return Math.ceil(value / SETTINGS.coinSize) * SETTINGS.coinSize;
  }

  function getBetFor(ns) {
    if (ns.phase === 2) {
      const start = roundUpToCoin(SETTINGS.maxBet / 4);
      const block = Math.floor((Math.max(ns.step, 1) - 1) / 5);
      return Math.min(start + block * start, SETTINGS.maxBet);
    }

    let bet = SETTINGS.minBet;
    for (let s = 1; s < Math.max(ns.step, 1); s++) {
      const projectedLoss = ns.losses + bet;
      const canStillHit = bet * 8 - projectedLoss >= SETTINGS.targetProfit;
      if (!canStillHit) {
        bet = nextDoubledLevel(bet);
      }
    }
    return Math.min(Math.max(bet, SETTINGS.minBet), SETTINGS.maxBet);
  }

  function ensureNotifications() {
    let box = document.getElementById('notifications');
    if (!box) {
      box = document.createElement('div');
      box.id = 'notifications';
      box.style.position = 'fixed';
      box.style.top = '12px';
      box.style.right = '12px';
      box.style.zIndex = '9999';
      box.style.display = 'flex';
      box.style.flexDirection = 'column';
      box.style.gap = '8px';
      box.style.maxWidth = '320px';
      document.body.appendChild(box);
    }
    return box;
  }

  function notify(title, lines, tone = 'gold') {
    const box = ensureNotifications();
    const card = document.createElement('div');
    const border = tone === 'red' ? '#b44' : tone === 'green' ? '#6a5' : '#b0892e';
    card.style.background = 'rgba(20,12,6,0.96)';
    card.style.border = `1px solid ${border}`;
    card.style.borderRadius = '12px';
    card.style.padding = '10px 12px';
    card.style.color = '#f3e7c5';
    card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
    card.innerHTML = `<div style="font-weight:700;margin-bottom:6px">${title}</div>` + lines.map(x => `<div>${x}</div>`).join('');
    box.appendChild(card);
    setTimeout(() => card.remove(), 4500);
  }

  function buildBoards() {
    fillBoard('boardY', 'Y');
    fillBoard('boardK', 'K');
  }

  function fillBoard(id, side) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const n = i === 10 ? 0 : i;
      const d = document.createElement('button');
      d.className = 'tile' + (n === 0 ? ' zero' : '');
      d.dataset.side = side;
      d.dataset.number = String(n);
      d.innerHTML = `<div class="num">${n}</div><div class="meta">${n === 0 ? 'ZERO' : side}</div>`;
      d.addEventListener('click', () => onTileTap(side, n));
      el.appendChild(d);
    }
  }

  function updateTileStates() {
    document.querySelectorAll('.tile').forEach(tile => {
      const side = tile.dataset.side;
      const n = Number(tile.dataset.number);
      tile.style.outline = '';
      tile.style.border = '';
      tile.style.opacity = '1';
      if (state.pending[side] === n) {
        tile.style.outline = '2px solid #f4d06f';
      }
      if (n === 0) return;
      const ns = state.sideData[side][n];
      const meta = tile.querySelector('.meta');
      if (ns.state === 'inactive') {
        meta.textContent = '-';
        tile.style.opacity = '0.85';
      } else if (ns.state === 'active') {
        meta.textContent = `${ns.phase === 2 ? '2' : ''}S${ns.step}`;
        tile.style.border = '1px solid #d5a849';
      } else if (ns.state === 'locked') {
        meta.textContent = 'LOCK';
        tile.style.border = '1px solid #d5a849';
        tile.style.background = 'rgba(180,140,40,0.18)';
      } else if (ns.state === 'cap') {
        meta.textContent = 'CAP';
        tile.style.border = '1px solid #b44';
      } else if (ns.state === 'cap_returned') {
        meta.textContent = 'RETURN';
        tile.style.border = '1px solid #d58049';
      }
    });
  }

  function onTileTap(side, number) {
    state.pending[side] = number;
    updateTileStates();
    if (state.pending.Y !== null && state.pending.K !== null) {
      processChakra();
    }
  }

  function activatePendingSecondLadders() {
    for (const side of sides) {
      for (let n = 1; n <= 9; n++) {
        const ns = state.sideData[side][n];
        if (ns.pendingSecond) {
          ns.pendingSecond = false;
          ns.state = 'active';
          ns.phase = 2;
          ns.step = 1;
          ns.losses = 0;
          ns.activationChakra = state.chakra;
        }
      }
    }
  }

  function processSide(side, result) {
    const wins = [];
    const events = [];
    const exposureItems = [];

    activatePendingSecondLadders();

    // collect exposure before resolution for active numbers on this side
    for (let n = 1; n <= 9; n++) {
      const ns = state.sideData[side][n];
      if (ns.state === 'active') {
        exposureItems.push({ number: n, bet: getBetFor(ns), step: ns.step, phase: ns.phase });
      }
    }

    if (result === 0) {
      for (let n = 1; n <= 9; n++) {
        const ns = state.sideData[side][n];
        if (ns.state === 'active') applyLoss(side, n, ns, wins, events);
      }
      return { wins, events, exposureItems };
    }

    for (let n = 1; n <= 9; n++) {
      const ns = state.sideData[side][n];
      if (n === result) {
        if (ns.state === 'inactive') {
          ns.state = 'active';
          ns.phase = 1;
          ns.step = 1;
          ns.losses = 0;
          ns.activationChakra = state.chakra;
          events.push(`${side}${n} activated at S1`);
        } else if (ns.state === 'locked') {
          // locked behaves like zero: no effect
          events.push(`${side}${n} ignored (LOCKED = ZERO)`);
        } else if (ns.state === 'cap') {
          ns.state = 'cap_returned';
          ns.pendingSecond = true;
          events.push(`${side}${n} CAP RETURN`);
        } else if (ns.state === 'cap_returned') {
          // already waiting for next round, ignore current appearance
          events.push(`${side}${n} waiting for 2nd ladder`);
        } else if (ns.state === 'active') {
          wins.push(applyWin(side, n, ns));
        }
      } else {
        if (ns.state === 'active') applyLoss(side, n, ns, wins, events);
      }
    }

    return { wins, events, exposureItems };
  }

  function applyWin(side, number, ns) {
    const bet = getBetFor(ns);
    const payout = bet * 8;
    const net = payout - ns.losses;
    SETTINGS.liveBankroll += net;

    state.drishti.unshift({
      Side: side,
      Number: number,
      ActivationChakra: ns.activationChakra ?? state.chakra,
      WinChakra: state.chakra,
      StepsToWin: ns.step,
      PreviousLoss: ns.losses,
      WinningBet: bet,
      NetProfitLoss: net,
      Status: 'WIN',
    });

    const result = {
      side,
      number,
      stepLabel: `${ns.phase === 2 ? '2' : ''}S${ns.step}`,
      bet,
      net,
    };

    ns.state = 'locked';
    ns.phase = 1;
    ns.step = 0;
    ns.losses = 0;
    ns.pendingSecond = false;
    ns.activationChakra = null;
    return result;
  }

  function applyLoss(side, number, ns, wins, events) {
    const bet = getBetFor(ns);
    ns.losses += bet;
    SETTINGS.liveBankroll -= bet;

    if (ns.phase === 1 && bet >= SETTINGS.maxBet) {
      state.drishti.unshift({
        Side: side,
        Number: number,
        ActivationChakra: ns.activationChakra ?? state.chakra,
        WinChakra: '-',
        StepsToWin: ns.step,
        PreviousLoss: ns.losses,
        WinningBet: '-',
        NetProfitLoss: -ns.losses,
        Status: 'CAP',
      });
      ns.state = 'cap';
      ns.step = 0;
      ns.phase = 1;
      ns.activationChakra = null;
      events.push(`${side}${number} became CAP`);
      return;
    }

    const maxSteps = ns.phase === 2 ? SETTINGS.secondMaxSteps : SETTINGS.firstMaxSteps;
    if (ns.step < maxSteps) ns.step += 1;
    events.push(`${side}${number} advanced to ${ns.phase === 2 ? '2' : ''}S${ns.step}`);
  }

  function renderNotifications(allWins, allEvents) {
    if (allWins.length) {
      notify('VIJAY DARSHANA', allWins.map(w => `${w.side}${w.number} → ${w.stepLabel} → Āhuti ${compact(w.bet)} → Net +${compact(w.net)}`), 'green');
    }
    if (allEvents.some(x => x.includes('CAP RETURN'))) {
      notify('CAP RETURNED', allEvents.filter(x => x.includes('CAP RETURN')), 'gold');
    }
    if (SETTINGS.liveBankroll < SETTINGS.startingBankroll) {
      // passive warning only when crossing 0-loss isn't useful; left for low bankroll state if needed later
    }
  }

  function processChakra() {
    const y = state.pending.Y;
    const k = state.pending.K;
    const yRes = processSide('Y', y);
    const kRes = processSide('K', k);

    const exposure = yRes.exposureItems.reduce((a, b) => a + b.bet, 0) + kRes.exposureItems.reduce((a, b) => a + b.bet, 0);
    state.totalAhuti += exposure;
    state.maxExposure = Math.max(state.maxExposure, exposure);

    state.history.unshift({ chakra: state.chakra, Y: y, K: k, ahuti: exposure, axyapatra: SETTINGS.liveBankroll });

    renderNotifications([...yRes.wins, ...kRes.wins], [...yRes.events, ...kRes.events]);

    state.chakra += 1;
    state.pending.Y = null;
    state.pending.K = null;
    render();
  }

  function getExposurePlan(side) {
    const groups = new Map();
    for (let n = 1; n <= 9; n++) {
      const ns = state.sideData[side][n];
      if (ns.state !== 'active') continue;
      const bet = getBetFor(ns);
      const arr = groups.get(bet) || [];
      arr.push(`${n}(${ns.phase === 2 ? '2' : ''}S${ns.step})`);
      groups.set(bet, arr);
    }
    const sorted = [...groups.entries()].sort((a, b) => b[0] - a[0]);
    const total = sorted.reduce((sum, [bet, nums]) => sum + bet * nums.length, 0);
    const line = sorted.map(([bet, nums]) => `${compact(bet)} on ${nums.join(' ')}`).join(' | ') || '-';
    return { line, total };
  }

  function renderNextAhuti() {
    const cards = document.querySelectorAll('.card');
    const panel = cards[3 - 1];
    const ahutiCard = [...cards].find(c => c.textContent.includes('NEXT ĀHUTI PANEL'));
    if (!ahutiCard) return;
    const y = getExposurePlan('Y');
    const k = getExposurePlan('K');
    ahutiCard.innerHTML = `<div class="label">NEXT ĀHUTI PANEL</div>
      <div>Y ${y.line}</div>
      <div>K ${k.line}</div>
      <div class="total">T ${compact(y.total + k.total)}</div>`;
  }

  function renderSummary() {
    const bankEl = document.querySelector('.bank');
    if (bankEl) bankEl.textContent = currency(SETTINGS.liveBankroll);
    const big = document.querySelector('.big');
    if (big) big.textContent = `Round : ${state.chakra}`;
  }

  function wireControls() {
    const buttons = [...document.querySelectorAll('.controls button')];
    const undo = buttons[0];
    const kumbha = buttons[1];
    const prayoga = buttons[2];
    if (undo) undo.addEventListener('click', () => notify('UNDO', ['Undo not included in this test patch.']));
    if (kumbha) kumbha.addEventListener('click', kumbhaReset);
    if (prayoga) prayoga.addEventListener('click', prayogaReset);
  }

  function kumbhaReset() {
    for (const side of sides) {
      for (let n = 1; n <= 9; n++) {
        state.sideData[side][n] = createNumberState();
      }
    }
    state.pending = { Y: null, K: null };
    state.chakra = 1;
    SETTINGS.liveBankroll = SETTINGS.startingBankroll;
    state.maxExposure = 0;
    state.totalAhuti = 0;
    state.drishti = []; // linked to Kumbha clear
    render();
    notify('KUMBHA SHUDDHI', ['Board reset', 'Axyapatra reset', 'Drishti reset']);
  }

  function prayogaReset() {
    kumbhaReset();
    notify('SANGRAM AARAMBHA', ['New Prayoga started']);
  }

  function render() {
    renderSummary();
    renderNextAhuti();
    updateTileStates();
  }

  function installHandling() {
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      document.getElementById('installBtn')?.classList.remove('hidden');
    });
    document.getElementById('installBtn')?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
    }
  }

  buildBoards();
  wireControls();
  installHandling();
  render();
})();
