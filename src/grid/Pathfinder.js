/**
 * Algoritmo de Búsqueda de Rutas A* (A-Star) sobre Cuadrícula
 * Encuentra la secuencia óptima de casillas transitables entre Inicio y Meta.
 */

export class Pathfinder {
  /**
   * @param {GridMap} gridMap
   * @returns {Array<{x: number, z: number}> | null} Secuencia de casillas o null si no hay camino
   */
  static findPath(gridMap) {
    if (!gridMap.startPos || !gridMap.goalPos) return null;

    const start = gridMap.startPos;
    const goal = gridMap.goalPos;

    // Si inicio o meta no son transitables por A*
    if (!gridMap.isPassableForAStar(start.x, start.z) || !gridMap.isPassableForAStar(goal.x, goal.z)) {
      return null;
    }

    const key = (p) => `${p.x},${p.z}`;
    const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

    const openSet = [start];
    const openSetKeys = new Set([key(start)]);
    const cameFrom = new Map();

    const gScore = new Map();
    gScore.set(key(start), 0);

    const fScore = new Map();
    fScore.set(key(start), heuristic(start, goal));

    while (openSet.length > 0) {
      // Obtener nodo con menor fScore
      let currentIdx = 0;
      let lowestF = fScore.get(key(openSet[0])) ?? Infinity;
      for (let i = 1; i < openSet.length; i++) {
        const f = fScore.get(key(openSet[i])) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          currentIdx = i;
        }
      }

      const current = openSet[currentIdx];
      if (current.x === goal.x && current.z === goal.z) {
        // Reconstruir camino
        const path = [current];
        let currKey = key(current);
        while (cameFrom.has(currKey)) {
          const prev = cameFrom.get(currKey);
          path.unshift(prev);
          currKey = key(prev);
        }
        return path;
      }

      // Remover current de openSet
      openSet.splice(currentIdx, 1);
      openSetKeys.delete(key(current));

      const neighbors = gridMap.getNeighbors(current.x, current.z, true);
      const currentG = gScore.get(key(current)) ?? Infinity;

      for (const neighbor of neighbors) {
        const neighborKey = key(neighbor);
        const tentativeG = currentG + 1; // Costo unitario por casilla

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + heuristic(neighbor, goal);
          fScore.set(neighborKey, f);

          if (!openSetKeys.has(neighborKey)) {
            openSet.push(neighbor);
            openSetKeys.add(neighborKey);
          }
        }
      }
    }

    return null; // No hay ruta conectada
  }
}
