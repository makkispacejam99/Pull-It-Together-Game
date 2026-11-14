import { avatarSrc, esc } from '../../core/utils.js';

export function charHTML(player, index) {
  const delay = ((index * 137) % 900) / 1000 - 0.6;
  const lift = index % 2 === 1 ? '18px' : '0px';
  return `
    <div class="char" data-id="${esc(player.id)}" style="--delay:${delay}s;--tag-lift:${lift}">
      <span class="char__name">${esc(player.nickname)}</span>
      <div class="char__sprite">
        <img class="pi" src="${avatarSrc(player.avatar, 'idle')}" alt="" draggable="false" loading="lazy">
        <img class="pa" src="${avatarSrc(player.avatar, 'walk_a')}" alt="" draggable="false" loading="lazy">
        <img class="pb" src="${avatarSrc(player.avatar, 'walk_b')}" alt="" draggable="false" loading="lazy">
        <img class="pc" src="${avatarSrc(player.avatar, 'hit')}" alt="" draggable="false">
      </div>
      <span class="char__base"></span>
    </div>`;
}

export function sceneMarkup(mini) {
  return `
    <div class="arena__sky"></div>
    <div class="arena__nebula arena__nebula--violet"></div>
    <div class="arena__nebula arena__nebula--teal"></div>
    <div class="arena__stars"></div>
    <div class="arena__stars arena__stars--near"></div>
    <div class="arena__planet"></div>
    ${mini ? '' : '<div class="arena__moon"></div>'}
    <div class="arena__shoot"></div>
    <div class="arena__sat" aria-hidden="true">
      <span class="arena__sat-panel"></span>
      <span class="arena__sat-body"></span>
      <span class="arena__sat-panel"></span>
    </div>
    <div class="arena__rocks"><span></span><span></span><span></span></div>
    <div class="arena__ridge arena__ridge--far"></div>
    <div class="arena__ridge arena__ridge--near"></div>
    <div class="arena__crystals">
      <span class="arena__crystal arena__crystal--1"></span>
      <span class="arena__crystal arena__crystal--2"></span>
      <span class="arena__crystal arena__crystal--3"></span>
      <span class="arena__crystal arena__crystal--4"></span>
    </div>
    <div class="arena__ground"></div>
    <div class="arena__center"></div>
    <div class="arena__vs" aria-hidden="true">
      <span class="arena__vs-badge">VS</span>
    </div>
    <div class="side side--a"></div>
    <div class="side side--b"></div>
    <div class="rope">
      <div class="rope__cord">
        <span class="rope__half rope__half--a"></span>
        <span class="rope__half rope__half--b"></span>
      </div>
      <span class="rope__pin" aria-hidden="true"></span>
    </div>
  `;
}
