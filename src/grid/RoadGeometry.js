import * as THREE from 'three';
import { TILE_EMPTY, TILE_ROAD, TILE_OBSTACLE, TILE_BLOCKED, TILE_START, TILE_GOAL, CELL_SIZE } from './GridMap.js';

/**
 * Gestor de Mallas 3D para Carreteras de Doble Calzada (2 Carriles)
 * Renderiza asfalto con línea divisoria amarilla central, líneas blancas de borde,
 * curvas fluidas y obstáculos ubicados en el carril derecho.
 */
export class RoadGeometry {
  constructor(scene, gridMap) {
    this.scene = scene;
    this.gridMap = gridMap;
    this.tileMeshes = new Map();
    this.materials = this.createMaterials();
    this.trajectoryLine = null;
    this.isLightMode = true;
  }

  createMaterials() {
    return {
      // Terreno césped diurno estilo PolyTown
      ground: new THREE.MeshStandardMaterial({ color: 0xdcfce7, roughness: 0.95, metalness: 0.05 }),
      gridLine: new THREE.LineBasicMaterial({ color: 0xbbf7d0, transparent: true, opacity: 0.7 }),
      // Asfalto de alto contraste
      asphalt: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.15 }),
      curb: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 }),
      roadLineYellow: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
      roadLineWhite: new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
      // Conos y barricadas
      coneOrange: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 }),
      coneWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
      coneBase: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
      blockedHazard: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }),
      startPad: new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6 }),
      goalPad: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }),
      // Línea guía de trayectoria (azul neón sutil)
      pathGlow: new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3, transparent: true, opacity: 0.85 })
    };
  }

  setTheme(isLight) {
    this.isLightMode = isLight;
    if (isLight) {
      this.materials.ground.color.setHex(0xdcfce7);
      this.materials.asphalt.color.setHex(0x334155);
      this.materials.gridLine.color.setHex(0xbbf7d0);
    } else {
      this.materials.ground.color.setHex(0x0f172a);
      this.materials.asphalt.color.setHex(0x1e293b);
      this.materials.gridLine.color.setHex(0x334155);
    }
  }

  initBaseGround() {
    const totalSize = this.gridMap.size * CELL_SIZE;

    const groundGeo = new THREE.PlaneGeometry(totalSize * 2.2, totalSize * 2.2);
    const groundMesh = new THREE.Mesh(groundGeo, this.materials.ground);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.05;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    const gridHelper = new THREE.GridHelper(totalSize, this.gridMap.size, 0x10b981, 0x93c5fd);
    gridHelper.position.y = 0.001;
    this.scene.add(gridHelper);
  }

  updateGridVisuals() {
    for (let z = 0; z < this.gridMap.size; z++) {
      for (let x = 0; x < this.gridMap.size; x++) {
        const key = `${x},${z}`;
        const tileType = this.gridMap.getTile(x, z);

        if (this.tileMeshes.has(key)) {
          const oldGroup = this.tileMeshes.get(key);
          this.scene.remove(oldGroup);
          this.tileMeshes.delete(key);
        }

        if (tileType !== TILE_EMPTY) {
          const tileGroup = this.createTileMesh(x, z, tileType);
          this.scene.add(tileGroup);
          this.tileMeshes.set(key, tileGroup);
        }
      }
    }
  }

  createTileMesh(x, z, type) {
    const group = new THREE.Group();
    const pos = this.gridMap.gridToWorld(x, z);
    group.position.set(pos.x, 0, pos.z);

    // 1. Base continua de asfalto (ancho 2.0m x largo 2.0m)
    const asphaltGeo = new THREE.BoxGeometry(CELL_SIZE * 0.99, 0.08, CELL_SIZE * 0.99);
    const asphaltMesh = new THREE.Mesh(asphaltGeo, this.materials.asphalt);
    asphaltMesh.position.y = 0.04;
    asphaltMesh.receiveShadow = true;
    group.add(asphaltMesh);

    // 2. Conexiones con vecinos para pintar calzadas
    const n = this.gridMap.isRoad(x, z - 1);
    const e = this.gridMap.isRoad(x + 1, z);
    const s = this.gridMap.isRoad(x, z + 1);
    const w = this.gridMap.isRoad(x - 1, z);

    this.addTwoLaneMarkings(group, n, e, s, w);

    // 3. Elementos específicos de casilla
    if (type === TILE_START) {
      this.addStartMarker(group);
    } else if (type === TILE_GOAL) {
      this.addGoalMarker(group);
    } else if (type === TILE_OBSTACLE) {
      this.addObstacleOnRightLane(group, x, z, n, e, s, w);
    } else if (type === TILE_BLOCKED) {
      this.addFullRoadBarrier(group, x, z);
    }

    return group;
  }

  addTwoLaneMarkings(group, n, e, s, w) {
    const yLine = 0.085;

    // Caso A: Recta Horizontal E-W
    if ((e || w) && !n && !s) {
      // Línea central amarilla discontinua
      const yellowLine = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE * 0.9, 0.01, 0.08), this.materials.roadLineYellow);
      yellowLine.position.set(0, yLine, 0);
      // Líneas blancas en los bordes exteriores (carril izquierdo a -0.85m, carril derecho a +0.85m)
      const whiteEdge1 = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE * 0.95, 0.01, 0.05), this.materials.roadLineWhite);
      whiteEdge1.position.set(0, yLine, -0.85);
      const whiteEdge2 = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE * 0.95, 0.01, 0.05), this.materials.roadLineWhite);
      whiteEdge2.position.set(0, yLine, 0.85);

      group.add(yellowLine, whiteEdge1, whiteEdge2);
    }
    // Caso B: Recta Vertical N-S
    else if ((n || s) && !e && !w) {
      // Línea central amarilla discontinua
      const yellowLine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, CELL_SIZE * 0.9), this.materials.roadLineYellow);
      yellowLine.position.set(0, yLine, 0);
      // Líneas blancas en los bordes exteriores
      const whiteEdge1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, CELL_SIZE * 0.95), this.materials.roadLineWhite);
      whiteEdge1.position.set(-0.85, yLine, 0);
      const whiteEdge2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, CELL_SIZE * 0.95), this.materials.roadLineWhite);
      whiteEdge2.position.set(0.85, yLine, 0);

      group.add(yellowLine, whiteEdge1, whiteEdge2);
    }
    // Caso C: Curvas de 90° con Arcos Continuos Realistas
    else if (n && e && !s && !w) {
      this.addCornerMarkings(group, 'NE');
    } else if (n && w && !s && !e) {
      this.addCornerMarkings(group, 'NW');
    } else if (s && e && !n && !w) {
      this.addCornerMarkings(group, 'SE');
    } else if (s && w && !n && !e) {
      this.addCornerMarkings(group, 'SW');
    }
    // Caso D: Intersecciones en T o en Cruz
    else {
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 16), this.materials.roadLineYellow);
      dot.position.set(0, yLine, 0);
      group.add(dot);

      if (n) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.8), this.materials.roadLineYellow);
        seg.position.set(0, yLine, -0.5);
        group.add(seg);
      }
      if (s) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.8), this.materials.roadLineYellow);
        seg.position.set(0, yLine, 0.5);
        group.add(seg);
      }
      if (e) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.01, 0.08), this.materials.roadLineYellow);
        seg.position.set(0.5, yLine, 0);
        group.add(seg);
      }
      if (w) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.01, 0.08), this.materials.roadLineYellow);
        seg.position.set(-0.5, yLine, 0);
        group.add(seg);
      }
    }
  }

  addCornerMarkings(group, type) {
    const yLine = 0.085;
    let cx = 0, cz = 0, thetaStart = 0;
    const thetaLen = Math.PI / 2;

    if (type === 'NE') {
      cx = 1.0; cz = -1.0;
      thetaStart = Math.PI;
    } else if (type === 'NW') {
      cx = -1.0; cz = -1.0;
      thetaStart = 3 * Math.PI / 2;
    } else if (type === 'SE') {
      cx = 1.0; cz = 1.0;
      thetaStart = Math.PI / 2;
    } else if (type === 'SW') {
      cx = -1.0; cz = 1.0;
      thetaStart = 0;
    }

    const createArcMesh = (innerR, outerR, start, len, material) => {
      const geo = new THREE.RingGeometry(innerR, outerR, 18, 1, start, len);
      const mesh = new THREE.Mesh(geo, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(cx, yLine, cz);
      return mesh;
    };

    // Borde blanco interior continuo
    group.add(createArcMesh(0.125, 0.175, thetaStart, thetaLen, this.materials.roadLineWhite));

    // Borde blanco exterior continuo
    group.add(createArcMesh(1.825, 1.875, thetaStart, thetaLen, this.materials.roadLineWhite));

    // Línea central amarilla discontinua (3 segmentos en arco circular concéntrico R=1.0m)
    const dashCount = 3;
    const dashLen = (thetaLen / dashCount) * 0.55;
    const stepLen = thetaLen / dashCount;
    for (let i = 0; i < dashCount; i++) {
      const dStart = thetaStart + i * stepLen + (stepLen - dashLen) / 2;
      group.add(createArcMesh(0.96, 1.04, dStart, dashLen, this.materials.roadLineYellow));
    }
  }

  createConeMesh(offsetX, offsetZ, rotRad = 0) {
    const coneGroup = new THREE.Group();
    coneGroup.position.set(offsetX, 0.08, offsetZ);
    coneGroup.rotation.y = rotRad;

    // Base del cono
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.38), this.materials.coneBase);
    base.position.y = 0.015;
    coneGroup.add(base);

    // Cono naranja
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 14), this.materials.coneOrange);
    cone.position.y = 0.28;
    coneGroup.add(cone);

    // Franja reflectante blanca
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.1, 14), this.materials.coneWhite);
    stripe.position.y = 0.26;
    coneGroup.add(stripe);

    return coneGroup;
  }

  addObstacleOnRightLane(group, x, z, n, e, s, w) {
    const obsData = this.gridMap ? this.gridMap.getObstacleData(x, z) : { lane: 'right', angleDeg: 0 };
    const { lane, angleDeg } = obsData;
    const rad = (angleDeg * Math.PI) / 180;

    // Determinar vector normal al carril derecho según orientación de la carretera
    let normX = 0;
    let normZ = 1; // Por defecto carretera E-W (+Z es carril derecho)

    if ((n || s) && !e && !w) {
      // Carretera N-S (+X es carril derecho)
      normX = 1;
      normZ = 0;
    } else if (n && e && !s && !w) {
      normX = -0.707; normZ = 0.707;
    } else if (n && w && !s && !e) {
      normX = 0.707; normZ = 0.707;
    } else if (s && e && !n && !w) {
      normX = -0.707; normZ = -0.707;
    } else if (s && w && !n && !e) {
      normX = 0.707; normZ = -0.707;
    }

    // Colocar conos según la calzada seleccionada
    if (lane === 'right') {
      group.add(this.createConeMesh(normX * 0.48, normZ * 0.48, rad));
    } else if (lane === 'left') {
      group.add(this.createConeMesh(-normX * 0.48, -normZ * 0.48, rad));
    } else if (lane === 'center') {
      group.add(this.createConeMesh(0, 0, rad));
    } else if (lane === 'both') {
      group.add(this.createConeMesh(normX * 0.48, normZ * 0.48, rad));
      group.add(this.createConeMesh(-normX * 0.48, -normZ * 0.48, rad));
    }
  }

  addFullRoadBarrier(group, x, z) {
    const obsData = this.gridMap ? this.gridMap.getObstacleData(x, z) : { angleDeg: 90 };
    const barrier = new THREE.Group();
    barrier.position.y = 0.08;

    const angleDeg = obsData.angleDeg !== undefined ? obsData.angleDeg : 90;
    barrier.rotation.y = (angleDeg * Math.PI) / 180;

    // Barra principal roja reflectante
    const bar = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE * 0.85, 0.24, 0.1), this.materials.blockedHazard);
    bar.position.y = 0.4;
    barrier.add(bar);

    // Franjas reflectantes blancas (estilo barricada vial de seguridad)
    const stripeMat = this.materials.roadLineWhite;
    for (let i = -0.6; i <= 0.6; i += 0.4) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.11), stripeMat);
      stripe.position.set(i, 0.4, 0);
      barrier.add(stripe);
    }

    // Patas de soporte
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), this.materials.coneBase);
    leg1.position.set(-0.65, 0.22, 0);
    leg1.rotation.z = 0.2;
    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), this.materials.coneBase);
    leg2.position.set(0.65, 0.22, 0);
    leg2.rotation.z = -0.2;
    barrier.add(leg1, leg2);

    group.add(barrier);
  }

  addStartMarker(group) {
    // Marcador en el carril derecho (+0.45m)
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.7), this.materials.startPad);
    pad.position.set(0.45, 0.09, 0.45);
    group.add(pad);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), this.materials.roadLineWhite);
    pole.position.set(0.75, 0.5, 0.75);
    group.add(pole);

    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.03), this.materials.startPad);
    flag.position.set(0.6, 0.9, 0.75);
    group.add(flag);
  }

  addGoalMarker(group) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.7), this.materials.goalPad);
    pad.position.set(0.45, 0.09, 0.45);
    group.add(pad);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), this.materials.roadLineWhite);
    pole.position.set(0.75, 0.5, 0.75);
    group.add(pole);

    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.03), this.materials.goalPad);
    flag.position.set(0.6, 0.9, 0.75);
    group.add(flag);
  }

  renderTrajectory(trajectory) {
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine = null;
    }

    if (!trajectory || !trajectory.points || trajectory.points.length < 2) return;

    const positions = [];
    for (const pt of trajectory.points) {
      positions.push(pt.x, 0.11, pt.z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.trajectoryLine = new THREE.Line(geo, this.materials.pathGlow);
    this.scene.add(this.trajectoryLine);
  }

  clearTrajectory() {
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine = null;
    }
  }
}
