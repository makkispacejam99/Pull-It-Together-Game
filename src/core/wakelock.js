let sentinel = null;
let wanted = false;

async function request() {
  if (!wanted || sentinel || typeof document === 'undefined') return;
  if (document.visibilityState !== 'visible' || !navigator.wakeLock) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

export async function holdScreenAwake() {
  wanted = true;
  await request();
}

export function releaseScreenAwake() {
  wanted = false;
  if (!sentinel) return;
  sentinel.release().catch(() => {});
  sentinel = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request();
  });
}
