/* Banco de preguntas */

import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  bankStats,
  buildTemplate,
  categoriesOf,
  loadBank,
  parseImport,
  resetBank,
  saveBank,
  searchBank,
  validateQuestion,
} from '../../core/questions.js';
import { downloadFile, esc, normalizeText, truncate, uid } from '../../core/utils.js';
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
          <button class="btn btn--primary btn--sm" data-help>Ayuda</button>
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

        <div class="admin__toolbar admin__toolbar--data">
          <span class="admin__data-label">Datos</span>
          <button class="btn btn--ghost btn--sm" data-import>Importar</button>
          <button class="btn btn--ghost btn--sm" data-export>Exportar</button>
          <button class="btn btn--ghost btn--sm" data-template>Descargar plantilla</button>
        </div>
        <input type="file" accept=".md,text/markdown" data-import-file hidden>

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

  const importFile = root.querySelector('[data-import-file]');

  root.querySelector('[data-import]').addEventListener('click', () => {
    importFile.value = '';
    importFile.click();
  });

  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      const result = parseImport(await file.text());
      if (!result.ok) {
        toast(result.error, 'bad');
        return;
      }
      if (!result.questions.length) {
        toast('No se encontraron preguntas válidas en el archivo', 'bad');
        return;
      }
      openImport(result.questions, result.skipped, file.name);
    } catch {
      toast('No se pudo leer el archivo', 'bad');
    } finally {
      importFile.value = '';
    }
  });

  root.querySelector('[data-export]').addEventListener('click', () => {
    if (!bank.length) {
      toast('No hay preguntas para exportar', 'bad');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`pull-it-together-preguntas-${date}.md`, buildTemplate(bank), 'text/markdown');
    toast('Banco exportado', 'ok');
  });

  root.querySelector('[data-template]').addEventListener('click', () => {
    downloadFile('pull-it-together-plantilla.md', buildTemplate(), 'text/markdown');
    toast('Plantilla descargada', 'ok');
  });

  root.querySelector('[data-help]').addEventListener('click', openHelp);

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

  function openImport(imported, skipped, fileName) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
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
      </form>`;

    document.body.appendChild(backdrop);
    document.body.classList.add('is-locked');

    const form = backdrop.querySelector('[data-import-modal]');
    const modeNodes = Array.from(backdrop.querySelectorAll('[data-mode]'));
    const warning = backdrop.querySelector('[data-warning]');

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

  function openHelp() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal panel" data-help-modal>
        <div class="modal__head">
          <h2 class="modal__title">Ayuda · Banco de preguntas</h2>
          <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
        </div>

        <div class="modal__body help-sheet">
          <p>Crea preguntas a mano o prepara un archivo completo y súbelo desde el botón Importar.</p>

          <h3>Importar</h3>
          <p>Acepta archivos <strong>.md</strong> creados con la plantilla. Puedes añadir las preguntas al banco actual o reemplazarlo por completo. Al añadir, las preguntas repetidas se omiten.</p>

          <h3>Exportar</h3>
          <p>Descarga el banco actual en un archivo <strong>.md</strong>. Sirve como copia de seguridad y puede volver a importarse cuando quieras.</p>

          <h3>Descargar plantilla</h3>
          <p>Descarga 100 preguntas generales listas para editar. Ábrela con cualquier editor de texto, cambia o añade bloques y guárdala como <strong>.md</strong>.</p>

          <h3>Formato de cada pregunta</h3>
          <pre class="help-code">## Pregunta
Texto: ¿Cuál es el planeta más grande del sistema solar?
Opción A: Saturno
Opción B: Júpiter
Opción C: Marte
Opción D: Neptuno
Correcta: B
Categoría: Ciencia
Dificultad: Fácil</pre>

          <h3>Reglas</h3>
          <ul>
            <li>La pregunta necesita al menos 5 caracteres y las opciones no pueden estar vacías.</li>
            <li>Se admiten entre 2 y 4 opciones por pregunta.</li>
            <li>La respuesta correcta se indica con la letra A, B, C o D.</li>
            <li>La dificultad puede ser Fácil, Media o Difícil.</li>
            <li>La duración de cada ronda se configura en el lobby.</li>
          </ul>

          <h3>Consejos</h3>
          <ul>
            <li>Escribe preguntas cortas para que se lean bien en pantallas grandes y móviles.</li>
            <li>Evita preguntas que dependan de un país o región concreta si juegas con gente de varios lugares.</li>
            <li>Usa categorías claras y mantén un banco variado de temas y dificultades.</li>
            <li>Antes de reemplazar el banco, exporta una copia de seguridad.</li>
          </ul>

          <p class="muted tiny">Si una pregunta se omite al importar, revisa la letra correcta, las opciones vacías o si ya existe otra pregunta con el mismo texto.</p>
        </div>

        <div class="modal__foot">
          <button type="button" class="btn btn--primary" data-close>Cerrar</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.classList.add('is-locked');

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
    backdrop.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', close);
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
