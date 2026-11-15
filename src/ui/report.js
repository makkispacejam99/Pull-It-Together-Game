import { openModal } from './modal.js';
import { toast } from './toast.js';

const ENDPOINT = 'https://api.web3forms.com/submit';
const ACCESS_KEY = '2400502d-b0d2-42ab-9b61-b60a871408cf';
const COOLDOWN_MS = 60000;
const LAST_KEY = 'pit:last-report';

export function openReport() {
const { backdrop, close } = openModal(`
    <form class="modal panel" data-report-form>
        <div class="modal__head">
            <h2 class="modal__title">Reportar un problema</h2>
            <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
        </div>

        <div class="modal__body">
            <div class="field">
                <label for="rp-type">Tipo</label>
                <select class="input" id="rp-type" name="type">
                <option>Error o bug</option>
                <option>Sugerencia</option>
                <option>Otro</option>
            </select>
        </div>

        <div class="field">
            <label for="rp-msg">¿Qué pasó?</label>
            <textarea class="input" id="rp-msg" name="message" rows="5" maxlength="1000" required placeholder="Cuéntanos qué viste y en qué pantalla pasó"></textarea>
        </div>

        <div class="field">
            <label for="rp-mail">Tu correo (opcional)</label>
            <input class="input" id="rp-mail" name="email" type="email" maxlength="120" placeholder="Solo si quieres que te respondamos">
        </div>

            <input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" style="display:none">
        </div>

        <div class="modal__foot">
            <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
            <button type="submit" class="btn btn--primary" data-send>Enviar</button>
        </div>
    </form>
    `);

    const form = backdrop.querySelector('[data-report-form]');
    const send = form.querySelector('[data-send]');

    form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (data.get('botcheck')) {
        close();
        return;
    }

    let last = 0;
    try {
        last = Number(localStorage.getItem(LAST_KEY)) || 0;
    } catch {}
        if (Date.now() - last < COOLDOWN_MS) {
        toast('Espera un momento antes de enviar otro reporte', 'bad');
        return;
    }

    send.disabled = true;
    send.textContent = 'Enviando…';

    try {
    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            access_key: ACCESS_KEY,
            subject: `[Pull It Together] ${data.get('type')}`,
            from_name: 'Pull It Together',
            type: data.get('type'),
            message: data.get('message'),
            email: data.get('email') || undefined,
            page: location.href,
            browser: navigator.userAgent,
            }),
        });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || 'error');

    try {
        localStorage.setItem(LAST_KEY, String(Date.now()));
        } catch {}
        showSent(form, close);
    } catch {
        toast('No se pudo enviar. Intenta de nuevo', 'bad');
        send.disabled = false;
        send.textContent = 'Enviar';
        }
    });
}

function showSent(form, close) {
    form.innerHTML = `
        <div class="modal__head">
            <h2 class="modal__title">¡Mensaje enviado!</h2>
            <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
        </div>

        <div class="modal__body report-sent">
            <svg class="report-sent__icon" viewBox="0 0 9 6" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M0 3h2v1H0zM1 4h2v1H1zM2 5h2v1H2zM3 4h2v1H3zM4 3h2v1H4zM5 2h2v1H5zM6 1h2v1H6zM7 0h2v1H7z"/>
            </svg>
            <p class="report-sent__title">Tu mensaje ya fue enviado a nuestro equipo de desarrollo.</p>
            <p class="muted tiny">Gracias por ayudarnos a mejorar Pull It Together. Ya puedes cerrar esta ventana.</p>
        </div>

        <div class="modal__foot">
            <button type="button" class="btn btn--primary" data-done>Cerrar</button>
        </div>
    `;
    form.querySelectorAll('[data-close], [data-done]').forEach((button) => {
    button.addEventListener('click', close);
    });
}