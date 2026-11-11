/* Banco de Preguntas */

import { SEED_QUESTIONS, SEED_VERSION } from '../data/seed-questions.js';
import { normalizeText, readJSON, shuffle, uid, writeJSON } from './utils.js';

const BANK_KEY = 'tyg.questions.v1';
const BANK_META_KEY = 'tyg.questions.meta';
const SEEN_KEY = 'tyg.questions.seen';

export const DIFFICULTIES = [
  { id: 'easy', label: 'Fácil' },
  { id: 'medium', label: 'Media' },
  { id: 'hard', label: 'Difícil' },
];

export const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d.label]));

export const OPTION_KEYS = ['A', 'B', 'C', 'D'];

const LIMITS = {
  textMin: 5,
  textMax: 180,
  optionMax: 70,
  minOptions: 2,
  maxOptions: 4,
};

function cloneSeed() {
  return SEED_QUESTIONS.map((q) => ({ ...q, options: [...q.options] }));
}

export function loadBank() {
  const stored = readJSON(BANK_KEY, null);
  if (Array.isArray(stored)) return stored;

  const seed = cloneSeed();
  saveBank(seed);
  writeJSON(BANK_META_KEY, { version: SEED_VERSION, seededAt: Date.now() });
  return seed;
}

export function saveBank(questions) {
  return writeJSON(BANK_KEY, questions);
}

export function resetBank() {
  const seed = cloneSeed();
  saveBank(seed);
  return seed;
}

export function bankCount() {
  return loadBank().length;
}

export function categoriesOf(bank) {
  const set = new Set(bank.map((q) => q.category).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

export function difficultyOf(bank) {
  const set = new Set(bank.map((q) => q.difficulty).filter(Boolean));
  return DIFFICULTIES.filter((d) => set.has(d.id));
}

export function searchBank(bank, { search = '', category = 'all', difficulty = 'all' } = {}) {
  const needle = normalizeText(search);
  return bank.filter((q) => {
    if (category !== 'all' && q.category !== category) return false;
    if (difficulty !== 'all' && q.difficulty !== difficulty) return false;
    if (!needle) return true;
    const haystack = normalizeText(`${q.text} ${q.options.join(' ')} ${q.category}`);
    return haystack.includes(needle);
  });
}

export function buildQueue(bank, config) {
  const categories = Array.isArray(config.categories) ? config.categories : [];
  const difficulty = config.difficulty || 'all';
  const rounds = Math.max(1, Math.min(20, Number(config.rounds) || 8));

  const texts = new Set();
  const pool = bank.filter((q) => {
    if (!q || !Array.isArray(q.options) || q.options.length < 2) return false;
    if (categories.length && !categories.includes(q.category)) return false;
    if (difficulty !== 'all' && q.difficulty !== difficulty) return false;
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) return false;
    const key = normalizeText(q.text);
    if (texts.has(key)) return false;
    texts.add(key);
    return true;
  });

  if (!pool.length) return [];

  const size = Math.min(rounds, pool.length);
  const seen = new Set(readJSON(SEEN_KEY, []));
  const unseen = shuffle(pool.filter((q) => !seen.has(q.id)));
  const old = shuffle(pool.filter((q) => seen.has(q.id)));
  const queue = shuffle(unseen.concat(old).slice(0, size));

  if (unseen.length < size) pool.forEach((q) => seen.delete(q.id));
  queue.forEach((q) => seen.add(q.id));
  writeJSON(SEEN_KEY, [...seen]);

  return queue;
}

export function toPublic(question) {
  if (!question) return null;
  return {
    id: question.id,
    text: question.text,
    options: question.options.slice(0, 4),
    category: question.category || 'General',
    difficulty: question.difficulty || 'medium',
  };
}

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

export function bankStats(bank) {
  const byCategory = {};
  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  for (const q of bank) {
    byCategory[q.category || 'General'] = (byCategory[q.category || 'General'] || 0) + 1;
    if (byDifficulty[q.difficulty] !== undefined) byDifficulty[q.difficulty] += 1;
  }
  return { total: bank.length, byCategory, byDifficulty };
}
