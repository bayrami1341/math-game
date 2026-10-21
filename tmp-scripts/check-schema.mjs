import { validateCartridge } from '../public/math-game/src/v10/station/cartridge-schema.js';
import { readFileSync } from 'fs';
const path = process.argv[2];
const c = JSON.parse(readFileSync(path, 'utf8'));
const v = validateCartridge(c);
console.log(JSON.stringify(v));
console.log('engine-gate-ok:', v.ok, '| red:', v.gate.red, '| yellow:', v.gate.yellow);
