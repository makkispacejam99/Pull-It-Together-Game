import { esc, fmtMs } from '../../../core/utils.js';
import { play } from '../../../core/audio.js';
import { showFeedback } from './feedback.js';

const LETTERS = ['A', 'B', 'C', 'D'];

export function buildReveal(ctx, state) {
  const { main, me, myPlayer, startTimer } = ctx;
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

      showFeedback(main, {
    correct,
    voted: Boolean(detail),
    streak: myPlayer.streak || 0,
    round: state.round,
    ms: detail?.ms || 0,
  });

  const next = main.querySelector('[data-next]');
  startTimer(state, (remaining) => {
    if (next) next.textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
  });
}
