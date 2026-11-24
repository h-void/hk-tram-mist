import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { HKSoundscape } from './audio/hkSoundscape';
import {
  DioramaHud,
  type CameraView,
  type LangCode,
  type PresetName,
  type ViewMode
} from './ui/hud';
import { ATMOSPHERE_PRESETS, createAtmosphere } from './scene/atmosphere';
import { createRoadAndReflections } from './scene/roadAndReflections';
import { createBuildings } from './scene/buildings';
import { createViaductAndVehicles } from './scene/viaductAndVehicles';
import { createPropsAndLife } from './scene/propsAndLife';
import { createWeatherAndEffects } from './scene/weatherAndEffects';

interface SceneControllerAPI {
  setPreset: (preset: PresetName) => void;
  setCamera: (view: CameraView, instant?: boolean) => void;
  setMode: (mode: ViewMode) => void;
  setLang: (lang: LangCode) => void;
  setSimTime: (t: number) => void;
  resumeAuto: () => void;
  ringBell: () => void;
  setHudVisible: (visible: boolean) => void;
  getDiagnostics: () => {
    glError: number;
    drawCalls: number;
    triangles: number;
    meshCount: number;
    lang: LangCode;
    preset: PresetName;
    mode: ViewMode;
    cameraView: CameraView;
    fps: number;
    simTime: number;
    ready: boolean;
  };
}

interface UrlBootConfig {
  lang: LangCode;
  preset: PresetName;
  view: CameraView;
  mode: ViewMode;
  hudVisible: boolean;
  lockedTime: number | null;
}

function parseUrlConfig(): UrlBootConfig {
  const params = new URLSearchParams(window.location.search);
  const rawLang = (params.get('lang') ?? 'en').toLowerCase();
  const lang: LangCode = rawLang.startsWith('zh') ? 'zh' : 'en';

  const rawPreset = (params.get('preset') ?? 'dusk').toLowerCase();
  const preset: PresetName =
    rawPreset === 'midnight' || rawPreset === 'dawn' ? rawPreset : 'dusk';

  const rawView = (params.get('view') ?? 'iso').toLowerCase();
  const view: CameraView =
    rawView === 'tram' || rawView === 'street' ? rawView : 'iso';

  const rawMode = (params.get('mode') ?? 'diorama').toLowerCase();
  const mode: ViewMode =
    rawMode === 'acoustic' || rawMode === 'print' ? rawMode : 'diorama';

  const hudVisible = params.get('hud') !== '0';
  const rawT = params.get('t');
  const parsedT = rawT !== null ? Number(rawT) : NaN;
  const lockedTime = Number.isFinite(parsedT) ? parsedT : null;

  return { lang, preset, view, mode, hudVisible, lockedTime };
}

declare global {
  interface Window {
    __SCENE_CTRL__?: SceneControllerAPI;
  }
}

function boot(): void {
  const container = document.getElementById('app');
  if (!container) return;

  // 1. WebGL2 Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // 2. Scene & Orthographic Isometric Camera
  const scene = new THREE.Scene();

  const FRUSTUM_SIZE = 32.8;
  const computeFrustumSize = (asp: number): number =>
    asp < 1.08 ? FRUSTUM_SIZE * Math.min(2.28, 1.12 / Math.max(0.42, asp)) : FRUSTUM_SIZE;

  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const initialFrustum = computeFrustumSize(aspect);
  const camera = new THREE.OrthographicCamera(
    (-initialFrustum * aspect) / 2,
    (initialFrustum * aspect) / 2,
    initialFrustum / 2,
    -initialFrustum / 2,
    -50,
    240
  );
  camera.position.set(42, 35, 42);
  camera.zoom = 0.885;
  camera.updateProjectionMatrix();

  // 3. Smooth Damped OrbitControls with Tasteful Bounds
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.45, 4.5, -1.15);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.72;
  controls.minZoom = 0.60;
  controls.maxZoom = 2.6;
  controls.minPolarAngle = 0.48;
  controls.maxPolarAngle = 1.32;
  controls.update();

  // 4. Post-Processing Pipeline (RenderPass -> Restrained UnrealBloomPass -> OutputPass)
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    ATMOSPHERE_PRESETS.dusk.bloomStrength,
    ATMOSPHERE_PRESETS.dusk.bloomRadius,
    ATMOSPHERE_PRESETS.dusk.bloomThreshold
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  // 5. Build All Procedural Diorama Subsystems
  const atmosphere = createAtmosphere(scene);
  const roadAndReflections = createRoadAndReflections(scene, atmosphere.mistUniforms);
  const buildings = createBuildings(scene);
  const viaductAndVehicles = createViaductAndVehicles(scene, atmosphere.mistUniforms);
  const propsAndLife = createPropsAndLife(scene);
  const weatherAndEffects = createWeatherAndEffects(scene, {
    mistUniforms: atmosphere.mistUniforms,
    neonPositions: buildings.neonPositions,
    bauhiniaCenters: propsAndLife.bauhiniaCenters,
    printTargetGroups: {
      buildings: buildings.group,
      viaductAndVehicles: viaductAndVehicles.group,
      props: propsAndLife.group,
      road: roadAndReflections.group,
      tramGroup: viaductAndVehicles.tramGroup,
      taxiGroup: viaductAndVehicles.taxiGroup
    }
  });

  // 6. Audio Soundscape & Minimalist Bilingual HUD
  const soundscape = new HKSoundscape();

  let currentPreset: PresetName = 'dusk';
  let currentCameraView: CameraView = 'iso';
  let currentViewMode: ViewMode = 'diorama';

  let simTime = 0;
  let manualTimeLock = false;
  let needsLockedRender = false;
  let isTransitioningCam = false;
  let followTram = false;
  const desiredCamPos = camera.position.clone();
  const desiredTarget = controls.target.clone();
  let desiredZoom = camera.zoom;

  const getCameraPose = (
    view: CameraView
  ): { pos: THREE.Vector3; target: THREE.Vector3; zoom: number } => {
    if (view === 'tram') {
      const tp = viaductAndVehicles.getTramPosition();
      return {
        pos: new THREE.Vector3(tp.x + 24, 17.2, tp.z + 24),
        target: new THREE.Vector3(tp.x + 0.15, 2.25, tp.z + 0.3),
        zoom: 1.92
      };
    }
    if (view === 'street') {
      return {
        pos: new THREE.Vector3(22.0, 14.0, 39.5),
        target: new THREE.Vector3(0.15, 4.35, -1.6),
        zoom: 1.24
      };
    }
    return {
      pos: new THREE.Vector3(42, 35, 42),
      target: new THREE.Vector3(0.45, 4.5, -1.15),
      zoom: 0.885
    };
  };

  const applyPresetState = (preset: PresetName) => {
    currentPreset = preset;
    const cfg = atmosphere.applyPreset(preset);
    buildings.setEmissiveScale(cfg.emissiveScale);
    viaductAndVehicles.setEmissiveScale(cfg.emissiveScale);
    propsAndLife.setEmissiveScale(cfg.emissiveScale);
    roadAndReflections.setReflectionStyle(cfg.reflectTint, cfg.reflectBoost);
    roadAndReflections.setGlowScale(cfg.shopLightScale);
    weatherAndEffects.setRainOpacity(cfg.rainOpacity);

    if (currentViewMode !== 'print') {
      bloomPass.strength = cfg.bloomStrength;
      bloomPass.radius = cfg.bloomRadius;
      bloomPass.threshold = cfg.bloomThreshold;
    }
    hud.setState({ preset });
  };

  const applyViewModeState = (mode: ViewMode) => {
    currentViewMode = mode;
    const isPrint = mode === 'print';
    atmosphere.setPrintMode(isPrint);
    roadAndReflections.setPrintMode(isPrint);
    viaductAndVehicles.setPrintMode(isPrint);
    propsAndLife.setPrintMode(isPrint);
    weatherAndEffects.setViewMode(mode);

    if (isPrint) {
      bloomPass.strength = 0.0;
      renderer.toneMappingExposure = 1.0;
    } else {
      const cfg = ATMOSPHERE_PRESETS[currentPreset];
      bloomPass.strength = cfg.bloomStrength;
      bloomPass.radius = cfg.bloomRadius;
      bloomPass.threshold = cfg.bloomThreshold;
      renderer.toneMappingExposure = 1.06;
    }
    hud.setState({ mode });
  };

  const applyCameraView = (view: CameraView, instant = false) => {
    currentCameraView = view;
    followTram = view === 'tram';
    const pose = getCameraPose(view);
    desiredCamPos.copy(pose.pos);
    desiredTarget.copy(pose.target);
    desiredZoom = pose.zoom;

    if (instant) {
      isTransitioningCam = false;
      camera.position.copy(pose.pos);
      controls.target.copy(pose.target);
      camera.zoom = pose.zoom;
      camera.updateProjectionMatrix();
      isRenderingFrame = true;
      controls.update();
      isRenderingFrame = false;
    } else {
      isTransitioningCam = true;
    }
    hud.setState({ camera: view });
  };

  const triggerTramBell = () => {
    soundscape.ringTramBell();
    weatherAndEffects.triggerBellPulse(viaductAndVehicles.getTramPosition(), simTime);
  };

  const urlCfg = parseUrlConfig();

  const hud = new DioramaHud(
    container,
    {
      onPreset: (p) => {
        applyPresetState(p);
        renderFrame();
      },
      onCamera: (v) => {
        applyCameraView(v, false);
      },
      onMode: (m) => {
        applyViewModeState(m);
        renderFrame();
      },
      onBell: () => {
        triggerTramBell();
      },
      onToggleSound: () => soundscape.toggleMute()
    },
    urlCfg.lang
  );

  let isRenderingFrame = false;

  // Cancel preset camera lerp when user manually drags or zooms
  controls.addEventListener('start', () => {
    isTransitioningCam = false;
    followTram = false;
  });

  controls.addEventListener('change', () => {
    if (manualTimeLock && !isRenderingFrame) {
      needsLockedRender = true;
    }
  });

  // 7. Pointer Raycasting for Clicking & Hovering Hero Vehicles (Tram #120, Green-Roof Minibus #28, Red Taxi)
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0 };

  const getInteractiveVehicleAtPointer = (
    clientX: number,
    clientY: number
  ): 'tram' | 'minibus' | 'taxi' | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(
      [
        viaductAndVehicles.tramGroup,
        viaductAndVehicles.minibusGroup,
        viaductAndVehicles.taxiGroup
      ],
      true
    );
    for (const h of hits) {
      if (h.object.userData.isTram) return 'tram';
      if (h.object.userData.isMinibus) return 'minibus';
      if (h.object.userData.isTaxi) return 'taxi';
    }
    return null;
  };

  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  });

  renderer.domElement.addEventListener('pointermove', (e) => {
    const vehicle = getInteractiveVehicleAtPointer(e.clientX, e.clientY);
    renderer.domElement.classList.toggle('pointer-hover', vehicle !== null);
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (moved < 6) {
      const vehicle = getInteractiveVehicleAtPointer(e.clientX, e.clientY);
      if (vehicle === 'tram') {
        triggerTramBell();
      } else if (vehicle === 'minibus') {
        soundscape.ringVehicleHorn('minibus');
        const p = viaductAndVehicles.minibusGroup.position;
        weatherAndEffects.triggerBellPulse(new THREE.Vector3(p.x, 1.4, p.z), simTime, {
          followTram: false,
          colorA: 0x58e8a8,
          colorB: 0xffd274
        });
      } else if (vehicle === 'taxi') {
        soundscape.ringVehicleHorn('taxi');
        const p = viaductAndVehicles.taxiGroup.position;
        weatherAndEffects.triggerBellPulse(new THREE.Vector3(p.x, 0.8, p.z), simTime, {
          followTram: false,
          colorA: 0xff6b5c,
          colorB: 0xffc864
        });
      }
    }
  });

  // 8. Keyboard Shortcuts (1/2/3, Q/W/E, A, P, Space, M)
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.code) {
      case 'Digit1':
        applyPresetState('dusk');
        break;
      case 'Digit2':
        applyPresetState('midnight');
        break;
      case 'Digit3':
        applyPresetState('dawn');
        break;
      case 'KeyQ':
        applyCameraView('iso', false);
        break;
      case 'KeyW':
        applyCameraView('tram', false);
        break;
      case 'KeyE':
        applyCameraView('street', false);
        break;
      case 'KeyA':
        applyViewModeState(currentViewMode === 'acoustic' ? 'diorama' : 'acoustic');
        break;
      case 'KeyP':
        applyViewModeState(currentViewMode === 'print' ? 'diorama' : 'print');
        break;
      case 'Space':
        e.preventDefault();
        triggerTramBell();
        break;
      case 'KeyM': {
        const enabled = soundscape.toggleMute();
        hud.setState({ soundEnabled: enabled });
        break;
      }
      default:
        break;
    }
  });

  // 9. Responsive Resize Handler
  const handleResize = () => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    const asp = w / h;
    const fSize = computeFrustumSize(asp);
    camera.left = (-fSize * asp) / 2;
    camera.right = (fSize * asp) / 2;
    camera.top = fSize / 2;
    camera.bottom = -fSize / 2;
    camera.updateProjectionMatrix();

    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
    if (manualTimeLock) {
      renderFrame();
    }
  };
  window.addEventListener('resize', handleResize);

  // 10. Core Simulation Step & Render Function
  const updateSimulation = (t: number) => {
    atmosphere.update(t);
    roadAndReflections.update(t);
    buildings.update(t);
    viaductAndVehicles.update(t);
    propsAndLife.update(t);

    const tramPos = viaductAndVehicles.getTramPosition();
    const trainPos = viaductAndVehicles.getTrainPosition();
    weatherAndEffects.update(t, tramPos, trainPos);

    const rainAudio = ATMOSPHERE_PRESETS[currentPreset].rainAudioIntensity;
    soundscape.updateMotion(
      viaductAndVehicles.getTramProximity(),
      viaductAndVehicles.getTrainProximity(),
      rainAudio
    );
  };

  const clampPanTarget = () => {
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -16, 16);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.5, 9.5);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -16, 16);
  };

  const renderFrame = () => {
    isRenderingFrame = true;
    clampPanTarget();
    controls.update();
    isRenderingFrame = false;
    composer.render();
  };

  // Apply initial URL state cleanly before first frame
  applyPresetState(urlCfg.preset);
  if (urlCfg.mode !== 'diorama') {
    applyViewModeState(urlCfg.mode);
  }
  if (!urlCfg.hudVisible) {
    hud.setVisible(false);
  }
  if (urlCfg.lockedTime !== null) {
    manualTimeLock = true;
    simTime = urlCfg.lockedTime;
  }
  updateSimulation(simTime);
  if (urlCfg.view !== 'iso') {
    applyCameraView(urlCfg.view, true);
  }
  renderFrame();

  // Compute exact procedural scene geometry metrics once
  let sceneMeshCount = 0;
  let sceneTriangleCount = 0;
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      sceneMeshCount += 1;
      const geom = obj.geometry;
      if (geom) {
        const count = geom.index ? geom.index.count / 3 : (geom.attributes.position?.count ?? 0) / 3;
        const mult = obj instanceof THREE.InstancedMesh ? obj.count : 1;
        sceneTriangleCount += Math.round(count * mult);
      }
    }
  });

  // Smoothly dismiss instant-paint boot veil once first WebGL frame is on screen
  const veil = document.getElementById('boot-veil');
  if (veil) {
    veil.classList.add('boot-done');
    window.setTimeout(() => veil.remove(), 500);
  }
  hud.bumpActivity();

  // 11. Main Animation Loop with FPS Tracking & Idle-Skip During Deterministic Lock
  let lastNow = performance.now();
  let fpsSmoothed = 60;

  const animate = (now: number) => {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, Math.max(0.0001, (now - lastNow) / 1000));
    lastNow = now;
    fpsSmoothed = fpsSmoothed * 0.92 + (1 / dt) * 0.08;

    // When locked via __SCENE_CTRL__.setSimTime(), skip redundant WebGL redraws unless user/controller requests one
    if (manualTimeLock) {
      if (needsLockedRender) {
        needsLockedRender = false;
        renderFrame();
      }
      return;
    }

    simTime += dt;
    updateSimulation(simTime);

    if (followTram) {
      const pose = getCameraPose('tram');
      desiredCamPos.copy(pose.pos);
      desiredTarget.copy(pose.target);
      desiredZoom = pose.zoom;
      const alpha = 1 - Math.exp(-dt * 4.8);
      camera.position.lerp(desiredCamPos, alpha);
      controls.target.lerp(desiredTarget, alpha);
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, desiredZoom, alpha);
      camera.updateProjectionMatrix();
    } else if (isTransitioningCam) {
      const alpha = 1 - Math.exp(-dt * 5.2);
      camera.position.lerp(desiredCamPos, alpha);
      controls.target.lerp(desiredTarget, alpha);
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, desiredZoom, alpha);
      camera.updateProjectionMatrix();

      if (
        camera.position.distanceTo(desiredCamPos) < 0.04 &&
        controls.target.distanceTo(desiredTarget) < 0.02 &&
        Math.abs(camera.zoom - desiredZoom) < 0.005
      ) {
        camera.position.copy(desiredCamPos);
        controls.target.copy(desiredTarget);
        camera.zoom = desiredZoom;
        camera.updateProjectionMatrix();
        isTransitioningCam = false;
      }
    }

    renderFrame();
  };
  requestAnimationFrame(animate);

  // 12. Expose Deterministic Inspection & Automation Controller Hook
  const gl = renderer.getContext();
  window.__SCENE_CTRL__ = {
    setPreset: (preset) => {
      applyPresetState(preset);
      renderFrame();
    },
    setCamera: (view, instant = true) => {
      applyCameraView(view, instant);
      renderFrame();
    },
    setMode: (mode) => {
      applyViewModeState(mode);
      renderFrame();
    },
    setLang: (lang) => {
      hud.setLang(lang);
    },
    setSimTime: (t) => {
      manualTimeLock = true;
      simTime = t;
      updateSimulation(simTime);
      if (currentCameraView === 'tram') {
        applyCameraView('tram', true);
      }
      renderFrame();
    },
    resumeAuto: () => {
      manualTimeLock = false;
    },
    ringBell: () => {
      triggerTramBell();
      updateSimulation(simTime);
      renderFrame();
    },
    setHudVisible: (visible) => {
      hud.setVisible(visible);
    },
    getDiagnostics: () => ({
      glError: gl.getError(),
      drawCalls: renderer.info.render.calls,
      triangles: sceneTriangleCount,
      meshCount: sceneMeshCount,
      lang: hud.getLang(),
      preset: currentPreset,
      mode: currentViewMode,
      cameraView: currentCameraView,
      fps: Math.round(fpsSmoothed),
      simTime,
      ready: true
    })
  };
}

// Defer heavy procedural texture + WebGL shader synthesis by 2 frames so #boot-veil paints immediately
requestAnimationFrame(() => {
  requestAnimationFrame(boot);
});
