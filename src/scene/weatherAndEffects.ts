import * as THREE from 'three';
import type { ViewMode } from '../ui/hud';
import { applyRadialMistFade, type RadialMistUniforms } from './atmosphere';
import { createRippleTexture } from './textures';

interface RainSeed {
  x: number;
  y0: number;
  z: number;
  speed: number;
  len: number;
}

interface RippleItem {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  x: number;
  z: number;
  period: number;
  phase: number;
  maxScale: number;
}

interface PetalSeed {
  origin: THREE.Vector3;
  offsetAngle: number;
  radius: number;
  speed: number;
  phase: number;
}

interface BellPulse {
  origin: THREE.Vector3;
  followTram: boolean;
  startTime: number;
  ringA: THREE.Mesh;
  ringB: THREE.Mesh;
  matA: THREE.MeshBasicMaterial;
  matB: THREE.MeshBasicMaterial;
}

interface SteamWisp {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  dx: number;
  dz: number;
  period: number;
  phase: number;
  baseScale: number;
  curlAmp: number;
  rotSpeed: number;
}

export interface BellPulseOptions {
  followTram?: boolean;
  colorA?: number;
  colorB?: number;
}

export interface WeatherAndEffectsSystem {
  group: THREE.Group;
  setRainOpacity: (opacity: number) => void;
  setViewMode: (mode: ViewMode) => void;
  triggerBellPulse: (origin: THREE.Vector3, simTime: number, pulseOpts?: BellPulseOptions) => void;
  update: (simTime: number, tramPos: THREE.Vector3, trainPos: THREE.Vector3) => void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Soft organic curling steam-wisp sprite texture with strict circular zero-alpha
 * envelope by r = 0.43 * S so rising noodle-shop steam never shows hard quad edges.
 */
function createSteamWispTexture(): THREE.CanvasTexture {
  const S = 128;
  const rand = mulberry32(9951);
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);

  const core = ctx.createRadialGradient(S * 0.5, S * 0.5, 2, S * 0.5, S * 0.5, S * 0.36);
  core.addColorStop(0, 'rgba(255, 246, 232, 0.78)');
  core.addColorStop(0.45, 'rgba(255, 238, 214, 0.38)');
  core.addColorStop(0.82, 'rgba(232, 236, 242, 0.08)');
  core.addColorStop(1, 'rgba(232, 236, 242, 0.0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);

  // Soft wispy off-center billowing sub-puffs strictly inside safe circular radius
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + rand() * 0.6;
    const dist = (0.06 + rand() * 0.12) * S;
    const cx = S * 0.5 + Math.cos(ang) * dist;
    const cy = S * 0.5 + Math.sin(ang) * dist;
    const rad = (0.14 + rand() * 0.10) * S;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
    g.addColorStop(0, 'rgba(255, 248, 236, 0.32)');
    g.addColorStop(0.6, 'rgba(255, 240, 222, 0.10)');
    g.addColorStop(1, 'rgba(255, 240, 222, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Strict circular alpha mask hitting exact 0.0 by r = 0.43 * S
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.10, S * 0.5, S * 0.5, S * 0.43);
  mask.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  mask.addColorStop(0.60, 'rgba(255, 255, 255, 0.58)');
  mask.addColorStop(0.88, 'rgba(255, 255, 255, 0.10)');
  mask.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createWeatherAndEffects(
  scene: THREE.Scene,
  opts: {
    mistUniforms: RadialMistUniforms;
    neonPositions: THREE.Vector3[];
    bauhiniaCenters: THREE.Vector3[];
    printTargetGroups: {
      buildings: THREE.Group;
      viaductAndVehicles: THREE.Group;
      props: THREE.Group;
      road: THREE.Group;
      tramGroup: THREE.Group;
      taxiGroup: THREE.Group;
    };
  }
): WeatherAndEffectsSystem {
  const group = new THREE.Group();
  group.name = 'WeatherAndEffectsGroup';
  const rand = mulberry32(202608);

  // =========================================================================
  // 1. DELICATE TAPERED GLSL DIAGONAL RAIN STREAKS (~620 silky streaks fading softly into mist)
  // =========================================================================
  const RAIN_COUNT = 620;
  const rainSeeds: RainSeed[] = [];
  const rainPositions = new Float32Array(RAIN_COUNT * 2 * 3);
  const rainEnds = new Float32Array(RAIN_COUNT * 2);

  for (let i = 0; i < RAIN_COUNT; i++) {
    rainSeeds.push({
      x: (rand() - 0.5) * 44,
      y0: rand() * 19,
      z: (rand() - 0.5) * 44,
      speed: 13.0 + rand() * 5.2,
      len: 0.46 + rand() * 0.38
    });
    // Top tail = 0.0 (transparent), falling tip = 1.0 (soft luminous droplet glint)
    rainEnds[i * 2] = 0.0;
    rainEnds[i * 2 + 1] = 1.0;
  }

  const rainGeom = new THREE.BufferGeometry();
  rainGeom.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainGeom.setAttribute('aEnd', new THREE.BufferAttribute(rainEnds, 1));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0x9cb8d4) },
      uOpacity: { value: 0.16 }
    },
    vertexShader: /* glsl */ `
      attribute float aEnd;
      varying float vEnd;
      varying float vRadialFade;
      void main() {
        vEnd = aEnd;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float dist = length(wp.xz);
        vRadialFade = 1.0 - smoothstep(14.5, 25.0, dist);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vEnd;
      varying float vRadialFade;
      void main() {
        float taper = pow(clamp(vEnd, 0.0, 1.0), 1.65);
        float alpha = uOpacity * taper * vRadialFade;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
  const rainLines = new THREE.LineSegments(rainGeom, rainMat);
  rainLines.frustumCulled = false;
  rainLines.renderOrder = 9;
  group.add(rainLines);

  // =========================================================================
  // 2. SOFT CONCENTRIC EXPANDING WET PUDDLE RIPPLES ON ROAD (y = 0.045)
  // =========================================================================
  const rippleGroup = new THREE.Group();
  rippleGroup.name = 'PuddleRipples';
  const rippleTex = createRippleTexture();
  const rippleGeom = new THREE.PlaneGeometry(1.0, 1.0);
  rippleGeom.rotateX(-Math.PI / 2);

  const ripples: RippleItem[] = [];
  for (let i = 0; i < 34; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: rippleTex,
      color: 0xa4c4de,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(rippleGeom, mat);
    const rx = (rand() - 0.5) * 8.8;
    const rz = (rand() - 0.5) * 26.0;
    mesh.position.set(rx, 0.045, rz);
    mesh.renderOrder = 5;
    rippleGroup.add(mesh);
    ripples.push({
      mesh,
      mat,
      x: rx,
      z: rz,
      period: 1.15 + rand() * 1.15,
      phase: rand() * 4.0,
      maxScale: 0.34 + rand() * 0.38
    });
  }
  group.add(rippleGroup);

  // =========================================================================
  // 3. GENTLY DRIFTING BAUHINIA (洋紫荊) BLOSSOM PETALS
  // =========================================================================
  const PETAL_COUNT = 48;
  const petalSeeds: PetalSeed[] = [];
  const petalGeom = new THREE.PlaneGeometry(0.09, 0.06);
  const petalMat = new THREE.MeshBasicMaterial({
    color: 0xf0adc8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  const petalInst = new THREE.InstancedMesh(petalGeom, petalMat, PETAL_COUNT);
  petalInst.renderOrder = 7;

  const centers =
    opts.bauhiniaCenters.length > 0
      ? opts.bauhiniaCenters
      : [new THREE.Vector3(-8.6, 2.9, 12.0)];

  for (let i = 0; i < PETAL_COUNT; i++) {
    const origin = centers[i % centers.length].clone();
    petalSeeds.push({
      origin,
      offsetAngle: rand() * Math.PI * 2,
      radius: 0.35 + rand() * 2.1,
      speed: 0.48 + rand() * 0.42,
      phase: rand() * 10.0
    });
  }
  group.add(petalInst);

  // =========================================================================
  // 3B. GENTLY RISING WARM-LIT NOODLE-SHOP STEAM WISPS (熱氣騰騰雲吞麵檔白煙)
  // Curling softly up from outside 明記雲吞麵 (x = -6.2, y = 1.6..3.8, z = 0.45)
  // =========================================================================
  const steamGroup = new THREE.Group();
  steamGroup.name = 'NoodleShopSteamWisps';
  const steamTex = createSteamWispTexture();
  const steamWisps: SteamWisp[] = [];
  const STEAM_ORIGIN_X = -6.2;
  const STEAM_ORIGIN_Z = 0.45;
  const STEAM_COUNT = 10;

  for (let i = 0; i < STEAM_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: steamTex,
      color: new THREE.Color(0xffe4be),
      transparent: true,
      opacity: 0.24,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 8;
    steamGroup.add(sprite);
    steamWisps.push({
      sprite,
      mat,
      dx: (rand() - 0.5) * 0.42,
      dz: (rand() - 0.5) * 1.15,
      period: 3.4 + rand() * 1.8,
      phase: (i / STEAM_COUNT) * 4.2 + rand() * 0.8,
      baseScale: 0.48 + rand() * 0.24,
      curlAmp: 0.16 + rand() * 0.16,
      rotSpeed: (rand() - 0.5) * 0.55
    });
  }
  group.add(steamGroup);

  // =========================================================================
  // 4. [A] ACOUSTIC FIELD MODE — TRANSLUCENT 3D SOUND WAVEFRONT RINGS
  // =========================================================================
  const acousticGroup = new THREE.Group();
  acousticGroup.name = 'AcousticFieldGroup';
  acousticGroup.visible = false;

  const waveRingGeom = new THREE.RingGeometry(0.92, 1.0, 48);
  const flatWaveGeom = waveRingGeom.clone();
  flatWaveGeom.rotateX(-Math.PI / 2);

  // Neon transformer 50Hz hum micro-rings around every projecting HK neon sign
  const neonWaveRings: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    origin: THREE.Vector3;
    phase: number;
  }> = [];
  opts.neonPositions.forEach((pos, idx) => {
    const colorHex = idx % 3 === 0 ? 0xff7896 : idx % 3 === 1 ? 0x62e8ff : 0xffbe5c;
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(flatWaveGeom, mat);
    ring.position.copy(pos);
    ring.renderOrder = 10;
    acousticGroup.add(ring);
    neonWaveRings.push({ mesh: ring, mat, origin: pos.clone(), phase: idx * 0.72 });
  });

  // Tram ambient rail-hum & periodic acoustic ring + Train steel viaduct resonance ring
  const tramHumRings: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; offset: number }> = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffcc64,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(flatWaveGeom, mat);
    mesh.renderOrder = 10;
    acousticGroup.add(mesh);
    tramHumRings.push({ mesh, mat, offset: i / 3 });
  }

  const trainHumRings: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; offset: number }> = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x76e0ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(flatWaveGeom, mat);
    mesh.renderOrder = 10;
    acousticGroup.add(mesh);
    trainHumRings.push({ mesh, mat, offset: i / 3 });
  }

  // Puddle acoustic rain-impact rings (elevated delicate cyan-white sound blooms)
  const rainAcousticRings: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    x: number;
    z: number;
    phase: number;
    period: number;
  }> = [];
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9de6ff,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(flatWaveGeom, mat);
    const rx = (rand() - 0.5) * 8.6;
    const rz = (rand() - 0.5) * 20.0;
    mesh.position.set(rx, 0.14, rz);
    mesh.renderOrder = 10;
    acousticGroup.add(mesh);
    rainAcousticRings.push({
      mesh,
      mat,
      x: rx,
      z: rz,
      phase: rand() * 3.0,
      period: 1.6 + rand() * 0.9
    });
  }

  group.add(acousticGroup);

  // Interactive Tram Bell ("叮叮!") Double-Ding Golden Wavefront Pool (visible in BOTH Diorama & Acoustic modes!)
  const bellBurstGroup = new THREE.Group();
  bellBurstGroup.name = 'TramBellWaveBursts';
  group.add(bellBurstGroup);
  const activeBellPulses: BellPulse[] = [];

  const triggerBellPulse = (origin: THREE.Vector3, simTime: number, pulseOpts?: BellPulseOptions) => {
    const followTram = pulseOpts?.followTram ?? true;
    const makeBellRing = (hex: number) => {
      const mat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(flatWaveGeom, mat);
      ring.position.set(origin.x, origin.y + 1.4, origin.z);
      ring.renderOrder = 11;
      bellBurstGroup.add(ring);
      return { ring, mat };
    };

    const a = makeBellRing(pulseOpts?.colorA ?? 0xffdc78);
    const b = makeBellRing(pulseOpts?.colorB ?? 0xffa942);
    activeBellPulses.push({
      origin: origin.clone(),
      followTram,
      startTime: simTime,
      ringA: a.ring,
      ringB: b.ring,
      matA: a.mat,
      matB: b.mat
    });
  };

  // =========================================================================
  // 4B. GLIDING RAIN-MIST URBAN PIGEONS (雨霧飛鳥) & EAVE RAIN DRIPS (屋檐滴水)
  // =========================================================================
  const birdsGroup = new THREE.Group();
  birdsGroup.name = 'RainMistPigeons';
  const birdBodyMat = new THREE.MeshStandardMaterial({
    color: 0xd8e2ec,
    roughness: 0.70,
    metalness: 0.05
  });
  const birdWingMat = new THREE.MeshStandardMaterial({
    color: 0x465868,
    roughness: 0.66,
    side: THREE.DoubleSide
  });

  interface BirdEntry {
    root: THREE.Group;
    wingL: THREE.Group;
    wingR: THREE.Group;
    cx: number;
    cz: number;
    rx: number;
    rz: number;
    baseY: number;
    speed: number;
    phase: number;
  }

  const birds: BirdEntry[] = [];
  const birdConfigs = [
    { cx: -0.8, cz: -2.4, rx: 10.5, rz: 7.4, baseY: 11.4, speed: 0.24, phase: 0.4 },
    { cx: -0.2, cz: -1.8, rx: 11.2, rz: 7.9, baseY: 11.8, speed: 0.24, phase: 0.62 },
    { cx: 1.5, cz: -3.2, rx: 9.6, rz: 6.8, baseY: 10.7, speed: 0.24, phase: 0.86 }
  ];

  const wingGeom = new THREE.PlaneGeometry(0.35, 0.17);
  for (const cfg of birdConfigs) {
    const bRoot = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.32, 6), birdBodyMat);
    body.rotation.x = Math.PI / 2;
    bRoot.add(body);

    const wingL = new THREE.Group();
    wingL.position.set(-0.035, 0.012, 0);
    const wingLMesh = new THREE.Mesh(wingGeom, birdWingMat);
    wingLMesh.rotation.x = -Math.PI / 2;
    wingLMesh.position.set(-0.175, 0, 0);
    wingL.add(wingLMesh);
    bRoot.add(wingL);

    const wingR = new THREE.Group();
    wingR.position.set(0.035, 0.012, 0);
    const wingRMesh = new THREE.Mesh(wingGeom, birdWingMat);
    wingRMesh.rotation.x = -Math.PI / 2;
    wingRMesh.position.set(0.175, 0, 0);
    wingR.add(wingRMesh);
    bRoot.add(wingR);

    birdsGroup.add(bRoot);
    birds.push({ root: bRoot, wingL, wingR, ...cfg });
  }
  group.add(birdsGroup);

  // Delicate falling water beads dripping off 金鳳冰室 striped awning edge & elevated viaduct drain spouts
  interface EaveDripSeed {
    x: number;
    yTop: number;
    yBot: number;
    z: number;
    period: number;
    phase: number;
  }
  const dripSeeds: EaveDripSeed[] = [];
  // Cha Chaan Teng east & south striped awning edges (y = 2.86 -> 0.18)
  for (let i = 0; i < 8; i++) {
    dripSeeds.push({
      x: -6.28,
      yTop: 2.84,
      yBot: 0.18,
      z: 4.35 + i * 0.68,
      period: 1.05 + rand() * 0.65,
      phase: rand() * 2.0
    });
  }
  for (let i = 0; i < 6; i++) {
    dripSeeds.push({
      x: -11.45 + i * 0.92,
      yTop: 2.84,
      yBot: 0.18,
      z: 9.85,
      period: 1.10 + rand() * 0.70,
      phase: rand() * 2.0
    });
  }
  // Viaduct south deck drainage spouts (y = 5.42 -> 0.06)
  for (const vx of [-11.5, -5.2, 0.4, 5.1, 10.6, 15.8]) {
    dripSeeds.push({
      x: vx,
      yTop: 5.42,
      yBot: 0.08,
      z: -1.72,
      period: 1.25 + rand() * 0.65,
      phase: rand() * 2.5
    });
  }

  const dripMat = new THREE.MeshBasicMaterial({
    color: 0xcfe4f6,
    transparent: true,
    opacity: 0.48,
    depthWrite: false
  });
  const dripGeom = new THREE.CylinderGeometry(0.012, 0.018, 0.16, 5);
  const eaveDripsInst = new THREE.InstancedMesh(dripGeom, dripMat, dripSeeds.length);
  eaveDripsInst.renderOrder = 8;
  group.add(eaveDripsInst);

  // =========================================================================
  // 5. [P] ARCHIVAL AXONOMETRIC PRINT MODE (Xuan Paper #F4EFE6 + Prussian/Pine/Cinnabar Ink)
  // =========================================================================
  const savedMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const savedVisibility = new Map<THREE.Object3D, boolean>();
  let printEdgesGroup: THREE.Group | null = null;
  let printModeActive = false;

  const xuanPaperMat = new THREE.MeshBasicMaterial({
    color: 0xf4efe6,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
  });
  const xuanWarmTintMat = new THREE.MeshBasicMaterial({
    color: 0xebe3d4,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
  });
  applyRadialMistFade(xuanWarmTintMat, opts.mistUniforms, {
    innerR: 17.0,
    outerR: 25.0,
    fadeAlpha: false
  });
  const xuanCinnabarTintMat = new THREE.MeshBasicMaterial({
    color: 0xf3e4dc,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
  });
  const inkPrussianMat = new THREE.LineBasicMaterial({ color: 0x1e3a5c, transparent: true, opacity: 0.84 });
  const inkPineSootMat = new THREE.LineBasicMaterial({ color: 0x262d34, transparent: true, opacity: 0.72 });
  const inkCinnabarMat = new THREE.LineBasicMaterial({ color: 0xb83b2e, transparent: true, opacity: 0.92 });
  applyRadialMistFade(inkPrussianMat, opts.mistUniforms, {
    innerR: 16.5,
    outerR: 24.5,
    fadeAlpha: true
  });
  applyRadialMistFade(inkPineSootMat, opts.mistUniforms, {
    innerR: 16.0,
    outerR: 24.0,
    fadeAlpha: true
  });
  applyRadialMistFade(inkCinnabarMat, opts.mistUniforms, {
    innerR: 17.5,
    outerR: 25.5,
    fadeAlpha: true
  });

  const isInsideAncestor = (obj: THREE.Object3D, ancestor: THREE.Object3D): boolean => {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur === ancestor) return true;
      cur = cur.parent;
    }
    return false;
  };

  const hasSkipPrintEdges = (obj: THREE.Object3D): boolean => {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.userData && cur.userData.skipPrintEdges === true) return true;
      cur = cur.parent;
    }
    return false;
  };

  const buildOrShowPrintMode = (enable: boolean) => {
    if (enable === printModeActive) return;
    printModeActive = enable;

    const { buildings, viaductAndVehicles, props, road, tramGroup, taxiGroup } =
      opts.printTargetGroups;
    const allTargets = [buildings, viaductAndVehicles, props, road];

    if (enable) {
      savedMaterials.clear();
      savedVisibility.clear();

      if (!printEdgesGroup) {
        printEdgesGroup = new THREE.Group();
        printEdgesGroup.name = 'ArchivalPrintInkLines';
        scene.add(printEdgesGroup);
      }
      // Properly dispose old LineSegments geometries before rebuilding (zero GPU memory leak!)
      while (printEdgesGroup.children.length > 0) {
        const ch = printEdgesGroup.children[0];
        if (ch instanceof THREE.LineSegments) {
          ch.geometry.dispose();
        }
        printEdgesGroup.remove(ch);
      }

      for (const root of allTargets) {
        root.updateMatrixWorld(true);
        root.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;

          // Override ExtendedGroundPlane to pure spotless Xuan paper (#F4EFE6) without edges!
          if (obj.name === 'ExtendedGroundPlane') {
            savedMaterials.set(obj, obj.material);
            obj.material = xuanPaperMat;
            return;
          }

          // Skip reflector, shadow decals, puddle glows, and volumetric light cones
          const singleMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
          const isDecalOrBeam =
            obj.name === 'PlanarWetRoadReflector' ||
            singleMat instanceof THREE.ShaderMaterial ||
            (singleMat instanceof THREE.MeshBasicMaterial && singleMat.transparent);

          if (isDecalOrBeam) {
            if (obj.name !== 'PlanarWetRoadReflector') {
              savedVisibility.set(obj, obj.visible);
              obj.visible = false;
            }
            return;
          }

          savedMaterials.set(obj, obj.material);

          const isHeroAccent = isInsideAncestor(obj, tramGroup) || isInsideAncestor(obj, taxiGroup);
          const isRoadOrRail = isInsideAncestor(obj, road);

          if (obj instanceof THREE.InstancedMesh) {
            obj.material = xuanWarmTintMat;
            return;
          }

          obj.material = isHeroAccent
            ? xuanCinnabarTintMat
            : isRoadOrRail
            ? xuanPaperMat
            : xuanWarmTintMat;

          // Generate crisp architectural ink edges on primary solid meshes
          // (respect userData.skipPrintEdges on meshes & parent groups so archival engraving stays clean!)
          if (
            obj.geometry &&
            obj.name !== 'WetAsphaltRoad' &&
            obj.name !== 'SidewalkOuterDeck' &&
            !hasSkipPrintEdges(obj)
          ) {
            const edgesGeom = new THREE.EdgesGeometry(obj.geometry, 26);
            if (edgesGeom.attributes.position && edgesGeom.attributes.position.count > 0) {
              const lineMat = isHeroAccent
                ? inkCinnabarMat
                : isRoadOrRail
                ? inkPineSootMat
                : inkPrussianMat;
              const edgeLine = new THREE.LineSegments(edgesGeom, lineMat);
              edgeLine.matrixAutoUpdate = false;
              edgeLine.matrix.copy(obj.matrixWorld);
              edgeLine.userData.sourceMesh = obj;
              printEdgesGroup!.add(edgeLine);
            } else {
              edgesGeom.dispose();
            }
          }
        });
      }
      printEdgesGroup.visible = true;
    } else {
      for (const [mesh, origMat] of savedMaterials.entries()) {
        mesh.material = origMat;
      }
      savedMaterials.clear();

      for (const [obj, vis] of savedVisibility.entries()) {
        obj.visible = vis;
      }
      savedVisibility.clear();

      if (printEdgesGroup) {
        printEdgesGroup.visible = false;
      }
    }
  };

  let currentViewMode: ViewMode = 'diorama';
  let currentRainBaseOpacity = 0.16;

  const setViewMode = (mode: ViewMode) => {
    currentViewMode = mode;
    acousticGroup.visible = mode === 'acoustic';
    const isPrint = mode === 'print';
    rainLines.visible = !isPrint;
    rippleGroup.visible = !isPrint;
    petalInst.visible = !isPrint;
    steamGroup.visible = !isPrint;
    bellBurstGroup.visible = !isPrint;
    birdsGroup.visible = !isPrint;
    eaveDripsInst.visible = !isPrint;
    buildOrShowPrintMode(isPrint);
  };

  const dummy = new THREE.Object3D();
  const steamWarmColor = new THREE.Color(0xffe4bc);
  const steamCoolColor = new THREE.Color(0xd2e2f0);

  const update = (simTime: number, tramPos: THREE.Vector3, trainPos: THREE.Vector3) => {
    // 1. Update delicate diagonal falling rain streaks deterministically from simTime
    if (rainLines.visible) {
      const posAttr = rainGeom.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const s = rainSeeds[i];
        const y = ((s.y0 - simTime * s.speed) % 19.0 + 19.0) % 19.0;
        const idx = i * 6;
        arr[idx] = s.x;
        arr[idx + 1] = y + s.len;
        arr[idx + 2] = s.z;
        arr[idx + 3] = s.x - s.len * 0.20;
        arr[idx + 4] = y;
        arr[idx + 5] = s.z + s.len * 0.06;
      }
      posAttr.needsUpdate = true;
    }

    // 2. Update wet road puddle ripples
    if (rippleGroup.visible) {
      for (const rp of ripples) {
        const t = (((simTime + rp.phase) % rp.period) + rp.period) % rp.period;
        const u = t / rp.period;
        const sc = 0.14 + u * rp.maxScale;
        rp.mesh.scale.set(sc, 1, sc);
        rp.mat.opacity = Math.sin(u * Math.PI) * 0.13 * Math.min(1.45, currentRainBaseOpacity / 0.16);
      }
    }

    // 3. Update gently drifting Bauhinia petals
    if (petalInst.visible) {
      for (let i = 0; i < PETAL_COUNT; i++) {
        const p = petalSeeds[i];
        const cycle = 5.5;
        const u = (((simTime * p.speed + p.phase) % cycle) + cycle) % cycle / cycle;
        const px = p.origin.x + Math.cos(p.offsetAngle + simTime * 0.4) * p.radius + Math.sin(simTime * 1.4 + p.phase) * 0.4;
        const py = p.origin.y + 0.5 - u * (p.origin.y - 0.22);
        const pz = p.origin.z + Math.sin(p.offsetAngle + simTime * 0.35) * p.radius + u * 0.85;
        dummy.position.set(px, py, pz);
        dummy.rotation.set(simTime * 1.8 + p.phase, simTime * 1.3, simTime * 0.9);
        const fadeScale = Math.sin(u * Math.PI);
        dummy.scale.setScalar(0.5 + fadeScale * 0.7);
        dummy.updateMatrix();
        petalInst.setMatrixAt(i, dummy.matrix);
      }
      petalInst.instanceMatrix.needsUpdate = true;
    }

    // 3B. Update rising warm-lit noodle-shop steam wisps deterministically from simTime
    if (steamGroup.visible) {
      for (const w of steamWisps) {
        const t = (((simTime + w.phase) % w.period) + w.period) % w.period;
        const u = t / w.period; // 0 -> 1 as wisp rises from y = 1.6 to y = 3.8
        const curlX = Math.sin(u * Math.PI * 2.0 + w.phase) * w.curlAmp + u * 0.28;
        const curlZ = Math.cos(u * Math.PI * 1.6 + w.phase * 1.3) * (w.curlAmp * 0.85) + u * 0.14;
        w.sprite.position.set(
          STEAM_ORIGIN_X + w.dx + curlX,
          1.6 + u * 2.2,
          STEAM_ORIGIN_Z + w.dz + curlZ
        );
        const sc = w.baseScale * (0.68 + u * 1.48);
        w.sprite.scale.set(sc, sc * 1.12, 1);
        w.mat.rotation = w.phase + simTime * w.rotSpeed;
        // Soft warm amber-cream near awning transitioning smoothly into cool rainy mist aloft
        w.mat.color.copy(steamWarmColor).lerp(steamCoolColor, u * 0.65);
        const fadeEnv = Math.sin(u * Math.PI) * (1.0 - u * 0.28);
        w.mat.opacity = fadeEnv * 0.28;
      }
    }

    // 3C. Update gliding rain-mist urban pigeons (flap-and-glide bank above viaduct)
    if (birdsGroup.visible) {
      for (const b of birds) {
        const ang = simTime * b.speed + b.phase;
        const bx = b.cx + Math.cos(ang) * b.rx;
        const bz = b.cz + Math.sin(ang) * b.rz;
        const by = b.baseY + Math.sin(ang * 2.0 + b.phase) * 0.65;
        const vx = -Math.sin(ang) * b.rx;
        const vz = Math.cos(ang) * b.rz;
        b.root.position.set(bx, by, bz);
        b.root.rotation.set(0, Math.atan2(vx, vz), -0.18);
        // Alternating brisk wingbeat bursts + soaring glide
        const glideEnv = Math.max(0.18, Math.sin(simTime * 1.3 + b.phase * 3.0) * 0.5 + 0.5);
        const flap = Math.sin(simTime * 11.5 + b.phase * 7.0) * 0.62 * glideEnv;
        b.wingL.rotation.z = -flap;
        b.wingR.rotation.z = flap;
      }
    }

    // 3D. Update falling eave rain drips (gravity-accelerated droplets off awnings & viaduct spouts)
    if (eaveDripsInst.visible) {
      for (let i = 0; i < dripSeeds.length; i++) {
        const d = dripSeeds[i];
        const t = (((simTime + d.phase) % d.period) + d.period) % d.period;
        const u = t / d.period;
        // Brief hanging bead pause (0..0.28), then smooth quadratic gravity drop (0.28..1.0)
        const fallU = u < 0.28 ? 0 : (u - 0.28) / 0.72;
        const dy = d.yTop - fallU * fallU * (d.yTop - d.yBot);
        dummy.position.set(d.x, dy, d.z);
        dummy.rotation.set(0, 0, 0);
        const sy = u < 0.28 ? 0.35 + u * 1.4 : 0.75 + fallU * 0.95;
        const sxz = u < 0.28 ? 0.95 : 0.65;
        dummy.scale.set(sxz, sy, sxz);
        dummy.updateMatrix();
        eaveDripsInst.setMatrixAt(i, dummy.matrix);
      }
      eaveDripsInst.instanceMatrix.needsUpdate = true;
    }

    // 4. Update [A] Acoustic Field wavefront rings
    if (currentViewMode === 'acoustic') {
      for (const nw of neonWaveRings) {
        const u = (((simTime * 0.68 + nw.phase) % 1.0) + 1.0) % 1.0;
        const r = 0.35 + u * 2.15;
        nw.mesh.position.copy(nw.origin);
        nw.mesh.scale.set(r, 1, r);
        nw.mat.opacity = (1 - u) * (1 - u) * 0.56;
      }

      for (const tw of tramHumRings) {
        const u = (((simTime * 0.52 + tw.offset) % 1.0) + 1.0) % 1.0;
        const r = 0.85 + u * 5.2;
        tw.mesh.position.set(tramPos.x, 0.24, tramPos.z);
        tw.mesh.scale.set(r, 1, r);
        tw.mat.opacity = (1 - u) * 0.52;
      }

      for (const rw of trainHumRings) {
        const u = (((simTime * 0.62 + rw.offset) % 1.0) + 1.0) % 1.0;
        const r = 1.0 + u * 4.8;
        rw.mesh.position.set(trainPos.x, trainPos.y - 0.9, trainPos.z);
        rw.mesh.scale.set(r, 1, r);
        rw.mat.opacity = (1 - u) * 0.44;
      }

      for (const aw of rainAcousticRings) {
        const u = ((((simTime + aw.phase) % aw.period) + aw.period) % aw.period) / aw.period;
        const r = 0.25 + u * 1.9;
        aw.mesh.position.set(aw.x, 0.14 + u * 0.55, aw.z);
        aw.mesh.scale.set(r, 1, r);
        aw.mat.opacity = (1 - u) * 0.36;
      }
    }

    // 5. Update Interactive Tram Bell Double-Ding Wavefront Pulses ("叮-叮!")
    for (let i = activeBellPulses.length - 1; i >= 0; i--) {
      const bp = activeBellPulses[i];
      const dtA = simTime - bp.startTime;
      const dtB = dtA - 0.17; // Classic double-ding interval
      const dur = 1.65;

      if (dtA < 0 || dtA > dur + 0.25) {
        bellBurstGroup.remove(bp.ringA);
        bellBurstGroup.remove(bp.ringB);
        bp.matA.dispose();
        bp.matB.dispose();
        activeBellPulses.splice(i, 1);
        continue;
      }

      const px = bp.followTram ? tramPos.x : bp.origin.x;
      const py = bp.followTram ? 3.6 : bp.origin.y + 1.0;
      const pz = bp.followTram ? tramPos.z : bp.origin.z;

      const uA = Math.min(1, Math.max(0, dtA / dur));
      const rA = 0.45 + uA * (bp.followTram ? 8.2 : 5.4);
      bp.ringA.position.set(px, py + uA * 0.5, pz);
      bp.ringA.scale.set(rA, 1, rA);
      bp.matA.opacity = (1 - uA) * (1 - uA) * 0.92;

      if (dtB >= 0 && dtB <= dur) {
        const uB = dtB / dur;
        const rB = 0.45 + uB * (bp.followTram ? 7.8 : 5.0);
        bp.ringB.visible = true;
        bp.ringB.position.set(px, py + 0.3 + uB * 0.5, pz);
        bp.ringB.scale.set(rB, 1, rB);
        bp.matB.opacity = (1 - uB) * (1 - uB) * 0.88;
      } else {
        bp.ringB.visible = false;
      }
    }

    // 6. Keep dynamic vehicle & walking pedestrian edges synced during Print Mode
    if (printModeActive && printEdgesGroup) {
      opts.printTargetGroups.viaductAndVehicles.updateMatrixWorld(true);
      opts.printTargetGroups.props.updateMatrixWorld(true);
      for (const ch of printEdgesGroup.children) {
        const src = ch.userData.sourceMesh as THREE.Mesh | undefined;
        if (src) {
          ch.matrix.copy(src.matrixWorld);
        }
      }
    }
  };

  scene.add(group);

  return {
    group,
    setRainOpacity: (opacity) => {
      currentRainBaseOpacity = opacity;
      rainMat.uniforms.uOpacity.value = opacity;
    },
    setViewMode,
    triggerBellPulse,
    update
  };
}
