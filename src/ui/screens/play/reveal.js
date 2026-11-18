import { esc, fmtMs } from '../../../core/utils.js';
import { play } from '../../../core/audio.js';
import { toast } from '../../toast.js';
import { showFeedback } from './feedback.js';

const LETTERS = ['A', 'B', 'C', 'D'];

export function buildReveal(ctx, state) {
  const { main, me, myPlayer, startTimer } = ctx;
  const result = state.lastResult;
  if (!result) return;
  const detail = result.individuals?.[me.id];
  const voted = Boolean(detail);
  const correct = Boolean(detail?.correct);
  const correctIndex = result.correctIndex;
  const myTeam = result.teams[myPlayer.team];
  const teamOk = Boolean(myTeam.correct);
  const teamVoted = myTeam.votes > 0;
  const teamName = state.teams[myPlayer.team].name;
  const teamSide = myPlayer.team === 'A' ? 'a' : 'b';
  const roster = state.players.filter(
    (p) => p.team === myPlayer.team && state.roundPlayers.includes(p.id)
  );
  const correctOption = state.question?.options?.[correctIndex] || '';

  play(correct ? 'correct' : 'wrong');

  if (detail?.away) {
    if (detail.warning) {
      toast('Saliste de la pantalla: sin bonus de velocidad. La próxima será -25 pts', 'bad', 4200);
    } else {
      const extra = detail.penalty ? ` y -${detail.penalty} pts` : '';
      toast(`Saliste de la pantalla: sin bonus de velocidad${extra}`, 'bad', 3600);
    }
  }

  const title = !voted ? 'No votaste' : correct ? 'Acertaste' : 'Fallaste';
  const sub = !voted
    ? 'Se acabó el tiempo de esta ronda.'
    : `Genial respondiste en ${fmtMs(detail.ms)}`;

  const teamLine = !teamVoted
    ? 'Nadie del equipo votó esta ronda.'
    : `La mayoría eligió la opción "${LETTERS[myTeam.choice]}". <br> <i class="team-verdict__votes">${myTeam.count} de ${roster.length} votaron.</i>`;

  const teamNote = !teamOk && teamVoted
    ? `La respuesta correcta era ${LETTERS[correctIndex]}: ${esc(correctOption)}`
    : myTeam.tied
      ? 'El equipo se dividió y desempató el voto más rápido.'
      : '';

  let diff = '';
  if (voted && correct && !teamOk) diff = 'Tú la tenías, pero la mayoría del equipo eligió otra.';
  else if (voted && !correct && teamOk) diff = 'El equipo acertó, pero tu voto no era la correcta.';
  else if (!voted && teamOk) diff = 'El equipo acertó incluso sin tu voto.';
  else if (voted && correct && teamOk) diff = 'Tú y tu equipo acertaron.';
  else if (voted && !correct && !teamOk) diff = 'Tú y tu equipo fallaron esta ronda.';
  else if (!voted && !teamOk) diff = 'El equipo falló y tú no votaste.';

  main.innerHTML = `
      <div class="reveal-card">
        <div class="reveal-card__result ${voted ? (correct ? 'is-ok' : 'is-bad') : 'is-out'}">
          <p class="reveal-card__title">${title}</p>
          <p class="reveal-card__sub">${sub}</p>
          <p class="reveal-card__points">+${detail?.points || 0} pts</p>
        </div>

        <div class="team-verdict team-verdict--${
          teamOk ? 'ok' : teamVoted ? 'bad' : 'flat'
        }">
          <div class="team-verdict__top">
            <span class="team-verdict__team team-verdict__team--${teamSide}">${esc(teamName)}</span>
            <span class="team-verdict__tag">${teamOk ? 'Acertó' : teamVoted ? 'Falló' : 'Sin votos'}</span>
          </div>
          <p class="team-verdict__line">${teamLine}</p>
          ${teamNote ? `<p class="team-verdict__note">${teamNote}</p>` : ''}
          ${diff ? `<p class="team-verdict__diff">${diff}</p>` : ''}
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
    voted,
    streak: myPlayer.streak || 0,
    round: state.round,
    ms: detail?.ms || 0,
  });

  const next = main.querySelector('[data-next]');
  startTimer(state, (remaining) => {
    if (next) next.textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
  });
}
