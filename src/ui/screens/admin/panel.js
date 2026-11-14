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
} from '../../../core/questions.js';
import { downloadFile, esc, uid } from '../../../core/utils.js';
import { toast } from '../../toast.js';
import { openEditor } from './editor.js';
import { openDeleteMany } from './bulk-delete.js';
import { openImport } from './import.js';
import { openHelp } from './help.js';

export function renderAdmin(root) {
  return renderPanel(root);
}

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

  root.querySelector('[data-new]').addEventListener('click', () => openEditor(null, { bank, persist }));

  root.querySelector('[data-delete-all]').addEventListener('click', () => {
    if (!bank.length) {
      toast('No hay preguntas para borrar');
      return;
    }
    if (!confirm(`¿Borrar las ${bank.length} preguntas del banco? Esta acción no se puede deshacer.`)) return;
    persist([]);
    toast('Se borraron todas las preguntas');
  });

  root.querySelector('[data-delete-many]').addEventListener('click', () =>
    openDeleteMany({ bank, filters, persist })
  );

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
      openImport(result.questions, result.skipped, file.name, { bank, persist });
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

    if (event.target.closest('[data-edit]')) openEditor(question, { bank, persist });
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

  refresh();
  return null;
}
