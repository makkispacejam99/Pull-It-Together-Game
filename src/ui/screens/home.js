/* Pantalla de inicio */

import { isMuted, toggleMuted } from '../../core/audio.js';
import { roomCode } from '../../core/utils.js';
import { decorateHomeScene } from '../../game/scene.js';
import { toast } from '../toast.js';
import { openReport } from '../report.js';

const FEATURES = [
  {
    n: '01',
    title: 'Entra a la sala',
    text: 'Comparte el código y compite. Hasta 30 jugadores, sin cuentas, ni descargas.',
  },
  {
    n: '02',
    title: 'Trabaja en equipo',
    text: 'Coopera con tus colegas para elegir la respuesta correcta.',
  },
  {
    n: '03',
    title: 'Acierta y Gana',
    text: 'Cada acierto jala la cuerda. Encadena aciertos y arrastra al equipo rival hasta el KO.',
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
            <a class="btn btn--ghost btn--sm btn--donate" href="https://ko-fi.com/makkispacejam" target="_blank" rel="noopener noreferrer">
              <svg class="donate__heart" viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
                <path fill="#ff5c8a" d="M1 0h2v1H1zM6 0h2v1H6zM0 1h4v1H0zM5 1h4v1H5zM0 2h9v2H0zM1 4h7v1H1zM2 5h5v1H2zM3 6h3v1H3zM4 7h1v1H4z"/>
                <path fill="#ffb3cb" d="M1 1h2v1H1z"/>
              </svg>
              Donar
            </a>
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
            <span>Desde tu móvil u ordenador</span>
          </p>
        </main>

        <div class="home__scene" id="homeScene"></div>
      </section>

      <section class="home__how">
        ${FEATURES.map(
          (f) => `
          <article class="how-card panel">
            <span class="how-card__num">${f.n}</span>
            <h2 class="how-card__title">${f.title}</h2>
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
          <button type="button" class="home__report" data-report>¿Algo salió mal o tienes una sugerencia? Cuéntanos</button>
        </div>
      </footer>
    </div>
  `;

  const scene = decorateHomeScene(root.querySelector('#homeScene'));
  const audioBtn = root.querySelector('[data-audio]');
  root.querySelector('[data-report]').addEventListener('click', openReport);

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
