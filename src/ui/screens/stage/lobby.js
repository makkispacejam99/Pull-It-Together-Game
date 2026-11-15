import { MAX_PLAYERS } from '../../../core/host.js';
import { DIFFICULTIES } from '../../../core/questions.js';
import { isMuted, toggleMuted } from '../../../core/audio.js';
import { avatarSrc, copyText, esc } from '../../../core/utils.js';
import { createScene } from '../../../game/scene.js';
import { toast } from '../../toast.js';
import { toggleFullscreen } from './shared.js';

const ROUND_OPTIONS = [4, 6, 8, 10, 12];
const TIME_OPTIONS = [30, 45, 60, 90];

export function createLobbyView(ctx) {
  const { root, host, code, categories } = ctx;

  function build(state) {
    const inviteUrl = `${location.origin}${location.pathname}#/room/${code}`;

    root.innerHTML = `
      <div class="lobby-screen">
        <header class="topbar">
          <a class="brand" href="#/">
            <img src="assets/img/props/hud_player_pink.png" alt="">
            <span>PULL IT TOGETHER</span>
          </a>
          <div class="topbar__nav">
            <span class="chip chip--gold">Sala ${esc(code)}</span>
            <button class="btn btn--ghost btn--sm" data-audio>${isMuted() ? '♪̸' : '♪'}</button>
            <button class="btn btn--ghost btn--sm" data-fullscreen>Pantalla completa</button>
            <a class="btn btn--ghost btn--sm join__back" href="#/">Volver</a>
          </div>
        </header>

        <main class="lobby">
          <section class="lobby__invite panel">
            <p class="eyebrow">Código de sala</p>
            <p class="lobby__code">${esc(code)}</p>
            <button class="btn btn--primary" data-copy>Copiar invitación</button>
            <div class="lobby__link">
              <span>${esc(inviteUrl)}</span>
              <button type="button" class="lobby__link-copy" data-copy-link>Copiar</button>
            </div>
            <hr class="rule">
            <button class="btn btn--ghost btn--sm" data-open-player>Unirse como jugador</button>
            <p class="tiny muted">
              Comparte el enlace o código de la sala e ingresa en tu movil o navegador.
            </p>
          </section>

          <section class="lobby__teams">
            ${teamColumn('A', state)}
            ${teamColumn('B', state)}
          </section>

          <section class="lobby__config panel">
            <div class="config-group">
              <span class="field-label">Rondas</span>
              <div class="seg" data-seg="rounds">
                ${ROUND_OPTIONS.map(
                  (n) =>
                    `<button type="button" data-value="${n}" class="${
                      state.config.rounds === n ? 'is-on' : ''
                    }">${n}</button>`
                ).join('')}
              </div>
            </div>

            <div class="config-group">
              <span class="field-label">Tiempo por pregunta</span>
              <div class="seg" data-seg="duration">
                ${TIME_OPTIONS.map(
                  (n) =>
                    `<button type="button" data-value="${n}" class="${
                      state.config.duration === n ? 'is-on' : ''
                    }">${n}s</button>`
                ).join('')}
              </div>
            </div>

            <div class="config-group">
              <span class="field-label">Dificultad</span>
              <div class="seg" data-seg="difficulty">
                <button type="button" data-value="all" class="${
                  state.config.difficulty === 'all' ? 'is-on' : ''
                }">Todas</button>
                ${DIFFICULTIES.map(
                  (d) =>
                    `<button type="button" data-value="${d.id}" class="${
                      state.config.difficulty === d.id ? 'is-on' : ''
                    }">${d.label}</button>`
                ).join('')}
              </div>
            </div>

            <div class="config-group">
              <span class="field-label">Categorías</span>
              <div class="cat-list" data-cats>
                ${categories
                  .map(
                    (c) =>
                      `<button type="button" class="chip ${
                        state.config.categories.includes(c) ? 'is-on' : ''
                      }" data-cat="${esc(c)}">${esc(c)}</button>`
                  )
                  .join('')}
              </div>
            </div>

            <div class="lobby__start">
              <button class="btn btn--primary btn--lg btn--block" data-start>Empezar partida</button>
              <button class="btn btn--ghost btn--sm btn--block" data-bots>Completar con bots</button>
              <p class="lobby__hint" data-hint></p>
            </div>
          </section>
        </main>

        <div class="lobby__arena" data-scene></div>
      </div>
    `;

    const sceneHost = root.querySelector('[data-scene]');
    const scene = createScene({ mini: true });
    sceneHost.appendChild(scene.root);
    scene.update(state);
    ctx.setScene(scene);

    bindLobby(state, inviteUrl);
    update(state);
  }

  function teamColumn(team, state) {
    const name = state.teams[team].name;
    return `
      <div class="team-col team-col--${team.toLowerCase()}">
        <div class="team-col__head">
          <input class="team-col__name" data-team-name="${team}" value="${esc(name)}"
              maxlength="16" aria-label="Nombre del equipo ${team}">
          <span class="team-col__count" data-count="${team}">0</span>
        </div>
        <div class="team-col__list" data-list="${team}"></div>
      </div>`;
  }

  function bindLobby(state, inviteUrl) {
    root.querySelector('[data-audio]').addEventListener('click', (event) => {
      const muted = toggleMuted();
      event.currentTarget.textContent = muted ? '♪̸' : '♪';
    });

    root.querySelector('[data-fullscreen]').addEventListener('click', toggleFullscreen);

    root.querySelector('[data-copy]').addEventListener('click', async () => {
      await copyText(`Entra a Pull It Together con el código ${code}: ${inviteUrl}`);
      toast('Invitación copiada', 'ok');
    });

    root.querySelector('[data-copy-link]').addEventListener('click', async () => {
      await copyText(inviteUrl);
      toast('Enlace copiado', 'ok');
    });

    root.querySelector('[data-open-player]').addEventListener('click', () => {
      window.open(`${location.pathname}#/room/${code}`, '_blank', 'noopener');
    });

    root.querySelector('[data-start]').addEventListener('click', () => host.startGame());

    root.querySelector('[data-bots]').addEventListener('click', () => {
      host.addBots(4);
      toast('¡La CPU entra a la partida!', 'ok');
    });

    root.querySelector('[data-seg="rounds"]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button) return;
      host.configure({ rounds: Number(button.dataset.value) });
    });

    root.querySelector('[data-seg="duration"]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button) return;
      host.configure({ duration: Number(button.dataset.value) });
    });

    root.querySelector('[data-seg="difficulty"]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button) return;
      host.configure({ difficulty: button.dataset.value });
    });

    root.querySelector('[data-cats]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-cat]');
      if (!button) return;
      const cat = button.dataset.cat;
      const current = new Set(host.state.config.categories);
      if (current.has(cat)) current.delete(cat);
      else current.add(cat);
      host.configure({ categories: Array.from(current) });
    });

    root.querySelectorAll('[data-team-name]').forEach((input) => {
      input.addEventListener('change', () => {
        const team = input.dataset.teamName;
        if (!input.value.trim()) {
          input.value = host.state.teams[team].name;
          toast('El equipo necesita un nombre', 'bad');
          return;
        }
        host.setTeamName(team, input.value);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
      });
    });

    root.querySelectorAll('[data-list]').forEach((list) => {
      list.addEventListener('click', (event) => {
        const move = event.target.closest('[data-move]');
        if (move) {
          host.movePlayer(move.dataset.move, move.dataset.to);
          return;
        }
        const remove = event.target.closest('[data-remove]');
        if (!remove) return;
        host.removePlayer(remove.dataset.remove);
      });
    });
  }

  function update(state) {
    if (!root.querySelector('.lobby')) return;

    for (const team of ['A', 'B']) {
      const list = root.querySelector(`[data-list="${team}"]`);
      const count = root.querySelector(`[data-count="${team}"]`);
      const players = state.players.filter((p) => p.team === team);
      if (count) count.textContent = String(players.length);
      if (list) {
        list.innerHTML = players.length
          ? players
              .map(
                (p) => `
                <span class="player-chip ${p.connected ? '' : 'is-off'}" title="${esc(p.nickname)}">
                  <img src="${avatarSrc(p.avatar, 'idle')}" alt="">
                  <span>${esc(p.nickname)}</span>
                  ${p.isBot ? '<em style="font-style:normal;color:var(--text-mute);font-size:0.5rem">BOT</em>' : ''}
                  
                  <button class="player-chip__move player-chip__move--to-${p.team === 'A' ? 'b' : 'a'}" data-move="${esc(p.id)}" data-to="${p.team === 'A' ? 'B' : 'A'}" title="Mover al otro equipo" aria-label="Mover ${esc(
                    p.nickname
                  )} al otro equipo">${p.team === 'A' ? '→' : '←'}</button>

                  <button class="player-chip__x" data-remove="${esc(p.id)}" title="Quitar jugador" aria-label="Quitar ${esc(
                    p.nickname
                  )}">✕</button>
                  
                </span>`
              )
              .join('')
          : '<p class="team-col__empty">Esperando jugadores…</p>';
      }
    }

    const syncSeg = (name, value) => {
      root.querySelectorAll(`[data-seg="${name}"] button`).forEach((button) => {
        button.classList.toggle('is-on', button.dataset.value === String(value));
      });
    };
    syncSeg('rounds', state.config.rounds);
    syncSeg('duration', state.config.duration);
    syncSeg('difficulty', state.config.difficulty);
    root.querySelectorAll('[data-cat]').forEach((button) => {
      button.classList.toggle('is-on', state.config.categories.includes(button.dataset.cat));
    });

    const a = state.players.filter((p) => p.team === 'A').length;
    const b = state.players.filter((p) => p.team === 'B').length;
    const total = state.players.length;
    const hint = root.querySelector('[data-hint]');
    const startBtn = root.querySelector('[data-start]');
    if (hint) {
      hint.textContent =
        total === 0
          ? 'Juega con amigos o añade bots si quieres jugar solo.'
          : `${a} contra ${b} · ${total} de ${MAX_PLAYERS} jugadores dentro`;
    }
    if (startBtn) startBtn.disabled = !(a > 0 && b > 0);

    const botsBtn = root.querySelector('[data-bots]');
    if (botsBtn) botsBtn.textContent = state.players.some((p) => p.isBot) ? 'Añadir más bots' : 'Completar con bots';

    ctx.getScene()?.update(state);
  }

  return { build, update };
}
