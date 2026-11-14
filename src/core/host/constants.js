export const MAX_PLAYERS = 30;
export const MIN_PLAYERS = 2;
export const MAX_PER_TEAM = MAX_PLAYERS / 2;

export const PHASE_MS = {
  countdown: 3000,
  reveal: 7000,
  allVoted: 900,
};

export const BOT_NAMES = [
  'Pixel', 'Turbo', 'Zeta', 'Nova', 'Bombo', 'Chispa', 'Kuma', 'Rayo',
  'Tofu', 'Mango', 'Bruno', 'Luna', 'Taco', 'Michi', 'Duna', 'Beto',
  'Frida', 'Nube', 'Pogo', 'Yuki', 'Rulo', 'Canela', 'Trueno', 'Kiwi',
  'Samba', 'Coco', 'Pepa', 'Golfo', 'Mimo', 'Vega',
];

export const AVATARS = ['green', 'pink', 'purple', 'yellow', 'beige'];

export const hostDataKey = (code) => `tyg:hostdata:${code}`;
