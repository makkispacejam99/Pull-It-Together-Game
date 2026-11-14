export function openModal(innerHTML) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = innerHTML;

  document.body.appendChild(backdrop);
  document.body.classList.add('is-locked');

  const close = () => {
    backdrop.remove();
    document.body.classList.remove('is-locked');
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelectorAll('[data-close], [data-cancel]').forEach((button) => {
    button.addEventListener('click', close);
  });

  return { backdrop, close };
}
