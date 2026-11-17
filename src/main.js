import * as THREE from 'three';
import { GridMap, CELL_SIZE, TILE_START, TILE_ROAD } from './grid/GridMap.js';
import { RoadGeometry } from './grid/RoadGeometry.js';
import { Pathfinder } from './grid/Pathfinder.js';
import { TrajectoryGenerator } from './grid/TrajectoryGenerator.js';
import { SpeedFuzzyController } from './fuzzy/SpeedFuzzyController.js';
import { SteeringFuzzyController } from './fuzzy/SteeringFuzzyController.js';
import { CarModel } from './vehicle/CarModel.js';
import { CarKinematics } from './vehicle/CarKinematics.js';
import { VirtualSensors } from './vehicle/VirtualSensors.js';
import { RaycastVisualizer } from './vehicle/RaycastVisualizer.js';
import { CameraManager } from './ui/CameraManager.js';
import { MembershipChart } from './ui/MembershipChart.js';
import { TelemetryHUD } from './ui/TelemetryHUD.js';
import { ExperimentPanel } from './ui/ExperimentPanel.js';
import { Toolbar } from './ui/Toolbar.js';
import { Presets } from './scenarios/Presets.js';

class FuzzyDriveApp {
  constructor() {
    this.canvas = document.getElementById('threeCanvas');
    this.speedMultiplier = 1;
    this.isSimulating = false;
    this.selectedFuzzyVarName = 'OUTPUT_DEFUZZ';
    this.trajectory = null;
    this.lastTime = performance.now();
    this.isLightMode = true;

    this.initThree();
    this.initCoreSystems();
    this.initUI();
    this.loadInitialScenario();

    requestAnimationFrame((t) => this.animate(t));
  }

  initThree() {
    // 1. Escena 3D en Modo Claro Diurno (estilo PolyTown)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf1f5f9);
    this.scene.fog = new THREE.FogExp2(0xf1f5f9, 0.010);

    // 2. Cámara
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 250);

    // 3. Renderer con sombras suaves
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Iluminación Diurna Cálida
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffedd5, 1.3);
    this.sunLight.position.set(25, 40, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 120;
    const d = 28;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    this.skyFillLight = new THREE.DirectionalLight(0xbae6fd, 0.4);
    this.skyFillLight.position.set(-20, 25, -20);
    this.scene.add(this.skyFillLight);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initCoreSystems() {
    // 1. Cuadrícula y Geometría 3D de 2 Calzadas
    this.gridMap = new GridMap(20);
    this.roadGeometry = new RoadGeometry(this.scene, this.gridMap);
    this.roadGeometry.initBaseGround();

    // 2. Controladores Difusos Mamdani
    this.speedController = new SpeedFuzzyController();
    this.steeringController = new SteeringFuzzyController();

    // 3. Vehículo escalado a media casilla, cinemática y sensores
    this.carModel = new CarModel();
    this.scene.add(this.carModel.group);

    this.kinematics = new CarKinematics();
    this.sensors = new VirtualSensors(this.gridMap);
    this.rayVisualizer = new RaycastVisualizer(this.scene);

    // 4. Gestor de Cámara (Clic derecho = rotación 360°)
    this.cameraManager = new CameraManager(this.camera, this.canvas);

    this.gridMap.onChange(() => {
      this.roadGeometry.updateGridVisuals();
      this.recalculateRoute();
    });
  }

  initUI() {
    const chartCanvas = document.getElementById('fuzzyChartCanvas');
    this.fuzzyChart = new MembershipChart(chartCanvas);

    this.telemetryHUD = new TelemetryHUD({
      speedValue: document.getElementById('speedValue'),
      speedBar: document.getElementById('speedBar'),
      accelValue: document.getElementById('accelValue'),
      accelBar: document.getElementById('accelBar'),
      steerValue: document.getElementById('steerValue'),
      steerNeedle: document.getElementById('steerNeedle'),
      distStopValue: document.getElementById('distStopValue'),
      distObsValue: document.getElementById('distObsValue'),
      curvDiffValue: document.getElementById('curvDiffValue'),
      latErrValue: document.getElementById('latErrValue'),
      headErrValue: document.getElementById('headErrValue'),
      statusBadge: document.getElementById('statusBadge'),
      speedRulesList: document.getElementById('speedRulesList'),
      steerRulesList: document.getElementById('steerRulesList')
    });

    this.experimentPanel = new ExperimentPanel({
      speedController: this.speedController,
      kinematics: this.kinematics,
      onResetRun: () => this.resetSimulation(),
      domElements: {
        sliderStopNear: document.getElementById('sliderStopNear'),
        valStopNear: document.getElementById('valStopNear'),
        sliderCurveSens: document.getElementById('sliderCurveSens'),
        valCurveSens: document.getElementById('valCurveSens'),
        sliderMaxSpeed: document.getElementById('sliderMaxSpeed'),
        valMaxSpeed: document.getElementById('valMaxSpeed'),
        btnRerun: document.getElementById('btnRerun'),
        btnClearHistory: document.getElementById('btnClearHistory'),
        historyTableBody: document.getElementById('historyTableBody')
      }
    });

    this.toolbar = new Toolbar({
      gridMap: this.gridMap,
      roadGeometry: this.roadGeometry,
      cameraManager: this.cameraManager,
      camera: this.camera,
      scene: this.scene,
      domElements: {},
      onSimulationToggle: (isRunning) => {
        this.isSimulating = isRunning;
        if (isRunning) {
          this.experimentPanel.startNewRun();
        }
      },
      onSimulationReset: () => {
        this.resetSimulation();
      },
      onSpeedMultiplierChange: (mult) => {
        this.speedMultiplier = mult;
      },
      onVariableSelected: (varName) => {
        this.selectedFuzzyVarName = varName;
      }
    });

    // Alternador de Modo Claro / Modo Oscuro
    const btnToggleTheme = document.getElementById('btnToggleTheme');
    const themeIcon = document.getElementById('themeIcon');
    if (btnToggleTheme) {
      btnToggleTheme.addEventListener('click', () => {
        this.isLightMode = !this.isLightMode;
        this.roadGeometry.setTheme(this.isLightMode);
        this.fuzzyChart.setTheme(this.isLightMode);

        if (this.isLightMode) {
          this.scene.background.setHex(0xf1f5f9);
          this.scene.fog.color.setHex(0xf1f5f9);
          this.ambientLight.intensity = 0.85;
          this.sunLight.intensity = 1.3;
          if (themeIcon) themeIcon.textContent = '☀️';
        } else {
          this.scene.background.setHex(0x0a0f1d);
          this.scene.fog.color.setHex(0x0a0f1d);
          this.ambientLight.intensity = 0.55;
          this.sunLight.intensity = 0.9;
          if (themeIcon) themeIcon.textContent = '🌙';
        }
      });
    }

    // Colapsar / Expandir panel de experimentación
    const btnToggleExp = document.getElementById('btnToggleExperiment');
    const expContent = document.getElementById('experimentContent');
    const expText = document.getElementById('experimentToggleText');
    const expIcon = document.getElementById('experimentToggleIcon');
    let expCollapsed = false;

    if (btnToggleExp) {
      btnToggleExp.addEventListener('click', () => {
        expCollapsed = !expCollapsed;
        expContent.classList.toggle('hidden', expCollapsed);
        expText.textContent = expCollapsed ? 'Mostrar Panel' : 'Ocultar Panel';
        expIcon.style.transform = expCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
      });
    }
  }

  loadInitialScenario() {
    Presets.loadSharpCurves(this.gridMap);
    this.resetSimulation();
  }

  recalculateRoute() {
    const path = Pathfinder.findPath(this.gridMap);
    if (path && path.length > 0) {
      this.trajectory = TrajectoryGenerator.generate(path, this.gridMap);
      this.roadGeometry.renderTrajectory(this.trajectory);
    } else {
      this.trajectory = null;
      this.roadGeometry.clearTrajectory();
    }
  }

  resetSimulation() {
    this.isSimulating = false;
    this.sensors.reset();
    const btnPlayPause = document.getElementById('btnPlayPause');
    if (btnPlayPause) {
      btnPlayPause.innerHTML = `<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Iniciar</span>`;
    }

    this.recalculateRoute();

    // Colocar el vehículo en el carril derecho de START
    if (this.gridMap.startPos) {
      let initialHeading = 0;
      let startWorldX = 0;
      let startWorldZ = 0;

      if (this.trajectory && this.trajectory.points.length > 0) {
        const firstPt = this.trajectory.points[0];
        startWorldX = firstPt.x;
        startWorldZ = firstPt.z;
        initialHeading = this.trajectory.points[Math.min(6, this.trajectory.points.length - 1)].heading;
      } else {
        const center = this.gridMap.gridToWorld(this.gridMap.startPos.x, this.gridMap.startPos.z);
        startWorldX = center.x + 0.48;
        startWorldZ = center.z + 0.48;
      }

      this.kinematics.reset(startWorldX, startWorldZ, initialHeading);
      this.carModel.updateTransform(startWorldX, startWorldZ, initialHeading);
      this.carModel.setSteerAngle(0);
      this.carModel.group.visible = true;
      this.rayVisualizer.setVisible(true);
    } else {
      this.carModel.group.visible = false;
      this.rayVisualizer.setVisible(false);
    }

    this.updateFuzzyTelemetry(0, 0, null, null, 0.016);
  }

  updateFuzzyTelemetry(accelCmd = 0, steerAngleDeg = 0, speedEval = null, steerEval = null, dt = 0.016, precomputedSensors = null) {
    const sensorReadings = precomputedSensors || this.sensors.readSensors(
      this.kinematics.x,
      this.kinematics.z,
      this.kinematics.heading,
      this.kinematics.speed,
      this.trajectory,
      dt
    );

    const sEval = speedEval || this.speedController.evaluate(
      sensorReadings.stopDistance,
      sensorReadings.curveDifficulty,
      this.kinematics.speed
    );

    const stEval = steerEval || this.steeringController.evaluate(
      sensorReadings.lateralError,
      sensorReadings.headingErrorDeg
    );

    this.telemetryHUD.update({
      speed: this.kinematics.speed,
      accelCmd,
      steerAngleDeg,
      sensorReadings,
      speedEval: sEval,
      steerEval: stEval,
      speedController: this.speedController,
      steeringController: this.steeringController,
      isArrived: sensorReadings.isArrived
    });

    this.rayVisualizer.update(
      this.kinematics.x,
      this.kinematics.z,
      this.kinematics.heading,
      sensorReadings.rays
    );

    this.updateFuzzyChart(sensorReadings, sEval, stEval);

    return sensorReadings;
  }

  updateFuzzyChart(sensorReadings, speedEval, steerEval) {
    if (this.selectedFuzzyVarName === 'OUTPUT_DEFUZZ' || !this.selectedFuzzyVarName) {
      if (this.telemetryHUD.activeTab === 'steering') {
        if (steerEval) {
          this.fuzzyChart.renderDefuzzification(
            this.steeringController.varSteer,
            steerEval.aggregatedCurve,
            steerEval.output
          );
        }
      } else {
        if (speedEval) {
          this.fuzzyChart.renderDefuzzification(
            this.speedController.varAcc,
            speedEval.aggregatedCurve,
            speedEval.output
          );
        }
      }
      return;
    }

    let targetVar = null;
    let crispVal = 0;

    switch (this.selectedFuzzyVarName) {
      case 'Distancia_Parada':
        targetVar = this.speedController.varDistStop;
        crispVal = sensorReadings.stopDistance;
        break;
      case 'Dificultad_Curva':
        targetVar = this.speedController.varCurvDiff;
        crispVal = sensorReadings.curveDifficulty;
        break;
      case 'Velocidad_Actual':
        targetVar = this.speedController.varSpeed;
        crispVal = this.kinematics.speed;
        break;
      case 'Error_Lateral':
        targetVar = this.steeringController.varLatErr;
        crispVal = sensorReadings.lateralError;
        break;
      case 'Error_Orientacion':
        targetVar = this.steeringController.varAngErr;
        crispVal = sensorReadings.headingErrorDeg;
        break;
    }

    if (targetVar) {
      this.fuzzyChart.render(targetVar, crispVal);
    }
  }

  animate(now) {
    requestAnimationFrame((t) => this.animate(t));

    const rawDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDelta, 0.05) * this.speedMultiplier;

    if (this.isSimulating && this.trajectory) {
      // 1. Lectura única de Sensores Virtuales con Evasión
      const sensorReadings = this.sensors.readSensors(
        this.kinematics.x,
        this.kinematics.z,
        this.kinematics.heading,
        this.kinematics.speed,
        this.trajectory,
        dt
      );

      this.experimentPanel.recordTick(
        this.kinematics.speed,
        sensorReadings.distToObstacle,
        sensorReadings.lateralError
      );

      // 2. Parada por Meta
      if (sensorReadings.isArrived) {
        this.isSimulating = false;
        this.experimentPanel.finalizeRun('🏁 Meta Alcanzada');
        const btnPlay = document.getElementById('btnPlayPause');
        if (btnPlay) {
          btnPlay.innerHTML = `<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Iniciar</span>`;
        }
      }

      // 3. Parada si carretera bloqueada totalmente
      if (sensorReadings.stopDistance < 0.6 && this.kinematics.speed < 0.1) {
        this.experimentPanel.finalizeRun('🛑 Bloqueo');
      }

      // 4. Inferencia Difusa Mamdani
      const speedEval = this.speedController.evaluate(
        sensorReadings.stopDistance,
        sensorReadings.curveDifficulty,
        this.kinematics.speed
      );

      const steerEval = this.steeringController.evaluate(
        sensorReadings.lateralError,
        sensorReadings.headingErrorDeg
      );

      const accelCmd = speedEval.output;
      const steerAngleDeg = steerEval.output;
      const steerAngleRad = (steerAngleDeg * Math.PI) / 180;

      // 5. Integración Cinemática
      this.kinematics.step(accelCmd, steerAngleRad, dt);

      // 6. Actualización Visual
      this.carModel.updateTransform(this.kinematics.x, this.kinematics.z, this.kinematics.heading);
      this.carModel.setSteerAngle(steerAngleRad);

      // 7. Telemetría y Láser
      this.updateFuzzyTelemetry(accelCmd, steerAngleDeg, speedEval, steerEval, dt, sensorReadings);
    } else {
      this.updateFuzzyTelemetry(0, 0, null, null, dt);
    }

    this.cameraManager.update(this.kinematics.x, this.kinematics.z, this.kinematics.heading);
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new FuzzyDriveApp();
});
