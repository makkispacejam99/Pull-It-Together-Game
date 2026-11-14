import { esc, normalizeText, uid } from '../../../core/utils.js';
import { toast } from '../../toast.js';
import { openModal } from '../../modal.js';

export function openImport(imported, skipped, fileName, { bank, persist }) {
  const { backdrop, close } = openModal(`
      <form class="modal panel" data-import-modal>
        <div class="modal__head">
          <h2 class="modal__title">Importar preguntas</h2>
          <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
        </div>

        <div class="modal__body">
          <p class="muted tiny">${esc(fileName)}</p>
          <div class="import-summary">
            <span class="chip chip--a">${imported.length} listas</span>
            <span class="chip chip--ghost">${skipped} omitidas</span>
            <span class="chip chip--ghost">${bank.length} en el banco</span>
          </div>

          <div class="field">
            <span class="field-label">Cómo importar</span>
            <label class="editor-opt is-on" data-mode>
              <input type="radio" name="mode" value="append" checked>
              <span class="import-mode__text">Añadir al banco actual</span>
            </label>
            <label class="editor-opt" data-mode>
              <input type="radio" name="mode" value="replace">
              <span class="import-mode__text">Reemplazar todo el banco</span>
            </label>
          </div>

          <p class="field-error" data-warning hidden>Se borrarán las preguntas actuales del banco.</p>
        </div>

        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
          <button type="submit" class="btn btn--primary">Importar</button>
        </div>
      </form>`);

  const form = backdrop.querySelector('[data-import-modal]');
  const modeNodes = Array.from(backdrop.querySelectorAll('[data-mode]'));
  const warning = backdrop.querySelector('[data-warning]');

  form.addEventListener('change', () => {
    const mode = form.querySelector('input[name="mode"]:checked')?.value || 'append';
    modeNodes.forEach((node) => node.classList.toggle('is-on', node.querySelector('input').checked));
    warning.hidden = mode !== 'replace';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const mode = form.querySelector('input[name="mode"]:checked')?.value || 'append';

    if (
      mode === 'replace' &&
      bank.length &&
      !confirm(`¿Reemplazar las ${bank.length} preguntas actuales por las ${imported.length} del archivo?`)
    ) {
      return;
    }

    let next;
    let message;

    if (mode === 'replace') {
      const used = new Set();
      next = imported.map((question) => {
        let id = question.id && !used.has(question.id) ? question.id : uid('q_');
        while (used.has(id)) id = uid('q_');
        used.add(id);
        return { ...question, id };
      });
      message = `${next.length} preguntas importadas`;
    } else {
      const texts = new Set(bank.map((question) => normalizeText(question.text)));
      const used = new Set(bank.map((question) => question.id));
      const fresh = imported
        .filter((question) => !texts.has(normalizeText(question.text)))
        .map((question) => {
          let id = question.id && !used.has(question.id) ? question.id : uid('q_');
          while (used.has(id)) id = uid('q_');
          used.add(id);
          texts.add(normalizeText(question.text));
          return { ...question, id };
        });
      next = [...fresh, ...bank];
      const repeated = imported.length - fresh.length;
      message = `${fresh.length} preguntas añadidas${repeated ? ` · ${repeated} ya existían` : ''}`;
    }

    persist(next);
    close();
    toast(message, 'ok');
  });
}
