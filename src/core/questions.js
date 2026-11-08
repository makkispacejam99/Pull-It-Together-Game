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
    time: question.time || null,
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
      ...(draft.time ? { time: Number(draft.time) } : {}),
    },
  };
}

export function parseImport(raw, existing = []) {
  let payload;
  try {
    payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.', questions: [] };
  }

  const list = Array.isArray(payload) ? payload : payload?.questions;
  if (!Array.isArray(list)) {
    return { ok: false, error: 'Formato no reconocido: se esperaba un array de preguntas.', questions: [] };
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
    const options = (item.options || item.opciones || []).map((o) => String(o).trim());
    const correct = Number.isInteger(item.correct)
      ? item.correct
      : Number.isInteger(item.correcta)
        ? item.correcta
        : -1;

    const validShape =
      text.length >= LIMITS.textMin &&
      options.length >= 2 &&
      options.length <= 4 &&
      options.every(Boolean) &&
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
      difficulty: DIFFICULTY_LABEL[item.difficulty] ? item.difficulty : 'medium',
    });
  }

  return { ok: true, questions: valid, skipped, error: null };
}

export function exportBank(bank) {
  return JSON.stringify({ version: SEED_VERSION, exportedAt: new Date().toISOString(), questions: bank }, null, 2);
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
