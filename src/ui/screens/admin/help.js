import { openModal } from '../../modal.js';

export function openHelp() {
  openModal(`
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
      </div>`);
}
