import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { HKSoundscape, type SoundState } from './audio/hkSoundscape';
import {
  DioramaHud,
  type CameraView,
  type LangCode,
  type PresetName,
  type ViewMode
} from './ui/hud';
import { ATMOSPHERE_PRESETS, createAtmosphere } from './scene/atmosphere';
import { getHKSignalState } from './scene/hkSignal';
import { createRoadAndReflections } from './scene/roadAndReflections';
import { createBuildings } from './scene/buildings';
import { createViaductAndVehicles } from './scene/viaductAndVehicles';
import { createPropsAndLife } from './scene/propsAndLife';
import {
  createWeatherAndEffects,
  type PrintEdgeSvgOptions,
  type PrintEdgeSvgResult
} from './scene/weatherAndEffects';

interface SceneControllerAPI {
  setPreset: (preset: PresetName) => void;
  setCamera: (view: CameraView, instant?: boolean) => void;
  setCameraPose: (
    pos: [number, number, number],
    target: [number, number, number],
    zoom?: number
  ) => void;
  setMode: (mode: ViewMode) => void;
  setPrintEdgesVisible: (visible: boolean) => void;
  getPrintEdgeSVG: (
    width: number,
    height: number,
    opts?: PrintEdgeSvgOptions
  ) => PrintEdgeSvgResult;
  setLang: (lang: LangCode) => void;
  setSimTime: (t: number) => void;
  resumeAuto: () => void;
  ringBell: () => void;
  triggerAllVehiclePulses: () => void;
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
    soundState: SoundState;
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

function showWebGLFallback(): void {
  let veil = document.getElementById('boot-veil');
  if (!veil) {
    veil = document.createElement('div');
    veil.id = 'boot-veil';
    veil.setAttribute('aria-live', 'polite');
    document.body.appendChild(veil);
  }
  veil.classList.remove('boot-done');
  veil.innerHTML = `
    <div class="boot-card boot-fallback" role="alert">
      <div class="boot-title">TRAMLINE MIST <span>香江雨霧・叮叮</span></div>
      <img class="boot-fallback-img" src="./og.jpg" alt="TRAMLINE MIST — Procedural 3D Hong Kong rainy corner diorama preview" />
      <p class="boot-fallback-copy">WebGL2 graphics acceleration is required to render the live procedural 3D diorama. Enable hardware acceleration or try a WebGL2-capable browser.</p>
      <p class="boot-fallback-zh">此作品需要支援 WebGL2 硬體加速的瀏覽器以即時合成 3D 香港雨霧場景，請啟用硬體加速或重新載入頁面。</p>
      <button type="button" class="boot-reload-btn" id="btn-webgl-reload">Reload / 重新載入</button>
    </div>
  `;
  const btn = document.getElementById('btn-webgl-reload');
  if (btn) {
    btn.addEventListener('click', () => window.location.reload());
  }
}

declare global {
  interface Window {
    __SCENE_CTRL__?: SceneControllerAPI;
  }
}

function bootScene(): void {
  const container = document.getElementById('app');
  if (!container) return;

  // 1. WebGL2 Renderer (EffectComposer owns offscreen RT, so disable unused default-backbuffer MSAA)
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance'
  });
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    throw new Error('WebGL2 context is required');
  }
  const MAX_SHADED_PIXELS = 2560 * 1440;
  const computeEffectiveDpr = (w: number, h: number): number => {
    const raw = Math.min(window.devicePixelRatio || 1, 2);
    const area = Math.max(1, w * h);
    const maxByBudget = Math.sqrt(MAX_SHADED_PIXELS / area);
    return Math.max(1, Math.min(raw, maxByBudget));
  };
  const initialDpr = computeEffectiveDpr(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(initialDpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = ATMOSPHERE_PRESETS.dusk.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  container.appendChild(renderer.domElement);

  const gl = renderer.getContext();
  const supportsHalfFloatRT = Boolean(
    gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')
  );
  const renderTargetType: THREE.TextureDataType = supportsHalfFloatRT
    ? THREE.HalfFloatType
    : THREE.UnsignedByteType;

  // 2. Scene & Orthographic Isometric Camera
  const scene = new THREE.Scene();

  const FRUSTUM_SIZE = 32.8;
  // Horizontal world span (incl. zoom 0.885) that keeps the tram stop on the left and the
  // green tenement on the right inside the frame. Landscape screens already exceed it, so
  // only portrait / near-square viewports grow the vertical frustum to honour it.
  const MIN_VISIBLE_SPAN = 38.0;
  const computeFrustumSize = (asp: number): number =>
    Math.max(FRUSTUM_SIZE, MIN_VISIBLE_SPAN / Math.max(0.42, asp));

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

  // Capture accurate pre-postprocess scene draw calls (instead of OutputPass fullscreen quad = 1)
  let lastSceneDrawCalls = 0;
  let isComposerRendering = false;
  scene.onAfterRender = (_r, _s, cam) => {
    if (isComposerRendering && cam === camera) {
      lastSceneDrawCalls = renderer.info.render.calls;
    }
  };

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

  // 4. Post-Processing Pipeline (RenderPass -> Half-Res Restrained UnrealBloomPass -> OutputPass)
  const composerTarget = new THREE.WebGLRenderTarget(
    Math.max(1, window.innerWidth),
    Math.max(1, window.innerHeight),
    { type: renderTargetType }
  );
  composerTarget.texture.name = 'EffectComposer.rt1';
  const composer = new EffectComposer(renderer, composerTarget);
  composer.setPixelRatio(initialDpr);
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(
      Math.max(1, Math.round(window.innerWidth * initialDpr * 0.5)),
      Math.max(1, Math.round(window.innerHeight * initialDpr * 0.5))
    ),
    ATMOSPHERE_PRESETS.dusk.bloomStrength,
    ATMOSPHERE_PRESETS.dusk.bloomRadius,
    ATMOSPHERE_PRESETS.dusk.bloomThreshold
  );
  const origBloomSetSize = bloomPass.setSize.bind(bloomPass);
  bloomPass.setSize = (w: number, h: number) => {
    origBloomSetSize(Math.max(1, Math.round(w * 0.5)), Math.max(1, Math.round(h * 0.5)));
  };
  if (!supportsHalfFloatRT) {
    bloomPass.renderTargetBright.texture.type = THREE.UnsignedByteType;
    for (const rt of bloomPass.renderTargetsHorizontal) {
      rt.texture.type = THREE.UnsignedByteType;
    }
    for (const rt of bloomPass.renderTargetsVertical) {
      rt.texture.type = THREE.UnsignedByteType;
    }
  }
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  // 5. Build All Procedural Diorama Subsystems
  const atmosphere = createAtmosphere(scene);
  const roadAndReflections = createRoadAndReflections(
    scene,
    atmosphere.mistUniforms,
    renderTargetType
  );
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

  // Exclude high-fillrate weather/mist & microscopic sub-details from the blurred planar road reflection pass
  const reflectionExclusions: THREE.Object3D[] = [
    atmosphere.mistGroup,
    weatherAndEffects.group
  ];
  scene.traverse((obj) => {
    if (obj.userData && obj.userData.skipReflection === true) {
      reflectionExclusions.push(obj);
    }
  });
  roadAndReflections.addReflectionExclusions(reflectionExclusions);

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
  let contextLost = false;
  let rafId: number | null = null;
  const desiredCamPos = camera.position.clone();
  const desiredTarget = controls.target.clone();
  let desiredZoom = camera.zoom;

  const syncSoundHud = () => {
    hud.setState({ soundState: soundscape.getSoundState() });
  };

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
      bloomPass.enabled = true;
      bloomPass.strength = cfg.bloomStrength;
      bloomPass.radius = cfg.bloomRadius;
      bloomPass.threshold = cfg.bloomThreshold;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = cfg.exposure;
    }
    hud.setState({ preset });
  };

  const applyViewModeState = (mode: ViewMode) => {
    currentViewMode = mode;
    const isPrint = mode === 'print';
    atmosphere.setPrintMode(isPrint);
    roadAndReflections.setPrintMode(isPrint);
    buildings.setPrintMode(isPrint);
    viaductAndVehicles.setPrintMode(isPrint);
    propsAndLife.setPrintMode(isPrint);
    weatherAndEffects.setViewMode(mode);

    if (isPrint) {
      bloomPass.enabled = false;
      bloomPass.strength = 0.0;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1.0;
    } else {
      const cfg = ATMOSPHERE_PRESETS[currentPreset];
      buildings.setEmissiveScale(cfg.emissiveScale);
      viaductAndVehicles.setEmissiveScale(cfg.emissiveScale);
      propsAndLife.setEmissiveScale(cfg.emissiveScale);
      bloomPass.enabled = true;
      bloomPass.strength = cfg.bloomStrength;
      bloomPass.radius = cfg.bloomRadius;
      bloomPass.threshold = cfg.bloomThreshold;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = cfg.exposure;
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
    syncSoundHud();
    weatherAndEffects.triggerBellPulse(viaductAndVehicles.getTramPosition(), simTime);
  };

  const exportPrintSvg = () => {
    if (currentViewMode !== 'print' || contextLost) return;
    flushCtrlRender();
    const res = weatherAndEffects.getPrintEdgeSVG(camera, renderer, 1440, 1080, {
      includePaperBg: true
    });
    const blob = new Blob([res.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tramline-mist-engraving.svg';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      onExportSvg: () => {
        exportPrintSvg();
      },
      onBell: () => {
        triggerTramBell();
      },
      onToggleSound: () => {
        soundscape.toggleMute();
        return soundscape.getSoundState();
      }
    },
    urlCfg.lang
  );

  let isRenderingFrame = false;
  let isOrbiting = false;

  // Cancel preset camera lerp when user manually drags or zooms
  controls.addEventListener('start', () => {
    isOrbiting = true;
    hoverDirty = false;
    renderer.domElement.classList.remove('pointer-hover');
    isTransitioningCam = false;
    followTram = false;
  });

  controls.addEventListener('end', () => {
    isOrbiting = false;
  });

  controls.addEventListener('change', () => {
    if (manualTimeLock && !isRenderingFrame) {
      needsLockedRender = true;
    }
  });

  // 7. Pointer Raycasting for Clicking & Frame-Throttled Hovering on Vehicles
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0 };
  let hoverDirty = false;
  let hoverClientX = 0;
  let hoverClientY = 0;

  const getInteractiveVehicleAtPointer = (
    clientX: number,
    clientY: number
  ): 'tram' | 'minibus' | 'taxi' | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
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
    if (isOrbiting) return;
    hoverClientX = e.clientX;
    hoverClientY = e.clientY;
    hoverDirty = true;
  });

  renderer.domElement.addEventListener('pointerleave', () => {
    hoverDirty = false;
    renderer.domElement.classList.remove('pointer-hover');
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (moved < 6) {
      const vehicle = getInteractiveVehicleAtPointer(e.clientX, e.clientY);
      if (vehicle === 'tram') {
        triggerTramBell();
      } else if (vehicle === 'minibus') {
        soundscape.ringVehicleHorn('minibus');
        syncSoundHud();
        const p = viaductAndVehicles.minibusGroup.position;
        weatherAndEffects.triggerBellPulse(new THREE.Vector3(p.x, 1.4, p.z), simTime, {
          followTram: false,
          colorA: 0x58e8a8,
          colorB: 0xffd274
        });
      } else if (vehicle === 'taxi') {
        soundscape.ringVehicleHorn('taxi');
        syncSoundHud();
        const p = viaductAndVehicles.taxiGroup.position;
        weatherAndEffects.triggerBellPulse(new THREE.Vector3(p.x, 0.8, p.z), simTime, {
          followTram: false,
          colorA: 0xff6b5c,
          colorB: 0xffc864
        });
      }
    }
  });

  // 8. Keyboard Shortcuts (1/2/3, Q/W/E, A, P, Space, M) with repeat & editable-target guards
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    switch (e.code) {
      case 'Digit1':
        applyPresetState('dusk');
        if (manualTimeLock) needsLockedRender = true;
        break;
      case 'Digit2':
        applyPresetState('midnight');
        if (manualTimeLock) needsLockedRender = true;
        break;
      case 'Digit3':
        applyPresetState('dawn');
        if (manualTimeLock) needsLockedRender = true;
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
        if (manualTimeLock) needsLockedRender = true;
        break;
      case 'KeyP':
        applyViewModeState(currentViewMode === 'print' ? 'diorama' : 'print');
        if (manualTimeLock) needsLockedRender = true;
        break;
      case 'Space':
        e.preventDefault();
        triggerTramBell();
        break;
      case 'KeyM': {
        soundscape.toggleMute();
        syncSoundHud();
        break;
      }
      default:
        break;
    }
  });

  // 9. Responsive Resize & DPR Handler
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

    const dpr = computeEffectiveDpr(w, h);
    renderer.setPixelRatio(dpr);
    composer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    composer.setSize(w, h);
    if (manualTimeLock) {
      needsLockedRender = true;
    }
  };
  window.addEventListener('resize', handleResize);

  // 9B. WebGL Context Loss & Restore Recovery
  let contextLostOverlay: HTMLDivElement | null = null;
  const showContextLostOverlay = () => {
    if (!contextLostOverlay) {
      contextLostOverlay = document.createElement('div');
      contextLostOverlay.id = 'context-lost-veil';
      contextLostOverlay.innerHTML = `
        <div class="boot-card boot-fallback" role="alert">
          <div class="boot-title">TRAMLINE MIST <span>香江雨霧・叮叮</span></div>
          <p class="boot-fallback-copy">WebGL graphics context was lost. Attempting automatic restore…</p>
          <p class="boot-fallback-zh">WebGL 繪圖內容已中斷，正在嘗試自動恢復，或可按下方按鈕重新載入。</p>
          <button type="button" class="boot-reload-btn" id="btn-context-reload">Reload / 重新載入</button>
        </div>
      `;
      document.body.appendChild(contextLostOverlay);
      const reloadBtn = contextLostOverlay.querySelector('#btn-context-reload');
      reloadBtn?.addEventListener('click', () => window.location.reload());
    }
  };

  const hideContextLostOverlay = () => {
    if (contextLostOverlay) {
      contextLostOverlay.remove();
      contextLostOverlay = null;
    }
  };

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    showContextLostOverlay();
  });

  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    hideContextLostOverlay();
    handleResize();
    applyPresetState(currentPreset);
    applyViewModeState(currentViewMode);
    updateSimulation(simTime);
    renderFrame();
    lastNow = performance.now();
    if (rafId === null) {
      rafId = requestAnimationFrame(animate);
    }
  });

  // 10. Core Simulation Step & Render Function
  const updateSimulation = (t: number) => {
    atmosphere.update(t);
    roadAndReflections.update(t);
    buildings.update(t);
    viaductAndVehicles.update(t);
    propsAndLife.update(t);

    const tramPos = viaductAndVehicles.getTramPosition();
    const trainPos = viaductAndVehicles.getTrainPosition();
    const minibusPos = viaductAndVehicles.getMinibusPosition();
    weatherAndEffects.update(t, tramPos, trainPos, minibusPos);

    const rainAudio = ATMOSPHERE_PRESETS[currentPreset].rainAudioIntensity;
    soundscape.updateMotion(
      viaductAndVehicles.getTramProximity(),
      viaductAndVehicles.getTrainProximity(),
      rainAudio
    );
    if (!manualTimeLock) {
      soundscape.updateTrafficSignal(getHKSignalState(t));
    }
  };

  const clampPanTarget = () => {
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -16, 16);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.5, 9.5);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -16, 16);
  };

  const renderFrame = () => {
    if (contextLost) return;
    isRenderingFrame = true;
    clampPanTarget();
    controls.update();
    isRenderingFrame = false;
    renderer.info.reset();
    isComposerRendering = true;
    composer.render();
    isComposerRendering = false;
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
        const count = geom.index
          ? geom.index.count / 3
          : (geom.attributes.position?.count ?? 0) / 3;
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

  // 11. Main Animation Loop with FPS Tracking, Throttled Hover Raycast & Idle-Skip During Deterministic Lock
  let lastNow = performance.now();
  let fpsSmoothed = 60;

  const animate = (now: number) => {
    if (contextLost) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, Math.max(0.0001, (now - lastNow) / 1000));
    lastNow = now;
    fpsSmoothed = fpsSmoothed * 0.92 + (1 / dt) * 0.08;

    // Throttled at most once per animation frame, skipped while orbiting
    if (hoverDirty && !isOrbiting) {
      hoverDirty = false;
      const vehicle = getInteractiveVehicleAtPointer(hoverClientX, hoverClientY);
      renderer.domElement.classList.toggle('pointer-hover', vehicle !== null);
    }

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
  rafId = requestAnimationFrame(animate);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (!contextLost && rafId === null) {
      lastNow = performance.now();
      rafId = requestAnimationFrame(animate);
    }
  });

  // 12. Expose Deterministic Inspection & Automation Controller Hook
  let ctrlRenderPending = false;
  const flushCtrlRender = () => {
    if (ctrlRenderPending || needsLockedRender) {
      ctrlRenderPending = false;
      needsLockedRender = false;
      renderFrame();
    }
  };
  const scheduleCtrlRender = () => {
    needsLockedRender = true;
    if (!ctrlRenderPending) {
      ctrlRenderPending = true;
      queueMicrotask(flushCtrlRender);
    }
  };

  window.__SCENE_CTRL__ = {
    setPreset: (preset) => {
      applyPresetState(preset);
      scheduleCtrlRender();
    },
    setCamera: (view, instant = true) => {
      applyCameraView(view, instant);
      scheduleCtrlRender();
    },
    setCameraPose: (pos, target, zoom) => {
      isTransitioningCam = false;
      followTram = false;
      camera.position.set(pos[0], pos[1], pos[2]);
      controls.target.set(target[0], target[1], target[2]);
      if (zoom !== undefined) {
        camera.zoom = zoom;
      }
      camera.updateProjectionMatrix();
      isRenderingFrame = true;
      controls.update();
      isRenderingFrame = false;
      scheduleCtrlRender();
    },
    setMode: (mode) => {
      applyViewModeState(mode);
      scheduleCtrlRender();
    },
    setPrintEdgesVisible: (visible) => {
      weatherAndEffects.setPrintEdgesVisible(visible);
      scheduleCtrlRender();
    },
    getPrintEdgeSVG: (width, height, opts) => {
      flushCtrlRender();
      return weatherAndEffects.getPrintEdgeSVG(camera, renderer, width, height, opts);
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
      scheduleCtrlRender();
    },
    resumeAuto: () => {
      manualTimeLock = false;
    },
    ringBell: () => {
      triggerTramBell();
      updateSimulation(simTime);
      scheduleCtrlRender();
    },
    triggerAllVehiclePulses: () => {
      weatherAndEffects.triggerBellPulse(viaductAndVehicles.getTramPosition(), simTime);
      const mbP = viaductAndVehicles.minibusGroup.position;
      weatherAndEffects.triggerBellPulse(new THREE.Vector3(mbP.x, 1.4, mbP.z), simTime, {
        followTram: false,
        colorA: 0x58e8a8,
        colorB: 0xffd274
      });
      const txP = viaductAndVehicles.taxiGroup.position;
      weatherAndEffects.triggerBellPulse(new THREE.Vector3(txP.x, 0.8, txP.z), simTime, {
        followTram: false,
        colorA: 0xff6b5c,
        colorB: 0xffc864
      });
      updateSimulation(simTime);
      scheduleCtrlRender();
    },
    setHudVisible: (visible) => {
      hud.setVisible(visible);
    },
    getDiagnostics: () => {
      flushCtrlRender();
      return {
        glError: gl.getError(),
        drawCalls: lastSceneDrawCalls,
        triangles: sceneTriangleCount,
        meshCount: sceneMeshCount,
        lang: hud.getLang(),
        preset: currentPreset,
        mode: currentViewMode,
        cameraView: currentCameraView,
        soundState: soundscape.getSoundState(),
        fps: Math.round(fpsSmoothed),
        simTime,
        ready: true
      };
    }
  };
}

function boot(): void {
  try {
    bootScene();
  } catch (err) {
    console.error('TRAMLINE MIST failed to initialize WebGL2:', err);
    showWebGLFallback();
  }
}

// Defer heavy procedural texture + WebGL shader synthesis by 2 frames so #boot-veil paints immediately
requestAnimationFrame(() => {
  requestAnimationFrame(boot);
});
