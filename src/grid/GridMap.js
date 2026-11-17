/**
 * Cuadrícula de 20x20 casillas para FuzzyDrive 3D
 * Gestiona el estado de cada celda y su correspondencia con el espacio 3D.
 */

export const TILE_EMPTY = 0;
export const TILE_ROAD = 1;
export const TILE_OBSTACLE = 2; // Obstáculo físico (cono/barrera) sobre la carretera
export const TILE_BLOCKED = 3;  // Carretera bloqueada para A*
export const TILE_START = 4;    // Punto de partida del vehículo
export const TILE_GOAL = 5;     // Meta/Destino

export const GRID_SIZE = 20;
export const CELL_SIZE = 2.0;   // Tamaño en unidades 3D de cada casilla

export class GridMap {
  constructor(size = GRID_SIZE) {
    this.size = size;
    this.cells = new Array(size * size).fill(TILE_EMPTY);
    this.obstacleSettings = new Map(); // key `${x},${z}` -> { lane: 'right'|'left'|'center'|'both', angleDeg: 0 }
    this.startPos = null; // {x, z}
    this.goalPos = null;  // {x, z}
    this.listeners = [];
  }

  getIndex(x, z) {
    if (x < 0 || x >= this.size || z < 0 || z >= this.size) return -1;
    return z * this.size + x;
  }

  getTile(x, z) {
    const idx = this.getIndex(x, z);
    return idx === -1 ? TILE_EMPTY : this.cells[idx];
  }

  getObstacleData(x, z) {
    const raw = this.obstacleSettings.get(`${x},${z}`);
    if (!raw) return { lane: 'right', angleDeg: 0 };
    if (typeof raw === 'string') return { lane: raw, angleDeg: 0 };
    if (typeof raw === 'number') return { lane: 'right', angleDeg: raw };
    return { lane: raw.lane || 'right', angleDeg: raw.angleDeg || 0 };
  }

  setObstacleData(x, z, data) {
    const prev = this.getObstacleData(x, z);
    const updated = typeof data === 'string'
      ? { ...prev, lane: data }
      : (typeof data === 'number' ? { ...prev, angleDeg: data } : { ...prev, ...data });
    this.obstacleSettings.set(`${x},${z}`, updated);
    this.notifyChange();
  }

  cycleObstacleLane(x, z) {
    const cur = this.getObstacleData(x, z);
    const lanes = ['right', 'left', 'center', 'both'];
    const idx = lanes.indexOf(cur.lane);
    const nextLane = lanes[(idx + 1) % lanes.length];
    const nextAngle = (cur.angleDeg + 90) % 360;
    this.setObstacleData(x, z, { lane: nextLane, angleDeg: nextAngle });
    return nextLane;
  }

  cycleBlockedAngle(x, z) {
    const cur = this.getObstacleData(x, z);
    const angles = [0, 45, 90, 135];
    const curAngle = cur.angleDeg % 180;
    let idx = angles.indexOf(curAngle);
    if (idx === -1) idx = 0;
    const nextAngle = angles[(idx + 1) % angles.length];
    this.setObstacleData(x, z, { lane: 'both', angleDeg: nextAngle });
    return nextAngle;
  }

  getDefaultBlockedAngle(x, z) {
    const n = this.isRoad(x, z - 1);
    const s = this.isRoad(x, z + 1);
    const e = this.isRoad(x + 1, z);
    const w = this.isRoad(x - 1, z);

    if (n && s && !e && !w) {
      return 0; // Vía vertical pura (N-S)
    }
    if (e && w && !n && !s) {
      return 90; // Vía horizontal pura (E-W)
    }
    if (n && s) {
      return 0; // Vía continua vertical
    }
    if (e && w) {
      return 90; // Vía continua horizontal
    }
    if ((n || s) && !e && !w) {
      return 0; // Extremo vertical
    }
    if ((e || w) && !n && !s) {
      return 90; // Extremo horizontal
    }
    if ((n && e) || (s && w)) {
      return 135; // Curva NE o SW
    }
    if ((n && w) || (s && e)) {
      return 45; // Curva NW o SE
    }
    return 90;
  }

  getObstacleRotation(x, z) {
    return this.getObstacleData(x, z).angleDeg;
  }

  rotateObstacle(x, z) {
    const tile = this.getTile(x, z);
    if (tile === TILE_BLOCKED) {
      return this.cycleBlockedAngle(x, z);
    }
    return this.cycleObstacleLane(x, z);
  }

  getRoadNormal(x, z) {
    const n = this.isRoad(x, z - 1);
    const s = this.isRoad(x, z + 1);
    const e = this.isRoad(x + 1, z);
    const w = this.isRoad(x - 1, z);

    let nx = 0;
    let nz = 1; // Default E-W (+Z es carril derecho hacia +X)

    if ((n || s) && !e && !w) {
      // Carretera N-S (+X es carril derecho hacia +Z)
      nx = 1;
      nz = 0;
    } else if (n && e && !s && !w) {
      nx = -0.707; nz = 0.707;
    } else if (n && w && !s && !e) {
      nx = 0.707; nz = 0.707;
    } else if (s && e && !n && !w) {
      nx = -0.707; nz = -0.707;
    } else if (s && w && !n && !e) {
      nx = 0.707; nz = -0.707;
    }
    return { nx, nz };
  }

  getObstaclePositions(x, z) {
    const center = this.gridToWorld(x, z);
    const tile = this.getTile(x, z);
    if (tile === TILE_BLOCKED) {
      return [{ x: center.x, z: center.z, isBlocked: true, lane: 'both', radius: 1.0 }];
    }
    const data = this.getObstacleData(x, z);
    const norm = this.getRoadNormal(x, z);
    const offsetDist = 0.48;
    const positions = [];
    if (data.lane === 'right') {
      positions.push({ x: center.x + norm.nx * offsetDist, z: center.z + norm.nz * offsetDist, isBlocked: false, lane: 'right', radius: 0.45 });
    } else if (data.lane === 'left') {
      positions.push({ x: center.x - norm.nx * offsetDist, z: center.z - norm.nz * offsetDist, isBlocked: false, lane: 'left', radius: 0.45 });
    } else if (data.lane === 'center') {
      positions.push({ x: center.x, z: center.z, isBlocked: false, lane: 'center', radius: 0.45 });
    } else if (data.lane === 'both') {
      positions.push({ x: center.x + norm.nx * offsetDist, z: center.z + norm.nz * offsetDist, isBlocked: true, lane: 'right', radius: 0.45 });
      positions.push({ x: center.x - norm.nx * offsetDist, z: center.z - norm.nz * offsetDist, isBlocked: true, lane: 'left', radius: 0.45 });
    }
    return positions;
  }

  setTile(x, z, type, customData = null) {
    const idx = this.getIndex(x, z);
    if (idx === -1) return false;

    // Si colocamos START, limpiar el start previo
    if (type === TILE_START) {
      if (this.startPos) {
        const prevIdx = this.getIndex(this.startPos.x, this.startPos.z);
        this.cells[prevIdx] = TILE_ROAD;
      }
      this.startPos = { x, z };
    } else if (this.startPos && this.startPos.x === x && this.startPos.z === z) {
      this.startPos = null;
    }

    // Si colocamos GOAL, limpiar la meta previa
    if (type === TILE_GOAL) {
      if (this.goalPos) {
        const prevIdx = this.getIndex(this.goalPos.x, this.goalPos.z);
        this.cells[prevIdx] = TILE_ROAD;
      }
      this.goalPos = { x, z };
    } else if (this.goalPos && this.goalPos.x === x && this.goalPos.z === z) {
      this.goalPos = null;
    }

    if (type === TILE_OBSTACLE || type === TILE_BLOCKED) {
      if (typeof customData === 'string') {
        this.obstacleSettings.set(`${x},${z}`, { lane: customData, angleDeg: 0 });
      } else if (typeof customData === 'number') {
        this.obstacleSettings.set(`${x},${z}`, { lane: 'right', angleDeg: customData });
      } else if (customData && typeof customData === 'object') {
        this.obstacleSettings.set(`${x},${z}`, { lane: customData.lane || 'right', angleDeg: customData.angleDeg || 0 });
      } else {
        this.obstacleSettings.set(`${x},${z}`, { lane: 'right', angleDeg: 0 });
      }
    } else {
      this.obstacleSettings.delete(`${x},${z}`);
    }

    this.cells[idx] = type;
    this.notifyChange();
    return true;
  }

  /**
   * Determina si la casilla es de tipo carretera (transitable físicamente)
   */
  isRoad(x, z) {
    const t = this.getTile(x, z);
    return t === TILE_ROAD || t === TILE_OBSTACLE || t === TILE_BLOCKED || t === TILE_START || t === TILE_GOAL;
  }

  /**
   * Determina si A* puede trazar camino por aquí.
   * Las carreteras bloqueadas NO son transitables para A*.
   * Los obstáculos físicos SÍ son transitables por A* para permitir que el controlador difuso reaccione ante ellos.
   */
  isPassableForAStar(x, z) {
    const t = this.getTile(x, z);
    if (t === TILE_BLOCKED || t === TILE_EMPTY) return false;
    return t === TILE_ROAD || t === TILE_OBSTACLE || t === TILE_START || t === TILE_GOAL;
  }

  hasPhysicalObstacle(x, z) {
    const t = this.getTile(x, z);
    return t === TILE_OBSTACLE || t === TILE_BLOCKED;
  }

  getNeighbors(x, z, checkAStar = false) {
    const dirs = [
      { dx: 0, dz: -1 }, // Norte
      { dx: 1, dz: 0 },  // Este
      { dx: 0, dz: 1 },  // Sur
      { dx: -1, dz: 0 }  // Oeste
    ];
    const neighbors = [];
    for (const d of dirs) {
      const nx = x + d.dx;
      const nz = z + d.dz;
      if (nx >= 0 && nx < this.size && nz >= 0 && nz < this.size) {
        const valid = checkAStar ? this.isPassableForAStar(nx, nz) : this.isRoad(nx, nz);
        if (valid) {
          neighbors.push({ x: nx, z: nz });
        }
      }
    }
    return neighbors;
  }

  /**
   * Convierte coordenadas de cuadrícula (x, z) a coordenadas de mundo 3D (X, Z)
   */
  gridToWorld(x, z) {
    const half = (this.size * CELL_SIZE) / 2;
    return {
      x: x * CELL_SIZE - half + CELL_SIZE / 2,
      z: z * CELL_SIZE - half + CELL_SIZE / 2
    };
  }

  /**
   * Convierte coordenadas de mundo 3D (X, Z) a coordenadas de cuadrícula (x, z)
   */
  worldToGrid(wx, wz) {
    const half = (this.size * CELL_SIZE) / 2;
    const x = Math.floor((wx + half) / CELL_SIZE);
    const z = Math.floor((wz + half) / CELL_SIZE);
    if (x < 0 || x >= this.size || z < 0 || z >= this.size) return null;
    return { x, z };
  }

  onChange(listener) {
    this.listeners.push(listener);
  }

  notifyChange() {
    for (const cb of this.listeners) {
      cb();
    }
  }

  clear() {
    this.cells.fill(TILE_EMPTY);
    this.obstacleSettings.clear();
    this.startPos = null;
    this.goalPos = null;
    this.notifyChange();
  }

  toJSON() {
    return {
      size: this.size,
      cells: [...this.cells],
      obstacleSettings: Object.fromEntries(this.obstacleSettings),
      startPos: this.startPos,
      goalPos: this.goalPos
    };
  }

  fromJSON(data) {
    if (!data || !data.cells) return;
    this.size = data.size || GRID_SIZE;
    this.cells = [...data.cells];
    this.obstacleSettings.clear();
    if (data.obstacleSettings) {
      for (const [k, v] of Object.entries(data.obstacleSettings)) {
        this.obstacleSettings.set(k, v);
      }
    } else if (data.obstacleRotations) {
      for (const [k, v] of Object.entries(data.obstacleRotations)) {
        this.obstacleSettings.set(k, { lane: 'right', angleDeg: v });
      }
    }
    this.startPos = data.startPos || null;
    this.goalPos = data.goalPos || null;
    this.notifyChange();
  }
}
