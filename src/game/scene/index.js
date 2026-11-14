import { clamp } from '../../core/utils.js';
import { charHTML, sceneMarkup } from './markup.js';
import { pullEffect } from './effects.js';

export function createScene({ mini = false } = {}) {
  const root = document.createElement('div');
  root.className = 'arena';
  root.innerHTML = sceneMarkup(mini);

  const sideA = root.querySelector('.side--a');
  const sideB = root.querySelector('.side--b');

  let signature = '';
  let stepTimer = null;
  let stepping = false;
  let lastPullRound = -1;
  let destroyed = false;
  let maxPerRow = 1;
  let splitPct = 50;

  function splitRows(players) {
    if (players.length <= 9) return { front: players, back: [] };
    const perRow = Math.ceil(players.length / 2);
    return { front: players.slice(0, perRow), back: players.slice(perRow) };
  }

  function renderSide(side, players) {
    const { front, back } = splitRows(players);
    const rowHTML = (list, cls) =>
      list.length
        ? `<div class="row ${cls}">${list.map((p, i) => charHTML(p, i)).join('')}</div>`
        : '';
    side.innerHTML = `${rowHTML(back, 'row--back')}${rowHTML(front, 'row--front')}`;
  }

  function layout() {
    const width = root.clientWidth || 900;
    const perRow = Math.max(1, maxPerRow);
    const available = width * 0.5;
    const maxSize = mini ? 72 : width < 760 ? 104 : width < 1200 ? 116 : 122;
    const size = clamp(available / (perRow * 0.86), mini ? 26 : 30, maxSize);
    const scale = clamp(1 + (900 - width) / 1500, 1, 1.22);
    const gap = perRow > 1 ? (available - size * scale) / (perRow - 1) : size;
    const overlap = perRow > 1 ? Math.min(-0.16, gap / size - 1) : 0;
    root.style.setProperty('--char-size', `${Math.round(size)}px`);
    root.style.setProperty('--char-scale', scale.toFixed(3));
    root.style.setProperty('--char-overlap', overlap.toFixed(3));
    root.style.setProperty('--char-lift', `${Math.round((scale - 1) * size)}px`);
  }

  function build(state) {
    const players = state.players || [];
    const a = players.filter((p) => p.team === 'A');
    const b = players.filter((p) => p.team === 'B');
    maxPerRow = Math.max(1, Math.ceil(a.length / (a.length > 9 ? 2 : 1)), Math.ceil(b.length / (b.length > 9 ? 2 : 1)));
    renderSide(sideA, a);
    renderSide(sideB, b);
    layout();
    signature = rosterSignature(players);
  }

  function rosterSignature(players) {
    return players
      .map((p) => `${p.id}:${p.team}:${p.avatar}:${p.nickname}`)
      .sort()
      .join('|');
  }

  function setStep(on) {
    if (stepping) root.classList.toggle('is-step', on);
  }

  function startStepLoop() {
    if (stepTimer) return;
    stepTimer = setInterval(() => {
      stepping = !stepping;
      root.classList.toggle('is-step', stepping);
    }, 520);
  }

  function stopStepLoop() {
    clearInterval(stepTimer);
    stepTimer = null;
    stepping = false;
    root.classList.remove('is-step');
  }

  function sync(state) {
    const players = state.players || [];
    const sig = rosterSignature(players);
    if (sig !== signature) build(state);

    if (state.status === 'question') {
      startStepLoop();
    } else {
      stopStepLoop();
    }

    root.classList.toggle('is-tug', state.status === 'reveal');

    const rope = Number(state.rope || 0);
    const advantage = Math.abs(rope);
    const shift = advantage ? Math.min(42, 4.6 * Math.sqrt(advantage)) : 0;
    splitPct = clamp(50 - Math.sign(rope) * shift, 8, 92);
    root.style.setProperty('--rope-split', `${splitPct}%`);

    root.classList.toggle('lead-a', rope > 0);
    root.classList.toggle('lead-b', rope < 0);

    for (const node of root.querySelectorAll('.char')) {
      const id = node.dataset.id;
      const player = players.find((p) => p.id === id);
      node.classList.toggle('is-voted', Boolean(player?.voted));
    }

    const result = state.lastResult;
    const showReveal = state.status === 'reveal' || state.status === 'results';
    for (const node of root.querySelectorAll('.char')) {
      node.classList.remove('is-correct', 'is-wrong');
      if (!showReveal || !result) continue;
      const detail = result.individuals?.[node.dataset.id];
      if (!detail) continue;
      node.classList.add(detail.correct ? 'is-correct' : 'is-wrong');
    }

    if (showReveal && result && result.round !== lastPullRound) {
      lastPullRound = result.round;
      pull(result.delta);
    }
  }

  function pull(delta) {
    pullEffect(root, delta, splitPct);
  }

  function update(state) {
    if (destroyed) return;
    sync(state || { players: [] });
  }

  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  return {
    root,
    update,
    pull,
    build,
    destroy() {
      destroyed = true;
      stopStepLoop();
      clearInterval(root.__demoTimer);
      window.removeEventListener('resize', onResize);
      root.remove();
    },
  };
}
