/* Pantalla de inicio */

import { isMuted, toggleMuted } from '../../core/audio.js';
import { readJSON, roomCode } from '../../core/utils.js';
import { roomExists } from '../../net/bus.js';
import { decorateHomeScene } from '../../game/scene.js';
import { toast } from '../toast.js';
import { openReport } from '../report.js';
import { canInstall, isIos, isStandalone, onInstallChange, promptInstall } from '../install.js';

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

const lastCode = readJSON('tyg.lastHost', '');
const canReturn = Boolean(lastCode) && roomExists(lastCode);

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
            <a class="btn btn--ghost btn--sm btn--donate" href="https://ko-fi.com/makkispacejam" target="_blank" rel="noopener noreferrer" aria-label="Donar">
              <svg class="donate__heart" viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
                <path fill="#ff5c8a" d="M1 0h2v1H1zM6 0h2v1H6zM0 1h4v1H0zM5 1h4v1H5zM0 2h9v2H0zM1 4h7v1H1zM2 5h5v1H2zM3 6h3v1H3zM4 7h1v1H4z"/>
                <path fill="#ffb3cb" d="M1 1h2v1H1z"/>
              </svg>
              <span class="donate__label">Donar</span>
            </a>
            <a class="btn btn--ghost btn--sm topbar__opt" href="#/admin">Preguntas</a>
            <button class="btn btn--ghost btn--sm topbar__opt" data-audio aria-label="Sonido"><span data-audio-icon>${isMuted() ? '♪̸' : '♪'}</span></button>
            <div class="topbar__menu" data-menu-root>
              <button type="button" class="btn btn--ghost btn--sm topbar__menu-btn" data-menu aria-label="Más opciones" aria-haspopup="true" aria-expanded="false"></button>
              <div class="topbar__menu-panel" data-menu-panel hidden>
                <button type="button" class="topbar__menu-item" data-audio>
                  <span class="topbar__menu-icon" data-audio-icon>${isMuted() ? '♪̸' : '♪'}</span>
                  <span data-audio-text>${isMuted() ? 'Sonido desactivado' : 'Sonido activado'}</span>
                </button>
                <a class="topbar__menu-item" href="#/admin">Preguntas</a>
              </div>
            </div>
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
            ${canReturn ? `<a class="btn btn--lg" href="#/stage/${lastCode}">Volver a sala (${lastCode})</a>` : ''}
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
          <button type="button" class="home__report" data-install hidden>Instalar la app</button>
        </div>
      </footer>
    </div>
  `;

  const scene = decorateHomeScene(root.querySelector('#homeScene'));
  const menuBtn = root.querySelector('[data-menu]');
  const menuPanel = root.querySelector('[data-menu-panel]');
  root.querySelector('[data-report]').addEventListener('click', openReport);
  const installBtn = root.querySelector('[data-install]');
  const syncInstall = () => {
    installBtn.hidden = isStandalone() || !(canInstall() || isIos());
  };
  syncInstall();
  const offInstall = onInstallChange(syncInstall);
  installBtn.addEventListener('click', async () => {
    if (canInstall()) await promptInstall();
    else toast('En Safari toca Compartir y luego "Añadir a pantalla de inicio"', 'ok', 6000);
  });

  function closeMenu() {
    menuPanel.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function syncAudio() {
    const muted = isMuted();
    root.querySelectorAll('[data-audio-icon]').forEach((el) => {
      el.textContent = muted ? '♪̸' : '♪';
    });
    const label = root.querySelector('[data-audio-text]');
    if (label) label.textContent = muted ? 'Sonido desactivado' : 'Sonido activado';
  }

  root.querySelectorAll('[data-audio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const muted = toggleMuted();
      syncAudio();
      toast(muted ? 'Sonido silenciado' : 'Sonido activado');
    });
  });

  menuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = menuPanel.hidden;
    menuPanel.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  menuPanel.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  function onDocClick(event) {
    if (!menuPanel.hidden && !event.target.closest('[data-menu-root]')) closeMenu();
  }

  function onKey(event) {
    if (event.key === 'Escape' && !menuPanel.hidden) {
      closeMenu();
      menuBtn.focus();
    }
  }

  document.addEventListener('click', onDocClick);
  root.addEventListener('keydown', onKey);

  root.querySelector('[data-create]').addEventListener('click', () => {
    const code = roomCode();
    location.hash = `#/stage/${code}`;
  });

  return () => {
    offInstall();
    document.removeEventListener('click', onDocClick);
    root.removeEventListener('keydown', onKey);
    scene.destroy();
  };
}
