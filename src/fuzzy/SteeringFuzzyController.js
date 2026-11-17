import { LinguisticVariable } from './LinguisticVariable.js';
import { TriangularMF, TrapezoidalMF } from './MembershipFunction.js';
import { FuzzyRule } from './FuzzyRule.js';
import { MamdaniEngine } from './MamdaniEngine.js';

/**
 * Controlador Difuso de Dirección (Mamdani)
 * Matriz completa de 9 reglas con amortiguamiento activo para evitar sobre-oscilaciones.
 * 
 * Convención de signos:
 * - Error Lateral < 0: Vehículo a la IZQUIERDA del centro (necesita corrección a la derecha).
 * - Error Lateral > 0: Vehículo a la DERECHA del centro (necesita corrección a la izquierda).
 * - Error Orientación < 0: Vehículo apuntando a la IZQUIERDA de la tangente.
 * - Error Orientación > 0: Vehículo apuntando a la DERECHA de la tangente.
 * - Salida Ángulo Volante: Negativo = Girar a la Izquierda, Positivo = Girar a la Derecha.
 */
export class SteeringFuzzyController {
  constructor() {
    this.initVariables();
    this.initRules();
  }

  initVariables() {
    // 1. Error Lateral [-1.5, 1.5] casillas de desviación del centro
    // Calibración precisa: Centrado estricto en +/-0.06 casillas (+/-0.12m)
    this.varLatErr = new LinguisticVariable('Error_Lateral', -1.5, 1.5);
    this.mfLatIzq = new TrapezoidalMF('Izquierda', -1.5, -1.5, -0.16, -0.02);
    this.mfLatCen = new TriangularMF('Centrado', -0.06, 0.0, 0.06);
    this.mfLatDer = new TrapezoidalMF('Derecha', 0.02, 0.16, 1.5, 1.5);
    this.varLatErr
      .addSet(this.mfLatIzq)
      .addSet(this.mfLatCen)
      .addSet(this.mfLatDer);

    // 2. Error Angular de Orientación [-60, 60] grados sexagesimales
    this.varAngErr = new LinguisticVariable('Error_Orientacion', -60, 60);
    this.mfAngIzq = new TrapezoidalMF('Apuntando_Izq', -60, -60, -20, -5);
    this.mfAngAli = new TriangularMF('Alineado', -8, 0, 8);
    this.mfAngDer = new TrapezoidalMF('Apuntando_Der', 5, 20, 60, 60);
    this.varAngErr
      .addSet(this.mfAngIzq)
      .addSet(this.mfAngAli)
      .addSet(this.mfAngDer);

    // Salida: Ángulo de Volante [-42, 42] grados (acorde a delta_max = 42 deg de CarKinematics)
    this.varSteer = new LinguisticVariable('Angulo_Volante', -42, 42);
    this.varSteer
      .addSet(new TrapezoidalMF('Fuerte_Izq', -42, -42, -32, -20))
      .addSet(new TriangularMF('Suave_Izq', -26, -16, -4))
      .addSet(new TriangularMF('Recto', -3.5, 0, 3.5))
      .addSet(new TriangularMF('Suave_Der', 4, 16, 26))
      .addSet(new TrapezoidalMF('Fuerte_Der', 20, 32, 42, 42));

    this.engine = new MamdaniEngine('Controlador_Direccion', this.varSteer, 0.0);
    this.engine
      .addInputVariable(this.varLatErr)
      .addInputVariable(this.varAngErr);
  }

  initRules() {
    // Matriz de 9 reglas exhaustivas con amortiguamiento
    const rules = [
      // Fila 1: Error Lateral = Izquierda (está a la izquierda de la carretera)
      {
        ant: [{ variable: 'Error_Lateral', set: 'Izquierda' }, { variable: 'Error_Orientacion', set: 'Apuntando_Izq' }],
        con: { variable: 'Angulo_Volante', set: 'Fuerte_Der' },
        desc: 'SI Izq Y Apuntando Izq ENTONCES Giro Fuerte Der'
      },
      {
        ant: [{ variable: 'Error_Lateral', set: 'Izquierda' }, { variable: 'Error_Orientacion', set: 'Alineado' }],
        con: { variable: 'Angulo_Volante', set: 'Suave_Der' },
        desc: 'SI Izq Y Alineado ENTONCES Giro Suave Der'
      },
      {
        ant: [{ variable: 'Error_Lateral', set: 'Izquierda' }, { variable: 'Error_Orientacion', set: 'Apuntando_Der' }],
        con: { variable: 'Angulo_Volante', set: 'Recto' },
        desc: 'SI Izq Y Apuntando Der ENTONCES Recto (Amortiguado)'
      },

      // Fila 2: Error Lateral = Centrado
      {
        ant: [{ variable: 'Error_Lateral', set: 'Centrado' }, { variable: 'Error_Orientacion', set: 'Apuntando_Izq' }],
        con: { variable: 'Angulo_Volante', set: 'Fuerte_Der' },
        desc: 'SI Centrado Y Apuntando Izq ENTONCES Giro Fuerte Der'
      },
      {
        ant: [{ variable: 'Error_Lateral', set: 'Centrado' }, { variable: 'Error_Orientacion', set: 'Alineado' }],
        con: { variable: 'Angulo_Volante', set: 'Recto' },
        desc: 'SI Centrado Y Alineado ENTONCES Recto'
      },
      {
        ant: [{ variable: 'Error_Lateral', set: 'Centrado' }, { variable: 'Error_Orientacion', set: 'Apuntando_Der' }],
        con: { variable: 'Angulo_Volante', set: 'Fuerte_Izq' },
        desc: 'SI Centrado Y Apuntando Der ENTONCES Giro Fuerte Izq'
      },

      // Fila 3: Error Lateral = Derecha (está a la derecha de la carretera)
      {
        ant: [{ variable: 'Error_Lateral', set: 'Derecha' }, { variable: 'Error_Orientacion', set: 'Apuntando_Izq' }],
        con: { variable: 'Angulo_Volante', set: 'Recto' },
        desc: 'SI Der Y Apuntando Izq ENTONCES Recto (Amortiguado)'
      },
      {
        ant: [{ variable: 'Error_Lateral', set: 'Derecha' }, { variable: 'Error_Orientacion', set: 'Alineado' }],
        con: { variable: 'Angulo_Volante', set: 'Suave_Izq' },
        desc: 'SI Der Y Alineado ENTONCES Giro Suave Izq'
      },
      {
        ant: [{ variable: 'Error_Lateral', set: 'Derecha' }, { variable: 'Error_Orientacion', set: 'Apuntando_Der' }],
        con: { variable: 'Angulo_Volante', set: 'Fuerte_Izq' },
        desc: 'SI Der Y Apuntando Der ENTONCES Giro Fuerte Izq'
      }
    ];

    for (const r of rules) {
      this.engine.addRule(new FuzzyRule(r.ant, r.con, r.desc));
    }
  }

  evaluate(lateralError, headingErrorDeg) {
    return this.engine.evaluate({
      Error_Lateral: lateralError,
      Error_Orientacion: headingErrorDeg
    });
  }
}
