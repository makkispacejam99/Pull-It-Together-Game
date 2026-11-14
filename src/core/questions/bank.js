import { SEED_QUESTIONS, SEED_VERSION } from '../../data/seed-questions.js';
import { normalizeText, readJSON, writeJSON } from '../utils.js';
import { BANK_KEY, BANK_META_KEY, DIFFICULTIES } from './config.js';

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

export function bankStats(bank) {
  const byCategory = {};
  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  for (const q of bank) {
    byCategory[q.category || 'General'] = (byCategory[q.category || 'General'] || 0) + 1;
    if (byDifficulty[q.difficulty] !== undefined) byDifficulty[q.difficulty] += 1;
  }
  return { total: bank.length, byCategory, byDifficulty };
}
