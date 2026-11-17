import * as THREE from 'three';

/**
 * Modelo 3D del Vehículo Autónomo escalado a Media Casilla (1 Carril)
 * Dimensiones: largo 1.05m, ancho 0.52m, alto 0.38m.
 * Encaja con holgura en una calzada de 1.0m de ancho.
 */
export class CarModel {
  constructor() {
    this.group = new THREE.Group();
    this.frontLeftWheel = null;
    this.frontRightWheel = null;
    this.rearLeftWheel = null;
    this.rearRightWheel = null;
    this.createCar();
  }

  createCar() {
    const carColor = 0x0284c7; // Azul deportivo intenso
    const glassColor = 0x0f172a; // Vidrio polarizado
    const wheelColor = 0x1e293b;
    const rimColor = 0x94a3b8;

    const bodyMat = new THREE.MeshStandardMaterial({ color: carColor, roughness: 0.3, metalness: 0.4 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: glassColor, roughness: 0.1, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: wheelColor, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.3, metalness: 0.7 });
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.9 });

    // 1. Chasis / Carrocería principal (largo 1.05, ancho 0.52, alto 0.22)
    const chassisGeo = new THREE.BoxGeometry(1.05, 0.20, 0.52);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.16;
    chassis.castShadow = true;
    this.group.add(chassis);

    // 2. Cabina superior
    const cabinGeo = new THREE.BoxGeometry(0.55, 0.18, 0.44);
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(-0.06, 0.32, 0);
    cabin.castShadow = true;
    this.group.add(cabin);

    // 3. Faros delanteros
    const hlGeo = new THREE.BoxGeometry(0.04, 0.06, 0.12);
    const hlLeft = new THREE.Mesh(hlGeo, headlightMat);
    hlLeft.position.set(0.52, 0.18, 0.16);
    const hlRight = new THREE.Mesh(hlGeo, headlightMat);
    hlRight.position.set(0.52, 0.18, -0.16);
    this.group.add(hlLeft, hlRight);

    // 4. Luces traseras
    const tlGeo = new THREE.BoxGeometry(0.04, 0.06, 0.12);
    const tlLeft = new THREE.Mesh(tlGeo, taillightMat);
    tlLeft.position.set(-0.52, 0.18, 0.16);
    const tlRight = new THREE.Mesh(tlGeo, taillightMat);
    tlRight.position.set(-0.52, 0.18, -0.16);
    this.group.add(tlLeft, tlRight);

    // 5. Creación de Ruedas direccionales
    const createWheel = () => {
      const wheelGroup = new THREE.Group();
      const tireGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14);
      const tire = new THREE.Mesh(tireGeo, wheelMat);
      tire.rotation.x = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rimGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.09, 8);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      wheelGroup.add(rim);

      return wheelGroup;
    };

    // Wheelbase L = 0.55m
    const halfBase = 0.55 / 2;
    const trackWidth = 0.28;

    this.frontLeftWheel = createWheel();
    this.frontLeftWheel.position.set(halfBase, 0.12, trackWidth);
    this.frontRightWheel = createWheel();
    this.frontRightWheel.position.set(halfBase, 0.12, -trackWidth);

    this.rearLeftWheel = createWheel();
    this.rearLeftWheel.position.set(-halfBase, 0.12, trackWidth);
    this.rearRightWheel = createWheel();
    this.rearRightWheel.position.set(-halfBase, 0.12, -trackWidth);

    this.group.add(this.frontLeftWheel, this.frontRightWheel, this.rearLeftWheel, this.rearRightWheel);
  }

  setSteerAngle(steerAngleRad) {
    if (this.frontLeftWheel && this.frontRightWheel) {
      this.frontLeftWheel.rotation.y = -steerAngleRad;
      this.frontRightWheel.rotation.y = -steerAngleRad;
    }
  }

  updateTransform(x, z, headingRad) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = -headingRad;
  }
}
