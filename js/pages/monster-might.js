'use strict';

/* ── Deck definitions ───────────────────────────────────────────
   Each entry: { value: number, isCrit: boolean }
   6 unique card faces × 3 copies = 18 cards per deck.
─────────────────────────────────────────────────────────────── */
const DECK_DEFS = {
  white: {
    label: 'White',
    faces: [
      { value: 0, isCrit: false },
      { value: 0, isCrit: false },
      { value: 1, isCrit: false },
      { value: 1, isCrit: false },
      { value: 2, isCrit: false },
      { value: 2, isCrit: true  },
    ],
  },
  yellow: {
    label: 'Yellow',
    faces: [
      { value: 0, isCrit: false },
      { value: 0, isCrit: false },
      { value: 1, isCrit: false },
      { value: 2, isCrit: false },
      { value: 3, isCrit: false },
      { value: 3, isCrit: true  },
    ],
  },
  red: {
    label: 'Red',
    faces: [
      { value: 0, isCrit: false },
      { value: 0, isCrit: false },
      { value: 2, isCrit: false },
      { value: 3, isCrit: false },
      { value: 3, isCrit: false },
      { value: 4, isCrit: true  },
    ],
  },
  black: {
    label: 'Black',
    faces: [
      { value: 0, isCrit: false },
      { value: 0, isCrit: false },
      { value: 3, isCrit: false },
      { value: 4, isCrit: false },
      { value: 4, isCrit: false },
      { value: 5, isCrit: true  },
    ],
  },
};

const DECK_NAMES  = Object.keys(DECK_DEFS);
const DECK_SIZE   = 18;   // 6 faces × 3 copies
const MAX_DRAW    = 18;

/* ── State ──────────────────────────────────────────────────── */
const state = {
  decks:    {},   // per-deck: { available: Card[], discard: Card[] }
  history:  [],   // array of round records
  round:    0,
};

/* ── Helpers ────────────────────────────────────────────────── */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(deckName) {
  const faces = DECK_DEFS[deckName].faces;
  const cards = [];
  for (let copy = 0; copy < 3; copy++) {
    faces.forEach(f => cards.push({ value: f.value, isCrit: f.isCrit, deck: deckName }));
  }
  return shuffle(cards);
}

function initDecks() {
  DECK_NAMES.forEach(name => {
    state.decks[name] = { available: buildDeck(name), discard: [] };
  });
}

/**
 * Draw `count` cards from a deck.
 * When the available pile runs out mid-draw, the existing discard
 * (cards drawn in previous rounds) is reshuffled back in.
 * Cards drawn in the current call are never returned mid-draw.
 *
 * Returns { cards: Card[], reshuffled: boolean }
 */
function drawFromDeck(deckName, count) {
  const deck = state.decks[deckName];
  const drawn = [];
  let reshuffled = false;

  while (drawn.length < count) {
    if (deck.available.length === 0) {
      if (deck.discard.length === 0) {
        // Nothing left at all — should not happen given MAX_DRAW === DECK_SIZE
        break;
      }
      deck.available = shuffle(deck.discard.slice());
      deck.discard    = [];
      reshuffled      = true;
    }
    drawn.push(deck.available.pop());
  }

  // Move drawn cards to discard (they'll be reshuffled next time the deck empties)
  deck.discard.push(...drawn);

  return { cards: drawn, reshuffled };
}

/* ── Persistence ────────────────────────────────────────────── */
function saveState() {
  saveData('monster-might', {
    decks:  state.decks,
    round:  state.round,
    history: state.history,
  });
}

function loadState() {
  const saved = loadData('monster-might');
  if (saved && saved.decks && DECK_NAMES.every(n => saved.decks[n])) {
    state.decks   = saved.decks;
    state.round   = saved.round   || 0;
    state.history = saved.history || [];
    return true;
  }
  return false;
}

/* ── DOM references ─────────────────────────────────────────── */
const dom = {};

function cacheDom() {
  dom.drawBtn       = document.getElementById('btn-draw');
  dom.clearBtn      = document.getElementById('btn-clear-inputs');
  dom.resetBtn      = document.getElementById('btn-reset-decks');
  dom.totalValue    = document.getElementById('draw-total-value');
  dom.totalBar      = document.getElementById('draw-limit-bar-fill');
  dom.resultsArea   = document.getElementById('results-area');
  dom.historyList   = document.getElementById('history-list');
  dom.reshuffleRow  = document.getElementById('reshuffle-row');

  DECK_NAMES.forEach(name => {
    dom[name] = {
      input:    document.getElementById(`input-${name}`),
      btnUp:    document.getElementById(`btn-up-${name}`),
      btnDown:  document.getElementById(`btn-down-${name}`),
      counter:  document.getElementById(`counter-${name}`),
      progress: document.getElementById(`progress-${name}`),
      discard:  document.getElementById(`discard-${name}`),
    };
  });
}

/* ── Render helpers ─────────────────────────────────────────── */
function renderDeckStatus() {
  DECK_NAMES.forEach(name => {
    const deck = state.decks[name];
    const avail = deck.available.length;
    const els   = dom[name];

    els.counter.innerHTML =
      `<span>${avail}</span> / ${DECK_SIZE}`;

    const pct = (avail / DECK_SIZE) * 100;
    els.progress.style.width = pct + '%';

    els.discard.textContent =
      deck.discard.length > 0
        ? `${deck.discard.length} in discard`
        : 'Discard empty';
  });
}

function getTotalDraw() {
  return DECK_NAMES.reduce((sum, name) => {
    const val = parseInt(dom[name].input.value, 10) || 0;
    return sum + val;
  }, 0);
}

function renderTotalBar() {
  const total = getTotalDraw();
  const over  = total > MAX_DRAW;

  dom.totalValue.textContent = total;
  dom.totalValue.classList.toggle('is-over-limit', over);

  const pct = Math.min((total / MAX_DRAW) * 100, 100);
  dom.totalBar.style.width = pct + '%';
  dom.totalBar.classList.toggle('is-full', over);

  dom.drawBtn.disabled = total === 0 || over;
}

function cardHTML(card, animDelay) {
  const deckClass = `result-card--${card.deck}`;
  const critClass = card.isCrit  ? 'result-card--crit'  : '';
  const blankClass = card.value === 0 ? 'result-card--blank' : '';
  const style = `animation-delay:${animDelay}ms`;

  const inner = card.value === 0
    ? `<span class="result-card__blank-icon" aria-hidden="true">—</span>
       <span class="result-card__deck-label">${DECK_DEFS[card.deck].label}</span>`
    : `<span class="result-card__deck-label">${DECK_DEFS[card.deck].label}</span>
       <span class="result-card__value">${card.value}</span>
       ${card.isCrit ? '<span class="result-card__crit-badge">Crit</span>' : ''}`;

  const ariaLabel = card.value === 0
    ? `${DECK_DEFS[card.deck].label} deck — blank`
    : `${DECK_DEFS[card.deck].label} deck — ${card.value}${card.isCrit ? ' critical' : ''}`;

  return `<div class="result-card ${deckClass} ${critClass} ${blankClass}"
               style="${style}" aria-label="${ariaLabel}" role="img">${inner}</div>`;
}

function chipHTML(card) {
  const critMark = card.isCrit ? ' ★' : '';
  const label    = card.value === 0 ? '—' : card.value;
  return `<span class="history-chip history-chip--${card.deck}${card.isCrit ? ' history-chip--crit' : ''}"
               title="${DECK_DEFS[card.deck].label}">${label}${critMark}</span>`;
}

function renderResults(allDrawn, reshuffles) {
  if (allDrawn.length === 0) {
    dom.resultsArea.innerHTML = `
      <div class="results-area__empty">
        <div class="results-area__empty-icon" aria-hidden="true">🎴</div>
        <p class="results-area__empty-text">Draw cards to see results</p>
      </div>`;
    return;
  }

  const totalDmg  = allDrawn.reduce((s, c) => s + c.value, 0);
  const crits     = allDrawn.filter(c => c.isCrit).length;
  const blanks    = allDrawn.filter(c => c.value === 0).length;

  const reshuffleHTML = reshuffles.length > 0
    ? `<div id="reshuffle-row" style="margin-bottom:var(--space-3);">
        ${reshuffles.map(d =>
          `<span class="reshuffle-notice">↺ ${DECK_DEFS[d].label} deck reshuffled</span>`
        ).join(' ')}
       </div>`
    : '';

  const cardsHTML = allDrawn
    .map((c, i) => cardHTML(c, i * 40))
    .join('');

  dom.resultsArea.innerHTML = `
    ${reshuffleHTML}
    <div class="results-header">
      <span class="results-title">Round ${state.round} — ${allDrawn.length} card${allDrawn.length !== 1 ? 's' : ''} drawn</span>
      <div class="results-summary">
        <div class="results-stat">
          <span class="results-stat__value">${totalDmg}</span>
          <span class="results-stat__label">Total</span>
        </div>
        <div class="results-stat">
          <span class="results-stat__value${crits ? ' results-stat__value--crit' : ''}">${crits}</span>
          <span class="results-stat__label">Crits</span>
        </div>
        <div class="results-stat">
          <span class="results-stat__value">${blanks}</span>
          <span class="results-stat__label">Blanks</span>
        </div>
      </div>
    </div>
    <div class="cards-grid" role="list">${cardsHTML}</div>`;
}

function renderHistory() {
  if (state.history.length === 0) {
    dom.historyList.innerHTML =
      `<p style="font-size:var(--text-xs);color:var(--color-text-muted);padding:var(--space-3);">No draws yet.</p>`;
    return;
  }

  dom.historyList.innerHTML = state.history.map(entry => {
    const chips = entry.cards.map(chipHTML).join('');
    return `<div class="history-entry">
      <span class="history-entry__round">Rnd ${entry.round}</span>
      <div class="history-entry__cards">${chips}</div>
      <span class="history-entry__total">Σ ${entry.total}</span>
    </div>`;
  }).join('');
}

/* ── Actions ────────────────────────────────────────────────── */
function handleDraw() {
  const requests = {};
  let totalCount = 0;

  DECK_NAMES.forEach(name => {
    const n = parseInt(dom[name].input.value, 10) || 0;
    if (n > 0) requests[name] = n;
    totalCount += n;
  });

  if (totalCount === 0 || totalCount > MAX_DRAW) return;

  state.round++;
  const allDrawn   = [];
  const reshuffles = [];

  Object.entries(requests).forEach(([name, count]) => {
    const { cards, reshuffled } = drawFromDeck(name, count);
    allDrawn.push(...cards);
    if (reshuffled) reshuffles.push(name);
  });

  const totalDmg = allDrawn.reduce((s, c) => s + c.value, 0);

  state.history.push({
    round: state.round,
    cards: allDrawn,
    total: totalDmg,
  });

  renderResults(allDrawn, reshuffles);
  renderDeckStatus();
  renderHistory();

  // Clear inputs after draw
  DECK_NAMES.forEach(name => { dom[name].input.value = 0; });
  renderTotalBar();

  if (reshuffles.length > 0) {
    reshuffles.forEach(d =>
      showToast(`${DECK_DEFS[d].label} deck reshuffled`, 'info', 3000)
    );
  }

  saveState();
}

function handleReset() {
  if (!confirm('Reset all decks to their full 18 cards? This will clear draw history.')) return;
  state.round   = 0;
  state.history = [];
  initDecks();
  renderDeckStatus();
  renderHistory();
  dom.resultsArea.innerHTML = `
    <div class="results-area__empty">
      <div class="results-area__empty-icon" aria-hidden="true">🎴</div>
      <p class="results-area__empty-text">Draw cards to see results</p>
    </div>`;
  DECK_NAMES.forEach(name => { dom[name].input.value = 0; });
  renderTotalBar();
  saveState();
  showToast('All decks reset', 'success');
}

function handleClearInputs() {
  DECK_NAMES.forEach(name => { dom[name].input.value = 0; });
  renderTotalBar();
}

function clampInput(name) {
  const deck = state.decks[name];
  const max  = deck.available.length;
  let val    = parseInt(dom[name].input.value, 10) || 0;
  val = Math.max(0, Math.min(val, max));
  dom[name].input.value = val;
  renderTotalBar();
}

/* ── Event wiring ───────────────────────────────────────────── */
function bindEvents() {
  dom.drawBtn.addEventListener('click', handleDraw);
  dom.resetBtn.addEventListener('click', handleReset);
  dom.clearBtn.addEventListener('click', handleClearInputs);

  DECK_NAMES.forEach(name => {
    const els = dom[name];

    els.input.addEventListener('input', () => clampInput(name));
    els.input.addEventListener('change', () => clampInput(name));

    // Keyboard: up/down arrows on the input
    els.input.addEventListener('keydown', (e) => {
      const deck = state.decks[name];
      const max  = deck.available.length;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        els.input.value = Math.min((parseInt(els.input.value,10)||0) + 1, max);
        renderTotalBar();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        els.input.value = Math.max((parseInt(els.input.value,10)||0) - 1, 0);
        renderTotalBar();
      }
    });

    els.btnUp.addEventListener('click', () => {
      const deck = state.decks[name];
      const max  = deck.available.length;
      const cur  = parseInt(els.input.value, 10) || 0;
      els.input.value = Math.min(cur + 1, max);
      renderTotalBar();
    });

    els.btnDown.addEventListener('click', () => {
      const cur = parseInt(els.input.value, 10) || 0;
      els.input.value = Math.max(cur - 1, 0);
      renderTotalBar();
    });
  });
}

/* ── Boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  cacheDom();

  const restored = loadState();
  if (!restored) initDecks();

  bindEvents();
  renderDeckStatus();
  renderHistory();
  renderTotalBar();

  if (restored) {
    showToast('Session restored', 'info', 2500);
  }
});
