export function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

export function confetti(root) {
  const layer = document.createElement('div');
  layer.className = 'confetti';
  const colors = ['#ffd05c', '#3ee0a0', '#ff5f92', '#7b86ff', '#f6eddc'];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty('--c', colors[Math.floor(Math.random() * colors.length)]);
    piece.style.setProperty('--d', `${2.4 + Math.random() * 2.2}s`);
    piece.style.setProperty('--delay', `${Math.random() * 0.9}s`);
    piece.style.animationDelay = `${Math.random() * 0.9}s`;
    piece.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
    layer.appendChild(piece);
  }
  root.appendChild(layer);
  setTimeout(() => layer.remove(), 6000);
}
