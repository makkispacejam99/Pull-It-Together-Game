/* Vista del jugador (En moviles) */

import { clearMe, loadMe } from '../../net/bus.js';
import { PlayerClient } from '../../core/client.js';
import { avatarSrc, clamp, esc, fmtMs } from '../../core/utils.js';
import { rankPlayers } from '../../core/rules.js';
import { play } from '../../core/audio.js';
import { toast } from '../toast.js';

const LETTERS = ['A', 'B', 'C', 'D'];

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
        <span class="chip chip--a" data-team-chip>MARCIANOS</span>
        <span class="play__nick">${esc(me.nickname)}</span>
        <span class="play__conn" data-conn title="Conexión"></span>
      </header>
      <main class="play__main" data-main></main>
    </div>
  `;

  const main = root.querySelector('[data-main]');
  const conn = root.querySelector('[data-conn]');
  const teamChip = root.querySelector('[data-team-chip]');

  let currentState = null;
  let myPlayer = null;
  let phaseKey = '';
  let lobbySig = '';
  let myChoice = -1;
  let lastRound = -1;
  let timerId = null;
  let joinTimeout = null;
  let destroyed = false;

  const client = new PlayerClient(code, me, {
    onState: (state) => {
      currentState = state;
      myPlayer = state.players.find((p) => p.id === me.id) || null;
      if (myPlayer) {
        teamChip.textContent = state.teams[myPlayer.team].name;
        teamChip.className = `chip ${myPlayer.team === 'A' ? 'chip--a' : 'chip--b'}`;
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
        buildWait(state);
      }
      return;
    }

    if (state.status === 'countdown') {
      if (changed) buildCountdown(state);
      return;
    }

    if (state.status === 'question') {
      if (changed) buildQuestion(state);
      syncQuestion(state);
      return;
    }

    if (state.status === 'reveal') {
      stopTimer();
      if (changed) buildReveal(state);
      return;
    }

    if (state.status === 'results') {
      stopTimer();
      if (changed) buildResults(state);
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

  /* Lobby */

  function buildWait(state) {
    const team = myPlayer.team;
    const mates = state.players.filter((p) => p.team === team);
    main.innerHTML = `
      <div class="play-wait">
        <p class="eyebrow">Estás en el equipo</p>
        <h2 class="display" style="font-size:1.3rem;color:var(--team-${team === 'A' ? 'a' : 'b'})">
          ${esc(state.teams[team].name)}
        </h2>
        <p class="muted">Sala <b>${esc(code)}</b></p>
        <div class="spinner"></div>
        <p class="tiny muted">Ya estás dentro. El anfitrión dará la salida en un momento…</p>
        <div class="roster">
          ${mates
            .map(
              (p) => `<span class="player-chip"><img src="${avatarSrc(p.avatar, 'idle')}" alt=""><span>${esc(
                p.nickname
              )}</span></span>`
            )
            .join('')}
        </div>
        <p class="tiny muted">${state.players.length} jugador${
          state.players.length === 1 ? '' : 'es'
        } en la sala</p>
      </div>`;
  }

  /* Countdown */

  function buildCountdown(state) {
    main.innerHTML = `
      <div class="play-wait">
        <p class="eyebrow">Prepárense</p>
        <h2 class="display" data-count style="font-size:4rem;color:var(--gold)">3</h2>
        <p class="muted">Arrancamos en...</p>
      </div>`;
    const num = main.querySelector('[data-count]');
    startTimer(state, (remaining) => {
      num.textContent = String(Math.min(3, Math.max(1, Math.ceil(remaining / 1000))));
    });
  }

  /* Pregunta Realizada */

  function buildQuestion(state) {
    const question = state.question;
    const total = Math.max(1, state.endsAt - state.phaseStartedAt);
    main.innerHTML = `
      <div class="q-mobile">
        <div class="q-mobile__meta">
          <span>Pregunta ${state.round}/${state.totalRounds}</span>
          <span data-clock>00:00</span>
        </div>
        <div class="q-mobile__bar"><i data-bar></i></div>
        <div class="q-mobile__meta">
          <span class="chip">${esc(question?.category || 'General')}</span>
          <span data-votes>0 / 0 votaron</span>
        </div>
        <h2 class="q-mobile__text">${esc(question?.text || '')}</h2>
        <div class="answers" data-answers>
          ${(question?.options || [])
            .map(
              (option, i) => `
              <button class="answer" data-choice="${i}" type="button">
                <span class="answer__key">${LETTERS[i]}</span>
                <span>${esc(option)}</span>
              </button>`
            )
            .join('')}
        </div>
        <p class="vote-note" data-note>Vota lo que creas. Gana la mayoría y puedes cambiar tu voto hasta que se revele.</p>
      </div>`;

    const bar = main.querySelector('[data-bar]');
    const clock = main.querySelector('[data-clock]');

    startTimer(state, (remaining, ratio) => {
      bar.style.width = `${ratio * 100}%`;
      clock.textContent = `${Math.ceil(remaining / 1000)}s`;
      bar.style.background = remaining < 10000 ? 'var(--danger)' : '';
    });

    main.querySelector('[data-answers]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-choice]');
      if (!button) return;
      const choice = Number(button.dataset.choice);
      if (!Number.isInteger(choice)) return;
      myChoice = choice;
      client.vote(choice);
      play('select');
      syncQuestion(currentState);
    });
  }

  function syncQuestion(state) {
    if (!state.question) return;
    const votes = state.voteCount || 0;
    const total = state.roundPlayers?.length || 0;
    const votesEl = main.querySelector('[data-votes]');
    if (votesEl) votesEl.textContent = `${votes} / ${total} votaron`;

    const note = main.querySelector('[data-note]');
    const buttons = main.querySelectorAll('[data-choice]');
    buttons.forEach((button) => {
      button.classList.toggle('is-picked', Number(button.dataset.choice) === myChoice);
    });

    if (note) {
      if (myChoice >= 0) {
        note.classList.add('vote-note--ok');
        note.textContent = `Voto registrado: ${LETTERS[myChoice]}. Puedes cambiarlo hasta que se revele.`;
      } else {
        note.classList.remove('vote-note--ok');
        note.textContent = 'Vota tú; la mayoría decide. Puedes cambiar tu voto hasta el final.';
      }
    }
  }

  /* Revelar Respuesta */

  function buildReveal(state) {
    const result = state.lastResult;
    if (!result) return;
    const detail = result.individuals?.[me.id];
    const correctIndex = result.correctIndex;
    const correct = Boolean(detail?.correct);
    const myTeam = result.teams[myPlayer.team];
    const otherTeam = result.teams[myPlayer.team === 'A' ? 'B' : 'A'];
    const teamName = state.teams[myPlayer.team].name;

    play(correct ? 'correct' : 'wrong');

    main.innerHTML = `
      <div class="reveal-card">
        <div class="reveal-card__result ${correct ? 'is-ok' : 'is-bad'}">
          <p class="reveal-card__title">${correct ? '¡Correcto!' : 'Incorrecto'}</p>
          <p class="reveal-card__sub">
            ${
              detail
                ? correct
                  ? `Respondiste en ${fmtMs(detail.ms)}`
                  : `La respuesta correcta era ${LETTERS[correctIndex]}.`
                : 'No alcanzaste a votar en esta ronda.'
            }
          </p>
          <p class="reveal-card__points">+${detail?.points || 0} pts</p>
        </div>

        <div class="panel panel--flat" style="padding:12px">
          <p class="eyebrow" style="margin-bottom:6px">${esc(teamName)}</p>
          <p class="muted" style="font-size:0.92rem">
            ${
              myTeam.correct
                ? `El equipo eligió la opcion: <b style="color:var(--team-a)"> ${LETTERS[myTeam.choice]}</b>, Enhorabuena <b style="color:var(--team-a)">Acertaron</b>.`
                : `El equipo eligió ${
                    myTeam.choice >= 0 ? `la opción: <b style="color:var(--team-b)"> ${LETTERS[myTeam.choice]}</b>. ` : '—'
                  }  Ups, <b style="color:var(--team-b)">no acertaron esta vez.</b>`
            }
            ${otherTeam.correct ? ' El rival también acertó.' : ''}
          </p>
        </div>

        <div class="reveal-options">
          ${(state.question?.options || [])
            .map(
              (option, i) => `
              <div class="opt ${i === correctIndex ? 'is-correct' : ''} ${
                i === detail?.choice && i !== correctIndex ? 'is-wrong' : ''
              }">
                <span class="opt__key">${LETTERS[i]}</span>
                <span class="opt__txt">${esc(option)}</span>
              </div>`
            )
            .join('')}
        </div>

        <p class="tiny muted center">Siguiente ronda en <span data-next>7</span>s</p>
      </div>`;

    const next = main.querySelector('[data-next]');
    startTimer(state, (remaining) => {
      if (next) next.textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
    });
  }

  /* Resultados */

  function buildResults(state) {
    const team = myPlayer.team;
    const ranked = rankPlayers(state.players.filter((p) => p.team === team));
    const rank = ranked.findIndex((p) => p.id === me.id) + 1;
    const winner = state.winner;
    const weWon = winner === team;
    const tie = !winner;

    play(weWon ? 'win' : 'wrong');

    main.innerHTML = `
      <div class="personal">
        <div class="personal__hero">
          <img class="personal__avatar" src="${avatarSrc(myPlayer.avatar, 'idle')}" alt="">
          <p class="eyebrow">${tie ? 'Empate' : weWon ? '¡Ganaron!' : 'Casi lo logran'}</p>
          <h2 class="display" style="font-size:1.4rem;color:var(--${
            weWon ? 'gold' : 'text'
          })">${esc(state.teams[team].name)}</h2>
          <p class="personal__rank">#${rank} en tu equipo</p>
        </div>

        <div class="personal__stats">
          <div class="stat"><b>${myPlayer.correct}</b><span>Aciertos</span></div>
          <div class="stat"><b>${myPlayer.score}</b><span>Puntos</span></div>
          <div class="stat"><b>${myPlayer.bestStreak}</b><span>Racha</span></div>
        </div>

        <div class="mini-board">
          ${ranked
            .slice(0, 8)
            .map(
              (p, i) => `
            <div class="mini-board__row ${p.id === me.id ? 'is-me' : ''}">
              <span class="mini-board__pos">${i + 1}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.nickname)}</span>
              <span class="mini-board__pts">${p.score}</span>
            </div>`
            )
            .join('')}
        </div>

        <p class="tiny muted" style="text-align:center">
          Si el anfitrión da revancha, quédate aquí y espera a que la partida comience.
        </p>

        <a class="btn btn--primary btn--block" href="#/">Volver al inicio</a>
      </div>`;
  }

  return () => {
    destroyed = true;
    clearTimeout(joinTimeout);
    stopTimer();
    client.destroy();
  };
}
