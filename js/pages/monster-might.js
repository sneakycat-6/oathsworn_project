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

function isExcluded(deckName, card) {
  const excl = state.decks[deckName].excluded;
  return excl.some(e => e.value === card.value && e.isCrit === card.isCrit);
}

/* ── State ──────────────────────────────────────────────────── */
const state = {
  decks: {},
  // { [deckName]: { available: Card[], discard: Card[], excluded: ExclType[] } }
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
      excluded:  prev ? prev.excluded : [],  // keep exclusions across reset
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
      const eligible = deck.discard.filter(c => !isExcluded(deckName, c));
      if (eligible.length === 0) break;   // nothing left to reshuffle
      deck.available = shuffle(eligible);
      deck.discard    = deck.discard.filter(c => isExcluded(deckName, c));
      reshuffled      = true;
    }
    drawn.push(deck.available.pop());
  }

  deck.discard.push(...drawn);
  return { cards: drawn, reshuffled };
}

/**
 * Redraw a single card at resultIndex.
 * The original card stays in discard; a replacement is drawn from the same deck.
 */
function redrawCard(resultIndex) {
  const original = state.currentResults[resultIndex];
  if (!original) return;

  const deckName = original.deck;
  const { cards, reshuffled } = drawFromDeck(deckName, 1);
  if (!cards.length) {
    showToast('No cards available to redraw from ' + DECK_DEFS[deckName].label + ' deck', 'warning');
    return;
  }

  const replacement = Object.assign({}, cards[0], { isRedrawn: true });
  state.currentResults[resultIndex] = replacement;

  if (reshuffled) {
    showToast(DECK_DEFS[deckName].label + ' deck reshuffled', 'info', 3000);
  }

  renderResults(state.currentResults, []);
  renderDeckStatus();
  saveState();
}

/* ── Exclusions ─────────────────────────────────────────────── */
function toggleExclusion(deckName, value, isCrit) {
  const deck = state.decks[deckName];
  const idx  = deck.excluded.findIndex(e => e.value === value && e.isCrit === isCrit);

  if (idx === -1) {
    // Add exclusion — move matching cards out of available and discard
    deck.excluded.push({ value, isCrit });
    deck.available = deck.available.filter(c => !(c.value === value && c.isCrit === isCrit));
    deck.discard   = deck.discard.filter(c => !(c.value === value && c.isCrit === isCrit));
  } else {
    // Remove exclusion — put cards back into available (reshuffled in)
    deck.excluded.splice(idx, 1);
    const types    = getCardTypes(deckName);
    const typeDef  = types.find(t => t.value === value && t.isCrit === isCrit);
    const count    = typeDef ? typeDef.total : 0;
    const restored = [];
    for (let i = 0; i < count; i++) {
      restored.push({ value, isCrit, deck: deckName });
    }
    deck.available = shuffle([...deck.available, ...restored]);
  }

  renderDeckStatus();
  renderExclusionToggles(deckName);
  renderTotalBar();
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
    // Ensure excluded array exists (backward compat)
    DECK_NAMES.forEach(n => {
      if (!state.decks[n].excluded) state.decks[n].excluded = [];
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
      exclRow:  document.getElementById('excl-row-' + name),
    };
  });
}

/* ── Render ─────────────────────────────────────────────────── */
function renderDeckStatus() {
  DECK_NAMES.forEach(name => {
    const deck  = state.decks[name];
    const avail = deck.available.length;
    const excl  = deck.excluded.length > 0;
    const els   = dom[name];

    // Active cards = available + discard (excludes excluded cards)
    const active = DECK_SIZE - deck.excluded.reduce((sum, e) => {
      const types = getCardTypes(name);
      const t = types.find(t => t.value === e.value && t.isCrit === e.isCrit);
      return sum + (t ? t.total : 0);
    }, 0);

    els.counter.innerHTML = '<span>' + avail + '</span> / ' + active +
      (excl ? ' <span style="color:var(--color-red-bright);font-size:9px;" title="Some cards excluded">&#9888;</span>' : '');

    const pct = active > 0 ? (avail / active) * 100 : 0;
    els.progress.style.width = pct + '%';

    els.discard.textContent =
      deck.discard.length > 0 ? deck.discard.length + ' in discard' : 'Discard empty';

    // Update input max
    els.input.max = avail;
    if ((parseInt(els.input.value, 10) || 0) > avail) {
      els.input.value = avail;
    }
  });
}

function renderExclusionToggles(deckName) {
  const container = dom[deckName].exclRow;
  if (!container) return;

  const deck  = state.decks[deckName];
  const types = getCardTypes(deckName);

  container.innerHTML = types.map(t => {
    const key      = typeKey(t.value, t.isCrit);
    const active   = deck.excluded.some(e => e.value === t.value && e.isCrit === t.isCrit);
    const label    = t.value === 0 ? '—' : (t.value + (t.isCrit ? '★' : ''));
    const countLbl = '×' + t.total;
    return '<button class="excl-toggle' + (active ? ' is-excluded' : '') + '" ' +
      'data-deck="' + deckName + '" ' +
      'data-value="' + t.value + '" ' +
      'data-crit="' + t.isCrit + '" ' +
      'aria-pressed="' + active + '" ' +
      'title="' + (active ? 'Re-include' : 'Exclude') + ' ' + label + ' cards from ' + DECK_DEFS[deckName].label + ' deck">' +
      '<span class="excl-toggle__label">' + label + '</span>' +
      '<span class="excl-toggle__count">' + countLbl + '</span>' +
      '</button>';
  }).join('');

  // Wire buttons
  container.querySelectorAll('.excl-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const dn   = btn.dataset.deck;
      const val  = parseInt(btn.dataset.value, 10);
      const crit = btn.dataset.crit === 'true';
      toggleExclusion(dn, val, crit);
    });
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
  const deckClass  = 'result-card--' + card.deck;
  const critClass  = card.isCrit    ? 'result-card--crit'    : '';
  const blankClass = card.value === 0 ? 'result-card--blank' : '';
  const redrawClass = card.isRedrawn ? 'result-card--redrawn' : '';
  const style = 'animation-delay:' + animDelay + 'ms';

  const inner = card.value === 0
    ? '<span class="result-card__blank-icon" aria-hidden="true">\u2014</span>' +
      '<span class="result-card__deck-label">' + DECK_DEFS[card.deck].label + '</span>'
    : '<span class="result-card__deck-label">' + DECK_DEFS[card.deck].label + '</span>' +
      '<span class="result-card__value">' + card.value + '</span>' +
      (card.isCrit ? '<span class="result-card__crit-badge">Crit</span>' : '');

  const redrawBtn =
    '<button class="result-card__redraw" data-index="' + index + '" ' +
    'aria-label="Redraw this card" title="Redraw">\u21BA</button>';

  const redrawBadge = card.isRedrawn
    ? '<span class="result-card__redrawn-badge" title="Redrawn">\u21BA</span>'
    : '';

  return '<div class="result-card ' + deckClass + ' ' + critClass + ' ' + blankClass + ' ' + redrawClass + '" ' +
    'style="' + style + '">' +
    redrawBadge +
    inner +
    redrawBtn +
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

  const totalDmg = cards.reduce((s, c) => s + c.value, 0);
  const crits    = cards.filter(c => c.isCrit).length;
  const blanks   = cards.filter(c => c.value === 0).length;

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
    '</div></div>' +
    '<div class="cards-grid" role="list">' + cardsHTML + '</div>';

  // Wire redraw buttons
  dom.resultsArea.querySelectorAll('.result-card__redraw').forEach(btn => {
    btn.addEventListener('click', () => redrawCard(parseInt(btn.dataset.index, 10)));
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
  if (!confirm('Reset all decks to their full card count? Draw history will be cleared.\n\nNote: card exclusions from character abilities will be kept.')) return;
  state.round   = 0;
  state.history = [];
  state.currentResults = [];
  initDecks();

  DECK_NAMES.forEach(name => {
    dom[name].input.value = 0;
    renderExclusionToggles(name);
  });

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

  DECK_NAMES.forEach(name => renderExclusionToggles(name));

  if (restored) showToast('Session restored', 'info', 2500);
});
