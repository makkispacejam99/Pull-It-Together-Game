import { normalizeText, readJSON, shuffle, writeJSON } from '../utils.js';
import { MAX_ROUNDS, SEEN_KEY } from './config.js';

export function poolFor(bank, config = {}) {
  const categories = Array.isArray(config.categories) ? config.categories : [];
  const difficulty = config.difficulty || 'all';
  const texts = new Set();

  return (Array.isArray(bank) ? bank : []).filter((q) => {
    if (!q || !Array.isArray(q.options) || q.options.length < 2) return false;
    if (categories.length && !categories.includes(q.category)) return false;
    if (difficulty !== 'all' && q.difficulty !== difficulty) return false;
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) return false;
    const key = normalizeText(q.text);
    if (texts.has(key)) return false;
    texts.add(key);
    return true;
  });
}

export function maxRoundsFor(bank, config) {
  return Math.min(MAX_ROUNDS, poolFor(bank, config).length);
}

export function buildQueue(bank, config) {
  const rounds = Math.max(1, Math.min(MAX_ROUNDS, Number(config?.rounds) || 8));
  const pool = poolFor(bank, config);

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
