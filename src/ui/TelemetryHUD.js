/**
 * HUD Académico de Telemetría y Demostración de las 4 Fases de Lógica Difusa
 * 
 * FASE 1: Fuzzificador (Mapeo de entradas crisp a grados de pertenencia mu in [0, 1])
 * FASE 2: Base de Reglas (Matriz de conocimiento experto con estado activo iluminado)
 * FASE 3: Motor de Inferencia (Conjunción Mamdani MIN, implicación y agregación MAX)
 * FASE 4: Defuzzificador (Cálculo del Centroide COG y comando crisp de salida)
 */
export class TelemetryHUD {
  constructor(domElements) {
    this.elements = domElements;
    this.activeTab = 'steering'; // 'steering' | 'speed'
    this.renderedController = null;

    this.initTabs();
  }

  initTabs() {
    const btnSteer = document.getElementById('btnTabSteering');
    const btnSpeed = document.getElementById('btnTabSpeed');

    if (btnSteer && btnSpeed) {
      btnSteer.addEventListener('click', () => {
        this.activeTab = 'steering';
        btnSteer.className = 'flex-1 py-1.5 rounded-md bg-sky-600 text-white font-bold transition shadow-sm text-center text-xs';
        btnSpeed.className = 'flex-1 py-1.5 rounded-md text-slate-600 hover:text-slate-900 font-medium transition text-center text-xs';
        this.renderedController = null; // Forzar reconstrucción de estructura estática
      });

      btnSpeed.addEventListener('click', () => {
        this.activeTab = 'speed';
        btnSpeed.className = 'flex-1 py-1.5 rounded-md bg-sky-600 text-white font-bold transition shadow-sm text-center text-xs';
        btnSteer.className = 'flex-1 py-1.5 rounded-md text-slate-600 hover:text-slate-900 font-medium transition text-center text-xs';
        this.renderedController = null;
      });
    }
  }

  update({
    speed,
    accelCmd,
    steerAngleDeg,
    sensorReadings,
    speedEval,
    steerEval,
    speedController,
    steeringController,
    isArrived
  }) {
    if (!this.elements.speedValue) return;

    // 1. Tacómetro y Actuadores Visuales
    this.elements.speedValue.textContent = `${speed.toFixed(1)} u/s`;
    const speedPercent = Math.min(100, (speed / 5.5) * 100);
    if (this.elements.speedBar) this.elements.speedBar.style.width = `${speedPercent}%`;

    const accelPercent = Math.round(accelCmd * 100);
    if (this.elements.accelValue && this.elements.accelBar) {
      if (accelCmd >= 0) {
        this.elements.accelValue.textContent = `+${accelPercent}% (Acelerando)`;
        this.elements.accelValue.className = 'font-mono font-bold text-emerald-600 text-right';
        this.elements.accelBar.style.width = `${accelPercent}%`;
        this.elements.accelBar.className = 'h-full bg-emerald-500 rounded-full transition-all duration-75';
      } else {
        this.elements.accelValue.textContent = `${accelPercent}% (Frenando)`;
        this.elements.accelValue.className = 'font-mono font-bold text-rose-600 text-right';
        this.elements.accelBar.style.width = `${Math.abs(accelPercent)}%`;
        this.elements.accelBar.className = 'h-full bg-rose-500 rounded-full transition-all duration-75';
      }
    }

    if (this.elements.steerValue) {
      this.elements.steerValue.textContent = `${steerAngleDeg.toFixed(1)}°`;
    }
    if (this.elements.steerNeedle) {
      this.elements.steerNeedle.style.transform = `rotate(${steerAngleDeg}deg)`;
    }

    // Estado de conducción
    const badge = this.elements.statusBadge || document.getElementById('statusBadge');
    if (badge) {
      if (isArrived) {
        badge.textContent = '🏁 Meta Alcanzada';
        badge.className = 'px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 animate-pulse';
      } else if (sensorReadings && sensorReadings.isEvading) {
        badge.textContent = '⚠️ Evasión Carril Izq';
        badge.className = 'px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse';
      } else if (speed > 0.1) {
        badge.textContent = '🚗 Conducción Activa';
        badge.className = 'px-2 py-0.5 text-[11px] font-bold rounded-full bg-sky-100 text-sky-700 border border-sky-300';
      } else {
        badge.textContent = '⏸ En Espera';
        badge.className = 'px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-300';
      }
    }

    // 2. Actualizar las 4 FASES según el controlador seleccionado
    if (this.activeTab === 'steering') {
      this.updateFourPhases({
        controllerName: 'Dirección (Volante)',
        controller: steeringController,
        evalResult: steerEval,
        crispInputs: {
          'Error_Lateral': {
            label: 'Error Lateral (e_lat)',
            val: sensorReadings ? sensorReadings.lateralError : 0,
            unit: 'casillas',
            variable: steeringController?.varLatErr
          },
          'Error_Orientacion': {
            label: 'Error Orientación (θ_e)',
            val: sensorReadings ? sensorReadings.headingErrorDeg : 0,
            unit: '°',
            variable: steeringController?.varAngErr
          }
        },
        outputVar: steeringController?.varSteer,
        outputUnit: '° (Volante)',
        outputSignText: steerAngleDeg > 1 ? 'Derecha' : (steerAngleDeg < -1 ? 'Izquierda' : 'Recto')
      });
    } else {
      this.updateFourPhases({
        controllerName: 'Velocidad y Frenado',
        controller: speedController,
        evalResult: speedEval,
        crispInputs: {
          'Distancia_Parada': {
            label: 'Distancia de Parada',
            val: sensorReadings ? sensorReadings.stopDistance : 10,
            unit: 'casillas',
            variable: speedController?.varDistStop
          },
          'Dificultad_Curva': {
            label: 'Dificultad de Curva',
            val: sensorReadings ? sensorReadings.curveDifficulty : 0,
            unit: '/ 10',
            variable: speedController?.varCurvDiff
          },
          'Velocidad_Actual': {
            label: 'Velocidad Actual',
            val: speed,
            unit: 'u/s',
            variable: speedController?.varSpeed
          }
        },
        outputVar: speedController?.varAcc,
        outputUnit: 'Aceleración [-1, +1]',
        outputSignText: accelCmd > 0.05 ? 'Acelerando' : (accelCmd < -0.05 ? 'Frenando' : 'Manteniendo')
      });
    }
  }

  updateFourPhases({
    controllerName,
    controller,
    evalResult,
    crispInputs,
    outputVar,
    outputUnit,
    outputSignText
  }) {
    if (!evalResult) return;

    // A. Reconstruir esqueleto HTML solo al cambiar de controlador (para CERO saltos o DOM thrashing)
    if (this.renderedController !== controllerName) {
      this.buildStaticStructure(crispInputs, controller, outputVar);
      this.renderedController = controllerName;
    }

    // ==========================================
    // FASE 1: Actualizar Fuzzificador
    // ==========================================
    for (const [varName, info] of Object.entries(crispInputs)) {
      const valEl = document.getElementById(`fuzzVal_${varName}`);
      if (valEl) valEl.textContent = `${info.val.toFixed(2)} ${info.unit}`;

      const varSets = evalResult.fuzzifiedInputs[varName] || {};
      for (const [setName, mu] of Object.entries(varSets)) {
        const barEl = document.getElementById(`fuzzBar_${varName}_${setName}`);
        const muEl = document.getElementById(`fuzzMu_${varName}_${setName}`);
        if (barEl) barEl.style.width = `${Math.round(mu * 100)}%`;
        if (muEl) {
          muEl.textContent = mu.toFixed(2);
          muEl.className = mu > 0.05
            ? 'font-mono text-[10px] font-bold text-sky-700 bg-sky-100 px-1 rounded'
            : 'font-mono text-[10px] text-slate-400';
        }
      }
    }

    // ==========================================
    // FASE 2: Actualizar Base de Reglas (Iluminación sin salto)
    // ==========================================
    let activeCount = 0;
    const activations = evalResult.ruleActivations || [];

    for (let i = 0; i < activations.length; i++) {
      const act = activations[i];
      const rowEl = document.getElementById(`ruleRow_${i}`);
      const badgeEl = document.getElementById(`ruleBadge_${i}`);

      if (act.alpha > 0.01) {
        activeCount++;
        if (rowEl) {
          rowEl.className = 'flex items-center justify-between p-1.5 rounded border border-amber-300 bg-amber-50/80 text-slate-900 transition-colors duration-100 shadow-xs';
        }
        if (badgeEl) {
          badgeEl.textContent = `α = ${act.alpha.toFixed(2)}`;
          badgeEl.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 text-amber-900 border border-amber-300';
        }
      } else {
        if (rowEl) {
          rowEl.className = 'flex items-center justify-between p-1.5 rounded border border-slate-100 bg-slate-50/40 text-slate-400 opacity-60 transition-colors duration-100';
        }
        if (badgeEl) {
          badgeEl.textContent = 'α = 0.00';
          badgeEl.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100';
        }
      }
    }

    const countBadge = document.getElementById('activeRulesCountBadge');
    if (countBadge) {
      countBadge.textContent = `${activeCount} de ${activations.length} Activas`;
      countBadge.className = activeCount > 0
        ? 'text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold'
        : 'text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500';
    }

    // ==========================================
    // FASE 3: Motor de Inferencia (Agregación de Salida)
    // ==========================================
    const strengths = evalResult.outputSetStrengths || {};
    for (const [setName, alpha] of Object.entries(strengths)) {
      const barEl = document.getElementById(`infBar_${setName}`);
      const textEl = document.getElementById(`infText_${setName}`);
      if (barEl) barEl.style.width = `${Math.round(alpha * 100)}%`;
      if (textEl) {
        textEl.textContent = alpha.toFixed(2);
        textEl.className = alpha > 0.01
          ? 'font-mono text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded'
          : 'font-mono text-[10px] text-slate-400';
      }
    }

    // ==========================================
    // FASE 4: Defuzzificador (Centroide COG)
    // ==========================================
    const defuzzBadge = document.getElementById('defuzzOutputBadge');
    if (defuzzBadge) {
      defuzzBadge.textContent = `${evalResult.output.toFixed(2)} (${outputSignText})`;
    }
  }

  buildStaticStructure(crispInputs, controller, outputVar) {
    // 1. Construir Contenedor de Fuzzificación
    const fuzzCont = document.getElementById('fuzzifierContainer');
    if (fuzzCont) {
      fuzzCont.innerHTML = Object.entries(crispInputs).map(([varName, info]) => `
        <div class="bg-slate-50/80 p-2 rounded-lg border border-slate-200/80 flex flex-col gap-1.5">
          <div class="flex justify-between items-center">
            <span class="font-semibold text-slate-700 text-[11px]">${info.label}:</span>
            <span id="fuzzVal_${varName}" class="font-mono font-bold text-sky-800 text-[11px]">0.00</span>
          </div>
          <div class="grid grid-cols-1 gap-1">
            ${Array.from(info.variable.sets.keys()).map(setName => `
              <div class="flex items-center gap-2 text-[10px]">
                <span class="w-20 text-slate-500 truncate font-medium">${setName}:</span>
                <div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div id="fuzzBar_${varName}_${setName}" class="h-full bg-sky-500 rounded-full transition-all duration-75" style="width: 0%"></div>
                </div>
                <span id="fuzzMu_${varName}_${setName}" class="w-8 text-right font-mono text-slate-400">0.00</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    // 2. Construir Lista Fija de Base de Reglas
    const rulesCont = document.getElementById('rulesListContainer');
    if (rulesCont && controller) {
      rulesCont.innerHTML = controller.engine.rules.map((rule, idx) => `
        <div id="ruleRow_${idx}" class="flex items-center justify-between p-1.5 rounded border border-slate-100 bg-slate-50/40 text-slate-400 opacity-60 transition-colors duration-100">
          <span class="truncate max-w-[240px] text-[10px] font-sans" title="${rule.description}">${rule.description}</span>
          <span id="ruleBadge_${idx}" class="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100 shrink-0">α = 0.00</span>
        </div>
      `).join('');
    }

    // 3. Construir Contenedor de Inferencia (Agregación)
    const infCont = document.getElementById('inferenceContainer');
    if (infCont && outputVar) {
      infCont.innerHTML = Array.from(outputVar.sets.keys()).map(setName => `
        <div class="flex items-center gap-2 text-[10px] py-0.5">
          <span class="w-24 text-slate-600 truncate font-medium">${setName}:</span>
          <div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div id="infBar_${setName}" class="h-full bg-emerald-500 rounded-full transition-all duration-75" style="width: 0%"></div>
          </div>
          <span id="infText_${setName}" class="w-8 text-right font-mono text-slate-400">0.00</span>
        </div>
      `).join('');
    }
  }
}
