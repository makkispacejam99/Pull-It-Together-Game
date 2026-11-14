import { normalizeText, uid } from '../utils.js';
import { DIFFICULTY_LABEL, LIMITS } from './config.js';

export function validateQuestion(draft, bank, editingId = null) {
  const errors = {};
  const text = String(draft.text || '').trim();
  const options = (draft.options || []).map((o) => String(o || '').trim());
  const category = String(draft.category || '').trim() || 'General';
  const difficulty = DIFFICULTY_LABEL[draft.difficulty] ? draft.difficulty : 'medium';
  const correct = Number(draft.correct);

  if (text.length < LIMITS.textMin) errors.text = 'Escribe la pregunta (mínimo 5 caracteres).';
  if (text.length > LIMITS.textMax) errors.text = `Máximo ${LIMITS.textMax} caracteres.`;

  const filled = options.filter(Boolean);
  if (filled.length < LIMITS.minOptions) errors.options = 'Necesitas al menos 2 opciones.';
  if (options.length > LIMITS.maxOptions) errors.options = 'Máximo 4 opciones.';
  if (options.some((o) => o.length > LIMITS.optionMax)) {
    errors.options = `Cada opción puede tener hasta ${LIMITS.optionMax} caracteres.`;
  }
  if (new Set(options.map((o) => normalizeText(o))).size !== options.length) {
    errors.options = 'Las opciones no pueden repetirse.';
  }
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length || !options[correct]) {
    errors.correct = 'Marca cuál es la opción correcta.';
  }

  const duplicate = bank.some(
    (q) => q.id !== editingId && normalizeText(q.text) === normalizeText(text)
  );
  if (duplicate) errors.text = 'Ya existe una pregunta con ese texto.';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: {
      id: editingId || uid('q_'),
      text,
      options,
      correct,
      category,
      difficulty,
    },
  };
}
