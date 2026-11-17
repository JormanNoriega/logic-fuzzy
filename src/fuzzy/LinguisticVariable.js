/**
 * Variable Lingüística Difusa
 * Contiene el universo de discurso [min, max] y sus conjuntos difusos asociados.
 */

export class LinguisticVariable {
  constructor(name, min, max) {
    this.name = name;
    this.min = min;
    this.max = max;
    this.sets = new Map();
  }

  addSet(membershipFunction) {
    this.sets.set(membershipFunction.name, membershipFunction);
    return this;
  }

  getSet(name) {
    return this.sets.get(name);
  }

  fuzzify(value) {
    // Clamping dentro del universo de discurso
    const clamped = Math.max(this.min, Math.min(this.max, value));
    const memberships = {};
    for (const [name, mf] of this.sets.entries()) {
      memberships[name] = mf.evaluate(clamped);
    }
    return memberships;
  }
}
