import { SpeedFuzzyController } from '../src/fuzzy/SpeedFuzzyController.js';
import { SteeringFuzzyController } from '../src/fuzzy/SteeringFuzzyController.js';
import { GridMap, TILE_ROAD, TILE_OBSTACLE, TILE_BLOCKED, TILE_START, TILE_GOAL } from '../src/grid/GridMap.js';
import { Pathfinder } from '../src/grid/Pathfinder.js';
import { TrajectoryGenerator } from '../src/grid/TrajectoryGenerator.js';
import { VirtualSensors } from '../src/vehicle/VirtualSensors.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('--- 1. VERIFICACIÓN DEL CONTROLADOR DIFUSO DE VELOCIDAD ---');
const speedCtrl = new SpeedFuzzyController();

const resCrit = speedCtrl.evaluate(0.5, 0.0, 5.0);
assert(!isNaN(resCrit.output), 'Salida no es NaN');
assert(resCrit.output < -0.4, `Frenado fuerte ante obstáculo cercano (esperado < -0.4, obtenido: ${resCrit.output.toFixed(2)})`);

const resAcc = speedCtrl.evaluate(9.0, 0.0, 0.5);
assert(resAcc.output > 0.4, `Aceleración fuerte en recta despejada (esperado > 0.4, obtenido: ${resAcc.output.toFixed(2)})`);

const resCurv = speedCtrl.evaluate(8.0, 9.0, 3.5);
assert(resCurv.output < 0.0, `Frenado preventivo antes de curva cerrada (esperado < 0.0, obtenido: ${resCurv.output.toFixed(2)})`);

console.log('\n--- 2. VERIFICACIÓN DEL CONTROLADOR DIFUSO DE DIRECCIÓN ---');
const steerCtrl = new SteeringFuzzyController();

const resCenter = steerCtrl.evaluate(0.0, 0.0);
assert(Math.abs(resCenter.output) < 1.0, `Vehículo centrado en carril va recto (esperado ~0°, obtenido: ${resCenter.output.toFixed(2)}°)`);

const resDivergeLeft = steerCtrl.evaluate(-1.0, -35.0);
assert(resDivergeLeft.output > 18.0, `Giro fuerte derecha ante desvío izquierdo (esperado > 18°, obtenido: ${resDivergeLeft.output.toFixed(2)}°)`);

const resDampedLeft = steerCtrl.evaluate(-0.8, 25.0);
assert(Math.abs(resDampedLeft.output) < 8.0, `Amortiguamiento activo evita sobregiro (esperado < 8°, obtenido: ${resDampedLeft.output.toFixed(2)}°)`);

console.log('\n--- 3. VERIFICACIÓN DE TRAYECTORIA DE 2 CALZADAS Y EVASIÓN ---');
const grid = new GridMap(10);
grid.setTile(2, 2, TILE_START);
grid.setTile(2, 3, TILE_ROAD);
grid.setTile(2, 4, TILE_ROAD);
grid.setTile(2, 5, TILE_ROAD);
grid.setTile(3, 5, TILE_ROAD);
grid.setTile(4, 5, TILE_ROAD);
grid.setTile(5, 5, TILE_GOAL);

const path = Pathfinder.findPath(grid);
assert(path !== null && path.length === 7, `A* encuentra camino de 7 casillas (obtenido: ${path?.length})`);

const trajectory = TrajectoryGenerator.generate(path, grid);
assert(trajectory !== null, 'Trayectoria de 2 calzadas generada');
assert(trajectory.points.length > 30, `Puntos densos generados (${trajectory.points.length})`);

// Verificar que el punto inicial está en el carril derecho (+0.48m de la línea central)
const firstPt = trajectory.points[0];
const centerPt = grid.gridToWorld(2, 2);
const laneDistance = Math.hypot(firstPt.x - centerPt.x, firstPt.z - centerPt.z);
assert(Math.abs(laneDistance - 0.48) < 0.05, `Auto posicionado en carril derecho (+0.48m del centro, obtenido: ${laneDistance.toFixed(2)}m)`);

// Verificar sensores y evasión
const sensors = new VirtualSensors(grid);
grid.setTile(2, 4, TILE_OBSTACLE); // Colocar obstáculo en el carril derecho
const readingsEvade = sensors.readSensors(firstPt.x, firstPt.z, firstPt.heading, 2.0, trajectory, 0.1);
assert(readingsEvade.isEvading === true, 'Sensor detecta obstáculo y activa maniobra de evasión');

console.log(`\n========================================`);
console.log(`RESULTADO DE TESTS: ${passed} PASADOS, ${failed} FALLADOS`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
