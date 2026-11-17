import * as THREE from 'three';

/**
 * Visualizador 3D de Sensores Láser (Raycasting)
 * Haz luminoso dinámico adaptado a la nueva escala del vehículo.
 */
export class RaycastVisualizer {
  constructor(scene) {
    this.scene = scene;
    this.rayLines = [];
    this.hitDots = [];
    this.initVisuals();
  }

  initVisuals() {
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(6);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0x10b981,
        linewidth: 3,
        transparent: true,
        opacity: 0.92,
        depthTest: false // Evita que se oculte bajo el asfalto o mallas
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false; // CRÍTICO: Previene que Three.js corte la línea fuera del origen (0,0,0)
      line.renderOrder = 999;
      this.scene.add(line);
      this.rayLines.push(line);

      const dotGeo = new THREE.SphereGeometry(0.08, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.frustumCulled = false;
      dot.renderOrder = 1000;
      dot.visible = false;
      this.scene.add(dot);
      this.hitDots.push(dot);
    }
  }

  update(carX, carZ, carHeading, rays) {
    if (!rays || rays.length < 3) return;

    // Nariz del auto adaptada a la escala física (largo 1.05m)
    const noseDist = 0.55;
    const originX = carX + Math.cos(carHeading) * noseDist;
    const originZ = carZ + Math.sin(carHeading) * noseDist;
    const originY = 0.22; // Elevado sobre el asfalto (y=0.08) para visibilidad perfecta

    for (let i = 0; i < 3; i++) {
      const ray = rays[i];
      const rad = carHeading + (ray.angle * Math.PI) / 180;
      const endX = originX + Math.cos(rad) * ray.dist;
      const endZ = originZ + Math.sin(rad) * ray.dist;
      const endY = 0.22;

      const line = this.rayLines[i];
      const posAttr = line.geometry.attributes.position;
      posAttr.setXYZ(0, originX, originY, originZ);
      posAttr.setXYZ(1, endX, endY, endZ);
      posAttr.needsUpdate = true;
      line.geometry.computeBoundingSphere();

      let colorHex = 0x10b981; // Verde (despejado)
      if (ray.dist < 2.2) {
        colorHex = 0xef4444; // Rojo (peligro inminente)
      } else if (ray.dist < 4.5) {
        colorHex = 0xf59e0b; // Ámbar (precaución)
      }

      line.material.color.setHex(colorHex);

      const dot = this.hitDots[i];
      if (ray.dist < 6.8) {
        dot.visible = true;
        dot.position.set(endX, endY, endZ);
        dot.material.color.setHex(colorHex);
      } else {
        dot.visible = false;
      }
    }
  }

  setVisible(visible) {
    for (let i = 0; i < 3; i++) {
      this.rayLines[i].visible = visible;
      this.hitDots[i].visible = visible;
    }
  }
}
