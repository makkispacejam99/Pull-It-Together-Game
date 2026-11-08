/* Pantalla de inicio */

import { isMuted, toggleMuted } from '../../core/audio.js';
import { roomCode } from '../../core/utils.js';
import { decorateHomeScene } from '../../game/scene.js';
import { toast } from '../toast.js';

const FEATURES = [
  {
    n: '01',
    title: 'Entra a la sala',
    text: 'Comparte el código de 5 letras y listo. Hasta 30 jugadores, sin cuentas ni descargas.',
  },
  {
    n: '02',
    title: 'Trabaja en equipo',
    text: 'Coopera con tus colegas para elegir la respuesta correcta.',
  },
  {
    n: '03',
    title: 'Tiren de la cuerda',
    text: 'Cada acierto tira para su lado. Encadenen aciertos y arrastren al otro equipo hasta el KO.',
  },
];

export function renderHome(root) {
  root.innerHTML = `
    <div class="home">
      <section class="home__hero">
        <div class="home__glow"></div>

        <header class="topbar">
          <a class="brand" href="#/">
            <img src="assets/img/props/hud_player_pink.png" alt="">
            <span>PULL IT TOGETHER</span>
          </a>
          <nav class="topbar__nav">
            <a class="btn btn--ghost btn--sm" href="#/admin">Preguntas</a>
            <button class="btn btn--ghost btn--sm" data-audio aria-label="Sonido">${isMuted() ? '♪̸' : '♪'}</button>
          </nav>
        </header>

        <main class="home__main">
          <h1 class="home__title display">PULL IT<br><span class="accent">TOGETHER</span></h1>
          <p class="home__lead">
            Pon a prueba tu conocimiento, trabaja en equipo y gana.
          </p>
          <div class="home__actions">
            <button class="btn btn--primary btn--lg" data-create>Crear sala</button>
            <a class="btn btn--lg" href="#/join">Unirse con código</a>
          </div>
          <p class="home__note">
            <span>Hasta 30 jugadores</span>
            <span>Sin registro</span>
            <span>Desde el móvil</span>
          </p>
        </main>

        <div class="home__scene" id="homeScene"></div>
      </section>

      <section class="home__how">
        ${FEATURES.map(
          (f) => `
          <article class="how-card panel">
            <span class="how-card__num">${f.n}</span>
            <h3 class="how-card__title">${f.title}</h3>
            <p class="how-card__text">${f.text}</p>
          </article>`
        ).join('')}
      </section>

      <footer class="home__footer">
        <p class="home__welcome">
          Bienvenido a <b>Pull It Together</b>, pon a prueba qué tanto sabes y disfruta
          de una tarde con tus amigos. Un proyecto gratuito y open source, creado por
          <b>MakkiDEV</b>.
        </p>
        <div class="home__credits">
          <span>Arte y sonido: Kenney, ColorAlpha y Chajamakesmusic (CC0)</span>
        </div>
      </footer>
    </div>
  `;

  const scene = decorateHomeScene(root.querySelector('#homeScene'));
  const audioBtn = root.querySelector('[data-audio]');

  audioBtn.addEventListener('click', () => {
    const muted = toggleMuted();
    audioBtn.textContent = muted ? '♪̸' : '♪';
    toast(muted ? 'Sonido silenciado' : 'Sonido activado');
  });

  root.querySelector('[data-create]').addEventListener('click', () => {
    const code = roomCode();
    location.hash = `#/stage/${code}`;
  });

  return () => scene.destroy();
}
