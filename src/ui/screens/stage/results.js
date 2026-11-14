import { play } from '../../../core/audio.js';
import { rankPlayers } from '../../../core/rules.js';
import { avatarSrc, esc } from '../../../core/utils.js';
import { confetti } from './shared.js';

export function createResultsView(ctx) {
  const { root, host } = ctx;
  let resultsNode = null;

  function show(state) {
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
      hide();
      host.rematch();
    });
    resultsNode.querySelector('[data-lobby]')?.addEventListener('click', () => {
      hide();
      host.resetToLobby();
    });

    if (winner) confetti(root);
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

  function hide() {
    if (resultsNode) {
      resultsNode.remove();
      resultsNode = null;
    }
  }

  return { show, hide };
}
