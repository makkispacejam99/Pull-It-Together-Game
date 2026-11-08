/* Audio y efectos de sonido */

import { readJSON, writeJSON } from './utils.js';

const KEY = 'tyg.muted';

const SFX = {
  select: { src: 'assets/audio/sfx_select.mp3', volume: 0.35 },
  correct: { src: 'assets/audio/sfx_coin.mp3', volume: 0.35 },
  wrong: { src: 'assets/audio/sfx_hurt.mp3', volume: 0.35 },
  pull: { src: 'assets/audio/sfx_jump.mp3', volume: 0.02 },
  win: { src: 'assets/audio/sfx_magic.mp3', volume: 0.02 },
  tick: { src: 'assets/audio/sfx_bump.ogg', volume: 0.25 },
};

let muted = Boolean(readJSON(KEY, false));
let unlocked = false;
let music = null;

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  writeJSON(KEY, muted);
  if (music) {
    if (muted) music.pause();
    else music.play().catch(() => {});
  }
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    const audio = new Audio(SFX.select.src);
    audio.volume = 0;
    audio.play().catch(() => {});
  } catch {
    /* noop */
  }
}

/* Musica de Fondo */
export function startMusic(src = 'assets/audio/game_bg_music.ogg', volume = 0.2) {
  if (!music) {
    music = new Audio(src);
    music.loop = true;
    music.volume = volume;
  }
  if (!muted) music.play().catch(() => {});
}

export function stopMusic() {
  if (!music) return;
  music.pause();
  music = null;
}

export function play(name) {
  if (muted) return;
  const item = SFX[name];
  if (!item) return;
  try {
    const audio = new Audio(item.src);
    audio.volume = item.volume;
    audio.play().catch(() => {});
  } catch {
    /* noop */
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
}

export const SFX_LIST = Object.keys(SFX);
