import { searchBank } from '../../../core/questions.js';
import { esc, truncate } from '../../../core/utils.js';
import { toast } from '../../toast.js';
import { openModal } from '../../modal.js';

export function openDeleteMany({ bank, filters, persist }) {
  const filtered = searchBank(bank, filters);
  if (!filtered.length) {
    toast('No hay preguntas con esos filtros');
    return;
  }

  const { backdrop, close } = openModal(`
      <form class="modal panel" data-bulk>
        <div class="modal__head">
          <h2 class="modal__title">Borrar varias preguntas</h2>
          <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
        </div>

        <div class="modal__body">
          <p class="muted tiny">
            Marca las preguntas que quieras borrar.
          </p>
          <div class="admin__bulk-head">
            <span class="field-label" data-bulk-label>Preguntas disponibles (${filtered.length})</span>
            <span class="admin__bulk-tools">
              <button type="button" class="btn btn--ghost btn--sm" data-select-all>Todas</button>
              <button type="button" class="btn btn--ghost btn--sm" data-select-none>Ninguna</button>
            </span>
          </div>
          <div class="admin__multi" data-bulk-list role="group" aria-label="Preguntas disponibles">
            ${filtered
              .map(
                (q) => `
              <label class="bulk-item">
                <input type="checkbox" value="${esc(q.id)}">
                <span class="bulk-item__text">${esc(truncate(q.text, 90))}</span>
                <span class="bulk-item__cat">${esc(q.category || 'General')}</span>
              </label>`
              )
              .join('')}
          </div>
          <p class="field-error" data-error hidden></p>
        </div>

        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
          <button type="submit" class="btn btn--primary" data-delete disabled>Borrar seleccionadas</button>
        </div>
      </form>`);

  const form = backdrop.querySelector('[data-bulk]');
  const listBox = backdrop.querySelector('[data-bulk-list]');
  const boxes = Array.from(listBox.querySelectorAll('input[type="checkbox"]'));
  const bulkLabel = backdrop.querySelector('[data-bulk-label]');
  const deleteBtn = backdrop.querySelector('[data-delete]');
  const error = backdrop.querySelector('[data-error]');

  const syncButton = () => {
    const count = boxes.filter((box) => box.checked).length;
    deleteBtn.disabled = count === 0;
    deleteBtn.textContent = count ? `Borrar ${count}` : 'Borrar seleccionadas';
    bulkLabel.textContent = `Preguntas disponibles (${filtered.length})${
      count ? ` · ${count} marcadas` : ''
    }`;
    error.hidden = true;
  };

  listBox.addEventListener('change', syncButton);
  backdrop.querySelector('[data-select-all]').addEventListener('click', () => {
    boxes.forEach((box) => {
      box.checked = true;
    });
    syncButton();
  });
  backdrop.querySelector('[data-select-none]').addEventListener('click', () => {
    boxes.forEach((box) => {
      box.checked = false;
    });
    syncButton();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const ids = new Set(boxes.filter((box) => box.checked).map((box) => box.value));
    if (!ids.size) {
      error.textContent = 'Selecciona al menos una pregunta.';
      error.hidden = false;
      return;
    }
    const label = ids.size === 1 ? '1 pregunta' : `${ids.size} preguntas`;
    if (!confirm(`¿Borrar ${label}? Esta acción no se puede deshacer.`)) return;
    persist(bank.filter((q) => !ids.has(q.id)));
    close();
    toast(ids.size === 1 ? 'Pregunta borrada' : `${ids.size} preguntas borradas`);
  });
}
