/**
 * Panel de Experimentación Académico
 * Permite sintonizar en vivo las funciones de pertenencia y comparar
 * métricas cuantitativas entre diferentes configuraciones difusas.
 */
export class ExperimentPanel {
  constructor({
    speedController,
    kinematics,
    onResetRun,
    domElements
  }) {
    this.speedController = speedController;
    this.kinematics = kinematics;
    this.onResetRun = onResetRun;
    this.elements = domElements;

    this.runHistory = [];
    this.currentRunMetrics = {
      startTime: 0,
      minObsDistance: Infinity,
      maxSpeed: 0,
      lateralErrors: [],
      completed: false
    };

    this.initEvents();
  }

  initEvents() {
    // Slider Umbral de Obstáculo Cercano
    if (this.elements.sliderStopNear) {
      this.elements.sliderStopNear.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.elements.valStopNear.textContent = `${val.toFixed(1)} casillas`;
        this.speedController.tuneParameters({ stopNearThreshold: val });
      });
    }

    // Slider Sensibilidad a Curvas
    if (this.elements.sliderCurveSens) {
      this.elements.sliderCurveSens.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.elements.valCurveSens.textContent = `${val.toFixed(0)}`;
        this.speedController.tuneParameters({ curveSensitivity: val });
      });
    }

    // Slider Velocidad Máxima
    if (this.elements.sliderMaxSpeed) {
      this.elements.sliderMaxSpeed.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.elements.valMaxSpeed.textContent = `${val.toFixed(1)} u/s`;
        this.kinematics.maxSpeed = val;
      });
    }

    // Botón Reejecutar
    if (this.elements.btnRerun) {
      this.elements.btnRerun.addEventListener('click', () => {
        this.startNewRun();
        if (this.onResetRun) this.onResetRun();
      });
    }

    // Botón Limpiar Historial
    if (this.elements.btnClearHistory) {
      this.elements.btnClearHistory.addEventListener('click', () => {
        this.runHistory = [];
        this.renderHistoryTable();
      });
    }
  }

  startNewRun() {
    this.currentRunMetrics = {
      startTime: performance.now(),
      minObsDistance: Infinity,
      maxSpeed: 0,
      lateralErrors: [],
      completed: false
    };
  }

  recordTick(speed, distToObstacle, lateralError) {
    if (this.currentRunMetrics.completed) return;

    if (speed > this.currentRunMetrics.maxSpeed) {
      this.currentRunMetrics.maxSpeed = speed;
    }

    if (distToObstacle < this.currentRunMetrics.minObsDistance) {
      this.currentRunMetrics.minObsDistance = distToObstacle;
    }

    this.currentRunMetrics.lateralErrors.push(Math.abs(lateralError));
  }

  finalizeRun(status) {
    if (this.currentRunMetrics.completed) return;
    this.currentRunMetrics.completed = true;

    const duration = ((performance.now() - this.currentRunMetrics.startTime) / 1000).toFixed(1);
    const stopNear = parseFloat(this.elements.sliderStopNear?.value || 2.2);

    // Error cuadrático medio lateral (RMSE)
    const errs = this.currentRunMetrics.lateralErrors;
    const rmse = errs.length > 0 
      ? Math.sqrt(errs.reduce((sum, e) => sum + e * e, 0) / errs.length).toFixed(3)
      : '0.000';

    const minObs = this.currentRunMetrics.minObsDistance < 9.5
      ? `${this.currentRunMetrics.minObsDistance.toFixed(2)} c`
      : 'N/A';

    this.runHistory.unshift({
      runId: this.runHistory.length + 1,
      stopNear: `${stopNear.toFixed(1)} c`,
      minObs,
      maxSpeed: `${this.currentRunMetrics.maxSpeed.toFixed(1)} u/s`,
      rmse: `${rmse} c`,
      duration: `${duration} s`,
      status
    });

    // Mantener máximo 8 registros
    if (this.runHistory.length > 8) {
      this.runHistory.pop();
    }

    this.renderHistoryTable();
  }

  renderHistoryTable() {
    if (!this.elements.historyTableBody) return;

    if (this.runHistory.length === 0) {
      this.elements.historyTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-slate-500 py-3 italic text-xs">Sin experimentos registrados aún</td>
        </tr>
      `;
      return;
    }

    this.elements.historyTableBody.innerHTML = this.runHistory.map(r => `
      <tr class="border-b border-slate-800 text-[11px] hover:bg-slate-800/40 font-mono">
        <td class="py-1 px-1.5 text-slate-400">#${r.runId}</td>
        <td class="py-1 px-1.5 text-amber-400">${r.stopNear}</td>
        <td class="py-1 px-1.5 text-rose-400">${r.minObs}</td>
        <td class="py-1 px-1.5 text-sky-400">${r.maxSpeed}</td>
        <td class="py-1 px-1.5 text-emerald-400">${r.rmse}</td>
        <td class="py-1 px-1.5 text-slate-300 font-sans">${r.status}</td>
      </tr>
    `).join('');
  }
}
