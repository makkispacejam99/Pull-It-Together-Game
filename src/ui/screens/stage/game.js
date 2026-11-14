import { isMuted, play, toggleMuted } from '../../../core/audio.js';
import { DIFFICULTY_LABEL } from '../../../core/questions.js';
import { esc, fmtClock } from '../../../core/utils.js';
import { createScene } from '../../../game/scene.js';
import { toggleFullscreen } from './shared.js';
import { SCORE } from '../../../core/rules.js';

const LETTERS = ['A', 'B', 'C', 'D'];

const FLAME_SVG = `
  <svg class="streak-toast__flame" viewBox="0 0 8 10" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <path fill="#ff6a1a" d="M3 0h2v1H3zM3 1h3v1H3zM2 2h4v1H2zM2 3h5v1H2zM1 4h6v2H1zM0 6h8v2H0zM1 8h6v1H1zM2 9h4v1H2z"/>
    <path fill="#ffc43d" d="M3 4h2v1H3zM2 5h4v1H2zM2 6h4v2H2zM2 8h4v1H2zM3 9h2v1H3z"/>
    <path fill="#fff3cf" d="M3 7h2v2H3z"/>
  </svg>`;

function streakLabel(streak) {
  if (streak >= 5) return '¡Imparable!';
  if (streak >= 4) return '¡En llamas!';
  if (streak >= 3) return 'En racha';
  return 'Racha';
}

function streakBonus(streak) {
  if (streak >= 3) return SCORE.streak3;
  if (streak === 2) return SCORE.streak2;
  return 0;
}

export function createGameView(ctx) {
  const { root, host } = ctx;
  let timerRaf = null;
  let tickSecond = -1;
  let panelKey = '';
  let countdownKey = '';
  let countdownTimer = null;

  function build(state) {
    root.innerHTML = `
      <div class="stage-screen">
        <header class="hud">
          <div class="hud__round">Ronda <b data-round>1</b><span data-total>/8</span></div>

          <div class="hud__teams">
            <div class="score score--a">
              <span class="score__name" data-name-a>MARCIANOS</span>
              <span class="score__value" data-score-a>0</span>
            </div>
            <div class="hud__timer" data-timer>
              <span class="time" data-time>00:45</span>
              <span class="label">Tiempo</span>
            </div>
            <div class="score score--b">
              <span class="score__value" data-score-b>0</span>
              <span class="score__name" data-name-b>SATURNINOS</span>
            </div>
          </div>

          <div class="hud__tools">
            <button class="icon-btn" data-audio title="Sonido">${isMuted() ? '♪̸' : '♪'}</button>
            <button class="icon-btn" data-fullscreen title="Pantalla completa">⛶</button>
            <button class="icon-btn" data-exit title="Salir">✕</button>
          </div>
        </header>

        <div class="tug" data-tug>
          <div class="tug__bar">
            <div class="tug__half tug__half--a"></div>
            <div class="tug__half tug__half--b"></div>
            <div class="tug__mid"></div>
            <div class="tug__ship" data-mark style="--ship-x:50%">
              <span class="tug__beam"></span>
              <svg class="tug__ufo" viewBox="0 0 16 11" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
                <path fill="#241f47" d="M6 0h4v1H6z"/>
                <path fill="#a9f0ff" d="M6 1h4v1H6zM4 2h8v1H4zM3 3h10v1H3z"/>
                <path fill="#efffff" d="M6 1h2v1H6zM5 2h2v1H5z"/>
                <path fill="#241f47" d="M2 4h12v1H2zM1 5h14v1H1zM0 6h16v1H0zM1 7h14v1H1zM3 8h10v1H3z"/>
                <path fill="#d6ddff" d="M2 5h12v1H2z"/>
                <path fill="#b9c2f2" d="M1 6h14v1H1z"/>
                <path fill="#7c86c4" d="M2 7h12v1H2z"/>
                <path fill="#ffd05c" d="M3 6h2v1H3zM7 6h2v1H7zM11 6h2v1H11z"/>
                <path fill="#9a7bff" d="M5 7h1v1H5zM10 7h1v1H10z"/>
              </svg>
            </div>
          </div>
          <div class="tug__status" data-status>
            <span class="tug__dir" data-dir hidden></span>
            <span data-status-text>Empate</span>
            <span class="tug__ko" data-ko hidden></span>
          </div>
        </div>

        <div class="arena-wrap" data-arena-wrap style="position:relative;min-height:0;overflow:hidden">
        </div>

        <section class="qpanel" data-panel></section>
      </div>
    `;

    const wrap = root.querySelector('[data-arena-wrap]');
    const scene = createScene();
    wrap.appendChild(scene.root);
    ctx.setScene(scene);

    root.querySelector('[data-audio]').addEventListener('click', (event) => {
      const muted = toggleMuted();
      event.currentTarget.textContent = muted ? '♪̸' : '♪';
    });
    root.querySelector('[data-fullscreen]').addEventListener('click', toggleFullscreen);
    root.querySelector('[data-exit]').addEventListener('click', () => {
      location.hash = '#/';
    });

    update(state);
  }

  function update(state) {
    if (!root.querySelector('.stage-screen')) return;

    const nameA = state.teams.A.name;
    const nameB = state.teams.B.name;

    root.querySelector('[data-round]').textContent = String(Math.max(1, state.round));
    root.querySelector('[data-total]').textContent = `/${state.totalRounds}`;
    root.querySelector('[data-score-a]').textContent = String(state.teams.A.score);
    root.querySelector('[data-score-b]').textContent = String(state.teams.B.score);
    root.querySelector('[data-name-a]').textContent = nameA;
    root.querySelector('[data-name-b]').textContent = nameB;

    const rope = Number(state.rope || 0);
    const lead = rope > 0 ? 'A' : rope < 0 ? 'B' : null;
    const ship = root.querySelector('[data-mark]');
    if (ship) ship.style.setProperty('--ship-x', `${50 - rope * 0.5}%`);

    const tug = root.querySelector('[data-tug]');
    tug?.classList.toggle('is-lead-a', lead === 'A');
    tug?.classList.toggle('is-lead-b', lead === 'B');
    tug?.classList.toggle('is-close', Math.abs(rope) >= 70);

    const dir = root.querySelector('[data-dir]');
    const statusText = root.querySelector('[data-status-text]');
    const ko = root.querySelector('[data-ko]');
    if (dir && statusText && ko) {
      dir.hidden = !lead;
      dir.className = `tug__dir${lead ? ` tug__dir--${lead === 'A' ? 'l' : 'r'}` : ''}`;
      statusText.textContent = lead
        ? `${lead === 'A' ? nameA : nameB} +${Math.abs(rope)}`
        : 'Empate · 0';
      const remaining = 100 - Math.abs(rope);
      ko.hidden = remaining > 30;
      ko.textContent = remaining > 30 ? '' : `¡A ${remaining} del KO!`;
    }

    ctx.getScene()?.update(state);
    updateTimer(state);

    if (state.status === 'countdown') {
      panelKey = '';
      renderCountdown(state);
      clearPanel();
      return;
    }

    removeCountdown();

    const key = `${state.status}:${state.round}`;
    if (key !== panelKey) {
      panelKey = key;
      if (state.status === 'question') {
        buildQuestionPanel(state);
        showRoundBanner(state);
      } else if (state.status === 'reveal') buildRevealPanel(state);
      else if (state.status === 'results') buildRevealPanel(state);
    }

    if (state.status === 'question') {
      const votes = root.querySelector('[data-votes]');
      if (votes) votes.textContent = `${state.voteCount || 0} / ${state.roundPlayers?.length || 0} votaron`;
    }
  }

  function showRoundBanner(state) {
    if (state.round <= 1) return;
    root.querySelector('.round-banner')?.remove();
    const node = document.createElement('div');
    node.className = 'round-banner';
    node.innerHTML = `
      <span class="round-banner__label">Ronda</span>
      <span class="round-banner__num">${state.round}<small>/${state.totalRounds}</small></span>`;
    root.querySelector('[data-arena-wrap]')?.appendChild(node);
    play('select');
    setTimeout(() => node.remove(), 1400);
  }

  function updateTimer(state) {
    stopTimer();
    if (!state.endsAt) {
      tickSecond = -1;
      return;
    }
    const timerBox = root.querySelector('[data-timer]');
    const time = root.querySelector('[data-time]');
    if (!time) return;

    const tick = () => {
      if (ctx.isDestroyed()) return;
      const remaining = Math.max(0, state.endsAt - Date.now());
      const total = Math.max(1, state.endsAt - state.phaseStartedAt);
      time.textContent = fmtClock(remaining);
      const low = remaining <= 10000 && remaining > 0;
      timerBox?.classList.toggle('is-low', low);
      if (low && state.status === 'question') {
        const second = Math.ceil(remaining / 1000);
        if (second !== tickSecond) {
          tickSecond = second;
          play('tick', { pitch: 1 + (10 - Math.min(second, 10)) * 0.03 });
        }
      } else if (state.status !== 'question') {
        tickSecond = -1;
      }
      const width = Math.max(0, Math.min(100, (remaining / total) * 100));
      const bar = root.querySelector('[data-tug-progress]');
      if (bar) bar.style.width = `${width}%`;
      if (remaining > 0) timerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopTimer() {
    if (timerRaf) {
      cancelAnimationFrame(timerRaf);
      timerRaf = null;
    }
  }

  function reset() {
    panelKey = '';
    countdownKey = '';
  }

  function clearPanel() {
    const panel = root.querySelector('[data-panel]');
    if (panel) panel.innerHTML = '';
  }

  function renderCountdown(state) {
    const remaining = Math.max(0, state.endsAt - Date.now());
    const number = String(Math.min(3, Math.max(1, Math.ceil(remaining / 1000))));
    let node = root.querySelector('.countdown');

    if (!node) {
      node = document.createElement('div');
      node.className = 'countdown';
      node.innerHTML = '<span class="countdown__num">3</span>';
      root.querySelector('[data-arena-wrap]')?.appendChild(node);
      countdownKey = '';
      clearInterval(countdownTimer);
      countdownTimer = setInterval(() => {
        if (ctx.isDestroyed() || !root.querySelector('.countdown')) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          return;
        }
        renderCountdown(state);
      }, 100);
    }

    const num = node.querySelector('.countdown__num');
    if (num && num.textContent !== number) {
      num.textContent = number;
      num.style.animation = 'none';
      void num.offsetWidth;
      num.style.animation = '';
    }
  }

  function removeCountdown() {
    root.querySelector('.countdown')?.remove();
  }

  function buildQuestionPanel(state) {
    const panel = root.querySelector('[data-panel]');
    if (!panel) return;
    const q = state.question;
    if (!q) return;

    panel.innerHTML = `
      <div class="qpanel">
        <div class="qpanel__meta">
          <span class="chip">${esc(q.category)}</span>
          <span class="chip chip--ghost">${esc(DIFFICULTY_LABEL[q.difficulty] || '')}</span>
          <span class="qpanel__votes" data-votes>0 / ${state.roundPlayers?.length || 0} votaron</span>
          <button class="btn btn--ghost btn--sm" data-skip style="margin-left:8px">Saltar</button>
        </div>
        <h2 class="qpanel__text">${esc(q.text)}</h2>
        <div class="qpanel__options">
          ${q.options
            .map(
              (option, i) => `
              <div class="opt" data-opt="${i}">
                <span class="opt__key">${LETTERS[i]}</span>
                <span class="opt__txt">${esc(option)}</span>
                <span class="opt__tags" data-tags="${i}"></span>
              </div>`
            )
            .join('')}
        </div>
      </div>`;

    panel.querySelector('[data-skip]')?.addEventListener('click', () => host.skip());
  }

  function buildRevealPanel(state) {
    const panel = root.querySelector('[data-panel]');
    if (!panel) return;
    const result = state.lastResult;
    const q = result?.question || state.question;
    if (!q || !result) return;

    const aCorrect = result.teams.A.correct;
    const bCorrect = result.teams.B.correct;
    const anyCorrect = aCorrect || bCorrect;

    panel.innerHTML = `
      <div class="qpanel">
        <div class="qpanel__meta">
          <span class="chip">${esc(q.category)}</span>
          <span class="chip ${anyCorrect ? 'chip--a' : 'chip--b'}">
            ${
              aCorrect && bCorrect
                ? 'Ambos equipos aciertan'
                : aCorrect
                  ? `Acierta ${esc(state.teams.A.name)}`
                  : bCorrect
                    ? `Acierta ${esc(state.teams.B.name)}`
                    : 'Nadie acierta esta ronda'
            }
          </span>
          <span class="qpanel__votes">
            ${esc(state.teams.A.name)} +${result.teams.A.pull} ·
            ${esc(state.teams.B.name)} +${result.teams.B.pull}
          </span>
          <button class="btn btn--ghost btn--sm" data-skip style="margin-left:8px">Siguiente</button>
        </div>
        <h2 class="qpanel__text">${esc(q.text)}</h2>
        <div class="qpanel__options">
          ${q.options
            .map(
              (option, i) => `
              <div class="opt ${i === result.correctIndex ? 'is-correct' : ''}" data-opt="${i}">
                <span class="opt__key">${LETTERS[i]}</span>
                <span class="opt__txt">${esc(option)}</span>
                <span class="opt__tags">
                  ${result.teams.A.choice === i ? '<span class="opt__tag opt__tag--a">A</span>' : ''}
                  ${result.teams.B.choice === i ? '<span class="opt__tag opt__tag--b">B</span>' : ''}
                </span>
              </div>`
            )
            .join('')}
        </div>
      </div>`;

    panel.querySelector('[data-skip]')?.addEventListener('click', () => host.skip());

    const badgeText =
      result.delta === 0
        ? 'Sin movimiento'
        : `${result.delta > 0 ? state.teams.A.name : state.teams.B.name} +${Math.abs(result.delta)}`;
    const badge = document.createElement('div');
    badge.className = `reveal-badge ${
      result.delta > 0 ? 'reveal-badge--ok' : result.delta < 0 ? 'reveal-badge--bad' : 'reveal-badge--tie'
    }`;
    badge.textContent = badgeText;
    root.querySelector('[data-arena-wrap]')?.appendChild(badge);
    setTimeout(() => badge.remove(), 5200);
        if (state.status === 'reveal') showStreakToasts(state, result);
    play(anyCorrect ? 'correct' : 'wrong');
    play('pull');
  }

    function showStreakToasts(state, result) {
    const items = ['A', 'B']
      .map((team) => ({ team, streak: result.teams[team].correct ? state.teams[team].streak || 0 : 0 }))
      .filter((item) => item.streak >= 2);
    if (!items.length) return;

    root.querySelector('.streak-toasts')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'streak-toasts';
    wrap.innerHTML = items
      .map(
        ({ team, streak }) => `
        <div class="streak-toast streak-toast--${team.toLowerCase()} ${streak >= 4 ? 'is-hot' : ''}">
          ${FLAME_SVG}
          <span class="streak-toast__body">
            <span class="streak-toast__team">${esc(state.teams[team].name)}</span>
            <span class="streak-toast__label">${streakLabel(streak)} <b>×${streak}</b></span>
          </span>
          <span class="streak-toast__bonus">+${streakBonus(streak)}</span>
        </div>`
      )
      .join('');
    root.querySelector('[data-arena-wrap]')?.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3600);
  }

  return { build, update, stopTimer, reset };
}
