/* Toasts */

let root = null;

function getRoot() {
  if (!root) root = document.getElementById('toasts');
  return root;
}

export function toast(message, type = 'info', duration = 2800) {
  const host = getRoot();
  if (!host) return;

  const node = document.createElement('div');
  node.className = `toast${type === 'ok' ? ' toast--ok' : type === 'bad' ? ' toast--bad' : ''}`;
  node.textContent = message;
  host.appendChild(node);

  while (host.children.length > 3) host.firstElementChild.remove();

  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 220);
  }, duration);
}
