const PRAISE = ['¡Genial!', '¡Excelente!', '¡Fantástico!', '¡Imparable!'];
const MISS = ['¡Casi!', '¡Ánimo!', '¡No te rindas!'];
let prevStreak = 0;

export function showFeedback(main, { correct, voted, streak, round, ms }) {
    const before = round <= 1 ? 0 : prevStreak;
    prevStreak = streak;

    let text;
    let tone;
    let count = 0;
    if (correct) {
    text = streak === 1 && ms > 0 && ms < 3000 ? '¡Rayo!' : PRAISE[Math.min(streak, PRAISE.length) - 1];
    tone = 'ok';
    count = streak;
        } else if (before >= 2) {
    text = 'Racha perdida';
    tone = 'lost';
    count = before;
        } else if (!voted) {
    text = '¡No te duermas!';
    tone = 'miss';
        } else {
    text = MISS[Math.floor(Math.random() * MISS.length)];
    tone = 'miss';
        }

    main.querySelector('.fb-toast')?.remove();
    const el = document.createElement('div');
    el.className = `fb-toast fb-toast--${tone}`;
    el.innerHTML = `<span>${text}</span>${count >= 2 ? `<b class="fb-toast__count">×${count}</b>` : ''}`;
    (main.querySelector('.reveal-card') || main).appendChild(el);
    setTimeout(() => el.remove(), 2600);
}