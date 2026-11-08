/* Pantalla de Lobby del anfitrion */

import { HostRoom, MAX_PLAYERS } from '../../core/host.js';
import { categoriesOf, DIFFICULTIES, DIFFICULTY_LABEL, loadBank } from '../../core/questions.js';
import { isMuted, play, startMusic, stopMusic, toggleMuted } from '../../core/audio.js';
import { rankPlayers } from '../../core/rules.js';
import { avatarSrc, copyText, esc, fmtClock } from '../../core/utils.js';
import { createScene } from '../../game/scene.js';
import { toast } from '../toast.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const ROUND_OPTIONS = [4, 6, 8, 10, 12];
const TIME_OPTIONS = [30, 45, 60, 90];

export function renderStage(root, params = {}) {
  const code = String(params.code || '').toUpperCase();
  if (!code) {
    location.hash = '#/';
    return null;
  }

  let host;
  try {
    host = new HostRoom(code, { onChange: onHostChange });
  } catch (error) {
    root.innerHTML = `
      <div class="gate">
        <div class="gate__card panel">
          <p class="gate__icon">!</p>
          <p class="muted">No se pudo abrir la sala.</p>
          <a class="btn btn--primary" href="#/">Volver al inicio</a>
        </div>
      </div>`;
    return null;
  }

  let mode = '';
  let scene = null;
  let timerRaf = null;
  let panelKey = '';
  let resultsKey = '';
  let countdownKey = '';
  let countdownTimer = null;
  let resultsNode = null;
  let destroyed = false;
  let lastStatus = '';

  const bank = loadBank();
  const categories = categoriesOf(bank);

  host.start();

  /* Render */

  function onHostChange(state, event) {
    if (destroyed) return;
    if (event?.message) toast(event.message, 'bad');
    if (event?.event === 'finish') play('win');
    render(state);
  }

  function render(state) {
    const nextMode = state.status === 'lobby' ? 'lobby' : 'game';
    if (nextMode !== mode) {
      mode = nextMode;
      build(state);
    }

    if (mode === 'lobby') updateLobby(state);
    else updateGame(state);

    if (state.status === 'results') showResults(state);
    else hideResults();

    if (state.status !== lastStatus) {
      lastStatus = state.status;
    if (['countdown', 'question', 'reveal'].includes(state.status)) startMusic();
      else stopMusic();
    }
  }

  function build(state) {
    destroyMode();
    if (mode === 'lobby') buildLobby(state);
    else buildGame(state);
  }

  function destroyMode() {
    stopTimer();
    if (scene) {
      scene.destroy();
      scene = null;
    }
    resultsNode?.remove();
    resultsNode = null;
    resultsKey = '';
    panelKey = '';
    countdownKey = '';
    root.innerHTML = '';
  }

  /* lobby */

  function buildLobby(state) {
    const inviteUrl = `${location.origin}${location.pathname}#/room/${code}`;

    root.innerHTML = `
      <div class="lobby-screen">
        <header class="topbar">
          <a class="brand" href="#/">
            <img src="assets/img/props/hud_player_pink.png" alt="">
            <span>PULL IT TOGETHER</span>
          </a>
          <div class="topbar__nav">
            <span class="chip chip--gold">Sala ${esc(code)}</span>
            <button class="btn btn--ghost btn--sm" data-audio>${isMuted() ? '♪̸' : '♪'}</button>
            <button class="btn btn--ghost btn--sm" data-fullscreen>Pantalla completa</button>
          </div>
        </header>

        <main class="lobby">
          <section class="lobby__invite panel">
            <p class="eyebrow">Código de sala</p>
            <p class="lobby__code">${esc(code)}</p>
            <button class="btn btn--primary" data-copy>Copiar invitación</button>
            <div class="lobby__link">
              <span>${esc(inviteUrl)}</span>
              <button type="button" class="lobby__link-copy" data-copy-link>Copiar</button>
            </div>
            <button class="btn btn--ghost btn--sm" data-open-player>Abrir vista de jugador</button>
            <hr class="rule">
            <p class="tiny muted">
              Comparte el código: cada jugador entra desde otra pestaña de este navegador.
              En la versión online cada uno podrá usar su propio móvil.
            </p>
          </section>

          <section class="lobby__teams">
            ${teamColumn('A', state)}
            ${teamColumn('B', state)}
          </section>

          <section class="lobby__config panel">
            <div class="config-group">
              <span class="field-label">Rondas</span>
              <div class="seg" data-seg="rounds">
                ${ROUND_OPTIONS.map(
                  (n) =>
                    `<button type="button" data-value="${n}" class="${
                      state.config.rounds === n ? 'is-on' : ''
                    }">${n}</button>`
                ).join('')}
              </div>
            </div>

            <div class="config-group">
              <span class="field-label">Tiempo por pregunta</span>
              <div class="seg" data-seg="duration">
                ${TIME_OPTIONS.map(
                  (n) =>
                    `<button type="button" data-value="${n}" class="${
                      state.config.duration === n ? 'is-on' : ''
                    }">${n}s</button>`
                ).join('')}
              </div>
            </div>

            <div class="config-group">
              <span class="field-label">Dificultad</span>
              <div class="seg" data-seg="difficulty">
                <button type="button" data-value="all" class="${
                  state.config.difficulty === 'all' ? 'is-on' : ''
                }">Todas</button>
                ${DIFFICULTIES.map(
                  (d) =>
                    `<button type="button" data-value="${d.id}" class="${
                      state.config.difficulty === d.id ? 'is-on' : ''
                    }">${d.label}</button>`
                ).join('')}
              </div>
            </div>

            <div class="config-group">
              <span class="field-label">Categorías</span>
              <div class="cat-list" data-cats>
                ${categories
                  .map(
                    (c) =>
                      `<button type="button" class="chip ${
                        state.config.categories.includes(c) ? 'is-on' : ''
                      }" data-cat="${esc(c)}">${esc(c)}</button>`
                  )
                  .join('')}
              </div>
            </div>

            <div class="lobby__start">
              <button class="btn btn--primary btn--lg btn--block" data-start>Empezar partida</button>
              <button class="btn btn--ghost btn--sm btn--block" data-bots>Completar con bots</button>
              <p class="lobby__hint" data-hint></p>
            </div>
          </section>
        </main>

        <div class="lobby__arena" data-scene></div>
      </div>
    `;

    const sceneHost = root.querySelector('[data-scene]');
    scene = createScene({ mini: true });
    sceneHost.appendChild(scene.root);
    scene.update(state);

    bindLobby(state, inviteUrl);
    updateLobby(state);
  }

  function teamColumn(team, state) {
    const name = state.teams[team].name;
    return `
      <div class="team-col team-col--${team.toLowerCase()}">
        <div class="team-col__head">
          <input class="team-col__name" data-team-name="${team}" value="${esc(name)}"
              maxlength="16" aria-label="Nombre del equipo ${team}">
          <span class="team-col__count" data-count="${team}">0</span>
        </div>
        <div class="team-col__list" data-list="${team}"></div>
      </div>`;
  }

  function bindLobby(state, inviteUrl) {
    root.querySelector('[data-audio]').addEventListener('click', (event) => {
      const muted = toggleMuted();
      event.currentTarget.textContent = muted ? '♪̸' : '♪';
    });

    root.querySelector('[data-fullscreen]').addEventListener('click', toggleFullscreen);

    root.querySelector('[data-copy]').addEventListener('click', async () => {
      await copyText(`Entra a Pull It Together con el código ${code}: ${inviteUrl}`);
      toast('Invitación copiada', 'ok');
    });

    root.querySelector('[data-copy-link]').addEventListener('click', async () => {
      await copyText(inviteUrl);
      toast('Enlace copiado', 'ok');
    });

    root.querySelector('[data-open-player]').addEventListener('click', () => {
      window.open(`${location.pathname}#/room/${code}`, '_blank', 'noopener');
    });

    root.querySelector('[data-start]').addEventListener('click', () => host.startGame());

    root.querySelector('[data-bots]').addEventListener('click', () => {
      host.addBots(4);
      toast('Bots añadidos para la demo', 'ok');
    });

    root.querySelector('[data-seg="rounds"]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button) return;
      host.configure({ rounds: Number(button.dataset.value) });
    });

    root.querySelector('[data-seg="duration"]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button) return;
      host.configure({ duration: Number(button.dataset.value) });
    });

    root.querySelector('[data-seg="difficulty"]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button) return;
      host.configure({ difficulty: button.dataset.value });
    });

    root.querySelector('[data-cats]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-cat]');
      if (!button) return;
      const cat = button.dataset.cat;
      const current = new Set(host.state.config.categories);
      if (current.has(cat)) current.delete(cat);
      else current.add(cat);
      host.configure({ categories: Array.from(current) });
    });

    root.querySelectorAll('[data-team-name]').forEach((input) => {
      input.addEventListener('change', () => {
        const team = input.dataset.teamName;
        if (!input.value.trim()) {
          input.value = host.state.teams[team].name;
          toast('El equipo necesita un nombre', 'bad');
          return;
        }
        host.setTeamName(team, input.value);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
      });
    });

    root.querySelectorAll('[data-list]').forEach((list) => {
      list.addEventListener('click', (event) => {
        const move = event.target.closest('[data-move]');
        if (move) {
          host.movePlayer(move.dataset.move, move.dataset.to);
          return;
        }
        const remove = event.target.closest('[data-remove]');
        if (!remove) return;
        host.removePlayer(remove.dataset.remove);
      });
    });
  }

  function updateLobby(state) {
    if (!root.querySelector('.lobby')) return;

    for (const team of ['A', 'B']) {
      const list = root.querySelector(`[data-list="${team}"]`);
      const count = root.querySelector(`[data-count="${team}"]`);
      const players = state.players.filter((p) => p.team === team);
      if (count) count.textContent = String(players.length);
      if (list) {
        list.innerHTML = players.length
          ? players
              .map(
                (p) => `
                <span class="player-chip ${p.connected ? '' : 'is-off'}" title="${esc(p.nickname)}">
                  <img src="${avatarSrc(p.avatar, 'idle')}" alt="">
                  <span>${esc(p.nickname)}</span>
                  ${p.isBot ? '<em style="font-style:normal;color:var(--text-mute);font-size:0.5rem">BOT</em>' : ''}
                  
                  <button class="player-chip__move player-chip__move--to-${p.team === 'A' ? 'b' : 'a'}" data-move="${esc(p.id)}" data-to="${p.team === 'A' ? 'B' : 'A'}" title="Mover al otro equipo" aria-label="Mover ${esc(
                    p.nickname
                  )} al otro equipo">${p.team === 'A' ? '→' : '←'}</button>

                  <button class="player-chip__x" data-remove="${esc(p.id)}" title="Quitar jugador" aria-label="Quitar ${esc(
                    p.nickname
                  )}">✕</button>
                  
                </span>`
              )
              .join('')
          : '<p class="team-col__empty">Esperando jugadores…</p>';
      }
    }

    const syncSeg = (name, value) => {
      root.querySelectorAll(`[data-seg="${name}"] button`).forEach((button) => {
        button.classList.toggle('is-on', button.dataset.value === String(value));
      });
    };
    syncSeg('rounds', state.config.rounds);
    syncSeg('duration', state.config.duration);
    syncSeg('difficulty', state.config.difficulty);
    root.querySelectorAll('[data-cat]').forEach((button) => {
      button.classList.toggle('is-on', state.config.categories.includes(button.dataset.cat));
    });

    const a = state.players.filter((p) => p.team === 'A').length;
    const b = state.players.filter((p) => p.team === 'B').length;
    const total = state.players.length;
    const hint = root.querySelector('[data-hint]');
    const startBtn = root.querySelector('[data-start]');
    if (hint) {
      hint.textContent =
        total === 0
          ? 'Comparte el código o añade bots si quieres probar sin gente.'
          : `${a} contra ${b} · ${total} de ${MAX_PLAYERS} jugadores dentro`;
    }
    if (startBtn) startBtn.disabled = !(a > 0 && b > 0);

    const botsBtn = root.querySelector('[data-bots]');
    if (botsBtn) botsBtn.textContent = state.players.some((p) => p.isBot) ? 'Añadir más bots' : 'Completar con bots';

    scene?.update(state);
  }

  /* Juego */

  function buildGame(state) {
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
    scene = createScene();
    wrap.appendChild(scene.root);

    root.querySelector('[data-audio]').addEventListener('click', (event) => {
      const muted = toggleMuted();
      event.currentTarget.textContent = muted ? '♪̸' : '♪';
    });
    root.querySelector('[data-fullscreen]').addEventListener('click', toggleFullscreen);
    root.querySelector('[data-exit]').addEventListener('click', () => {
      location.hash = '#/';
    });

    updateGame(state);
  }

  function updateGame(state) {
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

    scene?.update(state);
    updateTimer(state);

    if (state.status === 'countdown') {
      panelKey = '';
      renderCountdown(state);
      clearPanel();
      return;
    }

    removeCountdown();

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

    const key = `${state.status}:${state.round}`;
    if (key !== panelKey) {
      panelKey = key;
      if (state.status === 'question') {
        buildQuestionPanel(state);
        showRoundBanner(state);
      }
      else if (state.status === 'reveal') buildRevealPanel(state);
      else if (state.status === 'results') buildRevealPanel(state);
    }

    if (state.status === 'question') {
      const votes = root.querySelector('[data-votes]');
      if (votes) votes.textContent = `${state.voteCount || 0} / ${state.roundPlayers?.length || 0} votaron`;
    }
  }

  function updateTimer(state) {
    stopTimer();
    if (!state.endsAt) return;
    const timerBox = root.querySelector('[data-timer]');
    const time = root.querySelector('[data-time]');
    if (!time) return;

    const tick = () => {
      if (destroyed) return;
      const remaining = Math.max(0, state.endsAt - Date.now());
      const total = Math.max(1, state.endsAt - state.phaseStartedAt);
      time.textContent = fmtClock(remaining);
      timerBox?.classList.toggle('is-low', remaining <= 10000 && remaining > 0);
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
        if (destroyed || !root.querySelector('.countdown')) {
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

    play(anyCorrect ? 'correct' : 'wrong');
    play('pull');
  }

  /* Resultados */

  function showResults(state) {
    if (resultsNode) return;
    resultsNode = document.createElement('div');
    resultsNode.className = 'results';
    root.appendChild(resultsNode);

    const rankedA = rankPlayers(state.players.filter((p) => p.team === 'A'));
    const rankedB = rankPlayers(state.players.filter((p) => p.team === 'B'));
    const winner = state.winner;
    const winnerName = winner ? state.teams[winner].name : null;

    resultsNode.innerHTML = `
      <div class="results__head">
        <p class="eyebrow">${state.ko ? 'Knockout' : `Después de ${state.round} rondas`}</p>
        <h1 class="results__winner results__winner--${
          winner === 'A' ? 'a' : winner === 'B' ? 'b' : 'tie'
        }">${winner ? esc(winnerName) : 'Empate'}</h1>
        <p class="results__sub">
          ${
            state.ko
              ? 'La cuerda cruzó el límite: victoria por knockout'
              : winner
                ? `Cuerda a favor por ${Math.abs(state.rope)} puntos`
                : 'Misma cuerda, mismos aciertos'
          }
        </p>
      </div>

      <div class="results__boards">
        ${boardHTML('A', rankedA, state)}
        ${boardHTML('B', rankedB, state)}
      </div>

      <div class="results__actions">
        <button class="btn btn--primary btn--lg" data-rematch>Revancha</button>
        <button class="btn btn--lg" data-lobby>Volver al lobby</button>
        <a class="btn btn--ghost btn--lg" href="#/">Nueva sala</a>
      </div>
    `;

    resultsNode.querySelector('[data-rematch]')?.addEventListener('click', () => {
      hideResults();
      host.rematch();
    });
    resultsNode.querySelector('[data-lobby]')?.addEventListener('click', () => {
      hideResults();
      host.resetToLobby();
    });

    if (winner) confetti();
    play('win');
  }

  function boardHTML(team, ranked, state) {
    const isWinner = state.winner === team;
    return `
      <section class="board board--${team.toLowerCase()}">
        <div class="board__head">
          <span class="board__name">${esc(state.teams[team].name)} ${isWinner ? '👑' : ''}</span>
          <span class="board__score">${state.teams[team].score} pts · ${
            state.teams[team].correct
          } ${state.teams[team].correct === 1 ? 'acierto' : 'aciertos'}</span>
        </div>
        <div class="board__list">
          ${
            ranked.length
              ? ranked
                  .map(
                    (p, i) => `
                <div class="board__row">
                  <span class="board__pos">${i + 1}</span>
                  <span class="board__player">
                    <img src="${avatarSrc(p.avatar, 'idle')}" alt="">
                    <span>${esc(p.nickname)}</span>
                    ${i === 0 && p.score > 0 ? '<span class="board__mvp">MVP</span>' : ''}
                  </span>
                  <span class="board__hits">${p.correct} ✓ · ${p.bestStreak} racha</span>
                  <span class="board__pts">${p.score}</span>
                </div>`
                  )
                  .join('')
              : '<p class="team-col__empty">Sin jugadores</p>'
          }
        </div>
      </section>`;
  }

  function hideResults() {
    if (resultsNode) {
      resultsNode.remove();
      resultsNode = null;
      resultsKey = '';
    }
  }

  function confetti() {
    const layer = document.createElement('div');
    layer.className = 'confetti';
    const colors = ['#ffd05c', '#3ee0a0', '#ff5f92', '#7b86ff', '#f6eddc'];
    for (let i = 0; i < 90; i++) {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.setProperty('--c', colors[Math.floor(Math.random() * colors.length)]);
      piece.style.setProperty('--d', `${2.4 + Math.random() * 2.2}s`);
      piece.style.setProperty('--delay', `${Math.random() * 0.9}s`);
      piece.style.animationDelay = `${Math.random() * 0.9}s`;
      piece.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
      layer.appendChild(piece);
    }
    root.appendChild(layer);
    setTimeout(() => layer.remove(), 6000);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }

  return () => {
    destroyed = true;
    stopMusic();
    stopTimer();
    scene?.destroy();
    resultsNode?.remove();
    host.destroy();
  };
}
