import { HostRoom } from '../../../core/host.js';
import { categoriesOf, loadBank } from '../../../core/questions.js';
import { duckMusic, play, startMusic, stopMusic } from '../../../core/audio.js';
import { toast } from '../../toast.js';
import { createLobbyView } from './lobby.js';
import { createGameView } from './game.js';
import { writeJSON } from '../../../core/utils.js';
import { createResultsView } from './results.js';

export function renderStage(root, params = {}) {
  const code = String(params.code || '').toUpperCase();
  if (!code) {
    location.hash = '#/';
    return null;
  }

  let host;
  try {
    host = new HostRoom(code, { onChange: onHostChange });
  } catch (error) {
    root.innerHTML = `
      <div class="gate">
        <div class="gate__card panel">
          <p class="gate__icon">!</p>
          <p class="muted">No se pudo abrir la sala.</p>
          <a class="btn btn--primary" href="#/">Volver al inicio</a>
        </div>
      </div>`;
    return null;
  }
  
  writeJSON('tyg.lastHost', code);

  let mode = '';
  let scene = null;
  let destroyed = false;
  let lastStatus = '';

  const bank = loadBank();
  const categories = categoriesOf(bank);

  const ctx = {
    root,
    code,
    host,
    categories,
    isDestroyed: () => destroyed,
    getScene: () => scene,
    setScene: (value) => {
      scene = value;
    },
  };

  const lobby = createLobbyView(ctx);
  const game = createGameView(ctx);
  const results = createResultsView(ctx);

  host.start();

  function onHostChange(state, event) {
    if (destroyed) return;
    if (event?.message) toast(event.message, 'bad');
    if (event?.event === 'finish') play('win');
    render(state);
  }

  function render(state) {
    const nextMode = state.status === 'lobby' ? 'lobby' : 'game';
    if (nextMode !== mode) {
      mode = nextMode;
      build(state);
    }

    if (mode === 'lobby') lobby.update(state);
    else game.update(state);

    if (state.status === 'results') results.show(state);
    else results.hide();

    if (state.status !== lastStatus) {
      lastStatus = state.status;
      const closing = state.status === 'reveal' && (state.ko || state.round >= state.totalRounds);
      if (closing) duckMusic(0.16, 4500);
      else if (['countdown', 'question', 'reveal'].includes(state.status)) startMusic();
      else if (state.status === 'results') duckMusic();
      else stopMusic({ fade: 700 });
    }
  }

  function build(state) {
    destroyMode();
    if (mode === 'lobby') lobby.build(state);
    else game.build(state);
  }

  function destroyMode() {
    game.stopTimer();
    if (scene) {
      scene.destroy();
      scene = null;
    }
    results.hide();
    game.reset();
    root.innerHTML = '';
  }

  return () => {
    destroyed = true;
    stopMusic({ fade: 600 });
    game.stopTimer();
    scene?.destroy();
    results.hide();
    host.destroy();
  };
}
