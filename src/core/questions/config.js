export const BANK_KEY = 'tyg.questions.v1';
export const BANK_META_KEY = 'tyg.questions.meta';
export const SEEN_KEY = 'tyg.questions.seen';

export const DIFFICULTIES = [
  { id: 'easy', label: 'Fácil' },
  { id: 'medium', label: 'Media' },
  { id: 'hard', label: 'Difícil' },
];

export const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d.label]));

export const OPTION_KEYS = ['A', 'B', 'C', 'D'];

export const LIMITS = {
  textMin: 5,
  textMax: 180,
  optionMax: 70,
  minOptions: 2,
  maxOptions: 4,
};
