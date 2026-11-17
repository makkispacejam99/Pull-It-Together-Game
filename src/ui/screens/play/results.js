import { avatarSrc, esc } from '../../../core/utils.js';
import { rankPlayers } from '../../../core/rules.js';
import { play } from '../../../core/audio.js';

export function buildResults(ctx, state) {
  const { main, me, myPlayer } = ctx;
  const team = myPlayer.team;
  const ranked = rankPlayers(state.players.filter((p) => p.team === team));
  const rank = ranked.findIndex((p) => p.id === me.id) + 1;
  const winner = state.winner;
  const weWon = winner === team;
  const tie = !winner;
  const winnerName = winner ? state.teams[winner].name : 'Empate';
  const winnerSide = winner === 'A' ? 'a' : winner === 'B' ? 'b' : 'tie';

  play(weWon ? 'win' : 'wrong');

  main.innerHTML = `
      <div class="personal">
        <div class="personal__hero">
          <img class="personal__avatar" src="${avatarSrc(myPlayer.avatar, 'idle')}" alt="">
          <div class="personal__verdict personal__verdict--${winnerSide}">
            <p class="personal__verdict-label">${tie ? 'Empate' : 'Los ganadores son'}</p>
            <h2 class="personal__winner personal__winner--${winnerSide}">${esc(winnerName)}</h2>
          </div>

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

        <div class="personal__actions">
          <button type="button" class="btn btn--primary btn--block" data-lobby>Volver al lobby</button>
          <button type="button" class="btn btn--ghost btn--block" data-leave>Abandonar sala</button>
        </div>
      </div>`;

  main.querySelector('[data-lobby]')?.addEventListener('click', () => ctx.returnToLobby());
  main.querySelector('[data-leave]')?.addEventListener('click', () => ctx.confirmLeave());
}
