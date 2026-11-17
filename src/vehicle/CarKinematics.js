/**
 * Modelo Cinemático de Bicicleta Continuo Adaptado a Carril
 * Wheelbase L = 0.55m, ángulo de dirección ampliado a 42° para curvas cerradas.
 */
export class CarKinematics {
  constructor() {
    this.x = 0;
    this.z = 0;
    this.heading = 0; // radianes (0 = eje +X, pi/2 = eje +Z)
    this.speed = 0;   // unidades/segundo
    this.accel = 0;   // aceleración actual
    this.steer = 0;   // ángulo de ruedas delanteras en radianes

    // Parámetros dinámicos calibrados
    this.wheelbase = 0.55;     // Distancia entre ejes L (reducida para radio de giro < 0.8m)
    this.maxSpeed = 5.5;       // Velocidad máxima de crucero
    this.maxAccel = 3.5;       // Aceleración máxima
    this.maxBrake = 5.5;       // Capacidad de frenado máxima
    this.rollingFriction = 0.35;// Fricción por rodadura
  }

  reset(x = 0, z = 0, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.accel = 0;
    this.steer = 0;
  }

  /**
   * Avanza la física un paso temporal dt
   * @param {number} accelNormalized Entrada difusa en [-1.0, 1.0] (-1 = freno max, +1 = gas max)
   * @param {number} steerAngleRad Ángulo de giro de ruedas en radianes (máx ~42°)
   * @param {number} dt Delta de tiempo en segundos
   */
  step(accelNormalized, steerAngleRad, dt) {
    // Clamping de ángulo de giro físico a 42° (~0.733 rad)
    const maxSteer = (42 * Math.PI) / 180;
    this.steer = Math.max(-maxSteer, Math.min(maxSteer, steerAngleRad));

    // Calcular aceleración neta
    if (accelNormalized >= 0) {
      this.accel = accelNormalized * this.maxAccel;
    } else {
      this.accel = accelNormalized * this.maxBrake;
    }

    // Aplicar fricción de rodadura
    const frictionForce = this.speed * this.rollingFriction;
    const netAccel = this.accel - (this.speed > 0 ? frictionForce : 0);

    // Integración de velocidad
    this.speed += netAccel * dt;
    if (this.speed < 0.02 && accelNormalized <= 0) {
      this.speed = 0;
    }
    this.speed = Math.max(0, Math.min(this.maxSpeed, this.speed));

    // Cinemática de bicicleta para giro
    if (this.speed > 0.001) {
      const angularVelocity = (this.speed / this.wheelbase) * Math.tan(this.steer);
      this.heading += angularVelocity * dt;

      // Normalizar ángulo en [-pi, pi]
      while (this.heading > Math.PI) this.heading -= 2 * Math.PI;
      while (this.heading < -Math.PI) this.heading += 2 * Math.PI;

      // Integración de posición en el plano X-Z
      this.x += this.speed * Math.cos(this.heading) * dt;
      this.z += this.speed * Math.sin(this.heading) * dt;
    }

    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      speed: this.speed,
      accel: this.accel
    };
  }
}
