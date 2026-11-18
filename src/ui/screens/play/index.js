import { clearMe, hostInThisBrowser, loadMe } from '../../../net/bus.js';
import { PlayerClient } from '../../../core/client.js';
import { duckMusic, isMuted, resumeMusic, startMusic, stopMusic, toggleMuted } from '../../../core/audio.js';
import { clamp, esc } from '../../../core/utils.js';
import { toast } from '../../toast.js';
import { openModal } from '../../modal.js';
import { buildWait, buildCountdown } from './wait.js';
import { buildQuestion, syncQuestion } from './question.js';
import { buildReveal } from './reveal.js';
import { buildResults } from './results.js';

const AWAY_MS = 1500;
const FLAME_SVG = `
  <svg class="play__flame" viewBox="0 0 8 10" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <path fill="#ff6a1a" d="M3 0h2v1H3zM3 1h3v1H3zM2 2h4v1H2zM2 3h5v1H2zM1 4h6v2H1zM0 6h8v2H0zM1 8h6v1H1zM2 9h4v1H2z"/>
    <path fill="#ffc43d" d="M3 4h2v1H3zM2 5h4v1H2zM2 6h4v2H2zM2 8h4v1H2zM3 9h2v1H3z"/>
    <path fill="#fff3cf" d="M3 7h2v2H3z"/>
  </svg>`;

export function renderPlay(root, params = {}) {
  const code = String(params.code || '').toUpperCase();
  const me = code ? loadMe(code) : null;

  if (!code || !me) {
    location.hash = code ? `#/room/${code}` : '#/join';
    return null;
  }

  root.innerHTML = `
    <div class="play">
      <header class="play__head">
        <button class="btn btn--ghost btn--sm play__leave" type="button" data-leave>Salir</button>
        <span class="chip chip--a" data-team-chip>MARCIANOS</span>
        <span class="play__nick">${esc(me.nickname)}</span>
        <button class="btn btn--ghost btn--sm play__sound" type="button" data-sound aria-label="Sonido" aria-pressed="true"><span data-sound-icon>${isMuted() ? '♪̸' : '♪'}</span></button>
        <span class="play__streak" data-streak title="Tu racha de aciertos">${FLAME_SVG}<b data-streak-num>0</b></span>
        <span class="play__conn" data-conn title="Conexión"></span>
      </header>
      <main class="play__main" data-main></main>
    </div>
  `;

  const main = root.querySelector('[data-main]');
  const conn = root.querySelector('[data-conn]');
  const teamChip = root.querySelector('[data-team-chip]');
  const streakBox = root.querySelector('[data-streak]');
  const streakNum = root.querySelector('[data-streak-num]');

  function updateStreak(value) {
    const prev = Number(streakBox.dataset.value || 0);
    streakNum.textContent = String(value);
    streakBox.classList.toggle('is-on', value >= 1);
    streakBox.classList.toggle('is-hot', value >= 3);
    if (value > prev) {
      streakBox.classList.remove('is-bump');
      void streakBox.offsetWidth;
      streakBox.classList.add('is-bump');
    }
    streakBox.dataset.value = String(value);
  }

  let currentState = null;
  let myPlayer = null;
  let phaseKey = '';
  let lobbySig = '';
  let myChoice = -1;
  let lastRound = -1;
  let timerId = null;
  let joinTimeout = null;
  let destroyed = false;
  let localLobby = false;
  let musicWanted = false;
  let lastStatus = '';

  const soundBtn = root.querySelector('[data-sound]');
  const soundIcon = root.querySelector('[data-sound-icon]');

  function syncSound() {
    const muted = isMuted();
    soundIcon.textContent = muted ? '♪̸' : '♪';
    soundBtn.setAttribute('aria-pressed', String(!muted));
  }

  function applyMusic(status) {
    if (status === 'countdown' || status === 'question' || status === 'reveal') {
      musicWanted = true;
      startMusic();
    } else if (status === 'results') {
      musicWanted = true;
      duckMusic();
    } else {
      musicWanted = false;
      stopMusic({ fade: 700 });
    }
  }

  function retryMusic() {
    if (musicWanted) resumeMusic();
  }

  const client = new PlayerClient(code, me, {
    onState: (state) => {
      currentState = state;
      myPlayer = state.players.find((p) => p.id === me.id) || null;
      if (myPlayer) {
        teamChip.textContent = state.teams[myPlayer.team].name;
        teamChip.className = `chip ${myPlayer.team === 'A' ? 'chip--a' : 'chip--b'}`;
        updateStreak(myPlayer.streak || 0);
      }
      if (state.round !== lastRound) {
        lastRound = state.round;
        myChoice = -1;
      }
      render(state);
    },
    onConnection: (alive) => {
      conn.classList.toggle('is-off', !alive);
      if (!alive) toast('Reconectando con la sala…', 'bad', 1800);
    },
    onError: (message) => {
      clearTimeout(joinTimeout);
      main.innerHTML = `
        <div class="play-wait">
          <p class="eyebrow">No pudimos entrar</p>
          <h2 class="display" style="font-size:1rem;line-height:1.6">${esc(message)}</h2>
          <a class="btn btn--primary" href="#/room/${esc(code)}">Elegir otro apodo</a>
        </div>`;
    },
    onKicked: () => {
      clearMe(code);
      toast('El anfitrión te sacó de la sala', 'bad', 2500);
      location.hash = '#/';
    },
  });

  const ctx = {
    main,
    code,
    me,
    client,
    startTimer,
    get currentState() {
      return currentState;
    },
    get myPlayer() {
      return myPlayer;
    },
    get myChoice() {
      return myChoice;
    },
    setChoice(value) {
      myChoice = value;
    },
    confirmLeave,
    returnToLobby() {
      localLobby = true;
      stopTimer();
      if (currentState) buildWait(ctx, currentState);
    },
  };

  root.querySelector('[data-leave]').addEventListener('click', confirmLeave);

  syncSound();
  soundBtn.addEventListener('click', () => {
    const muted = toggleMuted();
    syncSound();
    if (!muted && musicWanted) resumeMusic();;
    toast(muted ? 'Sonido silenciado' : 'Sonido activado');
  });
  root.addEventListener('pointerdown', retryMusic);

    let hiddenAt = 0;

  function onVisibility() {
    if (document.hidden) {
      hiddenAt = currentState?.status === 'question' ? Date.now() : 0;
      return;
    }
    const wasAway = hiddenAt && Date.now() - hiddenAt >= AWAY_MS;
    hiddenAt = 0;
    if (!wasAway || currentState?.status !== 'question') return;
    if (hostInThisBrowser(code)) return;
    client.away(currentState.round);
  }

  document.addEventListener('visibilitychange', onVisibility);

  function confirmLeave() {
    const { backdrop, close } = openModal(`
      <div class="modal panel">
        <div class="modal__head">
          <h2 class="modal__title">¿Abandonar la sala?</h2>
          <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
        </div>
        <div class="modal__body">
          <p class="muted">¿Estás seguro que quieres abandonar la sala? Esta acción te llevará al inicio.</p>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-cancel>Quedarme</button>
          <button type="button" class="btn btn--danger" data-leave-confirm>Abandonar</button>
        </div>
      </div>`);

    backdrop.querySelector('[data-leave-confirm]').addEventListener('click', () => {
      close();
      clearMe(code);
      location.hash = '#/';
    });
  }

  client.connect();

  joinTimeout = setTimeout(() => {
    if (!myPlayer && !destroyed) {
      main.innerHTML = `
        <div class="play-wait">
          <div class="spinner"></div>
          <p class="muted">Buscando al anfitrión…</p>
          <p class="tiny muted">Asegúrate de que la pantalla del juego esté abierta y conectada.</p>
          <a class="btn btn--ghost btn--sm" href="#/room/${esc(code)}">Volver</a>
        </div>`;
    }
  }, 4000);

  /* Renderizado */

  function render(state) {
    if (destroyed) return;
    if (!myPlayer) {
      if (!main.querySelector('.spinner')) {
        main.innerHTML = `
          <div class="play-wait">
            <div class="spinner"></div>
            <p class="muted">Conectando con la sala…</p>
          </div>`;
      }
      return;
    }

    if (state.status === 'results' && localLobby) return;
    if (state.status !== 'results') localLobby = false;

    if (state.status !== lastStatus) {
      lastStatus = state.status;
      applyMusic(state.status);
    }

    const key = `${state.status}:${state.round}`;
    const changed = key !== phaseKey;
    phaseKey = key;

    if (state.status === 'lobby') {
      stopTimer();
      const sig = state.players
        .map((p) => `${p.id}:${p.team}:${p.avatar}:${p.nickname}:${p.connected}`)
        .join('|');
      if (changed || sig !== lobbySig) {
        lobbySig = sig;
        buildWait(ctx, state);
      }
      return;
    }

    if (state.status === 'countdown') {
      if (changed) buildCountdown(ctx, state);
      return;
    }

    if (state.status === 'question') {
      if (changed) buildQuestion(ctx, state);
      syncQuestion(ctx, state);
      return;
    }

    if (state.status === 'reveal') {
      stopTimer();
      if (changed) buildReveal(ctx, state);
      return;
    }

    if (state.status === 'results') {
      stopTimer();
      if (changed) buildResults(ctx, state);
    }
  }

  function stopTimer() {
    if (timerId) {
      cancelAnimationFrame(timerId);
      timerId = null;
    }
  }

  function startTimer(state, onTick) {
    stopTimer();
    const initial = state;
    const tick = () => {
      if (destroyed) return;
      const current = currentState || initial;
      const endsAt = current.endsAt || 0;
      const remaining = Math.max(0, endsAt - client.serverNow());
      const total = Math.max(1, endsAt - (current.phaseStartedAt || 0));
      onTick(remaining, clamp(remaining / total, 0, 1));
      if (remaining > 0) timerId = requestAnimationFrame(tick);
    };
    tick();
  }

  return () => {
    destroyed = true;
    clearTimeout(joinTimeout);
    stopTimer();
    stopMusic({ fade: 600 });
    root.removeEventListener('pointerdown', retryMusic);
    document.removeEventListener('visibilitychange', onVisibility);
    client.destroy();
  };
}
