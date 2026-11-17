/**
 * Generador de Trayectorias Continuas para Vía de 2 Calzadas (2 Carriles)
 * Traza la línea de referencia en el Carril Derecho (+0.48m) por defecto.
 * Implementa cálculo analítico de tangentes, búsqueda de índice local (anti-saltos)
 * y convención estricta de signos de navegación.
 */

export class TrajectoryGenerator {
  /**
   * @param {Array<{x: number, z: number}>} tilePath Camino discreto de casillas de A*
   * @param {GridMap} gridMap
   * @returns {Object} Objeto de trayectoria continua
   */
  static generate(tilePath, gridMap) {
    if (!tilePath || tilePath.length === 0) return null;

    const rawCenterPoints = tilePath.map(t => gridMap.gridToWorld(t.x, t.z));

    if (rawCenterPoints.length === 1) {
      return this.createSinglePointTrajectory(rawCenterPoints[0]);
    }

    const n = rawCenterPoints.length;
    const densePoints = [];
    const stepSize = 0.06; // Resolución fina de 6 cm por punto
    let cumulativeDist = 0;
    const laneOffsetRight = 0.48; // Carril derecho a +0.48m del eje central

    // Función auxiliar para agregar un punto denso en el carril derecho
    const addDensePoint = (cx, cz, heading, curvature = 0) => {
      // Normal derecha en plano X-Z (rotación de +90° respecto a heading)
      // Si heading es hacia +X (0 rad), derecha es +Z (0, 1)
      const normRightX = -Math.sin(heading);
      const normRightZ = Math.cos(heading);

      const rx = cx + normRightX * laneOffsetRight;
      const rz = cz + normRightZ * laneOffsetRight;

      densePoints.push({
        x: rx,
        z: rz,
        centerX: cx,
        centerZ: cz,
        normRightX,
        normRightZ,
        heading,
        curvature,
        cumDist: cumulativeDist
      });
    };

    // Recorrer los tramos entre casillas
    for (let i = 0; i < n - 1; i++) {
      const pCurr = rawCenterPoints[i];
      const pNext = rawCenterPoints[i + 1];
      const pPrev = i > 0 ? rawCenterPoints[i - 1] : null;
      const pNextNext = i + 2 < n ? rawCenterPoints[i + 2] : null;

      const vOut = { x: pNext.x - pCurr.x, z: pNext.z - pCurr.z };
      const lenOut = Math.hypot(vOut.x, vOut.z) || 1;
      const dirOut = { x: vOut.x / lenOut, z: vOut.z / lenOut };
      const headingOut = Math.atan2(dirOut.z, dirOut.x);

      const vIn = pPrev ? { x: pCurr.x - pPrev.x, z: pCurr.z - pPrev.z } : null;
      const lenIn = vIn ? (Math.hypot(vIn.x, vIn.z) || 1) : 1;
      const dirIn = vIn ? { x: vIn.x / lenIn, z: vIn.z / lenIn } : null;

      const maxFillet = 1.35;
      const cornerRadius = Math.min(maxFillet, Math.min(lenIn, lenOut) * 0.65);

      // Determinar si el tramo actual se aproxima a una curva en pNext
      let cornerStartsAt = lenOut;
      if (pNextNext) {
        const vNextNext = { x: pNextNext.x - pNext.x, z: pNextNext.z - pNext.z };
        const lenNextNext = Math.hypot(vNextNext.x, vNextNext.z) || 1;
        const dirNextNext = { x: vNextNext.x / lenNextNext, z: vNextNext.z / lenNextNext };
        const dot = dirOut.x * dirNextNext.x + dirOut.z * dirNextNext.z;

        if (Math.abs(dot) < 0.95) {
          const nextCornerRadius = Math.min(maxFillet, Math.min(lenOut, lenNextNext) * 0.65);
          cornerStartsAt = Math.max(0.1, lenOut - nextCornerRadius);
        }
      }

      // Determinar si salimos de una curva en pCurr
      let cornerEndsAt = 0;
      if (pPrev) {
        const dot = dirIn.x * dirOut.x + dirIn.z * dirOut.z;
        if (Math.abs(dot) < 0.95) {
          cornerEndsAt = Math.min(lenOut - 0.1, cornerRadius);
        }
      }

      // Si pCurr es un vértice de curva hacia pNext (generar arco circular continuo)
      if (pPrev && i < n - 1) {
        const dot = dirIn.x * dirOut.x + dirIn.z * dirOut.z;
        if (Math.abs(dot) < 0.95) {
          const cross = dirIn.x * dirOut.z - dirIn.z * dirOut.x;
          const turnRight = cross > 0;

          const normInX = turnRight ? -dirIn.z : dirIn.z;
          const normInZ = turnRight ? dirIn.x : -dirIn.x;

          const pStart = { x: pCurr.x - dirIn.x * cornerRadius, z: pCurr.z - dirIn.z * cornerRadius };
          const center = { x: pStart.x + normInX * cornerRadius, z: pStart.z + normInZ * cornerRadius };

          const startAngle = Math.atan2(pStart.z - center.z, pStart.x - center.x);
          const pEnd = { x: pCurr.x + dirOut.x * cornerRadius, z: pCurr.z + dirOut.z * cornerRadius };
          const endAngle = Math.atan2(pEnd.z - center.z, pEnd.x - center.x);

          let angleDiff = endAngle - startAngle;
          if (turnRight) {
            while (angleDiff < 0) angleDiff += 2 * Math.PI;
          } else {
            while (angleDiff > 0) angleDiff -= 2 * Math.PI;
          }

          const arcLen = Math.abs(angleDiff) * cornerRadius;
          const arcSteps = Math.max(10, Math.ceil(arcLen / stepSize));

          for (let s = 1; s <= arcSteps; s++) {
            const t = s / arcSteps;
            const a = startAngle + angleDiff * t;
            const cx = center.x + Math.cos(a) * cornerRadius;
            const cz = center.z + Math.sin(a) * cornerRadius;
            const h = turnRight ? a + Math.PI / 2 : a - Math.PI / 2;
            const curv = 1.0 / cornerRadius;

            const prevPt = densePoints[densePoints.length - 1];
            const distIncrement = prevPt ? Math.hypot(cx - prevPt.centerX, cz - prevPt.centerZ) : stepSize;
            cumulativeDist += distIncrement;
            addDensePoint(cx, cz, h, curv);
          }
        }
      }

      // Segmento Recto continuo
      const straightStart = cornerEndsAt;
      const straightEnd = cornerStartsAt;
      const straightLen = straightEnd - straightStart;

      if (straightLen > 0.02) {
        const numStraightSteps = Math.max(1, Math.floor(straightLen / stepSize));
        for (let s = 0; s < numStraightSteps; s++) {
          const t = s / numStraightSteps;
          const distAlong = straightStart + straightLen * t;
          const cx = pCurr.x + dirOut.x * distAlong;
          const cz = pCurr.z + dirOut.z * distAlong;

          const prevPt = densePoints[densePoints.length - 1];
          const distIncrement = prevPt ? Math.hypot(cx - prevPt.centerX, cz - prevPt.centerZ) : stepSize;
          cumulativeDist += distIncrement;

          addDensePoint(cx, cz, headingOut, 0.0);
        }
      }
    }

    // Agregar punto final en la meta
    const lastTile = rawCenterPoints[n - 1];
    const prevTile = rawCenterPoints[n - 2];
    const lastHeading = Math.atan2(lastTile.z - prevTile.z, lastTile.x - prevTile.x);
    cumulativeDist += stepSize;
    addDensePoint(lastTile.x, lastTile.z, lastHeading, 0.0);

    const totalLength = cumulativeDist;
    const goalCenter = rawCenterPoints[n - 1];
    const goalNormX = -Math.sin(lastHeading);
    const goalNormZ = Math.cos(lastHeading);

    return {
      points: densePoints,
      totalLength,
      goalPoint: {
        x: goalCenter.x + goalNormX * laneOffsetRight,
        z: goalCenter.z + goalNormZ * laneOffsetRight
      },

      // Índice de búsqueda local para garantizar continuidad y evitar saltos
      lastKnownIdx: 0,

      resetTracking() {
        this.lastKnownIdx = 0;
      },

      /**
       * Calcula telemetría de carril con punto de anticipación dinámico (Speed-Adaptive Lookahead)
       * y cálculo ortogonal de error lateral respecto a la calzada.
       * @param {number} carX
       * @param {number} carZ
       * @param {number} carHeading
       * @param {number} dynamicLaneOffset 0.0 = Carril Derecho (+0.48m)
       * @param {number} currentSpeed Velocidad actual del vehículo
       */
      getTrackingInfo(carX, carZ, carHeading, dynamicLaneOffset = 0.0, currentSpeed = 1.0) {
        // 1. Búsqueda con ventana local alrededor del último índice conocido
        // Previene saltos erróneos a tramos paralelos o adyacentes en curvas cerradas
        const searchRadius = 35;
        let startIdx = Math.max(0, this.lastKnownIdx - 10);
        let endIdx = Math.min(densePoints.length - 1, this.lastKnownIdx + searchRadius);

        let closestIdx = this.lastKnownIdx;
        let minDistSq = Infinity;

        for (let i = startIdx; i <= endIdx; i++) {
          const pt = densePoints[i];
          const distSq = (carX - pt.x) ** 2 + (carZ - pt.z) ** 2;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            closestIdx = i;
          }
        }

        // Si la distancia es excesiva (pérdida de trayectoria), buscar en todo el arreglo
        if (minDistSq > 9.0) {
          for (let i = 0; i < densePoints.length; i++) {
            const pt = densePoints[i];
            const distSq = (carX - pt.x) ** 2 + (carZ - pt.z) ** 2;
            if (distSq < minDistSq) {
              minDistSq = distSq;
              closestIdx = i;
            }
          }
        }

        this.lastKnownIdx = closestIdx;
        const closest = densePoints[closestIdx];

        // 2. Punto de Anticipación Adaptativo según Velocidad (Dynamic Lookahead)
        // Permite seguimiento ceñido en el vértice de curva y estabilidad a alta velocidad
        const lookaheadMeters = Math.max(0.48, Math.min(1.3, 0.45 * currentSpeed + 0.22));
        const lookaheadPoints = Math.round(lookaheadMeters / stepSize);
        const targetIdx = Math.min(densePoints.length - 1, closestIdx + lookaheadPoints);
        const targetPt = densePoints[targetIdx];

        // Aplicar desplazamiento dinámico de carril (para rebase/evasión si aplica)
        const effectiveTargetX = targetPt.x + targetPt.normRightX * dynamicLaneOffset;
        const effectiveTargetZ = targetPt.z + targetPt.normRightZ * dynamicLaneOffset;

        // 3. Error Lateral firmado ortogonal respecto al punto más cercano de la calzada
        // CONVENCIÓN ESTRICTA VERIFICADA:
        // Positivo = El vehículo está a la DERECHA de la trayectoria deseada
        // Negativo = El vehículo está a la IZQUIERDA de la trayectoria deseada
        const effClosestX = closest.x + closest.normRightX * dynamicLaneOffset;
        const effClosestZ = closest.z + closest.normRightZ * dynamicLaneOffset;
        const tX = Math.cos(closest.heading);
        const tZ = Math.sin(closest.heading);
        const rx = carX - effClosestX;
        const rz = carZ - effClosestZ;

        // Producto cruz 2D T x r = tX * rz - tZ * rx:
        const lateralError = tX * rz - tZ * rx;

        // 4. Error Angular de Orientación en grados sexagesimales respecto al Lookahead
        // Positivo = El vehículo apunta a la DERECHA de la tangente del camino
        // Negativo = El vehículo apunta a la IZQUIERDA de la tangente del camino
        let headingDiff = carHeading - targetPt.heading;
        while (headingDiff > Math.PI) headingDiff -= 2 * Math.PI;
        while (headingDiff < -Math.PI) headingDiff += 2 * Math.PI;
        const headingErrorDeg = (headingDiff * 180) / Math.PI;

        // 5. Distancia al destino
        const remainingDist = Math.max(0, totalLength - closest.cumDist);
        const distToGoalDirect = Math.hypot(carX - this.goalPoint.x, carZ - this.goalPoint.z);

        // 6. Dificultad de la Curva Próxima (Anticipación hasta 5.5 metros)
        let maxCurvatureAhead = 0;
        let distToCurve = 12.0;
        const lookaheadHorizon = Math.min(densePoints.length, closestIdx + 70);

        for (let i = closestIdx + 4; i < lookaheadHorizon; i++) {
          const pt = densePoints[i];
          if (pt.curvature > 0.3) {
            maxCurvatureAhead = Math.max(maxCurvatureAhead, pt.curvature);
            const d = pt.cumDist - closest.cumDist;
            if (d < distToCurve) distToCurve = d;
          }
        }

        let curveDifficulty = 0;
        if (maxCurvatureAhead > 0.3) {
          const proximityFactor = Math.max(0, 1 - distToCurve / 5.5);
          curveDifficulty = Math.min(10, (maxCurvatureAhead / 0.75) * proximityFactor * 10);
        }

        return {
          closestPoint: closest,
          targetPoint: { x: effectiveTargetX, z: effectiveTargetZ },
          lateralError,
          headingErrorDeg,
          distanceToGoal: Math.min(remainingDist, distToGoalDirect),
          curveDifficulty,
          distToCurve,
          closestIdx
        };
      }
    };
  }

  static createSinglePointTrajectory(pt) {
    return {
      points: [{ x: pt.x, z: pt.z, centerX: pt.x, centerZ: pt.z, normRightX: 0, normRightZ: 1, heading: 0, cumDist: 0, curvature: 0 }],
      totalLength: 0,
      goalPoint: pt,
      resetTracking() {},
      getTrackingInfo: () => ({
        closestPoint: pt,
        targetPoint: pt,
        lateralError: 0,
        headingErrorDeg: 0,
        distanceToGoal: 0,
        curveDifficulty: 0,
        distToCurve: 10,
        closestIdx: 0
      })
    };
  }
}
