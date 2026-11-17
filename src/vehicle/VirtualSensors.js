import { CELL_SIZE } from '../grid/GridMap.js';

/**
 * Sensores Virtuales con Detección de Calzadas y Evasión Reactiva
 * Gestiona el cambio de carril (calzada izquierda de rebase) al detectar
 * obstáculos en el carril derecho y el retorno automático tras superarlo.
 */
export class VirtualSensors {
  constructor(gridMap) {
    this.gridMap = gridMap;
    this.currentLaneOffset = 0.0; // 0.0 = Carril Derecho, -0.96 = Carril Izquierdo
    this.isEvading = false;
    this.evasionTargetOffset = 0.0;
  }

  reset() {
    this.currentLaneOffset = 0.0;
    this.isEvading = false;
    this.evasionTargetOffset = 0.0;
  }

  /**
   * Lee sensores virtuales y computa maniobra de evasión lateral difusa
   */
  readSensors(carX, carZ, carHeading, carSpeed, trajectory, dt = 0.016) {
    if (!trajectory) {
      return {
        stopDistance: 10,
        distToObstacle: 10,
        distToGoal: 0,
        curveDifficulty: 0,
        lateralError: 0,
        headingErrorDeg: 0,
        isArrived: false,
        isEvading: false,
        rays: [
          { angle: -25, dist: 8 },
          { angle: 0, dist: 8 },
          { angle: 25, dist: 8 }
        ]
      };
    }

    const forwardX = Math.cos(carHeading);
    const forwardZ = Math.sin(carHeading);

    // 1. Detección de Obstáculos Físicos (Conos en carril der/izq/centro o Barricadas de bloqueo total)
    let nearestObsDistWorld = Infinity;
    let nearestObsIsBlocked = false;
    let nearestObsLane = null;

    for (let z = 0; z < this.gridMap.size; z++) {
      for (let x = 0; x < this.gridMap.size; x++) {
        if (this.gridMap.hasPhysicalObstacle(x, z)) {
          const obsList = this.gridMap.getObstaclePositions
            ? this.gridMap.getObstaclePositions(x, z)
            : [{ x: this.gridMap.gridToWorld(x, z).x, z: this.gridMap.gridToWorld(x, z).z, isBlocked: this.gridMap.getTile(x, z) === 3, lane: 'right', radius: 0.45 }];

          for (const obs of obsList) {
            const dx = obs.x - carX;
            const dz = obs.z - carZ;
            const forwardDist = dx * forwardX + dz * forwardZ;
            const lateralDist = Math.abs(dx * forwardZ - dz * forwardX);

            // Si el obstáculo está en un rango de hasta 15m y alineado con la calzada
            const lateralThreshold = obs.isBlocked ? 2.0 : 1.6;
            if (forwardDist > -1.5 && forwardDist < 15.0 && lateralDist < lateralThreshold) {
              if (forwardDist > -0.5 && forwardDist < nearestObsDistWorld) {
                nearestObsDistWorld = forwardDist;
                nearestObsIsBlocked = obs.isBlocked;
                nearestObsLane = obs.lane;
              }
            }
          }
        }
      }
    }

    // 2. Lógica de Evasión Lateral vs Detención por Bloqueo Total:
    const distToObstacle = nearestObsDistWorld !== Infinity
      ? nearestObsDistWorld / CELL_SIZE
      : 10.0;

    if (nearestObsIsBlocked) {
      // Bloqueo total (ambas calzadas cerradas): NO se puede esquivar, debe frenar en su carril
      this.isEvading = false;
      this.evasionTargetOffset = 0.0;
    } else if (distToObstacle < 3.2 && distToObstacle > 0.1) {
      if (nearestObsLane === 'right') {
        // Cono en carril derecho del auto: activar maniobra de adelantamiento por carril izquierdo (-0.96m)
        this.isEvading = true;
        this.evasionTargetOffset = -0.96;
      } else if (nearestObsLane === 'center') {
        // Cono en el centro: ceñirse al borde derecho (+0.25m)
        this.isEvading = true;
        this.evasionTargetOffset = 0.25;
      } else if (nearestObsLane === 'left') {
        // Cono en carril opuesto izquierdo: nuestro carril derecho está completamente despejado!
        this.isEvading = false;
        this.evasionTargetOffset = 0.0;
      }
    } else if (distToObstacle >= 3.2 && nearestObsDistWorld === Infinity) {
      this.isEvading = false;
      this.evasionTargetOffset = 0.0; // Retornar suavemente al carril derecho
    }

    // Suavizado de transición de carril (animación suave del offset)
    const transitionSpeed = 3.5; // m/s de transición lateral
    const diff = this.evasionTargetOffset - this.currentLaneOffset;
    this.currentLaneOffset += Math.sign(diff) * Math.min(Math.abs(diff), transitionSpeed * dt);

    // 3. Obtener telemetría de carril con el offset de evasión aplicado y velocidad actual
    const tracking = trajectory.getTrackingInfo(carX, carZ, carHeading, this.currentLaneOffset, carSpeed);

    // 4. Distancia de parada ante bloqueos totales, meta o emergencia
    const distToGoal = tracking.distanceToGoal / CELL_SIZE;
    let effectiveStopDistance = distToGoal;

    if (nearestObsIsBlocked) {
      effectiveStopDistance = Math.min(effectiveStopDistance, distToObstacle);
    } else if (nearestObsLane === 'right' && distToObstacle < 1.0 && Math.abs(this.currentLaneOffset) < 0.4) {
      // Si el obstáculo está en nuestro carril y no hemos terminado de esquivar, frenar por seguridad
      effectiveStopDistance = Math.min(effectiveStopDistance, distToObstacle);
    }

    // 5. Simulación de Rayos Láser Frontales
    const rayAngles = [-20, 0, 20];
    const rays = rayAngles.map(degOffset => {
      const rad = carHeading + (degOffset * Math.PI) / 180;
      const rayDirX = Math.cos(rad);
      const rayDirZ = Math.sin(rad);
      let rayDist = 7.0;

      for (let z = 0; z < this.gridMap.size; z++) {
        for (let x = 0; x < this.gridMap.size; x++) {
          if (this.gridMap.hasPhysicalObstacle(x, z)) {
            const obsList = this.gridMap.getObstaclePositions
              ? this.gridMap.getObstaclePositions(x, z)
              : [{ x: this.gridMap.gridToWorld(x, z).x, z: this.gridMap.gridToWorld(x, z).z, radius: 0.45 }];

            for (const obs of obsList) {
              const dx = obs.x - carX;
              const dz = obs.z - carZ;
              const proj = dx * rayDirX + dz * rayDirZ;
              const perp = Math.abs(dx * rayDirZ - dz * rayDirX);

              const hitRadius = obs.radius || 0.45;
              if (proj > 0.1 && proj < rayDist && perp < hitRadius) {
                rayDist = proj;
              }
            }
          }
        }
      }

      return { angle: degOffset, dist: rayDist };
    });

    // 6. Condición de Llegada
    const goalWorld = trajectory.goalPoint;
    const distDirectToGoal = Math.hypot(carX - goalWorld.x, carZ - goalWorld.z);
    const isArrived = (distDirectToGoal < 0.5) && (carSpeed < 0.25);

    // Añadir dificultad artificial durante la evasión para que el auto desacelere suavemente al rebasar
    const finalCurveDifficulty = this.isEvading 
      ? Math.max(tracking.curveDifficulty, 4.5) 
      : tracking.curveDifficulty;

    return {
      stopDistance: effectiveStopDistance,
      distToObstacle,
      distToGoal,
      curveDifficulty: finalCurveDifficulty,
      lateralError: tracking.lateralError / CELL_SIZE,
      headingErrorDeg: tracking.headingErrorDeg,
      isArrived,
      isEvading: this.isEvading,
      currentLaneOffset: this.currentLaneOffset,
      rays
    };
  }
}
