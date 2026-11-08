/* Banco de preguntas */

import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  bankStats,
  categoriesOf,
  loadBank,
  resetBank,
  saveBank,
  searchBank,
  validateQuestion,
} from '../../core/questions.js';
import { esc, truncate, uid } from '../../core/utils.js';
import { toast } from '../toast.js';

export function renderAdmin(root) {
  return renderPanel(root);
}

/* panel */

function renderPanel(root) {
  let bank = loadBank();
  let filters = { search: '', category: 'all', difficulty: 'all' };

  root.innerHTML = `
    <div class="admin">
      <header class="admin__head">
        <div class="admin__id">
          <a class="brand" href="#/">
            <img src="assets/img/props/hud_player_pink.png" alt="">
            <span>PULL IT TOGETHER</span>
          </a>
          <div class="admin__meta">
            <span class="admin__title">Banco de preguntas</span>
            <span class="admin__count" data-count></span>
          </div>
        </div>
        <div class="admin__actions">
          <button class="btn btn--ghost btn--sm btn--danger" data-delete-all>Borrar todas</button>
          <button class="btn btn--ghost btn--sm" data-reset>Restaurar</button>
          <a class="btn btn--team-a btn--sm" href="#/">Volver</a>
        </div>
      </header>

      <main class="admin__main">
        <div class="admin__toolbar">
          <input class="input admin__search" data-search placeholder="Buscar pregunta, opción o categoría…">
          <select class="input" data-filter-category aria-label="Categoría">
            <option value="all">Todas las categorías</option>
          </select>
          <select class="input" data-filter-difficulty aria-label="Dificultad">
            <option value="all">Todas las dificultades</option>
            ${DIFFICULTIES.map((d) => `<option value="${d.id}">${d.label}</option>`).join('')}
          </select>
          <button class="btn btn--ghost" data-delete-many>Borrar varias</button>
          <button class="btn btn--primary" data-new>Nueva pregunta</button>
        </div>

        <div class="admin__list" data-list></div>
      </main>
    </div>
  `;

  const list = root.querySelector('[data-list]');
  const count = root.querySelector('[data-count]');
  const searchInput = root.querySelector('[data-search]');
  const categorySelect = root.querySelector('[data-filter-category]');
  const difficultySelect = root.querySelector('[data-filter-difficulty]');

  function refreshFilters() {
    const cats = categoriesOf(bank);
    const current = categorySelect.value;
    categorySelect.innerHTML = `<option value="all">Todas las categorías</option>${cats
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join('')}`;
    categorySelect.value = cats.includes(current) ? current : 'all';
  }

  function refresh() {
    refreshFilters();
    const filtered = searchBank(bank, filters);
    const stats = bankStats(bank);
    count.textContent = `${stats.total} preguntas · ${filtered.length} visibles`;

    if (!filtered.length) {
      list.innerHTML = '<div class="admin__empty">No hay preguntas con esos filtros.</div>';
      return;
    }

    list.innerHTML = filtered
      .map(
        (q) => `
        <article class="q-row" data-id="${esc(q.id)}">
          <span class="chip">${esc(q.category || 'General')}</span>
          <div class="q-row__body">
            <p class="q-row__text">${esc(q.text)}</p>
            <div class="q-row__meta">
              <span class="chip chip--ghost">${esc(DIFFICULTY_LABEL[q.difficulty] || 'Media')}</span>
              <span class="q-row__answer">✓ ${esc(q.options[q.correct] || '—')}</span>
            </div>
          </div>
          <div class="q-row__actions">
            <button class="btn btn--ghost" data-edit>Editar</button>
            <button class="btn btn--ghost" data-dup>Duplicar</button>
            <button class="btn btn--ghost" data-del>Borrar</button>
          </div>
        </article>`
      )
      .join('');
  }

  function persist(next) {
    bank = next;
    saveBank(bank);
    refresh();
  }

  root.querySelector('[data-new]').addEventListener('click', () => openEditor(null));

  root.querySelector('[data-delete-all]').addEventListener('click', () => {
    if (!bank.length) {
      toast('No hay preguntas para borrar');
      return;
    }
    if (!confirm(`¿Borrar las ${bank.length} preguntas del banco? Esta acción no se puede deshacer.`)) return;
    persist([]);
    toast('Se borraron todas las preguntas');
  });

  root.querySelector('[data-delete-many]').addEventListener('click', openDeleteMany);

  root.querySelector('[data-reset]').addEventListener('click', () => {
    if (!confirm('¿Restaurar el banco de ejemplo? Se perderán tus preguntas actuales.')) return;
    bank = resetBank();
    refresh();
    toast('Banco restaurado', 'ok');
  });

  searchInput.addEventListener('input', () => {
    filters = { ...filters, search: searchInput.value };
    refresh();
  });
  categorySelect.addEventListener('change', () => {
    filters = { ...filters, category: categorySelect.value };
    refresh();
  });
  difficultySelect.addEventListener('change', () => {
    filters = { ...filters, difficulty: difficultySelect.value };
    refresh();
  });

  list.addEventListener('click', (event) => {
    const row = event.target.closest('.q-row');
    if (!row) return;
    const question = bank.find((q) => q.id === row.dataset.id);
    if (!question) return;

    if (event.target.closest('[data-edit]')) openEditor(question);
    if (event.target.closest('[data-dup]')) {
      const copy = {
        ...question,
        id: uid('q_'),
        text: `${question.text} (copia)`,
        options: [...question.options],
      };
      persist([copy, ...bank]);
      toast('Pregunta duplicada', 'ok');
    }
    if (event.target.closest('[data-del]')) {
      if (!confirm('¿Borrar esta pregunta?')) return;
      persist(bank.filter((q) => q.id !== question.id));
      toast('Pregunta borrada');
    }
  });

  /* borrar varias preguntas */

  function openDeleteMany() {
    const filtered = searchBank(bank, filters);
    if (!filtered.length) {
      toast('No hay preguntas con esos filtros');
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
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
      </form>`;

    document.body.appendChild(backdrop);
    document.body.classList.add('is-locked');

    const form = backdrop.querySelector('[data-bulk]');
    const listBox = backdrop.querySelector('[data-bulk-list]');
    const boxes = Array.from(listBox.querySelectorAll('input[type="checkbox"]'));
    const bulkLabel = backdrop.querySelector('[data-bulk-label]');
    const deleteBtn = backdrop.querySelector('[data-delete]');
    const error = backdrop.querySelector('[data-error]');

    const close = () => {
      backdrop.remove();
      document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);

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
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
    backdrop.querySelector('[data-close]').addEventListener('click', close);
    backdrop.querySelector('[data-cancel]').addEventListener('click', close);

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

  /* Editor de preguntas */

  function openEditor(question) {
    const isNew = !question;
    const draft = question
      ? { ...question, options: [...question.options] }
      : { id: null, text: '', options: ['', '', '', ''], correct: 0, category: 'General', difficulty: 'medium' };

    const cats = categoriesOf(bank);
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
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
              <input class="input" id="q-cat" name="category" list="cat-options" maxlength="24"
                  value="${esc(draft.category)}" placeholder="General">
              <datalist id="cat-options">
                ${cats.map((c) => `<option value="${esc(c)}"></option>`).join('')}
              </datalist>
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

          <div class="field">
            <label for="q-time">Tiempo especial (opcional)</label>
            <select class="input" id="q-time" name="time">
              <option value="">Usar el tiempo de la sala</option>
              ${[20, 30, 45, 60, 90]
                .map(
                  (t) => `<option value="${t}" ${draft.time === t ? 'selected' : ''}>${t} segundos</option>`
                )
                .join('')}
            </select>
          </div>

          <p class="editor-hint">
            Consejo: preguntas de una sola línea se leen mejor en pantalla grande.
          </p>
        </div>

        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
          <button type="submit" class="btn btn--primary">Guardar pregunta</button>
        </div>
      </form>`;

    document.body.appendChild(backdrop);
    document.body.classList.add('is-locked');

    const form = backdrop.querySelector('[data-editor]');
    const optionNodes = Array.from(backdrop.querySelectorAll('[data-opt]'));

    const close = () => {
      backdrop.remove();
      document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
    backdrop.querySelector('[data-close]').addEventListener('click', close);
    backdrop.querySelector('[data-cancel]').addEventListener('click', close);

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
        time: form.time.value ? Number(form.time.value) : null,
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

  refresh();
  return null;
}
