import { readJSON, writeJSON } from '../utils.js';
import { hostDataKey } from './constants.js';

export function loadHostData(code) {
  return readJSON(hostDataKey(code), null);
}

export function saveHostData(code, data) {
  writeJSON(hostDataKey(code), data);
}
