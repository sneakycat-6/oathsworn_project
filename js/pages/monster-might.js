'use strict';

/* ── Deck definitions ───────────────────────────────────────────
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

const DECK_NAMES = Object.keys(DECK_DEFS);
const DECK_SIZE  = 18;

/* ── Helpers ────────────────────────────────────────────────── */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function typeKey(value, isCrit) {
  return value + '-' + isCrit;
}

/** Return distinct card types for a deck, sorted by value. */
function getCardTypes(deckName) {
  const faces = DECK_DEFS[deckName].faces;
  const map = {};
  faces.forEach(f => {
    const k = typeKey(f.value, f.isCrit);
    if (!map[k]) map[k] = { value: f.value, isCrit: f.isCrit, total: 0 };
    map[k].total += 3;
  });
  return Object.values(map).sort((a, b) => a.value - b.value || a.isCrit - b.isCrit);
}

function buildDeck(deckName) {
  const faces = DECK_DEFS[deckName].faces;
  const cards = [];
  for (let i = 0; i < 3; i++) {
    faces.forEach(f => cards.push({ value: f.value, isCrit: f.isCrit, deck: deckName }));
  }
  return shuffle(cards);
}

/* ── State ──────────────────────────────────────────────────── */
const state = {
  decks: {},
  // { [deckName]: { available: Card[], discard: Card[], spent: Card[], excluded: ExclType[] } }
  // ExclType: { value, isCrit }
  currentResults: [],   // cards shown in the current results panel
  history: [],
  round: 0,
};

function initDecks() {
  DECK_NAMES.forEach(name => {
    const prev = state.decks[name];
    state.decks[name] = {
      available: buildDeck(name),
      discard:   [],
      spent:     [],
      excluded:  [],
    };
  });
}

/* ── Draw ───────────────────────────────────────────────────── */
/**
 * Draw `count` cards from a named deck (respects exclusions).
 * When available runs out, old discard (minus excluded) is reshuffled back.
 * Returns { cards, reshuffled }
 */
function drawFromDeck(deckName, count) {
  const deck = state.decks[deckName];
  const drawn = [];
  let reshuffled = false;

  while (drawn.length < count) {
    if (deck.available.length === 0) {
      // Only discard reshuffles — spent (current round) never comes back mid-round
      if (deck.discard.length === 0) break;
      deck.available = shuffle(deck.discard.slice());
      deck.discard    = [];
      reshuffled      = true;
    }
    drawn.push(deck.available.pop());
  }

  // Cards go to spent (locked for this round), not discard
  deck.spent.push(...drawn);
  return { cards: drawn, reshuffled };
}

/**
 * Redraw a single card at resultIndex.
 * The original card stays in discard; a replacement is drawn from the same deck.
 */
function redrawCard(resultIndex) {
  const original = state.currentResults[resultIndex];
  if (!original || original.isDiscarded) return;

  const deckName = original.deck;
  const { cards, reshuffled } = drawFromDeck(deckName, 1);
  if (!cards.length) {
    showToast('No cards available to redraw from ' + DECK_DEFS[deckName].label + ' deck', 'warning');
    return;
  }

  // Store what the card was before redraw so it can be displayed
  const replacement = Object.assign({}, cards[0], {
    isRedrawn: true,
    redrawFrom: { value: original.value, isCrit: original.isCrit, deck: original.deck,
                  wasRedrawn: original.isRedrawn, redrawFrom: original.redrawFrom || null },
  });
  state.currentResults[resultIndex] = replacement;

  if (reshuffled) {
    showToast(DECK_DEFS[deckName].label + ' deck reshuffled', 'info', 3000);
  }

  renderResults(state.currentResults, []);
  renderDeckStatus();
  saveState();
}


/**
 * Toggle the discarded state of a result card.
 * Discarded cards stay visible but are struck out and excluded from totals.
 */
function discardCard(resultIndex) {
  const card = state.currentResults[resultIndex];
  if (!card) return;
  card.isDiscarded = !card.isDiscarded;
  renderResults(state.currentResults, []);
  saveState();
}

/* ── Persistence ────────────────────────────────────────────── */
function saveState() {
  saveData('monster-might', {
    decks:   state.decks,
    round:   state.round,
    history: state.history,
  });
}

function loadState() {
  const saved = loadData('monster-might');
  if (saved && saved.decks && DECK_NAMES.every(n => saved.decks[n])) {
    state.decks   = saved.decks;
    state.round   = saved.round   || 0;
    state.history = saved.history || [];
    // Ensure all pools exist (backward compat)
    DECK_NAMES.forEach(function(n) {
      if (!state.decks[n].excluded) state.decks[n].excluded = [];
      if (!state.decks[n].spent)    state.decks[n].spent    = [];
    });
    return true;
  }
  return false;
}

/* ── DOM cache ──────────────────────────────────────────────── */
const dom = {};

function cacheDom() {
  dom.drawBtn      = document.getElementById('btn-draw');
  dom.clearBtn     = document.getElementById('btn-clear-inputs');
  dom.resetBtn     = document.getElementById('btn-reset-decks');
  dom.totalValue   = document.getElementById('draw-total-value');
  dom.totalBar     = document.getElementById('draw-limit-bar-fill');
  dom.resultsArea  = document.getElementById('results-area');
  dom.historyList  = document.getElementById('history-list');

  DECK_NAMES.forEach(name => {
    dom[name] = {
      input:    document.getElementById('input-' + name),
      btnUp:    document.getElementById('btn-up-' + name),
      btnDown:  document.getElementById('btn-down-' + name),
      counter:  document.getElementById('counter-' + name),
      progress: document.getElementById('progress-' + name),
      discard:  document.getElementById('discard-' + name),
    };
  });
}

/* ── Render ─────────────────────────────────────────────────── */
function renderDeckStatus() {
  DECK_NAMES.forEach(name => {
    const deck  = state.decks[name];
    const avail = deck.available.length;
    const els   = dom[name];

    els.counter.innerHTML = '<span>' + avail + '</span> / 18';

    const pct = (avail / 18) * 100;
    els.progress.style.width = pct + '%';

    const spentCount   = deck.spent.length;
    const discardCount = deck.discard.length;
    if (spentCount > 0 && discardCount > 0) {
      els.discard.textContent = spentCount + ' spent · ' + discardCount + ' in discard';
    } else if (spentCount > 0) {
      els.discard.textContent = spentCount + ' spent this round';
    } else if (discardCount > 0) {
      els.discard.textContent = discardCount + ' in discard';
    } else {
      els.discard.textContent = 'Discard empty';
    }

    els.input.max = avail;
    if ((parseInt(els.input.value, 10) || 0) > avail) {
      els.input.value = avail;
    }
  });
}

function getTotalDraw() {
  return DECK_NAMES.reduce((sum, name) => {
    return sum + (parseInt(dom[name].input.value, 10) || 0);
  }, 0);
}

function renderTotalBar() {
  const total    = getTotalDraw();
  const maxTotal = DECK_NAMES.reduce((s, n) => s + state.decks[n].available.length, 0);
  const pct      = maxTotal > 0 ? Math.min((total / maxTotal) * 100, 100) : 0;

  dom.totalValue.textContent = total;
  dom.totalValue.classList.remove('is-over-limit');
  dom.totalBar.style.width = pct + '%';
  dom.totalBar.classList.remove('is-full');

  dom.drawBtn.disabled = total === 0;
}

function cardHTML(card, index, animDelay) {
  const deckClass     = 'result-card--' + card.deck;
  const critClass     = card.isCrit      ? 'result-card--crit'      : '';
  const blankClass    = card.value === 0  ? 'result-card--blank'    : '';
  const redrawClass   = card.isRedrawn   ? 'result-card--redrawn'   : '';
  const discardClass  = card.isDiscarded ? 'result-card--discarded' : '';
  const style = 'animation-delay:' + animDelay + 'ms';

  // Redraw origin label (shown on the card face)
  const redrawOriginHTML = card.redrawFrom
    ? ('<span class="result-card__origin" title="Redrawn from ' +
       (card.redrawFrom.value === 0 ? 'blank' : card.redrawFrom.value + (card.redrawFrom.isCrit ? '★' : '')) +
       '">↺ ' +
       (card.redrawFrom.value === 0 ? '—' : card.redrawFrom.value + (card.redrawFrom.isCrit ? '★' : '')) +
       '</span>')
    : '';

  const inner = card.value === 0
    ? '<span class="result-card__deck-label">' + DECK_DEFS[card.deck].label + '</span>' +
      '<span class="result-card__blank-icon" aria-hidden="true">—</span>' +
      redrawOriginHTML
    : '<span class="result-card__deck-label">' + DECK_DEFS[card.deck].label + '</span>' +
      '<span class="result-card__value">' + card.value + '</span>' +
      (card.isCrit ? '<span class="result-card__crit-badge">Crit</span>' : '') +
      redrawOriginHTML;

  const discardLabel = card.isDiscarded ? 'Restore' : 'Discard';
  const actionBtns =
    '<div class="result-card__actions">' +
    '<button class="result-card__btn result-card__btn--discard' + (card.isDiscarded ? ' is-active' : '') + '" ' +
    'data-action="discard" data-index="' + index + '" ' +
    'aria-pressed="' + !!card.isDiscarded + '" ' +
    'title="' + discardLabel + '">' +
    (card.isDiscarded ? '↩' : '✕') + '</button>' +
    '<button class="result-card__btn result-card__btn--redraw" data-action="redraw" data-index="' + index + '" ' +
    'title="Redraw"' + (card.isDiscarded ? ' disabled' : '') + '>↺</button>' +
    '</div>';

  return '<div class="result-card ' + deckClass + ' ' + critClass + ' ' + blankClass + ' ' + redrawClass + ' ' + discardClass + '" ' +
    'style="' + style + '">' +
    inner +
    actionBtns +
    '</div>';
}

function chipHTML(card) {
  const label = card.value === 0 ? '\u2014' : card.value;
  const crit  = card.isCrit ? ' \u2605' : '';
  const redr  = card.isRedrawn ? ' \u21BA' : '';
  return '<span class="history-chip history-chip--' + card.deck + (card.isCrit ? ' history-chip--crit' : '') + '" ' +
    'title="' + DECK_DEFS[card.deck].label + '">' + label + crit + redr + '</span>';
}

function renderResults(cards, reshuffles) {
  state.currentResults = cards;

  if (!cards || cards.length === 0) {
    dom.resultsArea.innerHTML =
      '<div class="results-area__empty">' +
      '<div class="results-area__empty-icon" aria-hidden="true">\uD83C\uDFC4</div>' +
      '<p class="results-area__empty-text">Draw cards to see results</p>' +
      '</div>';
    return;
  }

  const active   = cards.filter(c => !c.isDiscarded);
  const totalDmg = active.reduce((s, c) => s + c.value, 0);
  const crits    = active.filter(c => c.isCrit).length;
  const blanks   = active.filter(c => c.value === 0).length;
  const discarded = cards.filter(c => c.isDiscarded).length;

  const reshuffleHTML = reshuffles.length > 0
    ? '<div style="margin-bottom:var(--space-3);">' +
      reshuffles.map(d =>
        '<span class="reshuffle-notice">\u21BA ' + DECK_DEFS[d].label + ' deck reshuffled</span>'
      ).join(' ') + '</div>'
    : '';

  const cardsHTML = cards.map((c, i) => cardHTML(c, i, i * 40)).join('');

  dom.resultsArea.innerHTML =
    reshuffleHTML +
    '<div class="results-header">' +
    '<span class="results-title">Round ' + state.round + ' \u2014 ' + cards.length + ' card' + (cards.length !== 1 ? 's' : '') + ' drawn</span>' +
    '<div class="results-summary">' +
    '<div class="results-stat"><span class="results-stat__value">' + totalDmg + '</span><span class="results-stat__label">Total</span></div>' +
    '<div class="results-stat"><span class="results-stat__value' + (crits ? ' results-stat__value--crit' : '') + '">' + crits + '</span><span class="results-stat__label">Crits</span></div>' +
    '<div class="results-stat"><span class="results-stat__value">' + blanks + '</span><span class="results-stat__label">Blanks</span></div>' +
    '<div class="results-stat"><span class="results-stat__value' + (discarded ? ' results-stat__value--discarded' : '') + '">' + discarded + '</span><span class="results-stat__label">Discarded</span></div>' +
    '</div></div>' +
    '<div class="cards-grid" role="list">' + cardsHTML + '</div>';

  // Wire card action buttons
  dom.resultsArea.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(btn.dataset.index, 10);
      if (btn.dataset.action === 'redraw')  redrawCard(idx);
      if (btn.dataset.action === 'discard') discardCard(idx);
    });
  });
}

function renderHistory() {
  if (state.history.length === 0) {
    dom.historyList.innerHTML =
      '<p style="font-size:var(--text-xs);color:var(--color-text-muted);padding:var(--space-3);">No draws yet.</p>';
    return;
  }
  dom.historyList.innerHTML = state.history.map(entry => {
    const chips = entry.cards.map(chipHTML).join('');
    return '<div class="history-entry">' +
      '<span class="history-entry__round">Rnd ' + entry.round + '</span>' +
      '<div class="history-entry__cards">' + chips + '</div>' +
      '<span class="history-entry__total">\u03A3 ' + entry.total + '</span>' +
      '</div>';
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

  if (totalCount === 0) return;

  // Retire last round's spent cards into the discard pool
  DECK_NAMES.forEach(function(name) {
    const deck = state.decks[name];
    deck.discard.push.apply(deck.discard, deck.spent);
    deck.spent = [];
  });

  state.round++;
  const allDrawn   = [];
  const reshuffles = [];

  Object.entries(requests).forEach(function(entry) {
    var name  = entry[0];
    var count = entry[1];
    const { cards, reshuffled } = drawFromDeck(name, count);
    allDrawn.push.apply(allDrawn, cards);
    if (reshuffled) reshuffles.push(name);
  });

  const totalDmg = allDrawn.reduce((s, c) => s + c.value, 0);
  state.history.push({ round: state.round, cards: allDrawn.slice(), total: totalDmg });

  renderResults(allDrawn, reshuffles);
  renderDeckStatus();
  renderHistory();

  DECK_NAMES.forEach(name => { dom[name].input.value = 0; });
  renderTotalBar();

  reshuffles.forEach(d =>
    showToast(DECK_DEFS[d].label + ' deck reshuffled', 'info', 3000)
  );

  saveState();
}

function handleReset() {
  if (!confirm('Reset all decks? Available, spent and discard piles will be cleared. Draw history will be cleared.\n\nNote: card exclusions from character abilities will be kept.')) return;
  state.round   = 0;
  state.history = [];
  state.currentResults = [];
  initDecks();

  DECK_NAMES.forEach(name => { dom[name].input.value = 0; });

  renderDeckStatus();
  renderHistory();
  renderResults([], []);
  renderTotalBar();
  saveState();
  showToast('All decks reset', 'success');
}

function handleClearInputs() {
  DECK_NAMES.forEach(name => { dom[name].input.value = 0; });
  renderTotalBar();
}

function clampInput(name) {
  const max = state.decks[name].available.length;
  let   val = parseInt(dom[name].input.value, 10) || 0;
  val = Math.max(0, Math.min(val, max));
  dom[name].input.value = val;
  renderTotalBar();
}

/* ── Events ─────────────────────────────────────────────────── */
function bindEvents() {
  dom.drawBtn.addEventListener('click', handleDraw);
  dom.resetBtn.addEventListener('click', handleReset);
  dom.clearBtn.addEventListener('click', handleClearInputs);

  DECK_NAMES.forEach(name => {
    const els = dom[name];

    els.input.addEventListener('input',  () => clampInput(name));
    els.input.addEventListener('change', () => clampInput(name));

    els.input.addEventListener('keydown', function(e) {
      const max = state.decks[name].available.length;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        els.input.value = Math.min((parseInt(els.input.value, 10) || 0) + 1, max);
        renderTotalBar();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        els.input.value = Math.max((parseInt(els.input.value, 10) || 0) - 1, 0);
        renderTotalBar();
      }
    });

    els.btnUp.addEventListener('click', function() {
      const max = state.decks[name].available.length;
      els.input.value = Math.min((parseInt(els.input.value, 10) || 0) + 1, max);
      renderTotalBar();
    });

    els.btnDown.addEventListener('click', function() {
      els.input.value = Math.max((parseInt(els.input.value, 10) || 0) - 1, 0);
      renderTotalBar();
    });
  });
}

/* ── Boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  cacheDom();

  const restored = loadState();
  if (!restored) initDecks();

  bindEvents();
  renderDeckStatus();
  renderHistory();
  renderTotalBar();

  if (restored) showToast('Session restored', 'info', 2500);
});
