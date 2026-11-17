/**
 * Regla Difusa Mamdani
 * Estructura: IF (Var1 is Set1 AND Var2 is Set2 ...) THEN (OutputVar is OutputSet)
 * Utiliza el operador T-norma MIN para la conjunción AND de antecedentes.
 */

export class FuzzyRule {
  /**
   * @param {Array<{variable: string, set: string}>} antecedents
   * @param {{variable: string, set: string}} consequent
   * @param {string} [description]
   */
  constructor(antecedents, consequent, description = '') {
    this.antecedents = antecedents;
    this.consequent = consequent;
    this.description = description || this.generateDescription();
    this.lastFiringStrength = 0;
  }

  generateDescription() {
    const antStr = this.antecedents.map(a => `${a.variable} ES ${a.set}`).join(' Y ');
    return `SI ${antStr} ENTONCES ${this.consequent.variable} ES ${this.consequent.set}`;
  }

  /**
   * Evalúa el grado de activación de la regla mediante el operador MIN
   * @param {Object} fuzzifiedInputs Diccionario de entradas difusas { varName: { setName: mu } }
   * @returns {number} Grado de disparo alpha in [0, 1]
   */
  evaluate(fuzzifiedInputs) {
    let alpha = 1.0;
    for (const ant of this.antecedents) {
      const varValues = fuzzifiedInputs[ant.variable];
      if (!varValues) {
        alpha = 0;
        break;
      }
      const mu = varValues[ant.set] || 0;
      alpha = Math.min(alpha, mu);
      if (alpha === 0) break;
    }
    this.lastFiringStrength = alpha;
    return alpha;
  }
}
