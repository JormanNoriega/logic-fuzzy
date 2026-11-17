# FuzzyDrive 3D — Laboratorio de Conducción Autónoma con Lógica Difusa

Simulador interactivo 3D en tiempo real desarrollado para la enseñanza y experimentación de **Lógica Difusa (Fuzzy Logic Mamdani)** aplicada al control de vehículos autónomos.

Construido con **JavaScript moderno (ES Modules)**, **Three.js** y **Vite**.

---

## 🚗 Características Principales

1. **Editor de Escenarios por Casillas (Grid 20×20):**
   - Construye carreteras rectas, curvas e intersecciones con clic y arrastre (estilo *PolyTown*).
   - Colocación de puntos de **Inicio 🚩**, **Meta 🏁**, **Obstáculos Físicos ⚠️** (conos) y **Carreteras Bloqueadas 🚫**.
2. **Planificación A\* Desacoplada del Control Continuo:**
   - **A\*** encuentra la ruta topológica de casillas conectadas y genera una trayectoria continua con curvas suavizadas (arcos Bezier).
   - Si una carretera se bloquea en tiempo real, A\* recalcula automáticamente el camino alternativo.
3. **Doble Controlador Difuso Mamdani Riguroso:**
   - **Controlador de Velocidad y Frenado:** Modula la aceleración en función de la distancia al obstáculo/meta, dificultad de la curva próxima y velocidad actual.
   - **Controlador de Dirección (Matriz de 9 Reglas Amortiguada):** Elimina el sobregiro y las oscilaciones cruzando el error lateral y el error de orientación.
4. **Telemetría e Inspección Académica en Vivo:**
   - Visualizador de rayos láser 3D (verde, amarillo, rojo).
   - Lista dinámica de reglas activas mostrando el grado de activación ($\mu$).
   - Gráfico 2D en tiempo real de funciones de pertenencia y valor crisp actual.
5. **Modo de Experimentación:**
   - Sliders para sintonizar en vivo las funciones de pertenencia (umbral de obstáculo cercano, sensibilidad a curvas, velocidad máxima).
   - Tabla comparativa de métricas por corrida (distancia de frenado, RMSE de error lateral, velocidad pico y tiempo total).
6. **3 Presets Académicos Listos para Exposición:**
   - *Curvas 90°:* Demuestra frenado preventivo y giro suave en esquinas cerradas.
   - *Obstáculo:* Demuestra detección láser y frenado de emergencia suave sin colisión.
   - *Ruta Alterna:* Demuestra replanificación en vivo cuando se bloquea una vía.
7. **Guardar y Cargar en JSON:** Exporta o importa tus pistas personalizadas en cualquier momento.

---

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js (v18+)

### Instalación y Ejecución
```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar suite de pruebas unitarias difusas
npm test

# 3. Iniciar el servidor local de desarrollo
npm run dev
```

Abre en tu navegador la dirección indicada (por defecto: `http://localhost:5173/`).

---

## 🔬 Estructura del Proyecto

```
logic-fuzzy/
├── src/
│   ├── fuzzy/                   # Motor Mamdani Puro
│   │   ├── MembershipFunction.js# Funciones Triangulares y Trapezoidales
│   │   ├── LinguisticVariable.js# Variables lingüísticas y universos de discurso
│   │   ├── FuzzyRule.js         # Reglas con T-norma MIN
│   │   ├── MamdaniEngine.js     # Inferencia y defuzzificación por Centroide (COG)
│   │   ├── SpeedFuzzyController.js   # Controlador de velocidad
│   │   └── SteeringFuzzyController.js# Controlador de dirección (9 reglas)
│   │
│   ├── grid/                    # Cuadrícula y Rutas
│   │   ├── GridMap.js           # Matriz 20x20
│   │   ├── RoadGeometry.js      # Mallas 3D de asfalto, conos y barricadas
│   │   ├── Pathfinder.js        # Algoritmo A*
│   │   └── TrajectoryGenerator.js # Spline continuo con esquinas redondeadas
│   │
│   ├── vehicle/                 # Cinemática y Sensores
│   │   ├── CarModel.js          # Malla 3D del coche con ruedas giratorias
│   │   ├── CarKinematics.js     # Modelo de bicicleta continuo
│   │   ├── VirtualSensors.js    # Proyección láser y telemetría de carril
│   │   └── RaycastVisualizer.js # Haces de láser 3D
│   │
│   ├── scenarios/               # Presets y JSON
│   │   ├── Presets.js           # 3 Escenarios demostrativos
│   │   └── Storage.js           # Exportar / Importar
│   │
│   └── ui/                      # HUD y Paneles
│       ├── CameraManager.js     # Vistas: Isométrica 3D, Cenital 2D y Persecución
│       ├── MembershipChart.js   # Gráfica 2D de funciones de pertenencia
│       ├── TelemetryHUD.js      # HUD en tiempo real
│       ├── ExperimentPanel.js   # Sintonizador y tabla comparativa
│       └── Toolbar.js           # Barra de herramientas y ratón
│
├── test/
│   └── verify.js                # Pruebas unitarias automatizadas
├── index.html                   # Interfaz de usuario
└── package.json
```

---

## 🎓 Fundamento de Lógica Difusa

### Controlador de Velocidad y Frenado
- **Entradas:**
  - `Distancia_Parada`: $d_{stop} = \min(d_{obstaculo}, d_{meta})$ (`Muy_Cerca`, `Media`, `Lejos`).
  - `Dificultad_Curva`: Proximidad y severidad del próximo giro (`Baja`, `Media`, `Alta`).
  - `Velocidad_Actual`: Rapidez física actual (`Lenta`, `Media`, `Rapida`).
- **Salida:**
  - `Aceleracion_Freno`: $[-1.0, 1.0]$ (`Frenar_Fuerte`, `Frenar_Suave`, `Mantener`, `Acelerar_Suave`, `Acelerar_Fuerte`).

### Controlador de Dirección Amortiguado (9 Reglas)
| $e_{lat}$ \ $e_{ang}$ | Apuntando Izquierda ($<0$) | Alineado ($\approx 0$) | Apuntando Derecha ($>0$) |
| :--- | :--- | :--- | :--- |
| **Izquierda** ($<0$) | **Giro Fuerte Der** | **Giro Suave Der** | **Recto** *(amortiguado)* |
| **Centrado** ($\approx 0$) | **Giro Suave Der** | **Recto** | **Giro Suave Izq** |
| **Derecha** ($>0$) | **Recto** *(amortiguado)* | **Giro Suave Izq** | **Giro Fuerte Izq** |
