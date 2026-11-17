import { GridMap, TILE_ROAD, TILE_OBSTACLE, TILE_BLOCKED } from '../src/grid/GridMap.js';

console.log('--- TEST DE CONFIGURACIÓN Y POSICIONAMIENTO DE OBSTÁCULOS ---');

const grid = new GridMap(20);

// Crear un segmento de vía E-W en z=10 (desde x=5 hasta x=8)
for (let x = 5; x <= 8; x++) {
  grid.setTile(x, 10, TILE_ROAD);
}

// Colocar obstáculo en (6, 10) con carril derecho
grid.setTile(6, 10, TILE_OBSTACLE, { lane: 'right', angleDeg: 0 });
const data1 = grid.getObstacleData(6, 10);
if (data1.lane !== 'right') throw new Error(`Esperado 'right', obtenido ${data1.lane}`);
console.log('  ✓ PASS: Obstáculo inicial en carril derecho');

const positions1 = grid.getObstaclePositions(6, 10);
if (positions1.length !== 1 || positions1[0].lane !== 'right') throw new Error('Posición de cono derecho incorrecta');
console.log('  ✓ PASS: Generada 1 posición de cono en carril derecho');

// Ciclar carril: right -> left
const lane2 = grid.cycleObstacleLane(6, 10);
if (lane2 !== 'left') throw new Error(`Esperado 'left', obtenido ${lane2}`);
const positions2 = grid.getObstaclePositions(6, 10);
if (positions2.length !== 1 || positions2[0].lane !== 'left') throw new Error('Posición de cono izquierdo incorrecta');
console.log('  ✓ PASS: Ciclo a carril izquierdo correcto');

// Ciclar carril: left -> center
const lane3 = grid.cycleObstacleLane(6, 10);
if (lane3 !== 'center') throw new Error(`Esperado 'center', obtenido ${lane3}`);
const positions3 = grid.getObstaclePositions(6, 10);
if (positions3.length !== 1 || positions3[0].lane !== 'center') throw new Error('Posición de cono central incorrecta');
console.log('  ✓ PASS: Ciclo a centro correcto');

// Ciclar carril: center -> both
const lane4 = grid.cycleObstacleLane(6, 10);
if (lane4 !== 'both') throw new Error(`Esperado 'both', obtenido ${lane4}`);
const positions4 = grid.getObstaclePositions(6, 10);
if (positions4.length !== 2) throw new Error('Esperados 2 conos para lane=both');
console.log('  ✓ PASS: Ciclo a ambos carriles correcto (2 conos)');

// Serialización y deserialización
const json = grid.toJSON();
const gridNew = new GridMap(20);
gridNew.fromJSON(json);
const dataRestored = gridNew.getObstacleData(6, 10);
if (dataRestored.lane !== 'both') throw new Error('Fallo en persistencia de carril');
console.log('  ✓ PASS: Persistencia toJSON/fromJSON preserva configuración de carriles');

console.log('\n--- TEST DE BARRICADA DE BLOQUEO TOTAL (TILE_BLOCKED) ---');

// Orientación automática por carretera
const defaultAngleEW = grid.getDefaultBlockedAngle(7, 10);
if (defaultAngleEW !== 90) throw new Error(`Esperado 90° para vía E-W, obtenido ${defaultAngleEW}`);
console.log('  ✓ PASS: Orientación inteligente para vía E-W = 90° (barra transversal)');

// Crear un segmento N-S para probar orientación vertical
grid.setTile(5, 9, TILE_ROAD);
grid.setTile(5, 11, TILE_ROAD);
const defaultAngleNS = grid.getDefaultBlockedAngle(5, 10);
if (defaultAngleNS !== 0) throw new Error(`Esperado 0° para vía N-S, obtenido ${defaultAngleNS}`);
console.log('  ✓ PASS: Orientación inteligente para vía N-S = 0° (barra transversal)');

// Colocar bloqueo y rotarlo con clics
grid.setTile(7, 10, TILE_BLOCKED, { lane: 'both', angleDeg: 90 });
const bData0 = grid.getObstacleData(7, 10);
if (bData0.angleDeg !== 90) throw new Error('Ángulo inicial incorrecto');
console.log('  ✓ PASS: Bloqueo colocado a 90°');

// Ciclar ángulos (90 -> 135 -> 0 -> 45 -> 90)
const ang1 = grid.cycleBlockedAngle(7, 10);
if (ang1 !== 135) throw new Error(`Esperado 135°, obtenido ${ang1}`);
console.log('  ✓ PASS: Clic 1 rota a 135° (Diagonal ╲)');

const ang2 = grid.cycleBlockedAngle(7, 10);
if (ang2 !== 0) throw new Error(`Esperado 0°, obtenido ${ang2}`);
console.log('  ✓ PASS: Clic 2 rota a 0° (Horizontal ═)');

const ang3 = grid.cycleBlockedAngle(7, 10);
if (ang3 !== 45) throw new Error(`Esperado 45°, obtenido ${ang3}`);
console.log('  ✓ PASS: Clic 3 rota a 45° (Diagonal ╱)');

const ang4 = grid.cycleBlockedAngle(7, 10);
if (ang4 !== 90) throw new Error(`Esperado 90°, obtenido ${ang4}`);
console.log('  ✓ PASS: Clic 4 retorna a 90° (Vertical ║)');

console.log('\n>>> TODOS LOS TESTS DE OBSTÁCULOS Y BLOQUEOS PASARON CON ÉXITO <<<');
