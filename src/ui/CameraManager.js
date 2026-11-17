import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const CAMERA_ISOMETRIC = 'isometric';
export const CAMERA_TOP_DOWN = 'topdown';
export const CAMERA_CHASE = 'chase';

/**
 * Gestor de Cámaras 3D
 * Permite alternar entre vista Isométrica, Vista Cenital 2D y Cámara de Persecución estilo GTA.
 * Configura OrbitControls para que el CLIC DERECHO rote en 360° libremente.
 */
export class CameraManager {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.mode = CAMERA_ISOMETRIC;

    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // No pasar por debajo del suelo

    // Asignación de botones del ratón:
    // Clic Izquierdo = Reservado para pintar/dibujar en la cuadrícula
    // Clic Derecho = ROTAR CÁMARA 360° en órbita
    // Rueda / Clic Central = Zoom / Mover (Pan)
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.NONE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE
    };

    this.setMode(CAMERA_ISOMETRIC);
  }

  setMode(mode) {
    this.mode = mode;

    if (mode === CAMERA_ISOMETRIC) {
      this.controls.enabled = true;
      this.camera.position.set(18, 22, 22);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    } else if (mode === CAMERA_TOP_DOWN) {
      this.controls.enabled = true;
      this.camera.position.set(0, 36, 0.01);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    } else if (mode === CAMERA_CHASE) {
      this.controls.enabled = false;
    }
  }

  update(carX = 0, carZ = 0, carHeading = 0) {
    if (this.mode === CAMERA_CHASE) {
      // Posición de cámara detrás y ligeramente arriba del auto
      const chaseDistance = 4.2;
      const chaseHeight = 2.4;

      const targetCamX = carX - Math.cos(carHeading) * chaseDistance;
      const targetCamZ = carZ - Math.sin(carHeading) * chaseDistance;
      const targetCamY = chaseHeight;

      this.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.15);

      const lookAtX = carX + Math.cos(carHeading) * 1.8;
      const lookAtZ = carZ + Math.sin(carHeading) * 1.8;
      this.camera.lookAt(lookAtX, 0.5, lookAtZ);
    } else {
      this.controls.update();
    }
  }
}
