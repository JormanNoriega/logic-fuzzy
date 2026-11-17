import { GridMap, TILE_START, TILE_ROAD, TILE_GOAL, TILE_OBSTACLE } from '../src/grid/GridMap.js';
import { Pathfinder } from '../src/grid/Pathfinder.js';
import { TrajectoryGenerator } from '../src/grid/TrajectoryGenerator.js';
import { SteeringFuzzyController } from '../src/fuzzy/SteeringFuzzyController.js';
import { SpeedFuzzyController } from '../src/fuzzy/SpeedFuzzyController.js';
import { CarKinematics } from '../src/vehicle/CarKinematics.js';
import { Presets } from '../src/scenarios/Presets.js';

console.log('===============================================================');
console.log('   BATERÍA DE PRUEBAS DETERMINISTAS - ETAPA 1 (CONDUCCIÓN)     ');
console.log('===============================================================\n');

let allPassed = true;

function assert(condition, testName, metrics = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName} ${metrics ? `[${metrics}]` : ''}`);
  } else {
    console.error(`  ✗ FAIL: ${testName} ${metrics ? `[${metrics}]` : ''}`);
    allPassed = false;
  }
}

// ---------------------------------------------------------------------
// PRUEBA 1: Consistencia de Signos y Convergencia en Línea Recta
// ---------------------------------------------------------------------
console.log('--- PRUEBA 1: Convergencia de Error Lateral en Recta (Estabilidad de Lazo Cerrado) ---');
{
  const g = new GridMap(15);
  for (let x = 2; x <= 12; x++) {
    g.setTile(x, 5, x === 2 ? TILE_START : (x === 12 ? TILE_GOAL : TILE_ROAD));
  }
  const traj = TrajectoryGenerator.generate(Pathfinder.findPath(g), g);
  const steerCtrl = new SteeringFuzzyController();
  const speedCtrl = new SpeedFuzzyController();

  // Test 1A: Auto desplazado a la DERECHA (+0.35m de error lateral)
  {
    const car = new CarKinematics();
    const startPt = traj.points[0];
    // Colocar a la derecha (eje +Z)
    car.reset(startPt.x, startPt.z + 0.35, traj.points[5].heading);

    let finalLatErr = 0;
    for (let step = 0; step < 80; step++) {
      const trk = traj.getTrackingInfo(car.x, car.z, car.heading, 0, car.speed);
      const spd = speedCtrl.evaluate(trk.distanceToGoal / 2.0, trk.curveDifficulty, car.speed);
      const str = steerCtrl.evaluate(trk.lateralError / 2.0, trk.headingErrorDeg);
      car.step(spd.output, (str.output * Math.PI) / 180, 0.04);
      finalLatErr = trk.lateralError;
    }
    assert(Math.abs(finalLatErr) < 0.08, 'Corrección de desviación derecha (+0.35m)', `Error final: ${finalLatErr.toFixed(3)}m`);
  }

  // Test 1B: Auto desplazado a la IZQUIERDA (-0.35m de error lateral)
  {
    const car = new CarKinematics();
    const startPt = traj.points[0];
    // Colocar a la izquierda (eje -Z)
    car.reset(startPt.x, startPt.z - 0.35, traj.points[5].heading);

    let finalLatErr = 0;
    for (let step = 0; step < 80; step++) {
      const trk = traj.getTrackingInfo(car.x, car.z, car.heading, 0, car.speed);
      const spd = speedCtrl.evaluate(trk.distanceToGoal / 2.0, trk.curveDifficulty, car.speed);
      const str = steerCtrl.evaluate(trk.lateralError / 2.0, trk.headingErrorDeg);
      car.step(spd.output, (str.output * Math.PI) / 180, 0.04);
      finalLatErr = trk.lateralError;
    }
    assert(Math.abs(finalLatErr) < 0.08, 'Corrección de desviación izquierda (-0.35m)', `Error final: ${finalLatErr.toFixed(3)}m`);
  }
}

// ---------------------------------------------------------------------
// PRUEBA 2: Arranque desde Reposo vs. Detención ante Obstáculo Peligroso
// ---------------------------------------------------------------------
console.log('\n--- PRUEBA 2: Arranque desde Reposo y Seguridad ante Obstáculos Inmediatos ---');
{
  const speedCtrl = new SpeedFuzzyController();

  // Caso 2A: Reposo con curva adelante a 3 casillas, vía despejada
  const resCurveStart = speedCtrl.evaluate(6.0, 8.5, 0.0);
  assert(resCurveStart.output > 0.20, 'Arranque hacia curva con vía despejada', `Salida acel: ${resCurveStart.output.toFixed(2)}`);

  // Caso 2B: Reposo con obstáculo inmediatamente adelante (d = 0.8 casillas)
  const resDanger = speedCtrl.evaluate(0.8, 8.5, 0.0);
  assert(resDanger.output <= 0.0, 'Bloqueo seguro: NO acelera con obstáculo inmediato', `Salida acel: ${resDanger.output.toFixed(2)}`);

  // Caso 2C: Reposo en la meta (d = 0.3 casillas)
  const resAtGoal = speedCtrl.evaluate(0.3, 0.0, 0.0);
  assert(resAtGoal.output <= 0.0, 'Bloqueo seguro: NO acelera al estar en destino', `Salida acel: ${resAtGoal.output.toFixed(2)}`);
}

// ---------------------------------------------------------------------
// PRUEBA 3: Trazado Completo de Curva de 90° (Métricas Cuantitativas)
// ---------------------------------------------------------------------
console.log('\n--- PRUEBA 3: Seguimiento Continuo de Curva de 90° ---');
{
  const g = new GridMap(15);
  // Recta de 5 casillas, curva 90° a la derecha (Este a Sur), recta de 5 casillas
  for (let x = 2; x <= 7; x++) g.setTile(x, 4, TILE_ROAD);
  for (let z = 5; z <= 10; z++) g.setTile(7, z, TILE_ROAD);
  g.setTile(2, 4, TILE_START);
  g.setTile(7, 10, TILE_GOAL);

  const traj = TrajectoryGenerator.generate(Pathfinder.findPath(g), g);
  const steerCtrl = new SteeringFuzzyController();
  const speedCtrl = new SpeedFuzzyController();
  const car = new CarKinematics();

  const startPt = traj.points[0];
  car.reset(startPt.x, startPt.z, traj.points[5].heading);
  traj.resetTracking();

  let maxLatErr = 0;
  let maxHeadErr = 0;
  let minSpeedInCorner = Infinity;
  let completed = false;
  let steps = 0;

  for (let s = 0; s < 500; s++) {
    steps++;
    const trk = traj.getTrackingInfo(car.x, car.z, car.heading, 0, car.speed);
    const spd = speedCtrl.evaluate(trk.distanceToGoal / 2.0, trk.curveDifficulty, car.speed);
    const str = steerCtrl.evaluate(trk.lateralError / 2.0, trk.headingErrorDeg);

    car.step(spd.output, (str.output * Math.PI) / 180, 0.04);

    maxLatErr = Math.max(maxLatErr, Math.abs(trk.lateralError));
    maxHeadErr = Math.max(maxHeadErr, Math.abs(trk.headingErrorDeg));

    if (trk.curveDifficulty > 4.0) {
      minSpeedInCorner = Math.min(minSpeedInCorner, car.speed);
    }

    if (trk.distanceToGoal < 0.45 && car.speed < 0.3) {
      completed = true;
      break;
    }
  }

  const completionPct = completed ? 100 : Math.round((1 - (traj.getTrackingInfo(car.x, car.z, car.heading).distanceToGoal / traj.totalLength)) * 100);

  console.log(`  Métricas de Curva 90°:`);
  console.log(`    - Error lateral máximo: ${maxLatErr.toFixed(3)} m (Límite carril: 0.50 m)`);
  console.log(`    - Error angular máximo: ${maxHeadErr.toFixed(1)}°`);
  console.log(`    - Velocidad en curva: ${minSpeedInCorner.toFixed(2)} u/s`);
  console.log(`    - Recorrido completado: ${completionPct}% en ${steps} pasos`);

  assert(maxLatErr < 0.35, 'Permanece dentro del carril durante el giro (< 0.35m)', `Max: ${maxLatErr.toFixed(3)}m`);
  assert(completed, 'Llega y se detiene en la meta tras la curva', `Completado: ${completionPct}%`);
}

// ---------------------------------------------------------------------
// PRUEBA 4: Circuito con Curvas Consecutivas en S
// ---------------------------------------------------------------------
console.log('\n--- PRUEBA 4: Circuito de Curvas Consecutivas en S ---');
{
  const g = new GridMap(20);
  // Cargar preset de curvas cerradas del simulador
  Presets.loadSharpCurves(g);

  const traj = TrajectoryGenerator.generate(Pathfinder.findPath(g), g);
  const steerCtrl = new SteeringFuzzyController();
  const speedCtrl = new SpeedFuzzyController();
  const car = new CarKinematics();

  const startPt = traj.points[0];
  car.reset(startPt.x, startPt.z, traj.points[5].heading);
  traj.resetTracking();

  let maxLatErr = 0;
  let maxHeadErr = 0;
  let completed = false;
  let steps = 0;

  for (let s = 0; s < 1600; s++) {
    steps++;
    const trk = traj.getTrackingInfo(car.x, car.z, car.heading, 0, car.speed);
    const spd = speedCtrl.evaluate(trk.distanceToGoal / 2.0, trk.curveDifficulty, car.speed);
    const str = steerCtrl.evaluate(trk.lateralError / 2.0, trk.headingErrorDeg);

    car.step(spd.output, (str.output * Math.PI) / 180, 0.04);

    maxLatErr = Math.max(maxLatErr, Math.abs(trk.lateralError));
    maxHeadErr = Math.max(maxHeadErr, Math.abs(trk.headingErrorDeg));

    if (trk.distanceToGoal < 0.45 && car.speed < 0.3) {
      completed = true;
      break;
    }
  }

  const trkEnd = traj.getTrackingInfo(car.x, car.z, car.heading);
  const completionPct = completed ? 100 : Math.round((1 - (trkEnd.distanceToGoal / traj.totalLength)) * 100);

  console.log(`  Métricas de Curvas en S:`);
  console.log(`    - Error lateral máximo: ${maxLatErr.toFixed(3)} m`);
  console.log(`    - Error angular máximo: ${maxHeadErr.toFixed(1)}°`);
  console.log(`    - Recorrido completado: ${completionPct}% (${steps} pasos)`);

  assert(maxLatErr < 0.40, 'Mantiene el carril en curvas consecutivas (< 0.40m)', `Max: ${maxLatErr.toFixed(3)}m`);
  assert(completed, 'Completa el circuito de curvas y llega a la meta', `Progreso: ${completionPct}%`);
}

console.log('\n===============================================================');
console.log(allPassed ? '>>> RESULTADO FINAL ETAPA 1: TODAS LAS PRUEBAS SUPERADAS <<<' : '>>> HUBO FALLOS EN LAS PRUEBAS <<<');
console.log('===============================================================\n');

if (!allPassed) process.exit(1);
