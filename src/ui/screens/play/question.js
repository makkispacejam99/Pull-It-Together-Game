import { esc } from '../../../core/utils.js';
import { play } from '../../../core/audio.js';

const LETTERS = ['A', 'B', 'C', 'D'];

export function buildQuestion(ctx, state) {
  const { main, client, startTimer } = ctx;
  const question = state.question;
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
  let tickSecond = -1;

  startTimer(state, (remaining, ratio) => {
    bar.style.width = `${ratio * 100}%`;
    clock.textContent = `${Math.ceil(remaining / 1000)}s`;
    bar.style.background = remaining < 10000 ? 'var(--danger)' : '';
    if (remaining > 0 && remaining < 10000) {
      const second = Math.ceil(remaining / 1000);
      if (second !== tickSecond) {
        tickSecond = second;
        play('tick', { pitch: 1 + (10 - Math.min(second, 10)) * 0.03 });
      }
    }
  });

  main.querySelector('[data-answers]').addEventListener('click', (event) => {
    const button = event.target.closest('[data-choice]');
    if (!button) return;
    const choice = Number(button.dataset.choice);
    if (!Number.isInteger(choice)) return;
    ctx.setChoice(choice);
    client.vote(choice);
    play('select');
    syncQuestion(ctx, ctx.currentState);
  });
}

export function syncQuestion(ctx, state) {
  const { main } = ctx;
  if (!state.question) return;
  const myChoice = ctx.myChoice;
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
