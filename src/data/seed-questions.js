/* Banco de preguntas inicial */

import { CIENCIA } from './questions/ciencia.js';
import { GEOGRAFIA } from './questions/geografia.js';
import { HISTORIA } from './questions/historia.js';
import { NATURALEZA } from './questions/naturaleza.js';
import { ARTE } from './questions/arte.js';
import { LITERATURA } from './questions/literatura.js';
import { CINE } from './questions/cine.js';
import { MUSICA } from './questions/musica.js';
import { DEPORTES } from './questions/deportes.js';
import { TECNOLOGIA } from './questions/tecnologia.js';
import { CULTURA } from './questions/cultura.js';

export const SEED_QUESTIONS = [
  ...CIENCIA,
  ...GEOGRAFIA,
  ...HISTORIA,
  ...NATURALEZA,
  ...ARTE,
  ...LITERATURA,
  ...CINE,
  ...MUSICA,
  ...DEPORTES,
  ...TECNOLOGIA,
  ...CULTURA,
];

export const SEED_VERSION = 2;

