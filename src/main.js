/* Archivo Principal */

import { renderHome } from './ui/screens/home.js';
import { renderJoin } from './ui/screens/join.js';
import { renderPlay } from './ui/screens/play.js';
import { renderStage } from './ui/screens/stage.js';
import { renderAdmin } from './ui/screens/admin.js';

const app = document.getElementById('app');
const TITLES = {
  home: 'Pull It Together — Trivia cooperativa',
  join: 'Unirse · Pull It Together',
  play: 'Jugando · Pull It Together',
  stage: 'Sala · Pull It Together',
  admin: 'Preguntas · Pull It Together',
};

let cleanup = null;
let currentPath = '';

function resolve() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);

  if (!parts.length) return { key: 'home', screen: renderHome, params: {} };

  const [head, value] = parts;

  if (head === 'join') return { key: 'join', screen: renderJoin, params: {} };
  if (head === 'room' && value) return { key: 'join', screen: renderJoin, params: { code: value } };
  if (head === 'play' && value) return { key: 'play', screen: renderPlay, params: { code: value } };
  if (head === 'stage' && value) return { key: 'stage', screen: renderStage, params: { code: value } };
  if (head === 'admin') return { key: 'admin', screen: renderAdmin, params: {} };

  return { key: 'home', screen: renderHome, params: {} };
}

function render() {
  const path = location.hash || '#/';
  if (path === currentPath) return false;
  currentPath = path;

  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch {
      /* noop */
    }
  }
  cleanup = null;

  const route = resolve();
  document.title = TITLES[route.key] || TITLES.home;
  app.innerHTML = '';

  const result = route.screen(app, route.params);
  cleanup = typeof result === 'function' ? result : null;

  window.scrollTo(0, 0);
  return true;
}

window.addEventListener('hashchange', render);

if (!location.hash) {
  history.replaceState(null, '', `${location.pathname}${location.search}#/`);
}

render();
