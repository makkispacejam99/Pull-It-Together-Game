/* Escenario, personajes, cuerda y efectos de tirón */

import { avatarSrc, clamp, esc } from '../core/utils.js';

function charHTML(player, index) {
  const delay = ((index * 137) % 900) / 1000 - 0.6;
  const lift = index % 2 === 1 ? '18px' : '0px';
  return `
    <div class="char" data-id="${esc(player.id)}" style="--delay:${delay}s;--tag-lift:${lift}">
      <span class="char__name">${esc(player.nickname)}</span>
      <div class="char__sprite">
        <img class="pi" src="${avatarSrc(player.avatar, 'idle')}" alt="" draggable="false" loading="lazy">
        <img class="pa" src="${avatarSrc(player.avatar, 'walk_a')}" alt="" draggable="false" loading="lazy">
        <img class="pb" src="${avatarSrc(player.avatar, 'walk_b')}" alt="" draggable="false" loading="lazy">
        <img class="pc" src="${avatarSrc(player.avatar, 'hit')}" alt="" draggable="false">
      </div>
      <span class="char__base"></span>
    </div>`;
}

export function createScene({ mini = false } = {}) {
  const root = document.createElement('div');
  root.className = 'arena';
  root.innerHTML = `
    <div class="arena__sky"></div>
    <div class="arena__nebula arena__nebula--violet"></div>
    <div class="arena__nebula arena__nebula--teal"></div>
    <div class="arena__stars"></div>
    <div class="arena__stars arena__stars--near"></div>
    <div class="arena__planet"></div>
    ${mini ? '' : '<div class="arena__moon"></div>'}
    <div class="arena__shoot"></div>
    <div class="arena__sat" aria-hidden="true">
      <span class="arena__sat-panel"></span>
      <span class="arena__sat-body"></span>
      <span class="arena__sat-panel"></span>
    </div>
    <div class="arena__rocks"><span></span><span></span><span></span></div>
    <div class="arena__ridge arena__ridge--far"></div>
    <div class="arena__ridge arena__ridge--near"></div>
    <div class="arena__crystals">
      <span class="arena__crystal arena__crystal--1"></span>
      <span class="arena__crystal arena__crystal--2"></span>
      <span class="arena__crystal arena__crystal--3"></span>
      <span class="arena__crystal arena__crystal--4"></span>
    </div>
    <div class="arena__ground"></div>
    <div class="arena__center"></div>
    <div class="arena__vs" aria-hidden="true">
      <span class="arena__vs-badge">VS</span>
    </div>
    <div class="side side--a"></div>
    <div class="side side--b"></div>
    <div class="rope">
      <div class="rope__cord">
        <span class="rope__half rope__half--a"></span>
        <span class="rope__half rope__half--b"></span>
      </div>
      <span class="rope__pin" aria-hidden="true"></span>
    </div>
  `;

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
    if (!delta) return;
    const cls = delta > 0 ? 'is-pulling-a' : 'is-pulling-b';
    root.classList.add(cls, 'is-shaking');
    setTimeout(() => root.classList.remove(cls, 'is-shaking'), 700);

    const label = document.createElement('div');
    label.className = 'pull-fx';
    label.textContent = `${delta > 0 ? '+' : ''}${delta}`;
    root.appendChild(label);
    setTimeout(() => label.remove(), 1200);

    const count = clamp(Math.round(Math.abs(delta) / 2) + 3, 4, 14);
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('span');
      spark.className = 'spark';
      spark.style.left = `${splitPct}%`;
      spark.style.top = '50%';
      spark.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
      spark.style.setProperty('--dy', `${(Math.random() - 0.5) * 90 - 20}px`);
      spark.style.background = Math.random() > 0.5 ? '#faba2d' : '#fff3cf';
      root.appendChild(spark);
      setTimeout(() => spark.remove(), 700);
    }
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

export function decorateHomeScene(container) {
  const scene = createScene();
  container.appendChild(scene.root);

  const demo = [
    { id: 'd1', nickname: 'Nova', team: 'A', avatar: 'green' },
    { id: 'd2', nickname: 'Pixel', team: 'A', avatar: 'yellow' },
    { id: 'd3', nickname: 'Kuma', team: 'A', avatar: 'purple' },
    { id: 'd4', nickname: 'Michi', team: 'A', avatar: 'beige' },
    { id: 'd5', nickname: 'Luna', team: 'B', avatar: 'pink' },
    { id: 'd6', nickname: 'Rayo', team: 'B', avatar: 'purple' },
    { id: 'd7', nickname: 'Tofu', team: 'B', avatar: 'green' },
    { id: 'd8', nickname: 'Vega', team: 'B', avatar: 'yellow' },
  ];

  scene.update({
    status: 'reveal',
    players: demo,
    rope: 0,
  });

  let tick = 0;
  scene.root.__demoTimer = setInterval(() => {
    tick += 1;
    scene.update({
      status: 'reveal',
      players: demo,
      rope: Math.round(Math.sin(tick * 0.85) * 18),
    });
  }, 1100);

  return scene;
}
