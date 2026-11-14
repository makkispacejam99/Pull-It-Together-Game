import { avatarSrc, esc } from '../../../core/utils.js';

export function buildWait(ctx, state) {
  const { main, code, myPlayer } = ctx;
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

export function buildCountdown(ctx, state) {
  const { main, startTimer } = ctx;
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
