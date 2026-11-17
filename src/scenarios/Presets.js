import { TILE_EMPTY, TILE_ROAD, TILE_OBSTACLE, TILE_BLOCKED, TILE_START, TILE_GOAL, GRID_SIZE } from '../grid/GridMap.js';

/**
 * Escenarios Predefinidos para Demostraciones Académicas
 */
export class Presets {
  /**
   * Escenario 1: Pista con Curvas Cerradas (90°)
   * Evalúa la anticipación de curvatura, desaceleración difusa y giro amortiguado.
   */
  static loadSharpCurves(gridMap) {
    gridMap.clear();

    const roadTiles = [
      // Tramo inicial recto (Sur a Norte)
      { x: 3, z: 15, type: TILE_START },
      { x: 3, z: 14, type: TILE_ROAD },
      { x: 3, z: 13, type: TILE_ROAD },
      { x: 3, z: 12, type: TILE_ROAD },
      { x: 3, z: 11, type: TILE_ROAD },
      { x: 3, z: 10, type: TILE_ROAD },
      { x: 3, z: 9,  type: TILE_ROAD },
      { x: 3, z: 8,  type: TILE_ROAD },
      { x: 3, z: 7,  type: TILE_ROAD },
      { x: 3, z: 6,  type: TILE_ROAD },
      { x: 3, z: 5,  type: TILE_ROAD }, // Esquina 1 (giro al Este)

      // Tramo horizontal (Oeste a Este)
      { x: 4, z: 5,  type: TILE_ROAD },
      { x: 5, z: 5,  type: TILE_ROAD },
      { x: 6, z: 5,  type: TILE_ROAD },
      { x: 7, z: 5,  type: TILE_ROAD },
      { x: 8, z: 5,  type: TILE_ROAD },
      { x: 9, z: 5,  type: TILE_ROAD },
      { x: 10, z: 5, type: TILE_ROAD },
      { x: 11, z: 5, type: TILE_ROAD },
      { x: 12, z: 5, type: TILE_ROAD },
      { x: 13, z: 5, type: TILE_ROAD },
      { x: 14, z: 5, type: TILE_ROAD }, // Esquina 2 (giro al Sur)

      // Tramo vertical descendente
      { x: 14, z: 6,  type: TILE_ROAD },
      { x: 14, z: 7,  type: TILE_ROAD },
      { x: 14, z: 8,  type: TILE_ROAD },
      { x: 14, z: 9,  type: TILE_ROAD },
      { x: 14, z: 10, type: TILE_ROAD }, // Esquina 3 (giro al Oeste)

      // Tramo horizontal hacia el centro
      { x: 13, z: 10, type: TILE_ROAD },
      { x: 12, z: 10, type: TILE_ROAD },
      { x: 11, z: 10, type: TILE_ROAD },
      { x: 10, z: 10, type: TILE_ROAD },
      { x: 9, z: 10,  type: TILE_ROAD },
      { x: 8, z: 10,  type: TILE_ROAD },
      { x: 7, z: 10,  type: TILE_ROAD }, // Esquina 4 (giro al Sur)

      // Recta final a la meta
      { x: 7, z: 11, type: TILE_ROAD },
      { x: 7, z: 12, type: TILE_ROAD },
      { x: 7, z: 13, type: TILE_ROAD },
      { x: 7, z: 14, type: TILE_ROAD },
      { x: 7, z: 15, type: TILE_GOAL }
    ];

    for (const r of roadTiles) {
      gridMap.setTile(r.x, r.z, r.type);
    }
  }

  /**
   * Escenario 2: Carretera con Obstáculo Frontal
   * Evalúa la reacción difusa ante conos/barreras, la desaceleración suave y la parada segura.
   */
  static loadFrontalObstacle(gridMap) {
    gridMap.clear();

    const roadTiles = [];
    // Una larga avenida de Oeste a Este en z = 10
    for (let x = 2; x <= 17; x++) {
      let type = TILE_ROAD;
      let data = null;
      if (x === 2) type = TILE_START;
      else if (x === 17) type = TILE_GOAL;
      else if (x === 11) {
        type = TILE_OBSTACLE;
        data = { lane: 'right', angleDeg: 0 };
      }

      roadTiles.push({ x, z: 10, type, data });
    }

    for (const r of roadTiles) {
      gridMap.setTile(r.x, r.z, r.type, r.data);
    }
  }

  /**
   * Escenario 3: Intersección con Ruta Alternativa
   * Permite colocar un bloqueo dinámico en la ruta principal para ver la replanificación de A*
   * y cómo la lógica difusa ejecuta la transición suave al desvío.
   */
  static loadAlternativeRoute(gridMap) {
    gridMap.clear();

    const roadTiles = [
      // Origen común
      { x: 2, z: 10, type: TILE_START },
      { x: 3, z: 10, type: TILE_ROAD },
      { x: 4, z: 10, type: TILE_ROAD },
      { x: 5, z: 10, type: TILE_ROAD }, // Bifurcación

      // Camino Principal Recto (Directo pero con opción de bloqueo)
      { x: 6, z: 10, type: TILE_ROAD },
      { x: 7, z: 10, type: TILE_ROAD },
      { x: 8, z: 10, type: TILE_BLOCKED }, // Bloqueo inicial demostrativo
      { x: 9, z: 10, type: TILE_ROAD },
      { x: 10, z: 10, type: TILE_ROAD },
      { x: 11, z: 10, type: TILE_ROAD },
      { x: 12, z: 10, type: TILE_ROAD },
      { x: 13, z: 10, type: TILE_ROAD },

      // Desvío por el Norte
      { x: 5, z: 9,  type: TILE_ROAD },
      { x: 5, z: 8,  type: TILE_ROAD },
      { x: 5, z: 7,  type: TILE_ROAD },
      { x: 6, z: 7,  type: TILE_ROAD },
      { x: 7, z: 7,  type: TILE_ROAD },
      { x: 8, z: 7,  type: TILE_ROAD },
      { x: 9, z: 7,  type: TILE_ROAD },
      { x: 10, z: 7, type: TILE_ROAD },
      { x: 11, z: 7, type: TILE_ROAD },
      { x: 12, z: 7, type: TILE_ROAD },
      { x: 13, z: 7, type: TILE_ROAD },
      { x: 13, z: 8, type: TILE_ROAD },
      { x: 13, z: 9, type: TILE_ROAD },

      // Tramo final a meta común
      { x: 14, z: 10, type: TILE_ROAD },
      { x: 15, z: 10, type: TILE_ROAD },
      { x: 16, z: 10, type: TILE_ROAD },
      { x: 17, z: 10, type: TILE_GOAL }
    ];

    for (const r of roadTiles) {
      gridMap.setTile(r.x, r.z, r.type);
    }
  }
}
