/*
  Kubera Warhunt patch
  - Removes "Y SELECTED / K SELECTED" style popups
  - Adds temporary border glow to pressed keypad keys

  Install:
  1) Include kubera_keyglow_patch.css after your main stylesheet
  2) Include kubera_keyglow_patch.js after your main app script
*/
(function () {
  const GLOW_CLASS = 'kubera-key-glow';
  const GLOW_MS = 220;

  function restartGlow(el) {
    if (!el || !(el instanceof Element)) return;
    el.classList.remove(GLOW_CLASS);
    void el.offsetWidth;
    el.classList.add(GLOW_CLASS);
    window.setTimeout(() => {
      if (el && el.classList) el.classList.remove(GLOW_CLASS);
    }, GLOW_MS);
  }

  function looksLikePressable(el) {
    if (!el || !(el instanceof Element)) return false;
    if (el.matches('button, .key-btn, .num-btn, .keypad button, [data-key], [data-number]')) return true;
    const txt = (el.textContent || '').trim();
    return /^[0-9]$/.test(txt) || txt === 'Undo' || txt === 'Kumbha' || txt === 'Prayoga';
  }

  function findPressable(start) {
    let el = start;
    while (el && el !== document.body) {
      if (looksLikePressable(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function isSelectionPopup(el) {
    if (!el || !(el instanceof Element)) return false;
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!txt) return false;

    const hasSelected = txt.includes('SELECTED');
    const hasReady = txt.includes('READY');
    const matchesSide = txt.includes('Y SELECTED') || txt.includes('K SELECTED') || txt.includes('Y0 READY') || txt.includes('K0 READY');

    if (matchesSide) return true;
    if (hasSelected && hasReady) return true;

    return false;
  }

  function hideSelectionPopups(root) {
    const nodes = [];
    if (root && root.nodeType === 1) {
      nodes.push(root, ...root.querySelectorAll('*'));
    }
    for (const node of nodes) {
      if (!isSelectionPopup(node)) continue;
      const card = node.closest('div, section, article, aside') || node;
      card.style.setProperty('display', 'none', 'important');
      card.style.setProperty('visibility', 'hidden', 'important');
      card.style.setProperty('pointer-events', 'none', 'important');
      card.setAttribute('data-kubera-hidden-popup', 'true');
    }
  }

  function installEventHandlers() {
    const handler = (ev) => {
      const pressable = findPressable(ev.target);
      if (!pressable) return;
      restartGlow(pressable);
    };

    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('click', handler, true);
    document.addEventListener('touchstart', handler, { capture: true, passive: true });
  }

  function installObserver() {
    hideSelectionPopups(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
          if (added.nodeType === 1) hideSelectionPopups(added);
        }
        if (mutation.target && mutation.target.nodeType === 1) {
          hideSelectionPopups(mutation.target);
        }
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function injectFallbackStyle() {
    if (document.getElementById('kubera-keyglow-inline-style')) return;
    const style = document.createElement('style');
    style.id = 'kubera-keyglow-inline-style';
    style.textContent = `
      .${GLOW_CLASS} {
        border-color: rgba(246, 198, 107, 0.98) !important;
        box-shadow:
          0 0 0 1px rgba(246, 198, 107, 0.55),
          0 0 12px rgba(246, 198, 107, 0.42),
          0 0 22px rgba(246, 140, 0, 0.22),
          inset 0 0 10px rgba(246, 198, 107, 0.12) !important;
        transform: scale(0.98);
        transition: border-color .15s ease, box-shadow .15s ease, transform .10s ease;
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectFallbackStyle();
    installEventHandlers();
    installObserver();
    console.log('[Kubera patch] key glow enabled, selection popups suppressed');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
