/* Pantalla de Unirse a Sala */

import { fetchSnapshot, loadMe, loadSnapshot, saveMe } from '../../net/bus.js';
import { AVATARS, avatarSrc, esc, readJSON, uid, writeJSON } from '../../core/utils.js';
import { toast } from '../toast.js';

const NICK_KEY = 'tyg.nickname';

async function probeRoom(code) {
  const remote = await fetchSnapshot(code);
  return Boolean(remote && remote.code === code);
}

export function renderJoin(root, params = {}) {
  const fixedCode = String(params.code || '').toUpperCase().slice(0, 5);
  const snapshot = fixedCode ? loadSnapshot(fixedCode) : null;
  const existing = fixedCode ? loadMe(fixedCode) : null;

  if (fixedCode && existing && snapshot?.players?.some((p) => p.id === existing.id)) {
    location.hash = `#/play/${fixedCode}`;
    return null;
  }

  const remembered = readJSON(NICK_KEY, '');
  let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)].id;

  root.innerHTML = `
    <div class="join">
      <div class="join__card panel">
        <div class="join__head">
          <p class="eyebrow">Entrar a la sala</p>
          ${
            fixedCode
              ? `<p class="join__code">${esc(fixedCode)}</p>`
              : `<p class="muted tiny">Escribe el código que te compartió el anfitrión.</p>`
          }
        </div>

        <form class="field" data-form novalidate>
          ${
            fixedCode
              ? ''
              : `<label for="code">Código de sala</label>
                 <input class="input input--code" id="code" name="code" maxlength="5" autocomplete="off"
                        spellcheck="false" placeholder="ABC12" value="" required>`
          }

          <label for="nick">Tu apodo</label>
          <input class="input" id="nick" name="nick" maxlength="14" autocomplete="nickname"
                 placeholder="Ej. Nova" value="${esc(remembered)}" required>

          <p class="tiny muted" style="text-align:center">
            Tu equipo se asigna al azar al entrar.
          </p>

          <div class="field">
            <span class="field-label">Tu personaje</span>
            <div class="avatar-pick">
              <div class="avatar-pick__view">
                <img data-avatar-view src="${avatarSrc(avatar, 'idle')}" alt="">
              </div>
              <div class="avatar-pick__info">
                <p class="avatar-pick__label">Elige tu color</p>
                <div class="avatar-row" data-avatars>
                  ${AVATARS.map(
                    (a) => `
                    <button type="button" class="avatar-dot${a.id === avatar ? ' is-on' : ''}"
                            data-avatar="${a.id}" title="${a.label}" aria-label="${a.label}">
                      <img src="${avatarSrc(a.id, 'idle')}" alt="">
                    </button>`
                  ).join('')}
                </div>
              </div>
            </div>
          </div>

          <p class="join__error" data-error hidden></p>

          <button class="btn btn--primary btn--lg btn--block" type="submit">Entrar a la partida</button>
        </form>
      </div>
    </div>
  `;

  const form = root.querySelector('[data-form]');
  const errorBox = root.querySelector('[data-error]');
  const nickInput = root.querySelector('#nick');
  const codeInput = root.querySelector('#code');
  const avatarView = root.querySelector('[data-avatar-view]');
  const submitBtn = form.querySelector('button[type="submit"]');

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  root.querySelector('[data-avatars]').addEventListener('click', (event) => {
    const button = event.target.closest('[data-avatar]');
    if (!button) return;
    avatar = button.dataset.avatar;
    avatarView.src = avatarSrc(avatar, 'idle');
    root.querySelectorAll('[data-avatar]').forEach((b) => b.classList.toggle('is-on', b === button));
  });

  if (codeInput) {
    codeInput.addEventListener('input', () => {
      const clean = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (codeInput.value !== clean) codeInput.value = clean;
      errorBox.hidden = true;
    });
  }

  nickInput.addEventListener('input', () => {
    errorBox.hidden = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const code = (fixedCode || codeInput?.value || '').toUpperCase().trim();
    const nickname = nickInput.value.trim().replace(/[<>]/g, '');

    if (code.length !== 5) {
      showError('El código tiene 5 caracteres. Revísalo.');
      return;
    }
    if (nickname.length < 2) {
      showError('Pon un apodo de al menos 2 caracteres.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Conectando…';

    const exists = await probeRoom(code);
    if (!exists) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar a la partida';
      showError('No encontramos esa sala. Revisa el código o pide al anfitrión que la abra.');
      return;
    }

    writeJSON(NICK_KEY, nickname);

    const previous = loadMe(code);
    const me = {
      id: previous?.id || uid('p_'),
      nickname,
      team: 'auto',
      avatar,
    };
    saveMe(code, me);

    toast('Entrando a la sala…', 'ok', 1400);
    location.hash = `#/play/${code}`;
  });

  if (!fixedCode) setTimeout(() => codeInput?.focus(), 60);

  return null;
}
