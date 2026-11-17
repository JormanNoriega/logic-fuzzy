import * as THREE from 'three';
import { TILE_EMPTY, TILE_ROAD, TILE_OBSTACLE, TILE_BLOCKED, TILE_START, TILE_GOAL, CELL_SIZE } from '../grid/GridMap.js';
import { Presets } from '../scenarios/Presets.js';
import { Storage } from '../scenarios/Storage.js';
import { CAMERA_ISOMETRIC, CAMERA_TOP_DOWN, CAMERA_CHASE } from './CameraManager.js';

export const TOOL_ROAD = 'road';
export const TOOL_OBSTACLE = 'obstacle';
export const TOOL_BLOCKED = 'blocked';
export const TOOL_START = 'start';
export const TOOL_GOAL = 'goal';
export const TOOL_ERASER = 'eraser';

/**
 * Barra de Herramientas, Controles de Simulación y Gestor de Interacción del Ratón
 */
export class Toolbar {
  constructor({
    gridMap,
    roadGeometry,
    cameraManager,
    camera,
    scene,
    domElements,
    onSimulationToggle,
    onSimulationReset,
    onSpeedMultiplierChange,
    onVariableSelected
  }) {
    this.gridMap = gridMap;
    this.roadGeometry = roadGeometry;
    this.cameraManager = cameraManager;
    this.camera = camera;
    this.scene = scene;
    this.elements = domElements;
    this.onSimulationToggle = onSimulationToggle;
    this.onSimulationReset = onSimulationReset;
    this.onSpeedMultiplierChange = onSpeedMultiplierChange;
    this.onVariableSelected = onVariableSelected;

    this.activeTool = TOOL_ROAD;
    this.isMouseDown = false;
    this.lastPaintedCell = null;
    this.isSimulating = false;
    this.currentObstacleLane = 'right'; // 'right', 'left', 'center', 'both'
    this.currentObstacleRotation = 0; // 0, 90, 180, 270 grados
    this.currentBlockedAngle = 90; // 0 (═), 45 (╱), 90 (║), 135 (╲)
    this.hoveredCell = null;

    // Cursor 3D de selección sobre la cuadrícula
    this.hoverCursor = this.createHoverCursor();
    this.scene.add(this.hoverCursor);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.initUI();
    this.initMouseEvents();
    this.initKeyboardEvents();
    this.updateRotateBadge();
  }

  createHoverCursor() {
    const geo = new THREE.BoxGeometry(CELL_SIZE * 0.98, 0.05, CELL_SIZE * 0.98);
    const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.6 });
    const cursor = new THREE.Mesh(geo, mat);
    cursor.visible = false;
    return cursor;
  }

  initKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        this.rotateCurrentObstacle();
      }
    });
  }

  rotateCurrentObstacle() {
    if (this.hoveredCell && this.gridMap.hasPhysicalObstacle(this.hoveredCell.x, this.hoveredCell.z)) {
      const tile = this.gridMap.getTile(this.hoveredCell.x, this.hoveredCell.z);
      if (tile === TILE_BLOCKED) {
        const nextAngle = this.gridMap.cycleBlockedAngle(this.hoveredCell.x, this.hoveredCell.z);
        this.currentBlockedAngle = nextAngle;
        this.updateRotateBadge(`${nextAngle}°`);
      } else {
        const nextLane = this.gridMap.cycleObstacleLane(this.hoveredCell.x, this.hoveredCell.z);
        this.currentObstacleLane = nextLane;
        this.currentObstacleRotation = this.gridMap.getObstacleRotation(this.hoveredCell.x, this.hoveredCell.z);
        this.updateRotateBadge(nextLane);
      }
    } else if (this.activeTool === TOOL_BLOCKED) {
      const angles = [0, 45, 90, 135];
      const idx = angles.indexOf(this.currentBlockedAngle);
      this.currentBlockedAngle = angles[(idx + 1) % angles.length];
      this.updateRotateBadge(`${this.currentBlockedAngle}°`);
    } else {
      const lanes = ['right', 'left', 'center', 'both'];
      const idx = lanes.indexOf(this.currentObstacleLane);
      this.currentObstacleLane = lanes[(idx + 1) % lanes.length];
      this.currentObstacleRotation = (this.currentObstacleRotation + 90) % 360;
      this.updateRotateBadge(this.currentObstacleLane);
    }
    if (this.onSimulationReset) this.onSimulationReset();
  }

  updateRotateBadge(val = null) {
    const badge = document.getElementById('rotBadge');
    if (!badge) return;

    if (this.activeTool === TOOL_BLOCKED || (typeof val === 'string' && val.endsWith('°')) || typeof val === 'number') {
      const angle = typeof val === 'number'
        ? val
        : (val && typeof val === 'string' && val.endsWith('°') ? parseInt(val) : this.currentBlockedAngle);
      const angleLabels = {
        0: '0° ═ [R]',
        45: '45° ╱ [R]',
        90: '90° ║ [R]',
        135: '135° ╲ [R]'
      };
      badge.textContent = angleLabels[angle] || `${angle}° [R]`;
      return;
    }

    const lane = val || this.currentObstacleLane;
    const labels = {
      right: '➡️ Der [R]',
      left: '⬅️ Izq [R]',
      center: '⚪ Cen [R]',
      both: '⚠️ Ambos [R]'
    };
    badge.textContent = labels[lane] || `${lane} [R]`;
  }

  initUI() {
    // Botón de Rotación de Obstáculo
    const btnRotate = document.getElementById('btnRotateObstacle');
    if (btnRotate) {
      btnRotate.addEventListener('click', () => {
        this.rotateCurrentObstacle();
      });
    }

    // 1. Botones de Herramientas
    const toolButtons = [
      { id: 'btnToolRoad', tool: TOOL_ROAD },
      { id: 'btnToolObstacle', tool: TOOL_OBSTACLE },
      { id: 'btnToolBlocked', tool: TOOL_BLOCKED },
      { id: 'btnToolStart', tool: TOOL_START },
      { id: 'btnToolGoal', tool: TOOL_GOAL },
      { id: 'btnToolEraser', tool: TOOL_ERASER }
    ];

    for (const tb of toolButtons) {
      const btn = document.getElementById(tb.id);
      if (btn) {
        btn.addEventListener('click', () => {
          this.setTool(tb.tool);
        });
      }
    }

    // 2. Botón Limpiar Todo
    const btnClear = document.getElementById('btnClear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('¿Deseas limpiar todo el escenario?')) {
          this.gridMap.clear();
          if (this.onSimulationReset) this.onSimulationReset();
        }
      });
    }

    // 3. Botones de Presets
    const btnPresetCurves = document.getElementById('btnPresetCurves');
    if (btnPresetCurves) {
      btnPresetCurves.addEventListener('click', () => {
        Presets.loadSharpCurves(this.gridMap);
        if (this.onSimulationReset) this.onSimulationReset();
      });
    }

    const btnPresetObstacle = document.getElementById('btnPresetObstacle');
    if (btnPresetObstacle) {
      btnPresetObstacle.addEventListener('click', () => {
        Presets.loadFrontalObstacle(this.gridMap);
        if (this.onSimulationReset) this.onSimulationReset();
      });
    }

    const btnPresetAlt = document.getElementById('btnPresetAlt');
    if (btnPresetAlt) {
      btnPresetAlt.addEventListener('click', () => {
        Presets.loadAlternativeRoute(this.gridMap);
        if (this.onSimulationReset) this.onSimulationReset();
      });
    }

    // 4. Exportar e Importar JSON
    const btnExportJSON = document.getElementById('btnExportJSON');
    if (btnExportJSON) {
      btnExportJSON.addEventListener('click', () => {
        Storage.exportToJSON(this.gridMap);
      });
    }

    const btnImportJSON = document.getElementById('btnImportJSON');
    const fileInputJSON = document.getElementById('fileInputJSON');
    if (btnImportJSON && fileInputJSON) {
      btnImportJSON.addEventListener('click', () => fileInputJSON.click());
      fileInputJSON.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          Storage.importFromJSON(e.target.files[0], this.gridMap, () => {
            if (this.onSimulationReset) this.onSimulationReset();
          });
        }
      });
    }

    // 5. Controles de Simulación (Play / Pause / Reset)
    const btnPlayPause = document.getElementById('btnPlayPause');
    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', () => {
        this.isSimulating = !this.isSimulating;
        btnPlayPause.innerHTML = this.isSimulating
          ? `<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pausar</span>`
          : `<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Iniciar</span>`;
        if (this.onSimulationToggle) this.onSimulationToggle(this.isSimulating);
      });
    }

    const btnReset = document.getElementById('btnReset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.isSimulating = false;
        if (btnPlayPause) {
          btnPlayPause.innerHTML = `<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Iniciar</span>`;
        }
        if (this.onSimulationReset) this.onSimulationReset();
      });
    }

    // 6. Multiplicador de Velocidad
    const speedButtons = [
      { id: 'btnSpeed1x', mult: 1 },
      { id: 'btnSpeed2x', mult: 2 },
      { id: 'btnSpeed4x', mult: 4 }
    ];
    for (const sb of speedButtons) {
      const btn = document.getElementById(sb.id);
      if (btn) {
        btn.addEventListener('click', () => {
          speedButtons.forEach(b => document.getElementById(b.id)?.classList.remove('bg-sky-600', 'text-white'));
          btn.classList.add('bg-sky-600', 'text-white');
          if (this.onSpeedMultiplierChange) this.onSpeedMultiplierChange(sb.mult);
        });
      }
    }

    // 7. Modos de Cámara
    const camButtons = [
      { id: 'btnCamIso', mode: CAMERA_ISOMETRIC },
      { id: 'btnCamTop', mode: CAMERA_TOP_DOWN },
      { id: 'btnCamChase', mode: CAMERA_CHASE }
    ];
    for (const cb of camButtons) {
      const btn = document.getElementById(cb.id);
      if (btn) {
        btn.addEventListener('click', () => {
          camButtons.forEach(b => document.getElementById(b.id)?.classList.remove('bg-sky-600', 'text-white'));
          btn.classList.add('bg-sky-600', 'text-white');
          this.cameraManager.setMode(cb.mode);
        });
      }
    }

    // 8. Selector de Variable Difusa para el Gráfico
    const selectFuzzyVar = document.getElementById('selectFuzzyVar');
    if (selectFuzzyVar) {
      selectFuzzyVar.addEventListener('change', (e) => {
        if (this.onVariableSelected) this.onVariableSelected(e.target.value);
      });
    }
  }

  setTool(tool) {
    this.activeTool = tool;
    const toolIds = ['btnToolRoad', 'btnToolObstacle', 'btnToolBlocked', 'btnToolStart', 'btnToolGoal', 'btnToolEraser'];
    toolIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.remove('ring-2', 'ring-sky-400', 'bg-sky-600/40');
      }
    });

    const activeMap = {
      [TOOL_ROAD]: 'btnToolRoad',
      [TOOL_OBSTACLE]: 'btnToolObstacle',
      [TOOL_BLOCKED]: 'btnToolBlocked',
      [TOOL_START]: 'btnToolStart',
      [TOOL_GOAL]: 'btnToolGoal',
      [TOOL_ERASER]: 'btnToolEraser'
    };

    const activeBtn = document.getElementById(activeMap[tool]);
    if (activeBtn) {
      activeBtn.classList.add('ring-2', 'ring-sky-400', 'bg-sky-600/40');
    }

    if (tool === TOOL_BLOCKED) {
      this.updateRotateBadge(`${this.currentBlockedAngle}°`);
    } else if (tool === TOOL_OBSTACLE) {
      this.updateRotateBadge(this.currentObstacleLane);
    }
  }

  initMouseEvents() {
    const canvas = document.getElementById('threeCanvas');
    if (!canvas) return;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) { // Clic izquierdo
        this.isMouseDown = true;
        this.paintAtMouse(e);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      this.updateHoverCursor(e);
      if (this.isMouseDown) {
        this.paintAtMouse(e);
      }
    });

    window.addEventListener('pointerup', () => {
      this.isMouseDown = false;
      this.lastPaintedCell = null;
    });
  }

  getIntersectionPoint(e) {
    const canvas = document.getElementById('threeCanvas');
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint);
    return hit ? hitPoint : null;
  }

  updateHoverCursor(e) {
    const pt = this.getIntersectionPoint(e);
    if (!pt) {
      this.hoverCursor.visible = false;
      this.hoveredCell = null;
      return;
    }

    const gridCell = this.gridMap.worldToGrid(pt.x, pt.z);
    this.hoveredCell = gridCell;

    if (gridCell) {
      const worldPos = this.gridMap.gridToWorld(gridCell.x, gridCell.z);
      this.hoverCursor.position.set(worldPos.x, 0.05, worldPos.z);
      this.hoverCursor.visible = true;

      // Si la casilla tiene obstáculo o bloqueo, mostrar su estado en el badge
      if (this.gridMap.hasPhysicalObstacle(gridCell.x, gridCell.z)) {
        const tile = this.gridMap.getTile(gridCell.x, gridCell.z);
        const data = this.gridMap.getObstacleData(gridCell.x, gridCell.z);
        if (tile === TILE_BLOCKED) {
          this.updateRotateBadge(`${data.angleDeg || 0}°`);
        } else {
          this.updateRotateBadge(data.lane);
        }
      } else if (this.activeTool === TOOL_BLOCKED) {
        this.updateRotateBadge(`${this.currentBlockedAngle}°`);
      } else {
        this.updateRotateBadge(this.currentObstacleLane);
      }
    } else {
      this.hoverCursor.visible = false;
    }
  }

  paintAtMouse(e) {
    const pt = this.getIntersectionPoint(e);
    if (!pt) return;

    const gridCell = this.gridMap.worldToGrid(pt.x, pt.z);
    if (!gridCell) return;

    // Evitar repintar la misma casilla en el mismo arrastre
    if (this.lastPaintedCell && this.lastPaintedCell.x === gridCell.x && this.lastPaintedCell.z === gridCell.z) {
      return;
    }
    this.lastPaintedCell = gridCell;

    let targetType = TILE_ROAD;
    if (this.activeTool === TOOL_ROAD) targetType = TILE_ROAD;
    else if (this.activeTool === TOOL_OBSTACLE) targetType = TILE_OBSTACLE;
    else if (this.activeTool === TOOL_BLOCKED) targetType = TILE_BLOCKED;
    else if (this.activeTool === TOOL_START) targetType = TILE_START;
    else if (this.activeTool === TOOL_GOAL) targetType = TILE_GOAL;
    else if (this.activeTool === TOOL_ERASER) targetType = TILE_EMPTY;

    let customData = null;
    if (targetType === TILE_OBSTACLE) {
      // Si la casilla ya tenía un obstáculo, hacer clic sobre ella cicla el carril!
      if (this.gridMap.getTile(gridCell.x, gridCell.z) === TILE_OBSTACLE) {
        const nextLane = this.gridMap.cycleObstacleLane(gridCell.x, gridCell.z);
        this.updateRotateBadge(nextLane);
        if (this.onSimulationReset) this.onSimulationReset();
        return;
      }

      // Para un obstáculo nuevo, detectar si el clic fue en el carril derecho o izquierdo
      const cellCenter = this.gridMap.gridToWorld(gridCell.x, gridCell.z);
      const norm = this.gridMap.getRoadNormal ? this.gridMap.getRoadNormal(gridCell.x, gridCell.z) : { nx: 0, nz: 1 };
      const relX = pt.x - cellCenter.x;
      const relZ = pt.z - cellCenter.z;
      const proj = relX * norm.nx + relZ * norm.nz;

      let lane = this.currentObstacleLane;
      if (proj > 0.15) {
        lane = 'right';
      } else if (proj < -0.15) {
        lane = 'left';
      }
      customData = { lane, angleDeg: this.currentObstacleRotation };
      this.currentObstacleLane = lane;
      this.updateRotateBadge(lane);
    } else if (targetType === TILE_BLOCKED) {
      // Si la casilla ya tenía un bloqueo, hacer clic sobre ella cicla la orientación/modo!
      if (this.gridMap.getTile(gridCell.x, gridCell.z) === TILE_BLOCKED) {
        const nextAngle = this.gridMap.cycleBlockedAngle(gridCell.x, gridCell.z);
        this.currentBlockedAngle = nextAngle;
        this.updateRotateBadge(`${nextAngle}°`);
        if (this.onSimulationReset) this.onSimulationReset();
        return;
      }

      // Si es un bloqueo nuevo, usar orientación adaptativa inteligente a la carretera
      const smartAngle = this.gridMap.getDefaultBlockedAngle
        ? this.gridMap.getDefaultBlockedAngle(gridCell.x, gridCell.z)
        : this.currentBlockedAngle;
      customData = { lane: 'both', angleDeg: smartAngle };
      this.currentBlockedAngle = smartAngle;
      this.updateRotateBadge(`${smartAngle}°`);
    }

    this.gridMap.setTile(gridCell.x, gridCell.z, targetType, customData);
    if (this.onSimulationReset) this.onSimulationReset();
  }
}
