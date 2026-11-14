import { clamp } from '../../core/utils.js';

export function pullEffect(root, delta, splitPct) {
  if (!delta) return;
  const cls = delta > 0 ? 'is-pulling-a' : 'is-pulling-b';
  root.classList.add(cls, 'is-shaking');
  setTimeout(() => root.classList.remove(cls, 'is-shaking'), 700);

  const label = document.createElement('div');
  label.className = 'pull-fx';
  label.textContent = `${delta > 0 ? '+' : ''}${delta}`;
  root.appendChild(label);
  setTimeout(() => label.remove(), 1200);

  const count = clamp(Math.round(Math.abs(delta) / 2) + 3, 4, 14);
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span');
    spark.className = 'spark';
    spark.style.left = `${splitPct}%`;
    spark.style.top = '50%';
    spark.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    spark.style.setProperty('--dy', `${(Math.random() - 0.5) * 90 - 20}px`);
    spark.style.background = Math.random() > 0.5 ? '#faba2d' : '#fff3cf';
    root.appendChild(spark);
    setTimeout(() => spark.remove(), 700);
  }
}
