import { DIFFICULTIES, categoriesOf, validateQuestion } from '../../../core/questions.js';
import { esc } from '../../../core/utils.js';
import { toast } from '../../toast.js';
import { openModal } from '../../modal.js';

export function openEditor(question, { bank, persist }) {
  const isNew = !question;
  const draft = question
    ? { ...question, options: [...question.options] }
    : { id: null, text: '', options: ['', '', '', ''], correct: 0, category: 'General', difficulty: 'medium' };

  const cats = categoriesOf(bank);
  const currentCategory = draft.category || 'General';
  const categoryOptions = Array.from(new Set([currentCategory, ...cats])).sort((a, b) =>
    a.localeCompare(b, 'es')
  );
  const { backdrop, close } = openModal(`
      <form class="modal panel" data-editor>
        <div class="modal__head">
          <h2 class="modal__title">${isNew ? 'Nueva pregunta' : 'Editar pregunta'}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
        </div>

        <div class="modal__body">
          <div class="field">
            <label for="q-text">Pregunta</label>
            <input class="input" id="q-text" name="text" maxlength="180" value="${esc(draft.text)}"
                  placeholder="¿Cuál es el planeta más grande del sistema solar?" required>
            <p class="field-error" data-error="text" hidden></p>
          </div>

          <div class="field">
            <span class="field-label">Opciones · marca la correcta</span>
            <div class="editor-options" data-options>
              ${[0, 1, 2, 3]
                .map(
                  (i) => `
                <label class="editor-opt ${draft.correct === i ? 'is-on' : ''}" data-opt="${i}">
                  <input type="radio" name="correct" value="${i}" ${draft.correct === i ? 'checked' : ''}>
                  <span class="editor-opt__key">${'ABCD'[i]}</span>
                  <input class="input" name="option${i}" maxlength="70" value="${esc(
                    draft.options[i] || ''
                  )}" placeholder="Opción ${'ABCD'[i]}">
                </label>`
                )
                .join('')}
            </div>
            <p class="field-error" data-error="options" hidden></p>
            <p class="field-error" data-error="correct" hidden></p>
          </div>

          <div class="editor-grid">
            <div class="field">
              <label for="q-cat">Categoría</label>
              <select class="input" id="q-cat" name="category">
                ${categoryOptions
                  .map(
                    (c) =>
                      `<option value="${esc(c)}" ${currentCategory === c ? 'selected' : ''}>${esc(c)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="field">
              <label for="q-diff">Dificultad</label>
              <select class="input" id="q-diff" name="difficulty">
                ${DIFFICULTIES.map(
                  (d) => `<option value="${d.id}" ${draft.difficulty === d.id ? 'selected' : ''}>${d.label}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <p class="editor-hint">
            Consejo: preguntas de una sola línea se leen mejor en pantalla grande.
          </p>
        </div>

        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
          <button type="submit" class="btn btn--primary">Guardar pregunta</button>
        </div>
      </form>`);

  const form = backdrop.querySelector('[data-editor]');
  const optionNodes = Array.from(backdrop.querySelectorAll('[data-opt]'));

  optionNodes.forEach((node) => {
    node.addEventListener('click', () => {
      optionNodes.forEach((n) => n.classList.toggle('is-on', n === node));
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = {
      text: form.text.value,
      options: [0, 1, 2, 3].map((i) => form[`option${i}`].value),
      correct: Number(form.correct.value),
      category: form.category.value,
      difficulty: form.difficulty.value,
    };

    const result = validateQuestion(data, bank, draft.id);
    backdrop.querySelectorAll('[data-error]').forEach((node) => {
      node.hidden = true;
    });

    if (!result.ok) {
      for (const [field, message] of Object.entries(result.errors)) {
        const node = backdrop.querySelector(`[data-error="${field}"]`);
        if (node) {
          node.textContent = message;
          node.hidden = false;
        }
      }
      return;
    }

    const next = isNew
      ? [result.data, ...bank]
      : bank.map((q) => (q.id === draft.id ? result.data : q));
    persist(next);
    close();
    toast(isNew ? 'Pregunta creada' : 'Pregunta actualizada', 'ok');
  });

  setTimeout(() => form.text.focus(), 60);
}
