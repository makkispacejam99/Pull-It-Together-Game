import { SEED_QUESTIONS } from '../../data/seed-questions.js';
import { normalizeText, uid } from '../utils.js';
import { DIFFICULTY_LABEL, LIMITS, OPTION_KEYS } from './config.js';

function cloneSeed() {
  return SEED_QUESTIONS.map((q) => ({ ...q, options: [...q.options] }));
}

function importKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function parseDifficultyValue(value) {
  const key = normalizeText(value);
  if (key === 'easy' || key === 'facil') return 'easy';
  if (key === 'hard' || key === 'dificil') return 'hard';
  if (key === 'medium' || key === 'media' || key === 'medio') return 'medium';
  return 'medium';
}

function parseCorrectValue(value, options) {
  const raw = String(value ?? '').trim();
  if (!raw) return -1;
  const letter = raw.match(/^[A-Da-d]$/);
  if (letter) return letter[0].toUpperCase().charCodeAt(0) - 65;
  if (/^\d+$/.test(raw)) {
    const number = Number(raw);
    if (number >= 1 && number <= options.length) return number - 1;
    if (number >= 0 && number < options.length) return number;
  }
  return options.findIndex((option) => normalizeText(option) === normalizeText(raw));
}

function parseTemplate(raw) {
  const marker = /^#{1,6}\s*(?:pregunta|question)\b.*$/im;
  const chunks = marker.test(raw)
    ? raw.split(/^#{1,6}\s*(?:pregunta|question)\b.*$/im).slice(1)
    : raw.split(/\n\s*\n/);
  const items = [];

  for (const chunk of chunks) {
    const item = { text: '', options: [], correct: '', category: 'General', difficulty: 'medium' };
    let hasData = false;

    for (const rawLine of chunk.split(/\r?\n/)) {
      let line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      line = line.replace(/^[-*+]\s+/, '');

      const option = line.match(/^(?:opci[oó]n\s+)?([A-Da-d])\s*[).:\-]\s*(.+)$/i);
      if (option) {
        item.options[option[1].toUpperCase().charCodeAt(0) - 65] = option[2].trim();
        hasData = true;
        continue;
      }

      const pair = line.match(/^([^:]+):\s*(.*)$/);
      if (!pair) continue;
      const key = importKey(pair[1]);
      const value = pair[2].trim();

      if (['texto', 'pregunta', 'text', 'question'].includes(key)) {
        item.text = value;
        hasData = true;
      } else if (['correcta', 'respuesta', 'correct', 'answer'].includes(key)) {
        item.correct = value;
        hasData = true;
      } else if (['categoria', 'category'].includes(key)) {
        item.category = value || 'General';
        hasData = true;
      } else if (['dificultad', 'difficulty'].includes(key)) {
        item.difficulty = parseDifficultyValue(value);
        hasData = true;
      } else if (['opciones', 'options'].includes(key)) {
        item.options = value.split(/\s*[|;]\s*/).filter(Boolean);
        hasData = true;
      }
    }

    if (hasData) items.push(item);
  }

  return items;
}

export function parseImport(raw, existing = []) {
  const source = String(raw ?? '').trim();
  if (!source) return { ok: false, error: 'El archivo está vacío.', questions: [] };

  const list = parseTemplate(source);
  if (!list.length) {
    return { ok: false, error: 'No se encontraron preguntas en el archivo.', questions: [] };
  }

  const seen = new Set(existing.map((q) => normalizeText(q.text)));
  const valid = [];
  let skipped = 0;

  for (const item of list) {
    if (!item || typeof item !== 'object') {
      skipped += 1;
      continue;
    }

    const text = String(item.text || item.pregunta || '').trim();
    const rawOptions = item.options ?? item.opciones ?? [];
    const options = Array.isArray(rawOptions)
      ? Array.from(rawOptions, (option) => String(option ?? '').trim())
      : String(rawOptions).split(/\s*[|;]\s*/).map((option) => option.trim());

    const correct = parseCorrectValue(item.correct ?? item.correcta, options);
    const validShape =
      text.length >= LIMITS.textMin &&
      text.length <= LIMITS.textMax &&
      options.length >= LIMITS.minOptions &&
      options.length <= LIMITS.maxOptions &&
      options.every((option) => option.length > 0 && option.length <= LIMITS.optionMax) &&
      correct >= 0 &&
      correct < options.length &&
      !seen.has(normalizeText(text));

    if (!validShape) {
      skipped += 1;
      continue;
    }

    seen.add(normalizeText(text));
    valid.push({
      id: String(item.id || uid('q_')),
      text,
      options,
      correct,
      category: String(item.category || item.categoria || 'General').trim() || 'General',
      difficulty: DIFFICULTY_LABEL[item.difficulty] ? item.difficulty : parseDifficultyValue(item.difficulty),
    });
  }

  return { ok: true, questions: valid, skipped, error: null };
}

export function buildTemplate(bank = cloneSeed()) {
  const intro = [
    '# Pull It Together — Plantilla de preguntas',
    '',
    'Edita esta plantilla y vuelve a importarla desde el panel de preguntas.',
    '',
    '## Cómo usar la plantilla',
    '',
    '1. Cada pregunta empieza con el encabezado "## Pregunta". No borres ese encabezado.',
    '2. Puedes usar entre 2 y 4 opciones. La respuesta correcta se escribe con la letra A, B, C o D.',
    '3. La dificultad puede ser Fácil, Media o Difícil. Si no la indicas, se usará Media.',
    '4. La categoría es libre. Si no la indicas, se usará General.',
    '5. Para añadir más preguntas, copia un bloque completo desde "## Pregunta" hasta la última línea.',
    '6. Guarda el archivo como .md y usa el botón Importar del panel de preguntas.',
    '',
    'Consejo: escribe preguntas de una sola línea y evita repetir la misma pregunta.',
  ].join('\n');

  const blocks = bank.map((question) => {
    const lines = [
      '## Pregunta',
      `Texto: ${question.text}`,
      ...question.options.map((option, index) => `Opción ${OPTION_KEYS[index]}: ${option}`),
      `Correcta: ${OPTION_KEYS[question.correct] || 'A'}`,
      `Categoría: ${question.category || 'General'}`,
      `Dificultad: ${DIFFICULTY_LABEL[question.difficulty] || 'Media'}`,
    ];
    return lines.join('\n');
  });

  return `${intro}\n\n${blocks.join('\n\n')}\n`;
}
