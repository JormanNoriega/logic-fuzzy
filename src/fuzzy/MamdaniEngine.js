/**
 * Motor de Inferencia Difusa Mamdani con Defuzzificación por Centroide (COG)
 * Incluye protección contra división por cero y recorte por implicación MIN.
 */

export class MamdaniEngine {
  constructor(name, outputVariable, fallbackValue = 0) {
    this.name = name;
    this.inputVariables = new Map();
    this.outputVariable = outputVariable;
    this.rules = [];
    this.fallbackValue = fallbackValue;
    this.discretizationSteps = 120; // Resolución para integración numérica de centroide
  }

  addInputVariable(variable) {
    this.inputVariables.set(variable.name, variable);
    return this;
  }

  addRule(rule) {
    this.rules.push(rule);
    return this;
  }

  /**
   * Ejecuta el ciclo completo de inferencia:
   * 1. Fuzzificación de entradas
   * 2. Evaluación de reglas (MIN)
   * 3. Implicación y Agregación (MAX)
   * 4. Defuzzificación por Centroide (COG)
   * 
   * @param {Object} crispInputs { varName: crispValue }
   * @returns {Object} Resultado con valor defuzzificado, activaciones y curvas
   */
  evaluate(crispInputs) {
    // 1. Fuzzificación
    const fuzzifiedInputs = {};
    for (const [name, variable] of this.inputVariables.entries()) {
      const val = crispInputs[name] !== undefined ? crispInputs[name] : 0;
      fuzzifiedInputs[name] = variable.fuzzify(val);
    }

    // 2. Evaluación de reglas y acumulación por conjunto de salida
    const outputSetStrengths = new Map();
    for (const setName of this.outputVariable.sets.keys()) {
      outputSetStrengths.set(setName, 0);
    }

    const ruleActivations = [];
    for (const rule of this.rules) {
      const alpha = rule.evaluate(fuzzifiedInputs);
      ruleActivations.push({
        rule: rule.description,
        alpha: alpha,
        consequentSet: rule.consequent.set
      });

      // Operador MAX para reglas que concluyen en el mismo conjunto
      const currentMax = outputSetStrengths.get(rule.consequent.set) || 0;
      if (alpha > currentMax) {
        outputSetStrengths.set(rule.consequent.set, alpha);
      }
    }

    // 3 & 4. Defuzzificación por Centroide (COG) con recorte Mamdani
    const yMin = this.outputVariable.min;
    const yMax = this.outputVariable.max;
    const dy = (yMax - yMin) / this.discretizationSteps;

    let numerator = 0;
    let denominator = 0;
    const aggregatedCurve = [];

    for (let i = 0; i <= this.discretizationSteps; i++) {
      const y = yMin + i * dy;
      let muAgg = 0;

      // Implicación Mamdani: min(mu_set(y), alpha_set) y agregación max
      for (const [setName, alpha] of outputSetStrengths.entries()) {
        if (alpha > 0) {
          const mf = this.outputVariable.getSet(setName);
          if (mf) {
            const muSet = mf.evaluate(y);
            const clipped = Math.min(muSet, alpha);
            if (clipped > muAgg) {
              muAgg = clipped;
            }
          }
        }
      }

      aggregatedCurve.push({ y, mu: muAgg });
      numerator += y * muAgg;
      denominator += muAgg;
    }

    // Salvaguarda matemática contra división por cero
    let crispOutput;
    if (denominator < 1e-6) {
      crispOutput = this.fallbackValue;
    } else {
      crispOutput = numerator / denominator;
    }

    return {
      output: crispOutput,
      fuzzifiedInputs,
      ruleActivations,
      outputSetStrengths: Object.fromEntries(outputSetStrengths),
      aggregatedCurve
    };
  }
}
