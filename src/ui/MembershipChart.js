/**
 * Gráfico Interactivo de Funciones de Pertenencia y Defuzzificación por Centroide
 * Diseñado para la demostración académica de las 4 fases de la lógica difusa.
 */
export class MembershipChart {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.colors = ['#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'];
    this.isLightMode = true;
  }

  setTheme(isLight) {
    this.isLightMode = isLight;
  }

  /**
   * Fase 1: Fuzzificación — Dibuja las funciones de pertenencia de una variable lingüística
   * @param {LinguisticVariable} variable
   * @param {number} currentVal Valor crisp de entrada actual
   */
  render(variable, currentVal = 0) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (!variable) return;

    const padLeft = 32;
    const padRight = 16;
    const padTop = 18;
    const padBottom = 22;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const axisColor = this.isLightMode ? '#94a3b8' : '#475569';
    const textColor = this.isLightMode ? '#64748b' : '#94a3b8';
    const crispLineColor = this.isLightMode ? '#0f172a' : '#f8fafc';

    // Ejes de coordenadas
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.lineTo(padLeft + plotW, padTop + plotH);
    ctx.stroke();

    // Etiquetas de eje Y (0.0 y 1.0)
    ctx.fillStyle = textColor;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('1.0', padLeft - 6, padTop);
    ctx.fillText('0.0', padLeft - 6, padTop + plotH);

    // Mapeo de coordenadas
    const xRange = Math.max(0.001, variable.max - variable.min);
    const xToCanvas = (val) => padLeft + ((val - variable.min) / xRange) * plotW;
    const yToCanvas = (mu) => padTop + plotH - mu * plotH;

    // Dibujar cada conjunto difuso
    let colorIdx = 0;
    const stepCount = 80;

    for (const [setName, mf] of variable.sets.entries()) {
      const color = this.colors[colorIdx % this.colors.length];
      colorIdx++;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let s = 0; s <= stepCount; s++) {
        const xVal = variable.min + (s / stepCount) * xRange;
        const mu = mf.evaluate(xVal);
        const cx = xToCanvas(xVal);
        const cy = yToCanvas(mu);
        if (s === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      // Grado de pertenencia en el valor crisp
      const muAtCurrent = mf.evaluate(currentVal);
      ctx.fillStyle = color;
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${setName}: ${muAtCurrent.toFixed(2)}`, padLeft + (colorIdx - 1) * 82, padTop - 5);
    }

    // Línea vertical del valor crisp actual
    const clampedVal = Math.max(variable.min, Math.min(variable.max, currentVal));
    const curX = xToCanvas(clampedVal);

    ctx.strokeStyle = crispLineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(curX, padTop);
    ctx.lineTo(curX, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Etiqueta del valor actual
    ctx.fillStyle = crispLineColor;
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`x = ${currentVal.toFixed(2)}`, curX, padTop + plotH + 15);
  }

  /**
   * Fase 4: Defuzzificación — Dibuja el conjunto agregado resultante y el Centroide (COG)
   * @param {LinguisticVariable} outputVariable
   * @param {Array<{y: number, mu: number}>} aggregatedCurve
   * @param {number} centroidVal
   */
  renderDefuzzification(outputVariable, aggregatedCurve, centroidVal = 0) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (!outputVariable || !aggregatedCurve || aggregatedCurve.length === 0) return;

    const padLeft = 32;
    const padRight = 16;
    const padTop = 18;
    const padBottom = 22;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const axisColor = this.isLightMode ? '#94a3b8' : '#475569';
    const textColor = this.isLightMode ? '#64748b' : '#94a3b8';

    // Ejes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.lineTo(padLeft + plotW, padTop + plotH);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('1.0', padLeft - 6, padTop);
    ctx.fillText('0.0', padLeft - 6, padTop + plotH);

    const xRange = Math.max(0.001, outputVariable.max - outputVariable.min);
    const xToCanvas = (val) => padLeft + ((val - outputVariable.min) / xRange) * plotW;
    const yToCanvas = (mu) => padTop + plotH - mu * plotH;

    // Relleno sombreado del área agregada Mamdani recortada
    ctx.beginPath();
    ctx.moveTo(xToCanvas(aggregatedCurve[0].y), yToCanvas(0));

    for (let i = 0; i < aggregatedCurve.length; i++) {
      const pt = aggregatedCurve[i];
      ctx.lineTo(xToCanvas(pt.y), yToCanvas(pt.mu));
    }

    ctx.lineTo(xToCanvas(aggregatedCurve[aggregatedCurve.length - 1].y), yToCanvas(0));
    ctx.closePath();

    ctx.fillStyle = 'rgba(14, 165, 233, 0.28)'; // Azul cian translúcido
    ctx.fill();

    // Contorno del conjunto difuso agregado
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < aggregatedCurve.length; i++) {
      const pt = aggregatedCurve[i];
      const cx = xToCanvas(pt.y);
      const cy = yToCanvas(pt.mu);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Línea vertical roja del Centroide (COG)
    const curX = xToCanvas(Math.max(outputVariable.min, Math.min(outputVariable.max, centroidVal)));
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(curX, padTop);
    ctx.lineTo(curX, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Punto rojo en el centroide
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(curX, yToCanvas(0), 4, 0, Math.PI * 2);
    ctx.fill();

    // Etiqueta del valor Centroide
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Centroide (COG) = ${centroidVal.toFixed(2)}`, curX, padTop + plotH + 15);
  }
}
