/**
 * Funciones de Pertenencia Difusas
 * Soporta funciones Triangulares y Trapezoidales con evaluación de grado de pertenencia mu in [0, 1].
 * Maneja correctamente hombros izquierdos (a === b) y hombros derechos (c === d).
 */

export class MembershipFunction {
  constructor(name) {
    this.name = name;
  }

  evaluate(x) {
    throw new Error('evaluate() debe ser implementado por la subclase');
  }
}

export class TriangularMF extends MembershipFunction {
  constructor(name, a, b, c) {
    super(name);
    this.a = a; // Punto izquierdo (mu = 0)
    this.b = b; // Cúspide (mu = 1)
    this.c = c; // Punto derecho (mu = 0)
  }

  setParams(a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;
  }

  evaluate(x) {
    if (x === this.b) return 1;

    // Rango izquierdo
    if (x < this.b) {
      if (this.a === this.b) return 1; // Hombro izquierdo
      if (x <= this.a) return 0;
      return (x - this.a) / (this.b - this.a);
    }

    // Rango derecho
    if (x > this.b) {
      if (this.b === this.c) return 1; // Hombro derecho
      if (x >= this.c) return 0;
      return (this.c - x) / (this.c - this.b);
    }

    return 0;
  }
}

export class TrapezoidalMF extends MembershipFunction {
  constructor(name, a, b, c, d) {
    super(name);
    this.a = a; // Inicio pendiente de subida (mu = 0)
    this.b = b; // Inicio meseta (mu = 1)
    this.c = c; // Fin meseta (mu = 1)
    this.d = d; // Fin pendiente de bajada (mu = 0)
  }

  setParams(a, b, c, d) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }

  evaluate(x) {
    // Meseta superior [b, c]
    if (x >= this.b && x <= this.c) return 1;

    // A la izquierda de la meseta
    if (x < this.b) {
      if (this.a === this.b) return 1; // Hombro izquierdo abierto
      if (x <= this.a) return 0;
      return (x - this.a) / (this.b - this.a);
    }

    // A la derecha de la meseta
    if (x > this.c) {
      if (this.c === this.d) return 1; // Hombro derecho abierto
      if (x >= this.d) return 0;
      return (this.d - x) / (this.d - this.c);
    }

    return 0;
  }
}
