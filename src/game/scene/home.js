import { createScene } from './index.js';

export function decorateHomeScene(container) {
  const scene = createScene();
  container.appendChild(scene.root);

  const demo = [
    { id: 'd1', nickname: 'Nova', team: 'A', avatar: 'green' },
    { id: 'd2', nickname: 'Pixel', team: 'A', avatar: 'yellow' },
    { id: 'd3', nickname: 'Connie', team: 'A', avatar: 'purple' },
    { id: 'd4', nickname: 'Mily', team: 'A', avatar: 'beige' },
    { id: 'd5', nickname: 'Luna', team: 'B', avatar: 'pink' },
    { id: 'd6', nickname: 'Nat', team: 'B', avatar: 'purple' },
    { id: 'd7', nickname: 'Pat', team: 'B', avatar: 'green' },
    { id: 'd8', nickname: 'Vega', team: 'B', avatar: 'yellow' },
  ];

  scene.update({
    status: 'reveal',
    players: demo,
    rope: 0,
  });

  let tick = 0;
  scene.root.__demoTimer = setInterval(() => {
    tick += 1;
    scene.update({
      status: 'reveal',
      players: demo,
      rope: Math.round(Math.sin(tick * 0.85) * 18),
    });
  }, 1100);

  return scene;
}
