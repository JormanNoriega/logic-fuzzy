import { LinguisticVariable } from './LinguisticVariable.js';
import { TriangularMF, TrapezoidalMF } from './MembershipFunction.js';
import { FuzzyRule } from './FuzzyRule.js';
import { MamdaniEngine } from './MamdaniEngine.js';

/**
 * Controlador Difuso de Velocidad y Frenado (Mamdani)
 * Regula la aceleración y frenado considerando simultáneamente:
 * 1. Distancia de parada (mínimo entre obstáculo y meta)
 * 2. Dificultad y proximidad de la curva próxima
 * 3. Velocidad actual del vehículo
 * 
 * Garantiza arranque desde reposo ante curvas si la vía está despejada,
 * pero NUNCA acelera si existe un obstáculo o meta peligrosamente próximos.
 */
export class SpeedFuzzyController {
  constructor() {
    this.initVariables();
    this.initRules();
  }

  initVariables() {
    // 1. Distancia de Parada (min entre obstáculo y destino) en casillas [0, 10]
    // Calibrado: Muy_Cerca focalizado en [0, 0, 0.60, 1.10] para no frenar prematuramente a 1.2m de la meta
    this.varDistStop = new LinguisticVariable('Distancia_Parada', 0, 10);
    this.mfDistMuyCerca = new TrapezoidalMF('Muy_Cerca', 0, 0, 0.60, 1.10);
    this.mfDistMedia = new TriangularMF('Media', 0.95, 2.2, 4.5);
    this.mfDistLejos = new TrapezoidalMF('Lejos', 3.5, 5.2, 10, 10);
    this.varDistStop
      .addSet(this.mfDistMuyCerca)
      .addSet(this.mfDistMedia)
      .addSet(this.mfDistLejos);

    // 2. Dificultad de la Curva Próxima [0, 10]
    this.varCurvDiff = new LinguisticVariable('Dificultad_Curva', 0, 10);
    this.mfCurvBaja = new TrapezoidalMF('Baja', 0, 0, 1.5, 3.5);
    this.mfCurvMedia = new TriangularMF('Media', 2.5, 4.5, 6.8);
    this.mfCurvAlta = new TrapezoidalMF('Alta', 5.5, 7.5, 10, 10);
    this.varCurvDiff
      .addSet(this.mfCurvBaja)
      .addSet(this.mfCurvMedia)
      .addSet(this.mfCurvAlta);

    // 3. Velocidad Actual [0, 8] u/s
    this.varSpeed = new LinguisticVariable('Velocidad_Actual', 0, 8);
    this.mfSpeedLenta = new TrapezoidalMF('Lenta', 0, 0, 0.45, 0.95);
    this.mfSpeedMedia = new TriangularMF('Media', 0.8, 1.6, 2.6);
    this.mfSpeedRapida = new TrapezoidalMF('Rapida', 2.2, 3.5, 8, 8);
    this.varSpeed
      .addSet(this.mfSpeedLenta)
      .addSet(this.mfSpeedMedia)
      .addSet(this.mfSpeedRapida);

    // Salida: Aceleración / Frenado [-1.0, 1.0]
    this.varAcc = new LinguisticVariable('Aceleracion_Freno', -1.0, 1.0);
    this.varAcc
      .addSet(new TrapezoidalMF('Frenar_Fuerte', -1.0, -1.0, -0.75, -0.45))
      .addSet(new TriangularMF('Frenar_Suave', -0.55, -0.30, 0.0))
      .addSet(new TriangularMF('Mantener', -0.15, 0.0, 0.15))
      .addSet(new TriangularMF('Acelerar_Suave', 0.05, 0.30, 0.55))
      .addSet(new TrapezoidalMF('Acelerar_Fuerte', 0.45, 0.75, 1.0, 1.0));

    this.engine = new MamdaniEngine('Controlador_Velocidad', this.varAcc, 0.0);
    this.engine
      .addInputVariable(this.varDistStop)
      .addInputVariable(this.varCurvDiff)
      .addInputVariable(this.varSpeed);
  }

  initRules() {
    const rules = [
      // ==============================================================
      // BLOQUE 1: DISTANCIA DE PARADA CRÍTICA (Obstáculo o Meta MUY CERCA)
      // Prioridad máxima: frenar o mantenerse detenido. NUNCA acelerar.
      // ==============================================================
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Muy_Cerca' }, { variable: 'Velocidad_Actual', set: 'Rapida' }],
        con: { variable: 'Aceleracion_Freno', set: 'Frenar_Fuerte' },
        desc: 'SI Parada Muy Cerca Y Vel Rapida ENTONCES Frenar Fuerte'
      },
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Muy_Cerca' }, { variable: 'Velocidad_Actual', set: 'Media' }],
        con: { variable: 'Aceleracion_Freno', set: 'Frenar_Suave' },
        desc: 'SI Parada Muy Cerca Y Vel Media ENTONCES Frenar Suave'
      },
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Muy_Cerca' }, { variable: 'Velocidad_Actual', set: 'Lenta' }],
        con: { variable: 'Aceleracion_Freno', set: 'Mantener' },
        desc: 'SI Parada Muy Cerca Y Vel Lenta ENTONCES Mantener (Fricción detiene suavemente)'
      },

      // ==============================================================
      // BLOQUE 2: VÍA DESPEJADA (Lejos) O MODERADA (Media) CON CURVA ALTA
      // Permite acelerar suavemente desde reposo para alcanzar velocidad de giro,
      // pero reduce velocidad si ya se viene rápido.
      // ==============================================================
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Lejos' }, { variable: 'Dificultad_Curva', set: 'Alta' }, { variable: 'Velocidad_Actual', set: 'Lenta' }],
        con: { variable: 'Aceleracion_Freno', set: 'Acelerar_Suave' },
        desc: 'SI Distancia Lejos Y Curva Alta Y Vel Lenta ENTONCES Acelerar Suave (Arranque hacia curva)'
      },
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Media' }, { variable: 'Dificultad_Curva', set: 'Alta' }, { variable: 'Velocidad_Actual', set: 'Lenta' }],
        con: { variable: 'Aceleracion_Freno', set: 'Acelerar_Suave' },
        desc: 'SI Distancia Media Y Curva Alta Y Vel Lenta ENTONCES Acelerar Suave (Arranque hacia curva)'
      },
      {
        ant: [{ variable: 'Dificultad_Curva', set: 'Alta' }, { variable: 'Velocidad_Actual', set: 'Media' }],
        con: { variable: 'Aceleracion_Freno', set: 'Frenar_Suave' },
        desc: 'SI Curva Alta Y Vel Media ENTONCES Frenar Suave (Ajuste a velocidad de giro)'
      },
      {
        ant: [{ variable: 'Dificultad_Curva', set: 'Alta' }, { variable: 'Velocidad_Actual', set: 'Rapida' }],
        con: { variable: 'Aceleracion_Freno', set: 'Frenar_Fuerte' },
        desc: 'SI Curva Alta Y Vel Rapida ENTONCES Frenar Fuerte'
      },

      // ==============================================================
      // BLOQUE 3: CURVA MODERADA (Media) CON VÍA DESPEJADA O MEDIA
      // ==============================================================
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Lejos' }, { variable: 'Dificultad_Curva', set: 'Media' }, { variable: 'Velocidad_Actual', set: 'Lenta' }],
        con: { variable: 'Aceleracion_Freno', set: 'Acelerar_Suave' },
        desc: 'SI Distancia Lejos Y Curva Media Y Vel Lenta ENTONCES Acelerar Suave'
      },
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Media' }, { variable: 'Dificultad_Curva', set: 'Media' }, { variable: 'Velocidad_Actual', set: 'Lenta' }],
        con: { variable: 'Aceleracion_Freno', set: 'Acelerar_Suave' },
        desc: 'SI Distancia Media Y Curva Media Y Vel Lenta ENTONCES Acelerar Suave'
      },
      {
        ant: [{ variable: 'Dificultad_Curva', set: 'Media' }, { variable: 'Velocidad_Actual', set: 'Media' }],
        con: { variable: 'Aceleracion_Freno', set: 'Mantener' },
        desc: 'SI Curva Media Y Vel Media ENTONCES Mantener'
      },
      {
        ant: [{ variable: 'Dificultad_Curva', set: 'Media' }, { variable: 'Velocidad_Actual', set: 'Rapida' }],
        con: { variable: 'Aceleracion_Freno', set: 'Frenar_Suave' },
        desc: 'SI Curva Media Y Vel Rapida ENTONCES Frenar Suave'
      },

      // ==============================================================
      // BLOQUE 4: RECTA TOTALMENTE DESPEJADA (Distancia Lejos + Curva Baja)
      // Crucero pleno
      // ==============================================================
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Lejos' }, { variable: 'Dificultad_Curva', set: 'Baja' }, { variable: 'Velocidad_Actual', set: 'Lenta' }],
        con: { variable: 'Aceleracion_Freno', set: 'Acelerar_Fuerte' },
        desc: 'SI Distancia Lejos Y Curva Baja Y Vel Lenta ENTONCES Acelerar Fuerte'
      },
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Lejos' }, { variable: 'Dificultad_Curva', set: 'Baja' }, { variable: 'Velocidad_Actual', set: 'Media' }],
        con: { variable: 'Aceleracion_Freno', set: 'Acelerar_Suave' },
        desc: 'SI Distancia Lejos Y Curva Baja Y Vel Media ENTONCES Acelerar Suave'
      },
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Lejos' }, { variable: 'Dificultad_Curva', set: 'Baja' }, { variable: 'Velocidad_Actual', set: 'Rapida' }],
        con: { variable: 'Aceleracion_Freno', set: 'Mantener' },
        desc: 'SI Distancia Lejos Y Curva Baja Y Vel Rapida ENTONCES Mantener'
      },

      // ==============================================================
      // BLOQUE 5: RECTA A DISTANCIA MEDIA (Aproximación a destino o punto)
      // ==============================================================
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Media' }, { variable: 'Dificultad_Curva', set: 'Baja' }, { variable: 'Velocidad_Actual', set: 'Lenta' }],
        con: { variable: 'Aceleracion_Freno', set: 'Acelerar_Suave' },
        desc: 'SI Distancia Media Y Curva Baja Y Vel Lenta ENTONCES Acelerar Suave'
      },
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Media' }, { variable: 'Dificultad_Curva', set: 'Baja' }, { variable: 'Velocidad_Actual', set: 'Media' }],
        con: { variable: 'Aceleracion_Freno', set: 'Mantener' },
        desc: 'SI Distancia Media Y Curva Baja Y Vel Media ENTONCES Mantener'
      },
      {
        ant: [{ variable: 'Distancia_Parada', set: 'Media' }, { variable: 'Dificultad_Curva', set: 'Baja' }, { variable: 'Velocidad_Actual', set: 'Rapida' }],
        con: { variable: 'Aceleracion_Freno', set: 'Frenar_Suave' },
        desc: 'SI Distancia Media Y Curva Baja Y Vel Rapida ENTONCES Frenar Suave'
      }
    ];

    for (const r of rules) {
      this.engine.addRule(new FuzzyRule(r.ant, r.con, r.desc));
    }
  }

  tuneParameters({ stopNearThreshold, curveSensitivity }) {
    if (stopNearThreshold !== undefined) {
      this.mfDistMuyCerca.setParams(0, 0, stopNearThreshold * 0.6, stopNearThreshold);
      this.mfDistMedia.setParams(stopNearThreshold * 0.8, stopNearThreshold * 1.5, stopNearThreshold * 2.5);
    }
    if (curveSensitivity !== undefined) {
      const thr = 10 - curveSensitivity;
      this.mfCurvAlta.setParams(thr * 0.7, thr, 10, 10);
      this.mfCurvMedia.setParams(thr * 0.4, thr * 0.7, thr * 0.95);
    }
  }

  evaluate(distStop, curvDiff, currentSpeed) {
    return this.engine.evaluate({
      Distancia_Parada: distStop,
      Dificultad_Curva: curvDiff,
      Velocidad_Actual: currentSpeed
    });
  }
}
